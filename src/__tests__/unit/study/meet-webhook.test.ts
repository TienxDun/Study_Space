import { describe, it, expect, vi } from "vitest";
// @ts-expect-error node:sqlite is built into Node 22+ runtime but may lack declarations in @types/node
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import worker, {
  verifyWebhookJwt,
  signJwt,
} from "../../../../workers/livekit-rooms/worker.js";

async function makeWebhookToken(
  secret: string,
  apiKey: string,
  rawBody: string,
  overrides: Record<string, unknown> = {}
) {
  const enc = new TextEncoder();
  const hashBuf = await crypto.subtle.digest("SHA-256", enc.encode(rawBody));
  const hashBytes = new Uint8Array(hashBuf);
  let binary = "";
  for (let i = 0; i < hashBytes.length; i++) binary += String.fromCharCode(hashBytes[i]);
  const sha256 = btoa(binary);

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: apiKey,
    exp: now + 300,
    nbf: now - 10,
    sha256,
    ...overrides,
  };
  return signJwt(secret, payload);
}

function createRealSqliteD1() {
  const schemaPath = path.resolve(process.cwd(), "workers/livekit-schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(schemaSql);

  let failureFlag = false;
  let failOnEventsInsert = false;

  return {
    setSimulateFailure(val: boolean) {
      failureFlag = val;
    },
    setFailOnEventsInsert(val: boolean) {
      failOnEventsInsert = val;
    },
    prepare(sql: string) {
      return {
        bind(...args: any[]) {
          return {
            async first() {
              if (failureFlag && sql.includes("UPDATE meet_sessions")) {
                throw new Error("Simulated transient database connection error");
              }
              const stmt = sqlite.prepare(sql);
              return stmt.get(...args) || null;
            },
            async all() {
              if (failureFlag && sql.includes("UPDATE meet_sessions")) {
                throw new Error("Simulated transient database connection error");
              }
              const stmt = sqlite.prepare(sql);
              return { results: stmt.all(...args) };
            },
            async run() {
              if (failureFlag && sql.includes("UPDATE meet_sessions")) {
                throw new Error("Simulated transient database connection error");
              }
              if (failOnEventsInsert && sql.includes("INSERT INTO meet_events")) {
                throw new Error("Simulated database failure on inserting meet_events");
              }
              const stmt = sqlite.prepare(sql);
              const info = stmt.run(...args);
              return { meta: { changes: Number(info.changes) } };
            },
          };
        },
      };
    },
    _sqlite: sqlite,
  };
}

describe("LiveKit Webhook Verification & Session Tracking", () => {
  const secret = "SECRET_SUPER_SAFE_99999999999999999999";
  const apiKey = "LIVEKIT_API_KEY_TEST";

  it("verifies valid webhook JWT signature and body sha256", async () => {
    const rawBody = JSON.stringify({ event: "participant_joined", id: "ev-1" });
    const token = await makeWebhookToken(secret, apiKey, rawBody);
    const isValid = await verifyWebhookJwt(secret, `Bearer ${token}`, rawBody, apiKey);

    expect(isValid).toBe(true);
  });

  it("rejects webhook if body was tampered after token generation", async () => {
    const originalBody = JSON.stringify({ event: "participant_joined", id: "ev-1" });
    const tamperedBody = JSON.stringify({ event: "participant_joined", id: "ev-2" });
    const token = await makeWebhookToken(secret, apiKey, originalBody);

    const isValid = await verifyWebhookJwt(secret, `Bearer ${token}`, tamperedBody, apiKey);
    expect(isValid).toBe(false);
  });

  it("rejects webhook if signed with wrong secret", async () => {
    const rawBody = JSON.stringify({ event: "participant_joined", id: "ev-1" });
    const token = await makeWebhookToken("WRONG_SECRET_12345678901234567890", apiKey, rawBody);

    const isValid = await verifyWebhookJwt(secret, `Bearer ${token}`, rawBody, apiKey);
    expect(isValid).toBe(false);
  });

  it("rejects webhook if token is expired (> 60s tolerance)", async () => {
    const rawBody = JSON.stringify({ event: "participant_joined", id: "ev-1" });
    const pastTime = Math.floor(Date.now() / 1000) - 120;
    const token = await makeWebhookToken(secret, apiKey, rawBody, { exp: pastTime });

    const isValid = await verifyWebhookJwt(secret, `Bearer ${token}`, rawBody, apiKey);
    expect(isValid).toBe(false);
  });

  it("rejects webhook if API Key (iss) does not match expected", async () => {
    const rawBody = JSON.stringify({ event: "participant_joined", id: "ev-1" });
    const token = await makeWebhookToken(secret, "DIFFERENT_API_KEY", rawBody);

    const isValid = await verifyWebhookJwt(secret, `Bearer ${token}`, rawBody, apiKey);
    expect(isValid).toBe(false);
  });

  it("reconnect handling: join 1000 -> join 1100 -> left 1600 produces exactly 600s, not 1100s", async () => {
    const mockDb = createRealSqliteD1();
    const env = {
      LIVEKIT_URL: "wss://test.livekit.cloud",
      LIVEKIT_API_KEY: apiKey,
      LIVEKIT_API_SECRET: secret,
      FIREBASE_PROJECT_ID: "test-fb",
      DB: mockDb,
    };

    // 1. Join lúc 1000
    const body1 = JSON.stringify({
      id: "evt-join-1",
      event: "participant_joined",
      createdAt: 1000,
      room: { name: "phong-toan" },
      participant: { identity: "user-alpha", name: "Alpha" },
    });
    const token1 = await makeWebhookToken(secret, apiKey, body1);
    const res1 = await worker.fetch(
      new Request("https://worker.test/webhook/livekit", {
        method: "POST",
        headers: { Authorization: `Bearer ${token1}` },
        body: body1,
      }),
      env
    );
    expect(res1.status).toBe(200);

    // 2. Reconnect: Join lúc 1100 (cùng phòng + cùng user) -> Đóng session cũ (1000 -> 1100 = 100s) và mở session mới
    const body2 = JSON.stringify({
      id: "evt-join-2",
      event: "participant_joined",
      createdAt: 1100,
      room: { name: "phong-toan" },
      participant: { identity: "user-alpha", name: "Alpha" },
    });
    const token2 = await makeWebhookToken(secret, apiKey, body2);
    const res2 = await worker.fetch(
      new Request("https://worker.test/webhook/livekit", {
        method: "POST",
        headers: { Authorization: `Bearer ${token2}` },
        body: body2,
      }),
      env
    );
    expect(res2.status).toBe(200);

    // 3. Left lúc 1600 -> Đóng session thứ 2 (1100 -> 1600 = 500s)
    const body3 = JSON.stringify({
      id: "evt-left-1",
      event: "participant_left",
      createdAt: 1600,
      room: { name: "phong-toan" },
      participant: { identity: "user-alpha" },
    });
    const token3 = await makeWebhookToken(secret, apiKey, body3);
    const res3 = await worker.fetch(
      new Request("https://worker.test/webhook/livekit", {
        method: "POST",
        headers: { Authorization: `Bearer ${token3}` },
        body: body3,
      }),
      env
    );
    expect(res3.status).toBe(200);

    // Kiểm tra trong meet_usage_month: tổng cộng đúng 100s + 500s = 600s, không phải 1100s
    const usageRow: any = mockDb._sqlite
      .prepare("SELECT participant_seconds FROM meet_usage_month WHERE month = '1970-01'")
      .get();
    expect(usageRow).toBeDefined();
    expect(usageRow.participant_seconds).toBe(600);
  });

  it("handles transient failure during participant_left and adds minutes exactly once on retry", async () => {
    const mockDb = createRealSqliteD1();
    const env = {
      LIVEKIT_URL: "wss://test.livekit.cloud",
      LIVEKIT_API_KEY: apiKey,
      LIVEKIT_API_SECRET: secret,
      FIREBASE_PROJECT_ID: "test-fb",
      DB: mockDb,
    };

    // 1. Join hợp lệ lúc 1000
    const joinBody = JSON.stringify({
      id: "evt-join-retry",
      event: "participant_joined",
      createdAt: 1000,
      room: { name: "phong-hoa" },
      participant: { identity: "user-retry", name: "Học sinh Retry" },
    });
    const joinToken = await makeWebhookToken(secret, apiKey, joinBody);
    await worker.fetch(
      new Request("https://worker.test/webhook/livekit", {
        method: "POST",
        headers: { Authorization: `Bearer ${joinToken}` },
        body: joinBody,
      }),
      env
    );

    // 2. Left lúc 1600, nhưng database bị lỗi giữa chừng (chưa kịp hoàn tất)
    const leftBody = JSON.stringify({
      id: "evt-left-retry",
      event: "participant_left",
      createdAt: 1600,
      room: { name: "phong-hoa" },
      participant: { identity: "user-retry" },
    });
    const leftToken = await makeWebhookToken(secret, apiKey, leftBody);

    mockDb.setSimulateFailure(true);
    const failRes = await worker.fetch(
      new Request("https://worker.test/webhook/livekit", {
        method: "POST",
        headers: { Authorization: `Bearer ${leftToken}` },
        body: leftBody,
      }),
      env
    );
    expect(failRes.status).toBe(500);

    // Vì lỗi giữa chừng, event id chưa được ghi vào meet_events
    const eventRowBefore = mockDb._sqlite
      .prepare("SELECT id FROM meet_events WHERE id = 'evt-left-retry'")
      .get();
    expect(eventRowBefore).toBeUndefined();

    // 3. LiveKit thực hiện retry lại chính webhook event đó, lần này DB hoạt động bình thường
    mockDb.setSimulateFailure(false);
    const retryRes = await worker.fetch(
      new Request("https://worker.test/webhook/livekit", {
        method: "POST",
        headers: { Authorization: `Bearer ${leftToken}` },
        body: leftBody,
      }),
      env
    );
    expect(retryRes.status).toBe(200);

    // Event id đã được ghi sau khi hoàn tất thành công
    const eventRowAfter = mockDb._sqlite
      .prepare("SELECT id FROM meet_events WHERE id = 'evt-left-retry'")
      .get();
    expect(eventRowAfter).toBeDefined();

    // Số giây tích lũy lần 1 = 600s
    const usageRow1: any = mockDb._sqlite
      .prepare("SELECT participant_seconds FROM meet_usage_month WHERE month = '1970-01'")
      .get();
    expect(usageRow1.participant_seconds).toBe(600);

    // 4. LiveKit gửi lại event lần 3 (hoặc mạng gửi đúp) -> Nhận diện duplicate và không cộng thêm phút
    const dupRes = await worker.fetch(
      new Request("https://worker.test/webhook/livekit", {
        method: "POST",
        headers: { Authorization: `Bearer ${leftToken}` },
        body: leftBody,
      }),
      env
    );
    expect(dupRes.status).toBe(200);
    const dupBody = await dupRes.json();
    expect(dupBody.duplicate).toBe(true);

    // Số giây vẫn chỉ là 600s (chỉ cộng đúng 1 lần)
    const usageRow2: any = mockDb._sqlite
      .prepare("SELECT participant_seconds FROM meet_usage_month WHERE month = '1970-01'")
      .get();
    expect(usageRow2.participant_seconds).toBe(600);
  });

  it("handles failure on meet_events insert during participant_joined: retries 200, keeps session open, and accurately records left duration", async () => {
    const mockDb = createRealSqliteD1();
    const env = {
      LIVEKIT_API_KEY: apiKey,
      LIVEKIT_API_SECRET: secret,
      DB: mockDb,
    };

    const joinBody = JSON.stringify({
      id: "evt-join-fail-event",
      event: "participant_joined",
      createdAt: 1000,
      room: { name: "phong-retry-event" },
      participant: { identity: "user-retry-event", name: "User Retry" },
    });
    const joinToken = await makeWebhookToken(secret, apiKey, joinBody);

    // 1. Giả lập lỗi khi INSERT INTO meet_events sau khi đã tạo meet_sessions
    mockDb.setFailOnEventsInsert(true);

    const failRes = await worker.fetch(
      new Request("https://worker.test/webhook/livekit", {
        method: "POST",
        headers: { Authorization: `Bearer ${joinToken}` },
        body: joinBody,
      }),
      env
    );
    expect(failRes.status).toBe(500);

    // Kiểm tra: session đã tồn tại và left_at IS NULL
    const sessionRowBefore: any = mockDb._sqlite
      .prepare("SELECT id, left_at FROM meet_sessions WHERE id = 'sess-evt-join-fail-event'")
      .get();
    expect(sessionRowBefore).toBeDefined();
    expect(sessionRowBefore.left_at).toBeNull();

    // Event id chưa được ghi nhận vào meet_events
    const eventRowBefore = mockDb._sqlite
      .prepare("SELECT id FROM meet_events WHERE id = 'evt-join-fail-event'")
      .get();
    expect(eventRowBefore).toBeUndefined();

    // 2. LiveKit retry lại cùng webhook event khi DB bình thường trở lại
    mockDb.setFailOnEventsInsert(false);

    const retryRes = await worker.fetch(
      new Request("https://worker.test/webhook/livekit", {
        method: "POST",
        headers: { Authorization: `Bearer ${joinToken}` },
        body: joinBody,
      }),
      env
    );
    expect(retryRes.status).toBe(200);

    // Session vẫn mở (left_at IS NULL)
    const sessionRowAfter: any = mockDb._sqlite
      .prepare("SELECT id, left_at FROM meet_sessions WHERE id = 'sess-evt-join-fail-event'")
      .get();
    expect(sessionRowAfter.left_at).toBeNull();

    // Event đã được ghi vào meet_events
    const eventRowAfter = mockDb._sqlite
      .prepare("SELECT id FROM meet_events WHERE id = 'evt-join-fail-event'")
      .get();
    expect(eventRowAfter).toBeDefined();

    // 3. Người dùng rời phòng lúc 1600 (sau 600 giây)
    const leftBody = JSON.stringify({
      id: "evt-left-fail-event",
      event: "participant_left",
      createdAt: 1600,
      room: { name: "phong-retry-event" },
      participant: { identity: "user-retry-event" },
    });
    const leftToken = await makeWebhookToken(secret, apiKey, leftBody);

    const leftRes = await worker.fetch(
      new Request("https://worker.test/webhook/livekit", {
        method: "POST",
        headers: { Authorization: `Bearer ${leftToken}` },
        body: leftBody,
      }),
      env
    );
    expect(leftRes.status).toBe(200);

    // 4. Kiểm tra session đã được đóng và trigger đã cộng đúng 600 giây vào meet_usage_month
    const sessionClosed: any = mockDb._sqlite
      .prepare("SELECT left_at, duration_seconds FROM meet_sessions WHERE id = 'sess-evt-join-fail-event'")
      .get();
    expect(sessionClosed.left_at).toBe(1600);
    expect(sessionClosed.duration_seconds).toBe(600);

    const usageRow: any = mockDb._sqlite
      .prepare("SELECT participant_seconds FROM meet_usage_month WHERE month = '1970-01'")
      .get();
    expect(usageRow.participant_seconds).toBe(600);
  });

  async function sendRoomFinished(
    env: Record<string, unknown>,
    eventId: string,
    createdAt: number,
    creationTime: number,
    room = "phong-ket-thuc"
  ) {
    const body = JSON.stringify({
      id: eventId,
      event: "room_finished",
      createdAt,
      room: { name: room, creationTime },
    });
    const token = await makeWebhookToken(secret, apiKey, body);
    return worker.fetch(
      new Request("https://worker.test/webhook/livekit", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      }),
      env
    );
  }

  it("deletes room metadata on room_finished but keeps audit logs", async () => {
    const mockDb = createRealSqliteD1();
    const env = {
      LIVEKIT_API_KEY: apiKey,
      LIVEKIT_API_SECRET: secret,
      FIREBASE_PROJECT_ID: "test-fb",
      DB: mockDb,
    };

    mockDb._sqlite
      .prepare(
        "INSERT INTO meet_rooms (name, host_uid, host_identity, co_host_uids, locked, password_hash, created_at) VALUES (?, ?, ?, '[]', 1, ?, ?)"
      )
      .run("phong-ket-thuc", "uid-old", "user-uid-old", "hash-cu", 1000);
    mockDb._sqlite
      .prepare(
        "INSERT INTO meet_audit_logs (id, room, action, actor_uid, target_identity, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run("audit-1", "phong-ket-thuc", "kick", "uid-old", "user-uid-x", 1200);
    mockDb._sqlite
      .prepare(
        "INSERT INTO meet_sessions (id, room, identity, display_name, joined_at, left_at, duration_seconds, billing_month) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)"
      )
      .run("sess-old", "phong-ket-thuc", "user-uid-old", "Chủ Cũ", 1000, "1970-01");

    const res = await sendRoomFinished(env, "evt-room-fin-1", 1600, 1000);
    expect(res.status).toBe(200);

    const roomRow = mockDb._sqlite
      .prepare("SELECT name FROM meet_rooms WHERE name = 'phong-ket-thuc'")
      .get();
    expect(roomRow).toBeUndefined();

    const sessionRow: any = mockDb._sqlite
      .prepare("SELECT left_at, duration_seconds FROM meet_sessions WHERE id = 'sess-old'")
      .get();
    expect(sessionRow.left_at).toBe(1600);
    expect(sessionRow.duration_seconds).toBe(600);

    const auditRow = mockDb._sqlite
      .prepare("SELECT id FROM meet_audit_logs WHERE id = 'audit-1'")
      .get();
    expect(auditRow).toBeDefined();
  });

  it("is idempotent when room_finished is retried", async () => {
    const mockDb = createRealSqliteD1();
    const env = {
      LIVEKIT_API_KEY: apiKey,
      LIVEKIT_API_SECRET: secret,
      FIREBASE_PROJECT_ID: "test-fb",
      DB: mockDb,
    };

    mockDb._sqlite
      .prepare(
        "INSERT INTO meet_rooms (name, host_uid, host_identity, co_host_uids, locked, password_hash, created_at) VALUES (?, ?, ?, '[]', 0, NULL, ?)"
      )
      .run("phong-ket-thuc", "uid-old", "user-uid-old", 1000);

    const first = await sendRoomFinished(env, "evt-room-fin-retry", 1600, 1000);
    expect(first.status).toBe(200);

    const second = await sendRoomFinished(env, "evt-room-fin-retry", 1600, 1000);
    expect(second.status).toBe(200);
    const secondData = await second.json();
    expect(secondData.duplicate).toBe(true);

    const roomRow = mockDb._sqlite
      .prepare("SELECT name FROM meet_rooms WHERE name = 'phong-ket-thuc'")
      .get();
    expect(roomRow).toBeUndefined();
  });

  it("keeps metadata of a newer room when an old room_finished arrives late", async () => {
    const mockDb = createRealSqliteD1();
    const env = {
      LIVEKIT_API_KEY: apiKey,
      LIVEKIT_API_SECRET: secret,
      FIREBASE_PROJECT_ID: "test-fb",
      DB: mockDb,
    };

    mockDb._sqlite
      .prepare(
        "INSERT INTO meet_rooms (name, host_uid, host_identity, co_host_uids, locked, password_hash, created_at) VALUES (?, ?, ?, '[]', 0, NULL, ?)"
      )
      .run("phong-ket-thuc", "uid-new", "user-uid-new", 2000);

    const res = await sendRoomFinished(env, "evt-room-fin-late", 1600, 1000);
    expect(res.status).toBe(200);

    const roomRow: any = mockDb._sqlite
      .prepare("SELECT host_uid FROM meet_rooms WHERE name = 'phong-ket-thuc'")
      .get();
    expect(roomRow).toBeDefined();
    expect(roomRow.host_uid).toBe("uid-new");
  });

  it("resets role after room_finished: next user becomes host", async () => {
    const mockDb = createRealSqliteD1();
    const env = {
      LIVEKIT_URL: "wss://test.livekit.cloud",
      LIVEKIT_API_KEY: apiKey,
      LIVEKIT_API_SECRET: secret,
      FIREBASE_PROJECT_ID: "test-fb",
      DB: mockDb,
      _verifyToken: async () => ({ uid: "uid-new-host" }),
    };

    mockDb._sqlite
      .prepare(
        "INSERT INTO meet_rooms (name, host_uid, host_identity, co_host_uids, locked, password_hash, created_at) VALUES (?, ?, ?, '[]', 0, ?, ?)"
      )
      .run("phong-ket-thuc", "uid-old", "user-uid-old", "hash-cu", 1000);

    await sendRoomFinished(env, "evt-room-fin-reset", 1600, 1000);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ participants: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    try {
      const body = JSON.stringify({ room: "phong-ket-thuc", name: "Chủ Mới" });
      const res = await worker.fetch(
        new Request("https://worker.test/token", {
          method: "POST",
          headers: {
            Authorization: "Bearer token-new",
            "Content-Type": "application/json",
          },
          body,
        }),
        env
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.role).toBe("host");
      expect(data.isHost).toBe(true);
      expect(data.hasPassword).toBe(false);

      const roomRow: any = mockDb._sqlite
        .prepare("SELECT host_uid, password_hash FROM meet_rooms WHERE name = 'phong-ket-thuc'")
        .get();
      expect(roomRow.host_uid).toBe("uid-new-host");
      expect(roomRow.password_hash).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
