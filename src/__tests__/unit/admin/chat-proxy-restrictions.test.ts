import { beforeEach, describe, expect, it, vi } from "vitest";
import worker, { __resetFlagsCache } from "../../../../workers/chat-proxy/worker.js";

function fakeKv() {
  const store = new Map<string, string>();
  return {
    store,
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

function fakeDb(options: { aiDisabled?: number; throwOnRestriction?: boolean; onInsert?: () => void } = {}) {
  return {
    prepare(sql: string) {
      const q = sql.replace(/\s+/g, " ").trim();
      return {
        bind() {
          return {
            async first() {
              if (q.includes("FROM user_restrictions")) {
                if (options.throwOnRestriction) throw new Error("D1 down");
                return options.aiDisabled === undefined
                  ? null
                  : { ai_disabled: options.aiDisabled };
              }
              if (q.includes("FROM chat_usage")) return { count: 0 };
              return null;
            },
            async run() {
              if (q.startsWith("INSERT INTO chat_usage")) options.onInsert?.();
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
}

function makeEnv(db: unknown, overrides: Record<string, unknown> = {}) {
  return {
    ADMIN_TOKEN: "secret",
    ALLOWED_ORIGINS: "https://zenstudy.space",
    USER_DAILY_LIMIT: "30",
    CHAT_QUOTA: fakeKv(),
    DB: db,
    _verifyToken: async () => ({ uid: "user_b" }),
    ...overrides,
  };
}

function chatRequest() {
  return new Request("https://chat-proxy.example.com/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer fb",
      Origin: "https://zenstudy.space",
    },
    body: JSON.stringify({ text: "Newton là gì?" }),
  });
}

beforeEach(() => {
  __resetFlagsCache();
  vi.unstubAllGlobals();
});

describe("chat-proxy /chat — hạn chế tài khoản", () => {
  it("tài khoản bị khóa AI nhận 403 AI_RESTRICTED và không trừ lượt", async () => {
    const onInsert = vi.fn();
    const res = await worker.fetch(
      chatRequest(),
      makeEnv(fakeDb({ aiDisabled: 1, onInsert })) as never
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("AI_RESTRICTED");
    expect(body.error).toContain("tạm khóa trợ lý AI");
    expect(onInsert).not.toHaveBeenCalled();
  });

  it("không có hạn chế thì đi tiếp qua bước kiểm lượt", async () => {
    const onInsert = vi.fn();
    const res = await worker.fetch(
      chatRequest(),
      makeEnv(fakeDb({ aiDisabled: 0, onInsert })) as never
    );

    expect(res.status).not.toBe(403);
    expect(onInsert).toHaveBeenCalled();
  });

  it("D1 lỗi khi đọc hạn chế thì không chặn oan người dùng", async () => {
    const res = await worker.fetch(
      chatRequest(),
      makeEnv(fakeDb({ throwOnRestriction: true })) as never
    );

    expect(res.status).not.toBe(403);
  });
});
