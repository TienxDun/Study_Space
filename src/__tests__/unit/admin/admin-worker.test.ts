import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import worker, {
  __resetAccessCertsCache,
  __resetErrorLogThrottle,
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

function stubBackend(): FetchCall[] {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, headers: new Headers(init?.headers) });
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
  return calls;
}

type FakeDb = {
  db: AdminEnv["DB"];
  queries: string[];
  chatBinds: unknown[][];
  inserts: unknown[][];
};

type FakeR2 = {
  bucket: AdminEnv["R2"];
  calls: Array<string | undefined>;
};

function fakeR2(
  options: { pages?: number[][]; totalPages?: number; fail?: boolean } = {},
): FakeR2 {
  const pages = options.pages ?? [[]];
  const totalPages = options.totalPages ?? pages.length;
  const calls: Array<string | undefined> = [];
  let index = 0;

  const bucket = {
    async list(input?: { limit?: number; cursor?: string }) {
      calls.push(input?.cursor);
      if (options.fail) throw new Error("R2 không phản hồi");
      const sizes = pages[Math.min(index, pages.length - 1)] || [];
      index += 1;
      const isLast = index >= totalPages;
      return {
        objects: sizes.map((size) => ({ key: "study/scene.mp4", size })),
        truncated: !isLast,
        cursor: isLast ? undefined : `page-${index}`,
      };
    },
  };

  return { bucket: bucket as unknown as AdminEnv["R2"], calls };
}

function fakeDb(
  options: {
    fail?: boolean;
    failChat?: boolean;
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
          if (options.failChat && query.includes("FROM chat_usage")) {
            throw new Error("D1 không phản hồi");
          }
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
      "chat-v2",
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
      baseEnv({ LIVEKIT_URL: "", CHAT_V2_URL: "" }),
    );
    const body = (await res.json()) as {
      ok: boolean;
      checks: Array<{ name: string; ok: boolean }>;
    };

    expect(body.ok).toBe(false);
    expect(body.checks.find((c) => c.name === "chat-v2")?.ok).toBe(false);
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
    stubBackend();
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
      dailyLimit: 30,
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
      chatDaily: 30,
      snapshotMaxBytes: 2_000_000,
      r2: "10 GB",
      r2Bytes: 10_000_000_000,
    });
    expect(body.errors).toEqual({ ok: true, items: [] });
    expect(body.r2).toEqual({ ok: true, bytes: 0, objects: 0, partial: false });

    expect(fake.queries.some((q) => q.includes("FROM chat_usage"))).toBe(true);
    expect(fake.chatBinds[0]?.[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(JSON.stringify(body)).not.toContain("super-secret-token");
  });

  it("hạn mức chat lấy từ KV cfg:flags, cùng nguồn Worker chat v2 đang chặn", async () => {
    stubBackend();
    const fake = fakeDb({ chat: { total: 3, users: 1 } });
    const kv = fakeKv({
      "cfg:flags": JSON.stringify({ chatDailyLimit: 45 }),
    });

    const res = await worker.fetch(
      await overviewRequest(),
      baseEnv({ DB: fake.db, FLAGS: kv.kv }),
    );
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.chat.dailyLimit).toBe(45);
    expect(body.limits.chatDaily).toBe(45);
    expect(body.flags.chatDailyLimit).toBe(45);
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

  it("KV lỗi thì dùng hạn mức mặc định và báo degraded", async () => {
    stubBackend();
    const fake = fakeDb({ chat: { total: 1, users: 1 } });

    const res = await worker.fetch(
      await overviewRequest(),
      baseEnv({ DB: fake.db, FLAGS: fakeKv({}, { failGet: true }).kv }),
    );
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.chat).toMatchObject({ ok: true, dailyLimit: 30 });
    expect(body.flags).toEqual({ ok: false, error: "kv_error" });
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
    stubBackend();
    const fake = fakeDb({ failChat: true });

    await worker.fetch(await overviewRequest(), baseEnv({ DB: fake.db }));
    await worker.fetch(await overviewRequest(), baseEnv({ DB: fake.db }));

    const chatRows = fake.inserts.filter((row) => row[0] === "chat");
    expect(chatRows).toHaveLength(1);
    expect(chatRows[0]?.[1]).toBe("d1_error");
    expect(String(chatRows[0]?.[2])).toContain("d1_error");
    expect(String(chatRows[0]?.[2])).not.toContain("hỏng");
  });

  it("cộng dung lượng và số object qua nhiều trang R2", async () => {
    stubBackend();
    const fake = fakeDb();
    const r2 = fakeR2({ pages: [Array(1000).fill(10), Array(500).fill(20)] });

    const res = await worker.fetch(
      await overviewRequest(),
      baseEnv({ DB: fake.db, R2: r2.bucket }),
    );
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.r2).toEqual({
      ok: true,
      bytes: 1000 * 10 + 500 * 20,
      objects: 1500,
      partial: false,
    });
    expect(body.degraded).toBe(false);
    expect(r2.calls).toHaveLength(2);
  });

  it("thiếu binding R2 thì báo missing_binding và bật degraded", async () => {
    stubBackend();
    const fake = fakeDb();

    const res = await worker.fetch(
      await overviewRequest(),
      baseEnv({ DB: fake.db, R2: undefined }),
    );
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.r2).toEqual({ ok: false, error: "missing_binding" });
    expect(body.degraded).toBe(true);
    expect(fake.inserts.some((row) => row[0] === "r2")).toBe(true);
  });

  it("R2 list lỗi thì báo r2_error, degraded và không làm hỏng API", async () => {
    stubBackend();
    const fake = fakeDb();
    const r2 = fakeR2({ fail: true });

    const res = await worker.fetch(
      await overviewRequest(),
      baseEnv({ DB: fake.db, R2: r2.bucket }),
    );
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.r2).toEqual({ ok: false, error: "r2_error" });
    expect(body.degraded).toBe(true);
    expect(
      fake.inserts.some((row) => row[0] === "r2" && row[1] === "r2_error"),
    ).toBe(true);
  });

  it("cache R2 60 giây: hai lần overview chỉ list một lần", async () => {
    stubBackend();
    const fake = fakeDb();
    const r2 = fakeR2({ pages: [[7, 3]] });

    await worker.fetch(
      await overviewRequest(),
      baseEnv({ DB: fake.db, R2: r2.bucket }),
    );
    await worker.fetch(
      await overviewRequest(),
      baseEnv({ DB: fake.db, R2: r2.bucket }),
    );

    expect(r2.calls).toHaveLength(1);
  });

  it("chạm trần 30 trang thì partial và không bật degraded", async () => {
    stubBackend();
    const fake = fakeDb();
    const r2 = fakeR2({
      pages: Array.from({ length: 30 }, () => Array(1000).fill(1)),
      totalPages: 31,
    });

    const res = await worker.fetch(
      await overviewRequest(),
      baseEnv({ DB: fake.db, R2: r2.bucket }),
    );
    const body = (await res.json()) as any;

    expect(body.r2).toEqual({
      ok: true,
      bytes: 30_000,
      objects: 30_000,
      partial: true,
    });
    expect(body.degraded).toBe(false);
    expect(r2.calls).toHaveLength(30);
  });
});
