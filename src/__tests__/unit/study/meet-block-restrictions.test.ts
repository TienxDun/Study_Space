import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { __resetFlagsCache } from "../../../../workers/livekit-rooms/worker.js";

type Row = Record<string, any>;

interface DbOptions {
  restriction?: Row | null;
  room?: Row | null;
  blocks?: Row[];
}

const ROOM = {
  host_uid: "user_a",
  host_identity: "user-user_a",
  co_host_uids: "[]",
  locked: 0,
  password_hash: null,
};

function fakeDb(options: DbOptions = {}) {
  return {
    prepare(sql: string) {
      const q = sql.replace(/\s+/g, " ").trim();
      return {
        bind() {
          return {
            async first() {
              if (q.includes("FROM user_restrictions")) return options.restriction ?? null;
              if (q.includes("FROM meet_usage_month")) return { participant_seconds: 0 };
              if (q.includes("FROM meet_rooms")) return options.room ?? null;
              return null;
            },
            async all() {
              if (q.includes("FROM user_blocks")) return { results: options.blocks ?? [] };
              return { results: [] };
            },
            async run() {
              return { meta: { changes: 0 } };
            },
          };
        },
      };
    },
  };
}

function makeEnv(db: unknown, uid = "user_b") {
  return {
    LIVEKIT_URL: "wss://test.livekit.cloud",
    LIVEKIT_API_KEY: "KEY_TEST",
    LIVEKIT_API_SECRET: "SECRET_VERY_LONG_STRING_FOR_HMAC_1234567890",
    FIREBASE_PROJECT_ID: "test-fb",
    ALLOWED_ORIGINS: "*",
    DB: db,
    _verifyToken: async () => ({ uid }),
  };
}

function tokenRequest(room = "phong-hoc-1") {
  return new Request("https://worker.test/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer fb" },
    body: JSON.stringify({ room, name: "Bình" }),
  });
}

function stubLiveKit(participants: string[] = []) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("ListParticipants")) {
        return new Response(
          JSON.stringify({ participants: participants.map((identity) => ({ identity })) }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 200 });
    })
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  __resetFlagsCache();
});

describe("POST /token — hạn chế và chặn 2 chiều", () => {
  it("tài khoản bị khóa phòng học nhận 403 RESTRICTED trước khi gọi LiveKit", async () => {
    const calls = stubLiveKit();
    const res = await worker.fetch(
      tokenRequest(),
      makeEnv(fakeDb({ restriction: { rooms_disabled: 1 } }))
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("RESTRICTED");
    expect(calls).toHaveLength(0);
  });

  it("người vào đã chặn host thì không vào được", async () => {
    stubLiveKit();
    const res = await worker.fetch(
      tokenRequest(),
      makeEnv(
        fakeDb({
          room: ROOM,
          blocks: [{ blocker_uid: "user_b", blocked_uid: "user_a" }],
        })
      )
    );

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("BLOCKED");
  });

  it("host đã chặn người vào thì người đó cũng không vào được", async () => {
    stubLiveKit();
    const res = await worker.fetch(
      tokenRequest(),
      makeEnv(
        fakeDb({
          room: ROOM,
          blocks: [{ blocker_uid: "user_a", blocked_uid: "user_b" }],
        })
      )
    );

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("BLOCKED");
  });

  it("người đang ở trong phòng nằm trong danh sách chặn thì chặn luôn", async () => {
    stubLiveKit(["user-user_c"]);
    const res = await worker.fetch(
      tokenRequest(),
      makeEnv(
        fakeDb({
          room: { ...ROOM, host_uid: "user_z", host_identity: "user-user_z" },
          blocks: [{ blocker_uid: "user_b", blocked_uid: "user_c" }],
        })
      )
    );

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("BLOCKED");
  });

  it("host vào phòng của mình vẫn được dù có người đã chặn", async () => {
    stubLiveKit(["user-user_b"]);
    const res = await worker.fetch(
      tokenRequest(),
      makeEnv(
        fakeDb({
          room: ROOM,
          blocks: [{ blocker_uid: "user_a", blocked_uid: "user_b" }],
        }),
        "user_a"
      )
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("host");
    expect(typeof body.token).toBe("string");
  });

  it("không có chặn và không bị khóa thì vào bình thường", async () => {
    stubLiveKit();
    const res = await worker.fetch(tokenRequest(), makeEnv(fakeDb({ room: ROOM })));

    expect(res.status).toBe(200);
    expect((await res.json()).role).toBe("member");
  });
});
