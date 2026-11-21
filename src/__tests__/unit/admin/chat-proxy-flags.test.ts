import { beforeEach, describe, expect, it, vi } from "vitest";
import worker, {
  __resetFlagsCache,
} from "../../../../workers/chat-proxy/worker.js";

function fakeKv(initial: Record<string, string> = {}, options: { fail?: boolean } = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    store,
    async get(key: string) {
      if (options.fail) throw new Error("KV không phản hồi");
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

function makeEnv(
  flags?: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
) {
  return {
    ADMIN_TOKEN: "secret",
    ALLOWED_ORIGINS: "https://zenstudy.space",
    USER_DAILY_LIMIT: "30",
    CHAT_QUOTA: fakeKv(flags ? { "cfg:flags": JSON.stringify(flags) } : {}),
    ...overrides,
  };
}

async function callConfig(env: Record<string, unknown>) {
  const res = await worker.fetch(
    new Request("https://chat-proxy.example.com/config", {
      headers: { Origin: "https://zenstudy.space" },
    }),
    env as never,
  );
  return { res, body: (await res.json()) as any };
}

async function callStatus(env: Record<string, unknown>) {
  const res = await worker.fetch(
    new Request("http://localhost/status?token=secret"),
    env as never,
  );
  return { status: res.status, body: (await res.json()) as any };
}

beforeEach(() => {
  __resetFlagsCache();
  vi.unstubAllGlobals();
});

describe("chat-proxy /config", () => {
  it("trả cờ công khai, CORS và cache 30 giây, không lộ email hay hạn mức", async () => {
    const { res, body } = await callConfig(
      makeEnv({
        chatEnabled: false,
        roomsEnabled: true,
        maintenance: true,
        banner: "Bảo trì 30 phút",
        chatDailyLimit: 45,
        updatedAt: 1_761_500_000_000,
        updatedBy: "admin@example.com",
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://zenstudy.space",
    );
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=30");
    expect(body).toEqual({
      chatEnabled: false,
      chatV2: false,
      roomsEnabled: true,
      maintenance: true,
      banner: "Bảo trì 30 phút",
      updatedAt: 1_761_500_000_000,
    });
  });

  it("thiếu cờ thì mặc định mọi thứ đang bật", async () => {
    const { body } = await callConfig(makeEnv());

    expect(body).toEqual({
      chatEnabled: true,
      chatV2: false,
      roomsEnabled: true,
      maintenance: false,
      banner: "",
      updatedAt: 0,
    });
  });

  it("KV lỗi thì vẫn mặc định bật, không làm hỏng web", async () => {
    const env = makeEnv(undefined, { CHAT_QUOTA: fakeKv({}, { fail: true }) });

    const { res, body } = await callConfig(env);

    expect(res.status).toBe(200);
    expect(body.chatEnabled).toBe(true);
    expect(body.roomsEnabled).toBe(true);
  });

  it("banner bị cắt ký tự điều khiển và giới hạn 140 ký tự", async () => {
    const { body } = await callConfig(
      makeEnv({ banner: `${"a".repeat(150)}\n dòng hai` }),
    );

    expect(body.banner).toHaveLength(140);
    expect(body.banner).not.toContain("\n");
  });
});

describe("chat-proxy cờ tắt chat", () => {
  it("chatEnabled=false thì /chat trả 503 và không gọi AI hay mạng", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await worker.fetch(
      new Request("https://chat-proxy.example.com/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "hỏi thử" }),
      }),
      makeEnv({ chatEnabled: false }) as never,
    );
    const body = (await res.json()) as any;

    expect(res.status).toBe(503);
    expect(body.code).toBe("CHAT_DISABLED");
    expect(String(body.error)).toContain("tạm tắt");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("chatEnabled=true thì /chat đi tiếp tới bước xác thực vé", async () => {
    const res = await worker.fetch(
      new Request("https://chat-proxy.example.com/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "hỏi thử" }),
      }),
      makeEnv({ chatEnabled: true }) as never,
    );

    // Không có vé Firebase: 401, tức là đã qua cổng cờ.
    expect(res.status).toBe(401);
  });
});

describe("chat-proxy hạn mức hiệu lực", () => {
  it("/status trả hạn mức từ cờ KV trước env", async () => {
    const { status, body } = await callStatus(
      makeEnv({ chatDailyLimit: 45 }, { USER_DAILY_LIMIT: "30" }),
    );

    expect(status).toBe(200);
    expect(body.auth.userDailyLimit).toBe(45);
  });

  it("cờ sai (0, 201, không phải số) thì dùng env", async () => {
    for (const invalid of [0, 201, 30.5, "40"]) {
      __resetFlagsCache();
      const { body } = await callStatus(
        makeEnv({ chatDailyLimit: invalid }, { USER_DAILY_LIMIT: "30" }),
      );
      expect(body.auth.userDailyLimit).toBe(30);
    }
  });

  it("env hợp lệ được dùng khi cờ trống; env sai thì về 30", async () => {
    const withEnv = await callStatus(makeEnv({}, { USER_DAILY_LIMIT: "50" }));
    __resetFlagsCache();
    const badEnv = await callStatus(makeEnv({}, { USER_DAILY_LIMIT: "abc" }));

    expect(withEnv.body.auth.userDailyLimit).toBe(50);
    expect(badEnv.body.auth.userDailyLimit).toBe(30);
  });

  it("cache 30 giây: đổi KV chưa có hiệu lực cho tới khi hết hạn nhớ", async () => {
    const env = makeEnv({ chatDailyLimit: 40 });
    const first = await callStatus(env);
    (env.CHAT_QUOTA as { store: Map<string, string> }).store.set(
      "cfg:flags",
      JSON.stringify({ chatDailyLimit: 60 }),
    );
    const cached = await callStatus(env);
    __resetFlagsCache();
    const refreshed = await callStatus(env);

    expect(first.body.auth.userDailyLimit).toBe(40);
    expect(cached.body.auth.userDailyLimit).toBe(40);
    expect(refreshed.body.auth.userDailyLimit).toBe(60);
  });
});
