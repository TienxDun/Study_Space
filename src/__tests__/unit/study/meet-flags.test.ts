import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { __resetFlagsCache } from "../../../../workers/livekit-rooms/worker.js";

function fakeKv(raw: string | null, options: { fail?: boolean } = {}) {
  return {
    async get() {
      if (options.fail) throw new Error("KV lỗi");
      return raw;
    },
  };
}

function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    LIVEKIT_URL: "wss://test.livekit.cloud",
    LIVEKIT_API_KEY: "API_TEST_KEY_123",
    LIVEKIT_API_SECRET: "SECRET_TEST_999999999999999999999999",
    FIREBASE_PROJECT_ID: "zenspace-test",
    _verifyToken: async () => ({}),
    ...overrides,
  };
}

async function callToken(env: Record<string, unknown>) {
  const res = await worker.fetch(
    new Request("http://localhost/token", { method: "POST", body: "{}" }),
    env as never,
  );
  return { status: res.status, body: (await res.json()) as any };
}

async function callRooms(env: Record<string, unknown>) {
  const res = await worker.fetch(new Request("http://localhost/rooms"), env as never);
  return { status: res.status, body: (await res.json()) as any };
}

afterEach(() => {
  __resetFlagsCache();
});

describe("livekit-rooms đọc cờ hệ thống", () => {
  it("roomsEnabled false thì /token trả 503 trước khi kiểm vé", async () => {
    const verify = vi.fn(async () => ({ uid: "u1" }));
    const { status, body } = await callToken(
      makeEnv({ CHAT_QUOTA: fakeKv(JSON.stringify({ roomsEnabled: false })), _verifyToken: verify }),
    );

    expect(status).toBe(503);
    expect(body.code).toBe("ROOMS_DISABLED");
    expect(verify).not.toHaveBeenCalled();
  });

  it("roomsEnabled false thì /rooms trả 503", async () => {
    const { status, body } = await callRooms(
      makeEnv({ CHAT_QUOTA: fakeKv(JSON.stringify({ roomsEnabled: false })) }),
    );

    expect(status).toBe(503);
    expect(body.code).toBe("ROOMS_DISABLED");
  });

  it("cờ bật (hoặc thiếu) thì /token đi tiếp tới bước kiểm vé", async () => {
    const { status } = await callToken(makeEnv({ CHAT_QUOTA: fakeKv(JSON.stringify({ roomsEnabled: true })) }));
    expect(status).toBe(401);

    __resetFlagsCache();
    const noFlags = await callToken(makeEnv({ CHAT_QUOTA: fakeKv(null) }));
    expect(noFlags.status).toBe(401);
  });

  it("thiếu binding KV hoặc KV lỗi thì vẫn coi như phòng đang bật", async () => {
    const noBinding = await callToken(makeEnv());
    expect(noBinding.status).toBe(401);

    __resetFlagsCache();
    const broken = await callToken(makeEnv({ CHAT_QUOTA: fakeKv(null, { fail: true }) }));
    expect(broken.status).toBe(401);
  });

  it("webhook không bị cờ chặn: vẫn trả 401 chữ ký sai thay vì 503", async () => {
    const res = await worker.fetch(
      new Request("http://localhost/webhook/livekit", {
        method: "POST",
        headers: { Authorization: "Bearer sai" },
        body: "{}",
      }),
      makeEnv({ CHAT_QUOTA: fakeKv(JSON.stringify({ roomsEnabled: false })) }) as never,
    );

    expect(res.status).toBe(401);
  });

  it("nhớ cờ 30 giây, xóa bộ nhớ thì đọc lại", async () => {
    const env: Record<string, unknown> = makeEnv({
      CHAT_QUOTA: fakeKv(JSON.stringify({ roomsEnabled: true })),
    });
    expect((await callToken(env)).status).toBe(401);

    env.CHAT_QUOTA = fakeKv(JSON.stringify({ roomsEnabled: false }));
    expect((await callToken(env)).status).toBe(401);

    __resetFlagsCache();
    expect((await callToken(env)).status).toBe(503);
  });
});
