import { describe, expect, it } from "vitest";
import worker from "../../../../workers/chat-proxy/worker.js";

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

function fakeDb(options: { fail?: boolean; tables?: number } = {}) {
  const queries: string[] = [];
  const db = {
    queries,
    prepare(sql: string) {
      queries.push(sql);
      const stmt = {
        bind() {
          return stmt;
        },
        async run() {
          return {};
        },
        async first() {
          if (options.fail) throw new Error("D1 không phản hồi");
          if (sql.includes("sqlite_master")) return { n: options.tables ?? 1 };
          return null;
        },
        async all() {
          return { results: [] };
        },
      };
      return stmt;
    },
  };
  return db;
}

function pacificDay(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    ADMIN_TOKEN: "secret",
    ALLOWED_ORIGINS: "https://zenstudy.space",
    USER_DAILY_LIMIT: "30",
    CHAT_QUOTA: fakeKv(),
    DB: fakeDb(),
    ...overrides,
  };
}

async function callStatus(env: Record<string, unknown>) {
  const res = await worker.fetch(
    new Request("http://localhost/status?token=secret"),
    env as never,
  );
  return { status: res.status, body: (await res.json()) as any };
}

describe("chat-proxy /status", () => {
  it("trả ngày Thái Bình Dương, hạn mức và không còn bộ đếm Workers AI", async () => {
    const { status, body } = await callStatus(makeEnv());

    expect(status).toBe(200);
    expect(body.dayPacific).toBe(pacificDay());
    expect(body.auth.userDailyLimit).toBe(30);
    expect(body.workersAI).toBeDefined();
    expect(body.workersAI.requestsToday).toBeUndefined();
    expect(body.workersAI.neuronsToday).toBeUndefined();
    expect(body.workersAI.neuronLimit).toBeUndefined();
  });

  it("thiếu ADMIN_TOKEN thì trả 503, không lộ số liệu", async () => {
    const { status, body } = await callStatus(makeEnv({ ADMIN_TOKEN: "" }));

    expect(status).toBe(503);
    expect(body.workersAI).toBeUndefined();
  });

  it("Bearer sai thì trả 401", async () => {
    const res = await worker.fetch(
      new Request("http://localhost/status", {
        headers: { Authorization: "Bearer sai" },
      }),
      makeEnv() as never,
    );

    expect(res.status).toBe(401);
  });
});

async function sendChat(env: Record<string, unknown>, aiOutput: unknown) {
  env.AI = {
    async run() {
      return aiOutput;
    },
  };
  const res = await worker.fetch(
    new Request("http://localhost/chat", {
      method: "POST",
      headers: {
        Authorization: "Bearer secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: "abcd", strict: true, modelId: "qwen3-30b" }),
    }),
    env as never,
  );
  return { status: res.status, body: (await res.json()) as any };
}

describe("chat-proxy /chat", () => {
  it("trả lời bình thường dù response có usage", async () => {
    const db = fakeDb();
    const env = makeEnv({ DB: db });

    const { status, body } = await sendChat(env, {
      response: "hello",
      usage: { prompt_tokens: 1000, completion_tokens: 500 },
    });

    expect(status).toBe(200);
    expect(body.text).toBe("hello");
    expect(db.queries.some((q) => q.includes("cf_usage"))).toBe(false);
  });

  it("không ghi bộ đếm Workers AI khi response không có usage", async () => {
    const db = fakeDb();
    const env = makeEnv({ DB: db });

    const { status } = await sendChat(env, { response: "hello" });

    expect(status).toBe(200);
    expect(db.queries.some((q) => q.includes("cf_usage"))).toBe(false);
  });
});

describe("chat-proxy /chat lỗi cuối", () => {
  async function sendPlain(env: Record<string, unknown>) {
    const res = await worker.fetch(
      new Request("http://localhost/chat", {
        method: "POST",
        headers: {
          Authorization: "Bearer secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: "abcd", strict: true, modelId: "qwen3-30b" }),
      }),
      env as never,
    );
    return { status: res.status, body: (await res.json()) as any };
  }

  it("trả mã lỗi máy đọc được và ghi 1 dòng admin_error_log", async () => {
    const db = fakeDb();
    const env: Record<string, unknown> = makeEnv({ DB: db });
    env.AI = {
      async run() {
        throw new Error("quota");
      },
    };

    const first = await sendPlain(env);
    expect(first.status).toBe(502);
    expect(first.body.code).toBe("fallback_failed");
    expect(first.body.error).toContain("Dự phòng bận");
    expect(
      db.queries.some((q) => q.includes("INSERT INTO admin_error_log")),
    ).toBe(true);

    const second = await sendPlain(env);
    expect(second.status).toBe(503);
    expect(second.body.code).toBe("all_busy");
  });
});

describe("chat-proxy /health", () => {
  it("báo schema đủ khi có bảng chat_usage", async () => {
    const db = fakeDb({ tables: 1 });
    const res = await worker.fetch(
      new Request("http://localhost/health"),
      makeEnv({ DB: db }) as never,
    );
    const body = (await res.json()) as any;

    expect(body.db).toBe(true);
    expect(body.schema).toBe(true);
    expect(db.queries.at(-1)).toContain("chat_usage");
    expect(db.queries.at(-1)).not.toContain("cf_usage");
  });

  it("báo schema thiếu khi chưa có bảng", async () => {
    const res = await worker.fetch(
      new Request("http://localhost/health"),
      makeEnv({ DB: fakeDb({ tables: 0 }) }) as never,
    );
    const body = (await res.json()) as any;

    expect(body.schema).toBe(false);
  });
});
