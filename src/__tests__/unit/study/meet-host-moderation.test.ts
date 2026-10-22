import { describe, it, expect, vi, beforeEach } from "vitest";
import worker from "../../../../workers/livekit-rooms/worker.js";

// In-memory SQLite / D1 mock
class MockD1 {
  tables: {
    meet_rooms: Map<string, any>;
    meet_sessions: any[];
    meet_audit_logs: any[];
    meet_usage_month: Map<string, any>;
    meet_events: Set<string>;
  };

  constructor() {
    this.tables = {
      meet_rooms: new Map(),
      meet_sessions: [],
      meet_audit_logs: [],
      meet_usage_month: new Map(),
      meet_events: new Set(),
    };
  }

  prepare(query: string) {
    const tables = this.tables;
    let boundArgs: any[] = [];

    const stmt = {
      bind(...args: any[]) {
        boundArgs = args;
        return stmt;
      },
      async first() {
        const q = query.trim().toUpperCase();
        if (q.startsWith("SELECT") && q.includes("FROM MEET_ROOMS WHERE NAME =")) {
          const room = tables.meet_rooms.get(boundArgs[0]);
          return room ? { ...room } : null;
        }
        if (q.startsWith("SELECT") && q.includes("FROM MEET_USAGE_MONTH WHERE MONTH =")) {
          const u = tables.meet_usage_month.get(boundArgs[0]);
          return u ? { ...u } : null;
        }
        if (q.includes("COUNT(DISTINCT IDENTITY)") && q.includes("FROM MEET_SESSIONS")) {
          const [room, month] = boundArgs;
          const matching = tables.meet_sessions.filter(
            (s) => s.room === room && s.billing_month === month
          );
          const uniq = new Set(matching.map((s) => s.identity));
          return { count: uniq.size };
        }
        return null;
      },
      async all() {
        const q = query.trim().toUpperCase();
        if (q.startsWith("SELECT") && q.includes("FROM MEET_ROOMS")) {
          const results = Array.from(tables.meet_rooms.values()).map((r) => ({ ...r }));
          return { results };
        }
        if (q.startsWith("SELECT") && q.includes("FROM MEET_SESSIONS WHERE ROOM =")) {
          const [room, month] = boundArgs;
          const matching = tables.meet_sessions.filter(
            (s) => s.room === room && s.billing_month === month
          );
          return { results: matching };
        }
        return { results: [] };
      },
      async run() {
        const q = query.trim().toUpperCase();
        if (q.startsWith("INSERT INTO MEET_ROOMS")) {
          const [roomName, host_uid, host_identity, initialPassHash, created_at] = boundArgs;
          tables.meet_rooms.set(roomName, {
            name: roomName,
            host_uid,
            host_identity,
            co_host_uids: "[]",
            locked: 0,
            password_hash: initialPassHash ?? null,
            created_at,
          });
          return { success: true };
        }
        if (q.startsWith("UPDATE MEET_ROOMS SET LOCKED =")) {
          const [roomName] = boundArgs;
          const isLock = q.includes("LOCKED = 1");
          const r = tables.meet_rooms.get(roomName);
          if (r) r.locked = isLock ? 1 : 0;
          return { success: true };
        }
        if (q.startsWith("UPDATE MEET_ROOMS SET PASSWORD_HASH = ?")) {
          const [hash, roomName] = boundArgs;
          const r = tables.meet_rooms.get(roomName);
          if (r) r.password_hash = hash;
          return { success: true };
        }
        if (q.startsWith("UPDATE MEET_ROOMS SET PASSWORD_HASH = NULL")) {
          const [roomName] = boundArgs;
          const r = tables.meet_rooms.get(roomName);
          if (r) r.password_hash = null;
          return { success: true };
        }
        if (q.startsWith("UPDATE MEET_ROOMS SET CO_HOST_UIDS = ?")) {
          const [coHostsStr, roomName] = boundArgs;
          const r = tables.meet_rooms.get(roomName);
          if (r) r.co_host_uids = coHostsStr;
          return { success: true };
        }
        if (q.startsWith("INSERT INTO MEET_AUDIT_LOGS")) {
          const [id, room, action, actor_uid, target_identity, created_at] = boundArgs;
          tables.meet_audit_logs.push({
            id,
            room,
            action,
            actor_uid,
            target_identity,
            created_at,
          });
          return { success: true };
        }
        return { success: true };
      },
    };
    return stmt;
  }
}

describe("LiveKit Phase 3 — Host, Co-host, Password & Moderation Worker", () => {
  let db: MockD1;
  let mockFetch: any;

  const env = {
    LIVEKIT_URL: "https://test.livekit.cloud",
    LIVEKIT_API_KEY: "API_TEST_KEY",
    LIVEKIT_API_SECRET: "TEST_SECRET_KEY_1234567890_VERY_LONG_SECRET",
    FIREBASE_PROJECT_ID: "test-firebase-proj",
    ADMIN_TOKEN: "secret-admin-pass-999",
    DB: null as any,
    _verifyToken: async (_env: any, token: string) => {
      if (token === "token-host") return { uid: "uid-host-1" };
      if (token === "token-cohost") return { uid: "uid-cohost-1" };
      if (token === "token-member") return { uid: "uid-member-1" };
      if (token === "token-other") return { uid: "uid-other-99" };
      return { code: "INVALID" };
    },
  };

  beforeEach(() => {
    db = new MockD1();
    env.DB = db;

    // Seed default room "phong-toan" created by "uid-host-1"
    db.tables.meet_rooms.set("phong-toan", {
      name: "phong-toan",
      host_uid: "uid-host-1",
      host_identity: "user-uid-host-1",
      co_host_uids: "[]",
      locked: 0,
      password_hash: null,
      created_at: Math.floor(Date.now() / 1000),
    });

    // Mock LiveKit Twirp calls
    mockFetch = vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/twirp/livekit.RoomService/ListParticipants")) {
        return new Response(
          JSON.stringify({
            participants: [
              {
                identity: "user-uid-member-1",
                tracks: [{ sid: "TR_AUDIO_MEMBER", type: 0, source: 1 }],
              },
              {
                identity: "user-uid-cohost-1",
                tracks: [{ sid: "TR_AUDIO_COHOST", type: 0, source: 1 }],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (
        u.includes("/twirp/livekit.RoomService/MutePublishedTrack") ||
        u.includes("/twirp/livekit.RoomService/RemoveParticipant") ||
        u.includes("/twirp/livekit.RoomService/UpdateParticipant") ||
        u.includes("/twirp/livekit.RoomService/CreateRoom")
      ) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (u.includes("/twirp/livekit.RoomService/ListRooms")) {
        return new Response(
          JSON.stringify({
            rooms: [{ name: "phong-toan", numParticipants: 2 }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });
    vi.stubGlobal("fetch", mockFetch);
  });

  it("assigns host role to room creator on first POST /token", async () => {
    const req = new Request("https://worker.local/token", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-host",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ room: "phong-moi", name: "Thầy Giáo" }),
    });

    const res = await worker.fetch(req, env);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.role).toBe("host");
    expect(data.isHost).toBe(true);
    expect(data.isCoHost).toBe(false);

    // Verify persisted in DB
    const roomInDb = db.tables.meet_rooms.get("phong-moi");
    expect(roomInDb).toBeDefined();
    expect(roomInDb.host_uid).toBe("uid-host-1");
  });

  it("maintains host role when creator reconnects (no host loss)", async () => {
    // Creator reconnects
    const req = new Request("https://worker.local/token", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-host",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ room: "phong-toan", name: "Thầy Giáo" }),
    });

    const res = await worker.fetch(req, env);
    const data = await res.json();
    expect(data.role).toBe("host");
    expect(data.isHost).toBe(true);
  });

  it("assigns member role to normal participants joining the room", async () => {
    const req = new Request("https://worker.local/token", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-member",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ room: "phong-toan", name: "Học Viên A" }),
    });

    const res = await worker.fetch(req, env);
    const data = await res.json();
    expect(data.role).toBe("member");
    expect(data.isHost).toBe(false);
    expect(data.isCoHost).toBe(false);
  });

  it("allows Host to set password and enforces it on joining", async () => {
    // Host sets password "bi-mat-123"
    const setPassReq = new Request("https://worker.local/rooms/phong-toan/password", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-host",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: "bi-mat-123" }),
    });
    const setPassRes = await worker.fetch(setPassReq, env);
    expect(setPassRes.status).toBe(200);

    // Member joins without password -> 401 ROOM_PASSWORD_REQUIRED
    const noPassReq = new Request("https://worker.local/token", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-member",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ room: "phong-toan", name: "Học Viên B" }),
    });
    const noPassRes = await worker.fetch(noPassReq, env);
    expect(noPassRes.status).toBe(401);
    const noPassData = await noPassRes.json();
    expect(noPassData.code).toBe("ROOM_PASSWORD_REQUIRED");

    // Member joins with wrong password -> 403 INVALID_PASSWORD
    const wrongPassReq = new Request("https://worker.local/token", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-member",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        room: "phong-toan",
        name: "Học Viên B",
        password: "sai-mat-khau",
      }),
    });
    const wrongPassRes = await worker.fetch(wrongPassReq, env);
    expect(wrongPassRes.status).toBe(403);
    const wrongPassData = await wrongPassRes.json();
    expect(wrongPassData.code).toBe("INVALID_PASSWORD");

    // Member joins with correct password -> 200
    const correctPassReq = new Request("https://worker.local/token", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-member",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        room: "phong-toan",
        name: "Học Viên B",
        password: "bi-mat-123",
      }),
    });
    const correctPassRes = await worker.fetch(correctPassReq, env);
    expect(correctPassRes.status).toBe(200);
  });

  it("blocks non-host from setting or deleting password", async () => {
    // Normal member tries to delete password
    const delReq = new Request("https://worker.local/rooms/phong-toan/password", {
      method: "DELETE",
      headers: { Authorization: "Bearer token-member" },
    });
    const delRes = await worker.fetch(delReq, env);
    expect(delRes.status).toBe(403);
    const data = await delRes.json();
    expect(data.code).toBe("NOT_HOST");
  });

  it("supports managing co-hosts: Host adds co-host and co-host receives permissions", async () => {
    // Host adds co-host
    const addCoHostReq = new Request("https://worker.local/rooms/phong-toan/co-host", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-host",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        targetUid: "uid-cohost-1",
        targetIdentity: "user-uid-cohost-1",
      }),
    });
    const addRes = await worker.fetch(addCoHostReq, env);
    expect(addRes.status).toBe(200);

    // Co-host enters room with password
    const joinReq = new Request("https://worker.local/token", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-cohost",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        room: "phong-toan",
        name: "Trợ Giảng",
        password: "bi-mat-123",
      }),
    });
    const joinRes = await worker.fetch(joinReq, env);
    const joinData = await joinRes.json();
    expect(joinData.role).toBe("co-host");
    expect(joinData.isCoHost).toBe(true);
    expect(joinData.isHost).toBe(false);

    // Co-host tries to change password -> 403 NOT_HOST
    const passChangeReq = new Request("https://worker.local/rooms/phong-toan/password", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-cohost",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: "cohost-cannot-change" }),
    });
    const passChangeRes = await worker.fetch(passChangeReq, env);
    expect(passChangeRes.status).toBe(403);
  });

  it("handles room locking: locks room and blocks normal members while allowing hosts", async () => {
    db.tables.meet_rooms.get("phong-toan").co_host_uids = JSON.stringify(["uid-cohost-1"]);

    // Co-host locks the room
    const lockReq = new Request("https://worker.local/rooms/phong-toan/lock", {
      method: "POST",
      headers: { Authorization: "Bearer token-cohost" },
    });
    const lockRes = await worker.fetch(lockReq, env);
    expect(lockRes.status).toBe(200);
    expect(db.tables.meet_rooms.get("phong-toan").locked).toBe(1);

    // Normal member tries to join locked room -> 403 ROOM_LOCKED
    const memberJoinReq = new Request("https://worker.local/token", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-member",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        room: "phong-toan",
        name: "Học Viên Muộn",
        password: "bi-mat-123",
      }),
    });
    const memberJoinRes = await worker.fetch(memberJoinReq, env);
    expect(memberJoinRes.status).toBe(403);
    const memberJoinData = await memberJoinRes.json();
    expect(memberJoinData.code).toBe("ROOM_LOCKED");

    // Host can still enter locked room -> 200
    const hostJoinReq = new Request("https://worker.local/token", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-host",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ room: "phong-toan", name: "Thầy Giáo" }),
    });
    const hostJoinRes = await worker.fetch(hostJoinReq, env);
    expect(hostJoinRes.status).toBe(200);
  });

  it("supports mute and kick operations via Twirp and blocks unauthorized users", async () => {
    db.tables.meet_rooms.get("phong-toan").co_host_uids = JSON.stringify(["uid-cohost-1"]);

    // Normal member tries to kick -> 403 NOT_HOST
    const unauthKick = new Request("https://worker.local/rooms/phong-toan/kick", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-member",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ identity: "user-uid-cohost-1" }),
    });
    const unauthKickRes = await worker.fetch(unauthKick, env);
    expect(unauthKickRes.status).toBe(403);

    // Co-host mutes member
    const muteReq = new Request("https://worker.local/rooms/phong-toan/mute", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-cohost",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ identity: "user-uid-member-1" }),
    });
    const muteRes = await worker.fetch(muteReq, env);
    expect(muteRes.status).toBe(200);

    // Co-host kicks member
    const kickReq = new Request("https://worker.local/rooms/phong-toan/kick", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-cohost",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ identity: "user-uid-member-1" }),
    });
    const kickRes = await worker.fetch(kickReq, env);
    expect(kickRes.status).toBe(200);

    // Verify audit logs were written
    expect(db.tables.meet_audit_logs.some((l) => l.action === "mute")).toBe(true);
    expect(db.tables.meet_audit_logs.some((l) => l.action === "kick")).toBe(true);
  });

  it("GET /history returns aggregate session metrics without leaking uid or email", async () => {
    // Seed sample sessions
    db.tables.meet_sessions.push(
      {
        id: "sess-1",
        room: "phong-toan",
        identity: "user-uid-1",
        joined_at: 1729600000,
        left_at: 1729601800,
        duration_seconds: 1800,
        billing_month: "2026-10",
      },
      {
        id: "sess-2",
        room: "phong-toan",
        identity: "user-uid-2",
        joined_at: 1729600500,
        left_at: 1729602300,
        duration_seconds: 1800,
        billing_month: "2026-10",
      }
    );

    const req = new Request("https://worker.local/history?room=phong-toan&month=2026-10", {
      method: "GET",
      headers: { Authorization: "Bearer token-member" },
    });

    const res = await worker.fetch(req, env);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.room).toBe("phong-toan");
    expect(data.month).toBe("2026-10");
    expect(data.totalMinutes).toBe(60);
    expect(data.totalSessions).toBe(2);
    expect(data.uniqueParticipants).toBe(2);
    expect(Array.isArray(data.sessions)).toBe(true);

    // Verify sessions do not leak identity or email
    for (const s of data.sessions) {
      expect(s.identity).toBeUndefined();
      expect(s.email).toBeUndefined();
      expect(s.uid).toBeUndefined();
      expect(typeof s.durationMinutes).toBe("number");
    }
  });

  it("GET /usage and GET /admin/usage return identical metrics with ADMIN_TOKEN", async () => {
    const req1 = new Request("https://worker.local/usage", {
      method: "GET",
      headers: { Authorization: "Bearer secret-admin-pass-999" },
    });
    const res1 = await worker.fetch(req1, env);
    expect(res1.status).toBe(200);
    const data1 = await res1.json();

    const req2 = new Request("https://worker.local/admin/usage", {
      method: "GET",
      headers: { Authorization: "Bearer secret-admin-pass-999" },
    });
    const res2 = await worker.fetch(req2, env);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();

    expect(data1).toEqual(data2);
    expect(data1.limitMinutes).toBe(4500);
    expect(typeof data1.roomsOpen).toBe("number");
  });

  it("POST /token sets room password upon creation when host supplies password in pre-join", async () => {
    const req = new Request("https://worker.local/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token-host",
      },
      body: JSON.stringify({
        room: "phong-moi-tao-co-pass",
        name: "Host User",
        password: "secretpassword123",
      }),
    });

    const res = await worker.fetch(req, env);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isHost).toBe(true);

    // Verify room in DB has password_hash populated immediately
    const roomInDb = db.tables.meet_rooms.get("phong-moi-tao-co-pass");
    expect(roomInDb).toBeDefined();
    expect(roomInDb.password_hash).not.toBeNull();

    // Now a member joining without password should be rejected with 401
    const reqMemberNoPass = new Request("https://worker.local/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token-member",
      },
      body: JSON.stringify({
        room: "phong-moi-tao-co-pass",
        name: "Member User",
      }),
    });
    const resMember = await worker.fetch(reqMemberNoPass, env);
    expect(resMember.status).toBe(401);
    const memberData = await resMember.json();
    expect(memberData.code).toBe("ROOM_PASSWORD_REQUIRED");

    // Member joining with correct password succeeds
    const reqMemberWithPass = new Request("https://worker.local/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token-member",
      },
      body: JSON.stringify({
        room: "phong-moi-tao-co-pass",
        name: "Member User",
        password: "secretpassword123",
      }),
    });
    const resMemberOk = await worker.fetch(reqMemberWithPass, env);
    expect(resMemberOk.status).toBe(200);
  });
});
