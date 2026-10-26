import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import worker, {
  __resetAccessCertsCache,
  __resetChatWriteLog,
  mapChatConfig,
  type AdminEnv,
} from "../../../../admin-worker/_worker";
import {
  ADMIN_EMAIL,
  CERT_URL,
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
  __resetChatWriteLog();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const CHAT = "https://chat.example.com";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function configPayload(overrides: Record<string, unknown> = {}) {
  return {
    current: "qwen3-30b",
    available: [
      { key: "qwen3-30b", label: "Qwen3 30B", context: 32768 },
      { key: "llama-4", label: "Llama 4" },
    ],
    chain: [{ provider: "cf", modelId: "qwen3-30b" }],
    maxChain: 5,
    providers: [
      {
        id: "groq-1",
        type: "groq",
        label: "Groq",
        baseUrl: "https://api.groq.com/openai/v1",
        apiKey: "***abcd",
        enabled: true,
      },
    ],
    presets: {
      groq: { label: "Groq", baseUrl: "https://api.groq.com/openai/v1" },
      custom: { label: "Khác" },
    },
    prompt: "Bạn là trợ lý học tập.",
    gen: { temperature: 0.7, max_tokens: 1200 },
    ...overrides,
  };
}

type ProxyCall = { url: string; init?: RequestInit };

function stubChat(payload: Record<string, unknown> = configPayload()) {
  const calls: ProxyCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url === CERT_URL) return certsResponse([jwk]);
      if (url.startsWith(`${CHAT}/models`) && (init?.method || "GET") === "POST") {
        return jsonResponse({ ok: true });
      }
      if (url.startsWith(`${CHAT}/models`)) return jsonResponse(payload);
      if (url.startsWith(`${CHAT}/providers/check`)) {
        return jsonResponse({ ok: true, type: "groq", baseUrl: "https://api.groq.com", count: 2, models: ["a", "b"] });
      }
      if (url.startsWith(`${CHAT}/providers/models`)) {
        return jsonResponse({ ok: true, count: 1, models: ["m-1"] });
      }
      if (url.startsWith(`${CHAT}/chat`)) {
        return jsonResponse({ text: "Chào bạn.", provider: "cf", model: "qwen3-30b" });
      }
      throw new Error(`fetch ngoài dự kiến: ${url}`);
    }),
  );
  return calls;
}

function fakeDb(options: { failAudit?: boolean } = {}) {
  const events: string[] = [];
  const audits: Array<{ values: unknown[] }> = [];
  const db = {
    prepare(query: string) {
      const stmt = {
        bind(...values: unknown[]) {
          (stmt as unknown as { values: unknown[] }).values = values;
          return stmt;
        },
        async run() {
          if (query.includes("INSERT INTO admin_audit")) {
            if (options.failAudit) throw new Error("D1 lỗi");
            events.push("audit");
            audits.push({ values: (stmt as unknown as { values: unknown[] }).values });
          }
          return {};
        },
        async first() {
          return null;
        },
        async all() {
          return { results: [] };
        },
      };
      return stmt;
    },
  };
  return { db: db as unknown as AdminEnv["DB"], events, audits };
}

async function call(
  env: AdminEnv,
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
) {
  const token =
    options.token === null
      ? undefined
      : await makeToken(pair.privateKey, validClaims());
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Cf-Access-Jwt-Assertion"] = token;
  const res = await worker.fetch(
    new Request(`https://admin.zenstudy.space${path}`, {
      method: options.method || "GET",
      headers,
      body:
        options.method && options.method !== "GET" && options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
    }),
    env,
  );
  return { status: res.status, body: (await res.json()) as any };
}

describe("chat config — đọc", () => {
  it("trả cấu hình đã che key cho trình duyệt", async () => {
    stubChat();
    const { status, body } = await call(baseEnv(), "/api/admin/chat/config");

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.config.current).toBe("qwen3-30b");
    expect(body.config.providers[0].apiKey).toBe("***abcd");
    expect(body.config.prompt).toContain("trợ lý");
    expect(body.config.gen).toEqual({ temperature: 0.7, max_tokens: 1200 });
    expect(JSON.stringify(body)).not.toContain("super-secret-token");
  });

  it("chat-proxy trả key thật thì cắt bỏ, không đưa xuống trình duyệt", () => {
    const mapped = mapChatConfig({
      providers: [
        { id: "groq-1", type: "groq", baseUrl: "https://api.groq.com", apiKey: "sk-real", enabled: true },
      ],
    });
    expect(mapped.providers[0].apiKey).toBe("");
    expect(JSON.stringify(mapped)).not.toContain("sk-real");
  });

  it("thiếu CHAT_PROXY_URL hoặc ADMIN_TOKEN → 502 missing_config", async () => {
    stubChat();
    const { status, body } = await call(
      baseEnv({ ADMIN_TOKEN: "" }),
      "/api/admin/chat/config",
    );
    expect(status).toBe(502);
    expect(body.error).toBe("missing_config");
  });

  it("thiếu JWT → 401", async () => {
    stubChat();
    const { status } = await call(baseEnv(), "/api/admin/chat/config", { token: null });
    expect(status).toBe(401);
  });
});

describe("chat config — ghi", () => {
  it("lưu model: audit trước, gọi chat-proxy sau, audit không chứa key", async () => {
    const calls = stubChat();
    const db = fakeDb();
    const { status, body } = await call(baseEnv({ DB: db.db }), "/api/admin/chat/config", {
      method: "POST",
      body: { kind: "model", cfModel: "llama-4" },
    });

    expect(status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(db.events).toEqual(["audit"]);
    expect(db.audits[0].values[0]).toBe(ADMIN_EMAIL);
    expect(db.audits[0].values[1]).toBe("chat.config.update");
    expect(db.audits[0].values[2]).toBe("cfg:cfModel");
    expect(JSON.parse(String(db.audits[0].values[3]))).toEqual({
      before: "qwen3-30b",
      after: "llama-4",
    });

    const write = calls.find((c) => c.url.startsWith(`${CHAT}/models`) && c.init?.method === "POST");
    expect(write).toBeTruthy();
    expect(JSON.parse(String(write?.init?.body))).toEqual({ cfModel: "llama-4" });
    expect(db.events).toEqual(["audit"]);
  });

  it("audit lỗi → 500 audit_failed và không gọi chat-proxy", async () => {
    const calls = stubChat();
    const db = fakeDb({ failAudit: true });
    const { status, body } = await call(baseEnv({ DB: db.db }), "/api/admin/chat/config", {
      method: "POST",
      body: { kind: "model", cfModel: "llama-4" },
    });

    expect(status).toBe(500);
    expect(body).toEqual({ error: "audit_failed" });
    expect(calls.some((c) => c.init?.method === "POST")).toBe(false);
  });

  it("lưu prompt chỉ ghi độ dài vào audit, không ghi nội dung", async () => {
    stubChat();
    const db = fakeDb();
    const prompt = "Hướng dẫn mới: trả lời ngắn gọn.";
    const { status } = await call(baseEnv({ DB: db.db }), "/api/admin/chat/config", {
      method: "POST",
      body: { kind: "prompt", prompt },
    });

    expect(status).toBe(200);
    expect(db.audits[0].values[2]).toBe("cfg:prompt");
    const detail = String(db.audits[0].values[3]);
    expect(detail).not.toContain("Hướng dẫn mới");
    expect(JSON.parse(detail)).toEqual({
      beforeChars: "Bạn là trợ lý học tập.".length,
      afterChars: prompt.length,
    });
  });

  it("lưu hãng mới: audit chỉ có id/địa chỉ, không có key", async () => {
    stubChat();
    const db = fakeDb();
    const { status } = await call(baseEnv({ DB: db.db }), "/api/admin/chat/config", {
      method: "POST",
      body: {
        kind: "providers",
        providers: [
          {
            id: "groq-1",
            type: "groq",
            label: "Groq",
            baseUrl: "https://api.groq.com/openai/v1",
            apiKey: "***abcd",
            enabled: true,
          },
          {
            id: "gem-1",
            type: "custom",
            label: "Gemini",
            baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
            apiKey: "sk-new-secret",
            enabled: true,
          },
        ],
      },
    });

    expect(status).toBe(200);
    const detail = String(db.audits[0].values[3]);
    expect(detail).not.toContain("sk-new-secret");
    expect(detail).not.toContain("***abcd");
    expect(JSON.parse(detail).after).toEqual([
      { id: "groq-1", type: "groq", baseUrl: "https://api.groq.com/openai/v1", enabled: true },
      {
        id: "gem-1",
        type: "custom",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
        enabled: true,
      },
    ]);
  });

  it.each([
    ["model không có trong danh sách", { kind: "model", cfModel: "khong-co" }],
    ["nhiệt độ quá cao", { kind: "gen", temperature: 3, max_tokens: 1200 }],
    ["token quá thấp", { kind: "gen", temperature: 0.5, max_tokens: 100 }],
    ["prompt rỗng", { kind: "prompt", prompt: "   " }],
    ["prompt quá dài", { kind: "prompt", prompt: "x".repeat(4001) }],
    ["chain rỗng", { kind: "chain", chain: [] }],
    [
      "chain 6 đường",
      {
        kind: "chain",
        chain: Array.from({ length: 6 }, () => ({ provider: "cf", modelId: "qwen3-30b" })),
      },
    ],
    ["chain trỏ hãng lạ", { kind: "chain", chain: [{ provider: "khong-co", modelId: "m" }] }],
    ["chain model cf lạ", { kind: "chain", chain: [{ provider: "cf", modelId: "khong-co" }] }],
    [
      "hãng địa chỉ không https",
      {
        kind: "providers",
        providers: [{ id: "x-1", type: "custom", baseUrl: "http://x.test", apiKey: "k", enabled: true }],
      },
    ],
    [
      "hãng dùng mặt nạ nhưng chưa tồn tại",
      {
        kind: "providers",
        providers: [{ id: "moi-1", type: "custom", baseUrl: "https://x.test", apiKey: "***abcd", enabled: true }],
      },
    ],
    [
      "hãng trùng id",
      {
        kind: "providers",
        providers: [
          { id: "a-1", type: "custom", baseUrl: "https://a.test", apiKey: "k", enabled: true },
          { id: "a-1", type: "custom", baseUrl: "https://b.test", apiKey: "k", enabled: true },
        ],
      },
    ],
    ["kind lạ", { kind: "khac" }],
  ])("body không hợp lệ (%s) → 400, không audit, không ghi", async (_label, body) => {
    const calls = stubChat();
    const db = fakeDb();
    const { status, body: resBody } = await call(baseEnv({ DB: db.db }), "/api/admin/chat/config", {
      method: "POST",
      body,
    });

    expect(status).toBe(400);
    expect(resBody).toEqual({ error: "invalid_body" });
    expect(db.events).toHaveLength(0);
    expect(calls.some((c) => c.init?.method === "POST")).toBe(false);
  });

  it("quá 10 lần ghi mỗi phút → 429", async () => {
    stubChat();
    const env = baseEnv({ DB: fakeDb().db });
    for (let i = 0; i < 10; i += 1) {
      const res = await call(env, "/api/admin/chat/config", {
        method: "POST",
        body: { kind: "model", cfModel: "llama-4" },
      });
      expect(res.status).toBe(200);
    }
    const blocked = await call(env, "/api/admin/chat/config", {
      method: "POST",
      body: { kind: "model", cfModel: "llama-4" },
    });
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: "rate_limited" });
  });

  it("GET không ghi gì; DELETE → 405", async () => {
    stubChat();
    const db = fakeDb();
    const res = await call(baseEnv({ DB: db.db }), "/api/admin/chat/config", { method: "DELETE" });
    expect(res.status).toBe(405);
    expect(db.events).toHaveLength(0);
  });
});

describe("chat — thử key và thử model", () => {
  it("thử key: chuyển tiếp và không trả key về trình duyệt", async () => {
    const calls = stubChat();
    const { status, body } = await call(baseEnv(), "/api/admin/chat/check-key", {
      method: "POST",
      body: { type: "groq", baseUrl: "https://api.groq.com/openai/v1", apiKey: "sk-test" },
    });

    expect(status).toBe(200);
    expect(body).toEqual({ ok: true, count: 2, models: ["a", "b"] });
    expect(JSON.stringify(body)).not.toContain("sk-test");
    const check = calls.find((c) => c.url.startsWith(`${CHAT}/providers/check`));
    expect(check?.url).toContain("token=super-secret-token");
    expect(JSON.parse(String(check?.init?.body)).apiKey).toBe("sk-test");
  });

  it("thử model: gửi Bearer + strict, không audit, không lộ token trong URL", async () => {
    const calls = stubChat();
    const db = fakeDb();
    const { status, body } = await call(baseEnv({ DB: db.db }), "/api/admin/chat/test", {
      method: "POST",
      body: { provider: "cf", modelId: "qwen3-30b" },
    });

    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: true, text: "Chào bạn.", provider: "cf", model: "qwen3-30b" });
    expect(typeof body.ms).toBe("number");
    expect(db.events).toHaveLength(0);

    const test = calls.find((c) => c.url.startsWith(`${CHAT}/chat`));
    expect(test?.url).toBe(`${CHAT}/chat`);
    expect(String((test?.init?.headers as Record<string, string>).Authorization)).toBe(
      "Bearer super-secret-token",
    );
    expect(JSON.parse(String(test?.init?.body))).toMatchObject({
      strict: true,
      provider: "cf",
      modelId: "qwen3-30b",
    });
  });

  it("chat-proxy báo lỗi thì giữ nguyên câu tiếng Việt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === CERT_URL) return certsResponse([jwk]);
        if (url.startsWith(`${CHAT}/chat`)) {
          return jsonResponse({ error: "Tất cả đường dự phòng đều bận.", code: "all_busy" }, 503);
        }
        return jsonResponse({}, 200);
      }),
    );
    const { status, body } = await call(baseEnv(), "/api/admin/chat/test", {
      method: "POST",
      body: { provider: "cf", modelId: "qwen3-30b" },
    });
    expect(status).toBe(503);
    expect(body).toEqual({ error: "Tất cả đường dự phòng đều bận." });
  });
});

describe("chat — danh sách model của hãng", () => {
  it("trả danh sách model đã lưu", async () => {
    stubChat();
    const { status, body } = await call(
      baseEnv(),
      "/api/admin/chat/provider-models?id=groq-1",
    );
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true, models: ["m-1"] });
  });

  it("id không hợp lệ → 400", async () => {
    stubChat();
    const { status } = await call(
      baseEnv(),
      "/api/admin/chat/provider-models?id=../x",
    );
    expect(status).toBe(400);
  });
});
