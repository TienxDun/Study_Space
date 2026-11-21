import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import worker, {
  __resetAccessCertsCache,
  __resetErrorLogThrottle,
  __resetFlagWriteLog,
  __resetR2Cache,
  type AdminEnv,
} from "../../../../admin-worker/_worker";
import {
  ADMIN_EMAIL,
  CERT_URL,
  accessRequest,
  baseEnv,
  certsResponse,
  createKeyPair,
  exportJwk,
  fakeKv,
  makeToken,
  validClaims,
} from "./access-fixtures";

let pair: CryptoKeyPair;
let jwk: JsonWebKey;

beforeAll(async () => {
  pair = await createKeyPair();
  jwk = await exportJwk(pair);
});

beforeEach(() => {
  __resetAccessCertsCache();
  __resetErrorLogThrottle();
  __resetR2Cache();
  __resetFlagWriteLog();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubBackend(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === CERT_URL) return certsResponse([jwk]);
      if (url.endsWith("/health")) return jsonResponse({ ok: true });
      if (url.endsWith("/usage")) {
        return jsonResponse({
          month: "2026-10",
          usedMinutes: 12,
          limitMinutes: 4500,
          roomsOpen: 1,
          participants: 3,
        });
      }
      throw new Error(`fetch ngoài dự kiến: ${url}`);
    }),
  );
}

type FakeDb = { db: AdminEnv["DB"]; events: string[]; failAudit?: boolean };

function fakeDb(options: { failAudit?: boolean } = {}): FakeDb {
  const events: string[] = [];
  const db = {
    prepare(query: string) {
      let bound: unknown[] = [];
      const stmt = {
        bind(...values: unknown[]) {
          bound = values;
          return stmt;
        },
        async run() {
          if (query.includes("INSERT INTO admin_audit")) {
            if (options.failAudit) throw new Error("D1 lỗi");
            events.push("audit");
          }
          return {};
        },
        async first() {
          if (query.includes("FROM chat_usage")) return { total: 0, users: 0 };
          if (query.includes("FROM user_data")) return { users: 0, lastAt: null, maxBytes: 0 };
          if (query.includes("FROM admin_error_log")) return null;
          return null;
        },
        async all() {
          void bound;
          return { results: [] };
        },
      };
      return stmt;
    },
  };
  return { db: db as unknown as AdminEnv["DB"], events };
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    chatEnabled: true,
    roomsEnabled: true,
    maintenance: false,
    banner: "",
    chatDailyLimit: 35,
    ...overrides,
  };
}

async function callFlags(
  env: AdminEnv,
  options: { token?: string; method?: string; body?: unknown } = {},
) {
  const token = options.token ?? (await makeToken(pair.privateKey, validClaims()));
  const method = options.method ?? "POST";
  const res = await worker.fetch(
    new Request("https://admin.zenstudy.space/api/admin/flags", {
      method,
      headers: { "Cf-Access-Jwt-Assertion": token, "Content-Type": "application/json" },
      body:
        method === "POST"
          ? JSON.stringify(options.body === undefined ? validBody() : options.body)
          : undefined,
    }),
    env,
  );
  return { status: res.status, body: (await res.json()) as any };
}

async function callOverview(env: AdminEnv) {
  const token = await makeToken(pair.privateKey, validClaims());
  const res = await worker.fetch(accessRequest(token, "/api/admin/overview"), env);
  return { status: res.status, body: (await res.json()) as any };
}

describe("admin flags — đọc", () => {
  it("chưa có cờ trong KV thì overview trả mặc định bật và hạn mức hiệu lực", async () => {
    stubBackend();
    const { body } = await callOverview(baseEnv({ DB: fakeDb().db, FLAGS: fakeKv().kv }));

    expect(body.flags).toEqual({
      ok: true,
      chatEnabled: true,
      roomsEnabled: true,
      maintenance: false,
      banner: "",
      chatDailyLimit: 30,
      updatedAt: 0,
      updatedBy: "",
    });
    expect(body.degraded).toBe(false);
  });

  it("đọc đúng cờ đã lưu, kể cả hạn mức riêng", async () => {
    stubBackend();
    const kv = fakeKv({
      "cfg:flags": JSON.stringify({
        chatEnabled: false,
        roomsEnabled: false,
        maintenance: true,
        banner: "Bảo trì 30 phút",
        chatDailyLimit: 45,
        updatedAt: 1_760_000_000_000,
        updatedBy: ADMIN_EMAIL,
      }),
    });

    const { body } = await callOverview(baseEnv({ DB: fakeDb().db, FLAGS: kv.kv }));

    expect(body.flags).toMatchObject({
      ok: true,
      chatEnabled: false,
      roomsEnabled: false,
      maintenance: true,
      banner: "Bảo trì 30 phút",
      chatDailyLimit: 45,
      updatedAt: 1_760_000_000_000,
      updatedBy: ADMIN_EMAIL,
    });
  });

  it("thiếu binding KV thì flags đỏ, degraded và ghi log flags", async () => {
    stubBackend();
    const db = fakeDb();
    const { body } = await callOverview(baseEnv({ DB: db.db, FLAGS: undefined }));

    expect(body.flags).toEqual({ ok: false, error: "missing_binding" });
    expect(body.degraded).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(db.events).not.toContain("audit");
  });

  it("JSON hỏng thì báo invalid_json thay vì đoán cờ", async () => {
    stubBackend();
    const kv = fakeKv({ "cfg:flags": "{hỏng" });
    const { body } = await callOverview(baseEnv({ DB: fakeDb().db, FLAGS: kv.kv }));

    expect(body.flags).toEqual({ ok: false, error: "invalid_json" });
    expect(body.degraded).toBe(true);
  });
});

describe("admin flags — ghi", () => {
  it("lưu thành công: audit trước, put sau, trả cờ mới", async () => {
    stubBackend();
    const db = fakeDb();
    const kv = fakeKv({}, { onPut: () => db.events.push("put") });

    const { status, body } = await callFlags(baseEnv({ DB: db.db, FLAGS: kv.kv }));

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.flags).toMatchObject({
      chatEnabled: true,
      roomsEnabled: true,
      maintenance: false,
      banner: "",
      chatDailyLimit: 35,
      updatedBy: ADMIN_EMAIL,
    });
    expect(body.flags.updatedAt).toBeGreaterThan(0);
    expect(db.events).toEqual(["audit", "put"]);
    expect(kv.puts).toHaveLength(1);
    expect(kv.puts[0].key).toBe("cfg:flags");
    expect(JSON.parse(kv.puts[0].value)).toMatchObject({ chatDailyLimit: 35 });
  });

  it("audit lỗi thì trả 500 và không ghi KV", async () => {
    stubBackend();
    const db = fakeDb({ failAudit: true });
    const kv = fakeKv();

    const { status, body } = await callFlags(baseEnv({ DB: db.db, FLAGS: kv.kv }));

    expect(status).toBe(500);
    expect(body).toEqual({ error: "audit_failed" });
    expect(kv.puts).toHaveLength(0);
  });

  it("KV put lỗi thì trả kv_error nhưng dòng audit vẫn còn", async () => {
    stubBackend();
    const db = fakeDb();
    const kv = fakeKv({}, { failPut: true });

    const { status, body } = await callFlags(baseEnv({ DB: db.db, FLAGS: kv.kv }));

    expect(status).toBe(500);
    expect(body).toEqual({ error: "kv_error" });
    expect(db.events).toEqual(["audit"]);
  });

  it.each([
    ["thiếu trường", { chatEnabled: true, roomsEnabled: true, maintenance: false, banner: "" }],
    ["sai kiểu boolean", validBody({ chatEnabled: "true" })],
    ["banner 141 ký tự", validBody({ banner: "x".repeat(141) })],
    ["banner có ký tự điều khiển", validBody({ banner: "tốt\u0000xấu" })],
    ["hạn mức 0", validBody({ chatDailyLimit: 0 })],
    ["hạn mức 201", validBody({ chatDailyLimit: 201 })],
    ["hạn mức 30.5", validBody({ chatDailyLimit: 30.5 })],
    ["hạn mức dạng chuỗi", validBody({ chatDailyLimit: "35" })],
  ])("body không hợp lệ (%s) → 400 invalid_body, không ghi gì", async (_label, body) => {
    stubBackend();
    const db = fakeDb();
    const kv = fakeKv();

    const res = await callFlags(baseEnv({ DB: db.db, FLAGS: kv.kv }), { body });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "invalid_body" });
    expect(db.events).toHaveLength(0);
    expect(kv.puts).toHaveLength(0);
  });

  it("thiếu JWT → 401 và không ghi gì", async () => {
    stubBackend();
    const db = fakeDb();
    const kv = fakeKv();

    const res = await worker.fetch(
      new Request("https://admin.zenstudy.space/api/admin/flags", {
        method: "POST",
        body: JSON.stringify(validBody()),
      }),
      baseEnv({ DB: db.db, FLAGS: kv.kv }),
    );

    expect(res.status).toBe(401);
    expect(db.events).toHaveLength(0);
    expect(kv.puts).toHaveLength(0);
  });

  it("GET → 405", async () => {
    stubBackend();
    const { status } = await callFlags(baseEnv({ DB: fakeDb().db, FLAGS: fakeKv().kv }), {
      method: "GET",
      body: null,
    });

    expect(status).toBe(405);
  });

  it("quá 10 lần ghi mỗi phút thì trả 429", async () => {
    stubBackend();
    const env = baseEnv({ DB: fakeDb().db, FLAGS: fakeKv().kv });

    for (let i = 0; i < 10; i += 1) {
      const res = await callFlags(env);
      expect(res.status).toBe(200);
    }
    const blocked = await callFlags(env);

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: "rate_limited" });
  });
});
