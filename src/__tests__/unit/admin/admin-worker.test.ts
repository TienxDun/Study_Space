import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import worker, {
  __resetAccessCertsCache,
  __resetErrorLogThrottle,
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

type FetchCall = { url: string; headers: Headers };

function stubBackend(options: { statusCode?: number } = {}): FetchCall[] {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, headers: new Headers(init?.headers) });
      if (url === CERT_URL) return certsResponse([jwk]);
      if (url.endsWith("/status")) {
        if (options.statusCode) {
          return jsonResponse({ error: "hỏng" }, options.statusCode);
        }
        return jsonResponse({
          auth: { userDailyLimit: 25 },
        });
      }
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
  return calls;
}

type FakeDb = {
  db: AdminEnv["DB"];
  queries: string[];
  chatBinds: unknown[][];
  inserts: unknown[][];
};

function fakeDb(
  options: {
    fail?: boolean;
    failErrors?: boolean;
    chat?: { total: number; users: number };
    sync?: { users: number; lastAt: number | null; maxBytes: number };
    errors?: Array<{
      id: number;
      source: string;
      code: string;
      message: string;
      created_at: number;
    }>;
  } = {},
): FakeDb {
  const queries: string[] = [];
  const chatBinds: unknown[][] = [];
  const inserts: unknown[][] = [];
  const db = {
    prepare(query: string) {
      queries.push(query);
      let bound: unknown[] = [];
      const stmt = {
        bind(...values: unknown[]) {
          bound = values;
          if (query.includes("INSERT INTO admin_error_log")) inserts.push(values);
          return stmt;
        },
        async run() {
          return {};
        },
        async first() {
          if (options.fail) throw new Error("D1 không phản hồi");
          if (query.includes("FROM chat_usage")) {
            chatBinds.push(bound);
            return options.chat ?? { total: 0, users: 0 };
          }
          if (query.includes("FROM user_data")) {
            return options.sync ?? { users: 0, lastAt: null, maxBytes: 0 };
          }
          return null;
        },
        async all() {
          if (options.failErrors) throw new Error("D1 không phản hồi");
          return { results: options.errors ?? [] };
        },
      };
      return stmt;
    },
  };
  return { db: db as unknown as AdminEnv["DB"], queries, chatBinds, inserts };
}

describe("admin worker", () => {
  it("chuyển request không phải API cho ASSETS", async () => {
    const assetsFetch = vi.fn(async () => new Response("vo-shell"));
    const res = await worker.fetch(
      new Request("https://admin.zenstudy.space/admin/"),
      baseEnv({ ASSETS: { fetch: assetsFetch } }),
    );

    expect(await res.text()).toBe("vo-shell");
    expect(assetsFetch).toHaveBeenCalledTimes(1);
  });

  it("thiếu JWT thì trả 401 và không gọi backend", async () => {
    const calls = stubBackend();
    const res = await worker.fetch(accessRequest(), baseEnv());
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({ error: "Cần đăng nhập Cloudflare Access." });
    expect(calls).toHaveLength(0);
  });

  it("ping trả email, ba check và không lộ token", async () => {
    const calls = stubBackend();
    const token = await makeToken(pair.privateKey, validClaims());

    const res = await worker.fetch(accessRequest(token), baseEnv());
    const body = (await res.json()) as {
      ok: boolean;
      email: string;
      checks: Array<{ name: string; ok: boolean; ms: number }>;
      time: string;
    };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.email).toBe(ADMIN_EMAIL);
    expect(body.checks.map((check) => check.name)).toEqual([
      "chat-proxy",
      "data-api",
      "livekit",
    ]);
    expect(body.checks.every((check) => check.ok)).toBe(true);
    expect(typeof body.time).toBe("string");

    const livekitCall = calls.find((call) => call.url.endsWith("/usage"));
    expect(livekitCall?.url).toBe("https://livekit.example.com/usage");
    expect(livekitCall?.url).not.toContain("token=");
    expect(livekitCall?.headers.get("Authorization")).toBe(
      "Bearer super-secret-token",
    );

    const raw = JSON.stringify(body);
    expect(raw).not.toContain("super-secret-token");
    expect(raw).not.toContain(CERT_URL);
  });

  it("thiếu URL hoặc token thì check tương ứng fail, không gọi mạng", async () => {
    const calls = stubBackend();
    const token = await makeToken(pair.privateKey, validClaims());

    const res = await worker.fetch(
      accessRequest(token),
      baseEnv({ LIVEKIT_URL: "", CHAT_PROXY_URL: "" }),
    );
    const body = (await res.json()) as {
      ok: boolean;
      checks: Array<{ name: string; ok: boolean }>;
    };

    expect(body.ok).toBe(false);
    expect(body.checks.find((c) => c.name === "chat-proxy")?.ok).toBe(false);
    expect(body.checks.find((c) => c.name === "livekit")?.ok).toBe(false);
    expect(calls.some((call) => call.url === "https://livekit.example.com/usage")).toBe(
      false,
    );
  });

  it("backend trả 500 thì check fail nhưng API vẫn 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === CERT_URL) return certsResponse([jwk]);
        return jsonResponse({ error: "hỏng" }, 500);
      }),
    );
    const token = await makeToken(pair.privateKey, validClaims());

    const res = await worker.fetch(accessRequest(token), baseEnv());
    const body = (await res.json()) as {
      ok: boolean;
      checks: Array<{ name: string; ok: boolean }>;
    };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.checks.every((check) => !check.ok)).toBe(true);
  });

  it("ping chỉ nhận GET", async () => {
    stubBackend();
    const token = await makeToken(pair.privateKey, validClaims());
    const res = await worker.fetch(
      new Request("https://admin.zenstudy.space/api/admin/ping", {
        method: "POST",
        headers: { "Cf-Access-Jwt-Assertion": token },
      }),
      baseEnv(),
    );

    expect(res.status).toBe(405);
  });

  it("endpoint admin lạ trả 404 sau khi xác thực", async () => {
    stubBackend();
    const token = await makeToken(pair.privateKey, validClaims());
    const res = await worker.fetch(
      new Request("https://admin.zenstudy.space/api/admin/khong-co", {
        headers: { "Cf-Access-Jwt-Assertion": token },
      }),
      baseEnv(),
    );

    expect(res.status).toBe(404);
  });

  it("không có binding ASSETS thì trả 404 thay vì crash", async () => {
    const res = await worker.fetch(
      new Request("https://admin.zenstudy.space/admin/"),
      baseEnv(),
    );

    expect(res.status).toBe(404);
  });
});

describe("admin overview", () => {
  async function overviewRequest() {
    const token = await makeToken(pair.privateKey, validClaims());
    return accessRequest(token, "/api/admin/overview");
  }

  it("trả số liệu chat, sync, livekit và không lộ token", async () => {
    const calls = stubBackend();
    const fake = fakeDb({
      chat: { total: 42, users: 5 },
      sync: { users: 7, lastAt: 1_730_000_000_000, maxBytes: 1234 },
    });

    const res = await worker.fetch(
      await overviewRequest(),
      baseEnv({ DB: fake.db }),
    );
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.email).toBe(ADMIN_EMAIL);
    expect(body.degraded).toBe(false);
    expect(body.health.ok).toBe(true);
    expect(body.chat).toMatchObject({
      ok: true,
      total: 42,
      users: 5,
      dailyLimit: 25,
    });
    expect(body.chat.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.sync).toEqual({
      ok: true,
      users: 7,
      lastAt: 1_730_000_000_000,
      maxBytes: 1234,
    });
    expect(body.livekit).toEqual({
      ok: true,
      month: "2026-10",
      usedMinutes: 12,
      limitMinutes: 4500,
      roomsOpen: 1,
      participants: 3,
    });
    expect(body.limits).toEqual({
      chatDaily: 25,
      snapshotMaxBytes: 2_000_000,
      r2: "10 GiB",
    });
    expect(body.errors).toEqual({ ok: true, items: [] });

    const statusCall = calls.find((call) => call.url.endsWith("/status"));
    expect(statusCall?.headers.get("Authorization")).toBe(
      "Bearer super-secret-token",
    );
    expect(fake.queries.some((q) => q.includes("FROM chat_usage"))).toBe(true);
    expect(fake.chatBinds[0]?.[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(JSON.stringify(body)).not.toContain("super-secret-token");
  });

  it("thiếu binding DB thì chat/sync báo lỗi nhưng vẫn trả 200", async () => {
    stubBackend();

    const res = await worker.fetch(await overviewRequest(), baseEnv());
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.degraded).toBe(true);
    expect(body.health.ok).toBe(true);
    expect(body.chat).toEqual({ ok: false, error: "d1_unavailable" });
    expect(body.sync).toEqual({ ok: false, error: "d1_unavailable" });
  });

  it("D1 lỗi thì hạch toán là d1_error, không làm hỏng API", async () => {
    stubBackend();
    const fake = fakeDb({ fail: true });

    const res = await worker.fetch(
      await overviewRequest(),
      baseEnv({ DB: fake.db }),
    );
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.chat).toEqual({ ok: false, error: "d1_error" });
    expect(body.sync).toEqual({ ok: false, error: "d1_error" });
    expect(body.degraded).toBe(true);
  });

  it("chat-proxy lỗi thì dùng hạn mức mặc định và báo degraded", async () => {
    stubBackend({ statusCode: 500 });
    const fake = fakeDb({ chat: { total: 1, users: 1 } });

    const res = await worker.fetch(
      await overviewRequest(),
      baseEnv({ DB: fake.db }),
    );
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.chat).toEqual({ ok: false, error: "http_500" });
    expect(body.limits.chatDaily).toBe(30);
    expect(body.degraded).toBe(true);
  });

  it("overview chỉ nhận GET", async () => {
    stubBackend();
    const token = await makeToken(pair.privateKey, validClaims());
    const res = await worker.fetch(
      new Request("https://admin.zenstudy.space/api/admin/overview", {
        method: "POST",
        headers: { "Cf-Access-Jwt-Assertion": token },
      }),
      baseEnv(),
    );

    expect(res.status).toBe(405);
  });

  it("overview thiếu JWT thì trả 401", async () => {
    const calls = stubBackend();
    const res = await worker.fetch(
      accessRequest(undefined, "/api/admin/overview"),
      baseEnv(),
    );

    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("đọc nhật ký lỗi: trả đúng dòng và hỏi 20 dòng mới nhất", async () => {
    stubBackend();
    const fake = fakeDb({
      errors: [
        {
          id: 2,
          source: "chat-proxy",
          code: "all_busy",
          message: "Tất cả đường dự phòng đều bận hoặc đang nghỉ.",
          created_at: 1_730_000_500_000,
        },
        {
          id: 1,
          source: "chat",
          code: "d1_error",
          message: "Số liệu chat không lấy được (d1_error).",
          created_at: 1_730_000_000_000,
        },
      ],
    });

    const res = await worker.fetch(
      await overviewRequest(),
      baseEnv({ DB: fake.db }),
    );
    const body = (await res.json()) as any;

    expect(body.errors.ok).toBe(true);
    expect(body.errors.items).toEqual([
      {
        id: 2,
        source: "chat-proxy",
        code: "all_busy",
        message: "Tất cả đường dự phòng đều bận hoặc đang nghỉ.",
        createdAt: 1_730_000_500_000,
      },
      {
        id: 1,
        source: "chat",
        code: "d1_error",
        message: "Số liệu chat không lấy được (d1_error).",
        createdAt: 1_730_000_000_000,
      },
    ]);
    expect(
      fake.queries.some((q) => q.includes("ORDER BY created_at DESC LIMIT")),
    ).toBe(true);
  });

  it("không đọc được nhật ký lỗi thì errors đỏ, degraded bật, trang vẫn 200", async () => {
    stubBackend();
    const fake = fakeDb({ failErrors: true });

    const res = await worker.fetch(
      await overviewRequest(),
      baseEnv({ DB: fake.db }),
    );
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.errors).toEqual({ ok: false, error: "d1_error" });
    expect(body.degraded).toBe(true);
    expect(fake.inserts.some((row) => row[0] === "errors")).toBe(true);
  });

  it("thiếu binding DB thì errors báo d1_unavailable", async () => {
    stubBackend();

    const res = await worker.fetch(await overviewRequest(), baseEnv());
    const body = (await res.json()) as any;

    expect(body.errors).toEqual({ ok: false, error: "d1_unavailable" });
  });

  it("cùng một lỗi chỉ ghi 1 dòng trong vòng 1 giờ và không chép body thô", async () => {
    stubBackend({ statusCode: 500 });
    const fake = fakeDb();

    await worker.fetch(await overviewRequest(), baseEnv({ DB: fake.db }));
    await worker.fetch(await overviewRequest(), baseEnv({ DB: fake.db }));

    const chatRows = fake.inserts.filter((row) => row[0] === "chat");
    expect(chatRows).toHaveLength(1);
    expect(chatRows[0]?.[1]).toBe("http_500");
    expect(String(chatRows[0]?.[2])).toContain("http_500");
    expect(String(chatRows[0]?.[2])).not.toContain("hỏng");
  });
});
