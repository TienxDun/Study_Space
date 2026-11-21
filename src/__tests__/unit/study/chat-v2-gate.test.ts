import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import worker from "../../../../workers/chat-v2/worker.js";
import { pacificDay, resetQuotaCache } from "../../../../workers/chat-v2/quota.js";

const BASE_ENV = {
  MOTAPIS_API_KEY: "sk-test",
  FIREBASE_PROJECT_ID: "proj-test",
  ALLOWED_ORIGINS: "http://localhost:3001",
  DEFAULT_MODEL: "deepseek-v4-flash",
  AGE_BAND: "16-17",
};

type FakeDb = ReturnType<typeof fakeDb>;

function fakeDb(init: { count?: number; restricted?: boolean } = {}) {
  const state = {
    count: init.count ?? 0,
    restricted: !!init.restricted,
    upserts: [] as Array<{ sql: string; args: unknown[] }>,
  };
  return {
    state,
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            first: async () => {
              if (sql.includes("FROM chat_usage")) return { count: state.count };
              if (sql.includes("user_restrictions")) {
                return state.restricted ? { ai_disabled: 1 } : null;
              }
              return null;
            },
            run: async () => {
              if (sql.includes("INSERT INTO chat_usage")) {
                state.count += 1;
                state.upserts.push({ sql, args });
              }
              return { success: true };
            },
          };
        },
      };
    },
  };
}

function prodEnv(options: { db?: FakeDb; token?: string | null } = {}) {
  return {
    ...BASE_ENV,
    DB: options.db,
    _verifyToken: async (_env: unknown, token: string) =>
      token === (options.token ?? "") && token ? { uid: token } : { code: "BAD_SIG" },
  };
}

function chatRequest(headers: Record<string, string> = {}) {
  return new Request("https://chat-v2.test/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      messages: [{ role: "user", content: "Xin chào" }],
    }),
  });
}

function stubUpstream() {
  const mock = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          id: "chatcmpl-1",
          model: "deepseek-v4-flash",
          choices: [{ message: { content: "Chào bạn." }, finish_reason: "stop" }],
          usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}

beforeEach(() => {
  resetQuotaCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("chat v2 — cửa gác đăng nhập và hạn mức", () => {
  it("không có vé thì 401 và không gọi Motapis", async () => {
    const fetchMock = stubUpstream();
    const res = await worker.fetch(chatRequest(), prodEnv({ db: fakeDb() }));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("vé sai thì 401 và không gọi Motapis", async () => {
    const fetchMock = stubUpstream();
    const env = prodEnv({ db: fakeDb(), token: "u1" });
    const res = await worker.fetch(chatRequest({ Authorization: "Bearer sai" }), env);
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tài khoản bị khoá AI thì 403 AI_RESTRICTED", async () => {
    const fetchMock = stubUpstream();
    const env = prodEnv({ db: fakeDb({ restricted: true }), token: "u1" });
    const res = await worker.fetch(chatRequest({ Authorization: "Bearer u1" }), env);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("AI_RESTRICTED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("đã dùng hết hạn mức trong ngày thì 429", async () => {
    const fetchMock = stubUpstream();
    const env = prodEnv({ db: fakeDb({ count: 30 }), token: "u1" });
    const res = await worker.fetch(chatRequest({ Authorization: "Bearer u1" }), env);
    expect(res.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("chat thành công thì tăng đúng bộ đếm chat_usage của người dùng", async () => {
    stubUpstream();
    const db = fakeDb({ count: 0 });
    const env = prodEnv({ db, token: "u1" });

    const res = await worker.fetch(chatRequest({ Authorization: "Bearer u1" }), env);
    expect(res.status).toBe(200);
    expect(db.state.count).toBe(1);
    expect(db.state.upserts[0].args).toEqual(["u1", pacificDay()]);
  });

  it("chế độ local dùng dev token, không cần DB và không ghi lượt", async () => {
    stubUpstream();
    const res = await worker.fetch(chatRequest({ "X-Chat-V2-Token": "dev-token" }), {
      ...BASE_ENV,
      ENVIRONMENT: "development",
      CHAT_V2_DEV_TOKEN: "dev-token",
    });
    expect(res.status).toBe(200);
  });

  it("chế độ local mà sai dev token thì vẫn 401", async () => {
    const fetchMock = stubUpstream();
    const res = await worker.fetch(chatRequest({ "X-Chat-V2-Token": "sai" }), {
      ...BASE_ENV,
      ENVIRONMENT: "development",
      CHAT_V2_DEV_TOKEN: "dev-token",
    });
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("/models là công khai, không cần vé", async () => {
    const res = await worker.fetch(new Request("https://chat-v2.test/models"), prodEnv());
    expect(res.status).toBe(200);
  });
});
