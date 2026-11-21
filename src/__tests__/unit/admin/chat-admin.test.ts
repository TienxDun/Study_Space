import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import worker, {
  __resetAccessCertsCache,
  type AdminEnv,
} from "../../../../admin-worker/_worker";
import {
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

type Row = Record<string, any>;

const CHAT_V2_URL = "https://chat-v2.example.com";

const CATALOG_PAYLOAD = {
  object: "list",
  count: 3,
  generatedAt: "2026-11-20T18:31:59.000Z",
  data: [
    {
      id: "motapis/qwen3-30b",
      displayName: "Qwen3 30B",
      ownedBy: "motapis",
      free: true,
      available: true,
      contextTokens: 131072,
      maxOutputTokens: 8192,
      priceIn: 0,
      priceOut: 0,
      priceSource: "models.dev",
      specSource: "models.js",
      checkedAt: "2026-11-20T18:31:59.000Z",
    },
    {
      id: "motapis/llama-4",
      displayName: "Llama 4",
      ownedBy: "motapis",
      free: false,
      available: false,
      contextTokens: 200000,
      priceIn: 0.27,
      priceOut: 0.85,
      checkedAt: "2026-11-20T18:31:59.000Z",
    },
    {
      id: "motapis/unchecked",
      available: null,
    },
    { id: "" },
    "rác",
  ],
};

function fakeDb(
  options: {
    today?: { total: number; users: number };
    series?: Row[];
    top?: Row[];
    disabled?: string[];
    fail?: boolean;
  } = {},
) {
  const prepare = (query: string) => {
    const q = query.replace(/\s+/g, " ").trim();
    let bound: unknown[] = [];
    const stmt = {
      bind(...values: unknown[]) {
        bound = values;
        return stmt;
      },
      async first() {
        if (options.fail) throw new Error("D1 lỗi");
        if (q.includes("FROM chat_usage") && q.includes("WHERE day = ?")) {
          return options.today || { total: 0, users: 0 };
        }
        return null;
      },
      async all() {
        if (options.fail) throw new Error("D1 lỗi");
        if (q.includes("GROUP BY day")) return { results: options.series || [] };
        if (q.startsWith("SELECT uid, count FROM chat_usage")) {
          return { results: options.top || [] };
        }
        if (q.startsWith("SELECT uid, ai_disabled FROM user_restrictions")) {
          const wanted = new Set(bound.map(String));
          const results = (options.disabled || [])
            .filter((uid) => wanted.has(uid))
            .map((uid) => ({ uid, ai_disabled: 1 }));
          return { results };
        }
        return { results: [] };
      },
    };
    return stmt;
  };
  return { prepare };
}

let pair: CryptoKeyPair;
let jwk: JsonWebKey;
let token: string;

beforeAll(async () => {
  pair = await createKeyPair();
  jwk = await exportJwk(pair);
  token = await makeToken(pair.privateKey, validClaims());
});

beforeEach(() => {
  __resetAccessCertsCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

type StubOptions = {
  catalog?: unknown;
  catalogStatus?: number;
  catalogThrows?: boolean;
  identities?: Record<string, { email: string; displayName: string }>;
};

function stubFetch(options: StubOptions = {}) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input instanceof Request ? input.url : input);
      calls.push(url);
      if (url === CERT_URL) return certsResponse([jwk]);
      if (url.endsWith("/models")) {
        if (options.catalogThrows) throw new Error("mất mạng");
        const status = options.catalogStatus ?? 200;
        const body = options.catalog === undefined ? CATALOG_PAYLOAD : options.catalog;
        return new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/admin/users/lookup")) {
        const uid = decodeURIComponent(/uid=([^&]+)/.exec(url)?.[1] || "");
        const found = options.identities?.[uid] || null;
        return new Response(
          JSON.stringify({ ok: true, user: found ? { uid, ...found } : null }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    }),
  );
  return calls;
}

function req(path: string, options: { method?: string; withToken?: boolean } = {}): Request {
  const base = accessRequest(options.withToken === false ? undefined : token, path);
  return new Request(base.url, {
    method: options.method || "GET",
    headers: options.withToken === false ? {} : { "Cf-Access-Jwt-Assertion": token },
  });
}

function envFor(
  db: ReturnType<typeof fakeDb> | null,
  overrides: Partial<AdminEnv> = {},
): AdminEnv {
  return baseEnv({
    CHAT_V2_URL,
    DB: (db || undefined) as unknown as AdminEnv["DB"],
    ...overrides,
  });
}

describe("Admin bước 3 — danh mục mô hình", () => {
  it("thiếu Access token thì 401", async () => {
    stubFetch();
    const res = await worker.fetch(
      req("/api/admin/chat/catalog", { withToken: false }),
      envFor(fakeDb()),
    );
    expect(res.status).toBe(401);
  });

  it("chuẩn hóa danh mục và đếm đúng", async () => {
    const calls = stubFetch();
    const res = await worker.fetch(req("/api/admin/chat/catalog"), envFor(fakeDb()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(calls).toContain(`${CHAT_V2_URL}/models`);
    expect(body.ok).toBe(true);
    expect(body.generatedAt).toBe("2026-11-20T18:31:59.000Z");
    expect(body.counts).toEqual({ total: 3, free: 1, unverified: 1, unavailable: 1 });
    expect(body.models[0]).toMatchObject({
      id: "motapis/qwen3-30b",
      displayName: "Qwen3 30B",
      provider: "motapis",
      free: true,
      contextTokens: 131072,
      priceIn: 0,
    });
    // Bản ghi thiếu id bị loại, displayName rỗng lấy id bù vào.
    expect(body.models[2]).toMatchObject({
      id: "motapis/unchecked",
      displayName: "motapis/unchecked",
      available: null,
      priceIn: null,
    });
    expect(body.models.some((model: Row) => model.id === "")).toBe(false);
  });

  it("thiếu CHAT_V2_URL thì 502 rõ lý do", async () => {
    stubFetch();
    const res = await worker.fetch(
      req("/api/admin/chat/catalog"),
      baseEnv({ CHAT_V2_URL: "" }),
    );
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("missing_chat_v2_url");
  });

  it("Worker chat-v2 lỗi HTTP, mất mạng hoặc trả rác đều được gắn mã lỗi", async () => {
    stubFetch({ catalogStatus: 503 });
    const http = await worker.fetch(req("/api/admin/chat/catalog"), envFor(fakeDb()));
    expect((await http.json()).error).toBe("chat_v2_503");

    vi.unstubAllGlobals();
    stubFetch({ catalogThrows: true });
    const offline = await worker.fetch(req("/api/admin/chat/catalog"), envFor(fakeDb()));
    expect((await offline.json()).error).toBe("chat_v2_unreachable");

    vi.unstubAllGlobals();
    stubFetch({ catalog: "oj" });
    const bad = await worker.fetch(req("/api/admin/chat/catalog"), envFor(fakeDb()));
    expect((await bad.json()).error).toBe("chat_v2_bad_payload");
  });

  it("chỉ nhận GET", async () => {
    stubFetch();
    const res = await worker.fetch(
      req("/api/admin/chat/catalog", { method: "POST" }),
      envFor(fakeDb()),
    );
    expect(res.status).toBe(405);
  });
});

describe("Admin bước 3 — mức sử dụng và hạn mức", () => {
  it("đọc số hôm nay, chuỗi 30 ngày, hạn mức mặc định và tên người dùng", async () => {
    stubFetch({
      identities: {
        "uid-an": { email: "an@example.com", displayName: "An" },
      },
    });
    const db = fakeDb({
      today: { total: 12, users: 3 },
      series: [
        { day: "2026-11-20", total: 4, users: 2 },
        { day: "2026-11-21", total: 12, users: 3 },
      ],
      top: [
        { uid: "uid-an", count: 6 },
        { uid: "uid-bi", count: 3 },
      ],
      disabled: ["uid-bi"],
    });

    const res = await worker.fetch(req("/api/admin/chat/usage"), envFor(db));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.days).toBe(30);
    expect(body.today).toEqual({ total: 12, users: 3 });
    expect(body.limit).toBe(30);
    expect(body.limitFromFlags).toBe(false);
    expect(body.series).toEqual([
      { day: "2026-11-20", total: 4, users: 2 },
      { day: "2026-11-21", total: 12, users: 3 },
    ]);
    expect(body.top[0]).toMatchObject({
      uid: "uid-an",
      count: 6,
      name: "An",
      email: "an@example.com",
      aiDisabled: false,
    });
    // Không tra được danh tính thì để trống, panel tự rơi về UID rút gọn.
    expect(body.top[1]).toMatchObject({
      uid: "uid-bi",
      name: "",
      email: "",
      aiDisabled: true,
    });
  });

  it("hạn mức đọc từ KV cfg:flags khi đã đặt", async () => {
    stubFetch();
    const kv = fakeKv({
      "cfg:flags": JSON.stringify({
        chatEnabled: true,
        roomsEnabled: true,
        maintenance: false,
        banner: "",
        chatDailyLimit: 45,
      }),
    });
    const res = await worker.fetch(
      req("/api/admin/chat/usage"),
      envFor(fakeDb(), { FLAGS: kv.kv }),
    );
    const body = await res.json();
    expect(body.limit).toBe(45);
    expect(body.limitFromFlags).toBe(true);
  });

  it("tham số days được kẹp trong 7..90, ngoài khoảng thì về 30", async () => {
    stubFetch();
    const db = fakeDb();
    const cases: Array<[string, number]> = [
      ["?days=3", 30],
      ["?days=45", 45],
      ["?days=200", 30],
      ["?days=abc", 30],
    ];
    for (const [query, expected] of cases) {
      const res = await worker.fetch(req("/api/admin/chat/usage" + query), envFor(db));
      expect((await res.json()).days).toBe(expected);
    }
  });

  it("thiếu D1 thì 503, D1 lỗi thì 500", async () => {
    stubFetch();
    const missing = await worker.fetch(req("/api/admin/chat/usage"), envFor(null));
    expect(missing.status).toBe(503);
    expect((await missing.json()).error).toBe("d1_unavailable");

    const broken = await worker.fetch(
      req("/api/admin/chat/usage"),
      envFor(fakeDb({ fail: true })),
    );
    expect(broken.status).toBe(500);
    expect((await broken.json()).error).toBe("d1_error");
  });

  it("chỉ nhận GET", async () => {
    stubFetch();
    const res = await worker.fetch(
      req("/api/admin/chat/usage", { method: "DELETE" }),
      envFor(fakeDb()),
    );
    expect(res.status).toBe(405);
  });
});
