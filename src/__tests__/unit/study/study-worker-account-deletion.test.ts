import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { createWorker } from "../../../../workers/data-api/worker.js";

type Row = Record<string, any>;

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

let emailSeq = 0;
function serviceAccountJson() {
  emailSeq += 1;
  return JSON.stringify({
    client_email: `sa-${emailSeq}@test.iam.gserviceaccount.com`,
    private_key: privateKey as unknown as string,
    project_id: "test-zenspace-project",
  });
}

/**
 * D1 giả lập theo bảng, đủ cho luồng xoá tài khoản.
 * Bảng LiveKit chỉ có khi bật withMeet (giống DB chưa cài livekit-schema).
 */
function createMockD1(options: { withMeet?: boolean } = {}) {
  const tables: Record<string, Row[]> = {
    user_data: [],
    chat_usage: [],
    deleted_accounts: [],
    content_reports: [],
    user_blocks: [],
    user_restrictions: [],
  };
  if (options.withMeet) {
    tables.meet_sessions = [];
    tables.meet_rooms = [];
    tables.meet_audit_logs = [];
  }

  const table = (name: string): Row[] => {
    if (!tables[name]) tables[name] = [];
    return tables[name];
  };

  const execute = (sql: string, params: any[]) => {
    const s = sql.replace(/\s+/g, " ").trim();

    if (s.startsWith("DELETE FROM user_data WHERE uid = ?")) {
      const [uid] = params;
      const before = table("user_data").length;
      tables.user_data = table("user_data").filter((row) => row.uid !== uid);
      return { meta: { changes: before - tables.user_data.length } };
    }

    if (s.startsWith("DELETE FROM chat_usage WHERE uid = ?")) {
      const [uid] = params;
      const before = table("chat_usage").length;
      tables.chat_usage = table("chat_usage").filter((row) => row.uid !== uid);
      return { meta: { changes: before - tables.chat_usage.length } };
    }

    if (s.startsWith("DELETE FROM meet_sessions WHERE identity = ?")) {
      const [identity] = params;
      const before = table("meet_sessions").length;
      tables.meet_sessions = table("meet_sessions").filter(
        (row) => row.identity !== identity
      );
      return { meta: { changes: before - tables.meet_sessions.length } };
    }

    if (s.startsWith("DELETE FROM meet_rooms WHERE host_uid = ?")) {
      const [uid] = params;
      const before = table("meet_rooms").length;
      tables.meet_rooms = table("meet_rooms").filter((row) => row.host_uid !== uid);
      return { meta: { changes: before - tables.meet_rooms.length } };
    }

    if (s.startsWith("UPDATE meet_rooms SET co_host_uids = ?")) {
      const [next, name] = params;
      let changes = 0;
      for (const row of table("meet_rooms")) {
        if (row.name === name) {
          row.co_host_uids = next;
          changes += 1;
        }
      }
      return { meta: { changes } };
    }

    if (s.startsWith("DELETE FROM meet_audit_logs")) {
      const targets = [params[0], params[1], params[2]];
      const before = table("meet_audit_logs").length;
      tables.meet_audit_logs = table("meet_audit_logs").filter(
        (row) => !targets.includes(row.actor_uid) && !targets.includes(row.target_identity)
      );
      return { meta: { changes: before - table("meet_audit_logs").length } };
    }

    if (s.startsWith("CREATE TABLE IF NOT EXISTS deleted_accounts")) {
      table("deleted_accounts");
      return { meta: { changes: 0 } };
    }

    if (s.startsWith("DELETE FROM content_reports WHERE reporter_uid = ? OR target_uid = ?")) {
      const [uid] = params;
      const before = table("content_reports").length;
      tables.content_reports = table("content_reports").filter(
        (row) => row.reporter_uid !== uid && row.target_uid !== uid
      );
      return { meta: { changes: before - tables.content_reports.length } };
    }

    if (s.startsWith("DELETE FROM user_blocks WHERE blocker_uid = ? OR blocked_uid = ?")) {
      const [uid] = params;
      const before = table("user_blocks").length;
      tables.user_blocks = table("user_blocks").filter(
        (row) => row.blocker_uid !== uid && row.blocked_uid !== uid
      );
      return { meta: { changes: before - tables.user_blocks.length } };
    }

    if (s.startsWith("DELETE FROM user_restrictions WHERE uid = ?")) {
      const [uid] = params;
      const before = table("user_restrictions").length;
      tables.user_restrictions = table("user_restrictions").filter(
        (row) => row.uid !== uid
      );
      return { meta: { changes: before - tables.user_restrictions.length } };
    }

    if (s.startsWith("DELETE FROM user_feedback WHERE uid = ?")) {
      const [uid] = params;
      const before = table("user_feedback").length;
      tables.user_feedback = table("user_feedback").filter((row) => row.uid !== uid);
      return { meta: { changes: before - tables.user_feedback.length } };
    }

    if (s.startsWith("INSERT INTO deleted_accounts")) {
      const [uid, deletedAt] = params;
      const existing = table("deleted_accounts").find((row) => row.uid === uid);
      if (existing) existing.deleted_at = deletedAt;
      else table("deleted_accounts").push({ uid, deleted_at: deletedAt });
      return { meta: { changes: 1 } };
    }

    if (s.startsWith("INSERT INTO user_data")) {
      const [uid, dataJson, updatedAt] = params;
      const existing = table("user_data").find((row) => row.uid === uid);
      if (existing) {
        existing.data_json = dataJson;
        existing.updated_at = updatedAt;
      } else {
        table("user_data").push({ uid, data_json: dataJson, updated_at: updatedAt });
      }
      return { meta: { changes: 1 } };
    }

    return { meta: { changes: 0 } };
  };

  const first = (sql: string, params: any[]) => {
    const s = sql.replace(/\s+/g, " ").trim();
    if (s.startsWith("SELECT name FROM sqlite_master")) {
      const [name] = params;
      return tables[name] ? { name } : null;
    }
    if (s.startsWith("SELECT uid FROM deleted_accounts")) {
      const [uid] = params;
      const row = table("deleted_accounts").find((item) => item.uid === uid);
      return row ? { uid: row.uid } : null;
    }
    if (s.startsWith("SELECT data_json, updated_at FROM user_data")) {
      const [uid] = params;
      return table("user_data").find((item) => item.uid === uid) || null;
    }
    return null;
  };

  const all = (sql: string, params: any[]) => {
    const s = sql.replace(/\s+/g, " ").trim();
    if (s.startsWith("SELECT name, co_host_uids FROM meet_rooms")) {
      const needle = String(params[0] || "").replace(/%/g, "");
      return {
        results: table("meet_rooms").filter((row) =>
          String(row.co_host_uids || "").includes(needle)
        ),
      };
    }
    if (s.startsWith("SELECT image_key FROM user_feedback WHERE uid = ?")) {
      const [uid] = params;
      return {
        results: table("user_feedback")
          .filter((row) => row.uid === uid && row.image_key)
          .map((row) => ({ image_key: row.image_key })),
      };
    }
    return { results: [] };
  };

  const prepare = (sql: string) => {
    let params: any[] = [];
    const stmt = {
      bind(...args: any[]) {
        params = args;
        return stmt;
      },
      async first() {
        return first(sql, params);
      },
      async all() {
        return all(sql, params);
      },
      async run() {
        return execute(sql, params);
      },
    };
    return stmt;
  };

  return {
    prepare,
    async batch(statements: Array<{ run: () => Promise<any> }>) {
      const out = [];
      for (const statement of statements) out.push(await statement.run());
      return out;
    },
    _tables: tables,
  };
}

type DeleteReply = { status: number; body?: unknown };

/** Stub OAuth + Identity Toolkit; trả về spy để đếm lượt gọi. */
function stubAdminFetch(deleteReply: DeleteReply = { status: 200, body: {} }) {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      void init;
      const url = String(input);
      if (url === "https://oauth2.googleapis.com/token") {
        return new Response(
          JSON.stringify({ access_token: "admin-token", expires_in: 3600 }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("identitytoolkit.googleapis.com")) {
        return new Response(JSON.stringify(deleteReply.body ?? {}), {
          status: deleteReply.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("{}", { status: 404 });
    }
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("Worker Data-API — Xoá tài khoản", () => {
  let mockDb: ReturnType<typeof createMockD1>;
  let worker: ReturnType<typeof createWorker>;
  let serviceAccount: string;
  const baseEnv = {
    FIREBASE_PROJECT_ID: "test-zenspace-project",
    ALLOWED_ORIGINS: "http://localhost:3000,http://localhost:3001",
  };

  beforeEach(() => {
    mockDb = createMockD1({ withMeet: true });
    serviceAccount = serviceAccountJson();
    worker = createWorker({
      verifyToken: async (_env: unknown, token: string) => {
        if (token === "valid-token-alice") return { uid: "user_alice" };
        if (token === "valid-token-bob") return { uid: "user_bob" };
        return { error: "INVALID_TOKEN" };
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const seed = () => {
    mockDb._tables.user_data.push(
      { uid: "user_alice", data_json: '{"notes":["a"]}', updated_at: 1 },
      { uid: "user_bob", data_json: '{"notes":["b"]}', updated_at: 2 }
    );
    mockDb._tables.chat_usage.push(
      { uid: "user_alice", day: "2026-10-29", count: 4 },
      { uid: "user_bob", day: "2026-10-29", count: 1 }
    );
    mockDb._tables.meet_sessions.push(
      { id: "s1", room: "study", identity: "user-user_alice", display_name: "An" },
      { id: "s2", room: "study", identity: "user-user_bob", display_name: "Bình" }
    );
    mockDb._tables.meet_rooms.push(
      {
        name: "phong-cua-alice",
        host_uid: "user_alice",
        host_identity: "user-user_alice",
        co_host_uids: "[]",
      },
      {
        name: "phong-cua-bob",
        host_uid: "user_bob",
        host_identity: "user-user_bob",
        co_host_uids: '["user_alice","user_bob"]',
      }
    );
    mockDb._tables.meet_audit_logs.push(
      { id: "a1", room: "study", actor_uid: "user_alice", target_identity: "user-user_bob" },
      { id: "a2", room: "study", actor_uid: "user_bob", target_identity: "user-user_alice" },
      { id: "a3", room: "study", actor_uid: "user_bob", target_identity: "user-user_carol" }
    );
    mockDb._tables.content_reports.push(
      { id: "r1", reporter_uid: "user_alice", target_uid: "user_bob" },
      { id: "r2", reporter_uid: "user_bob", target_uid: "user_alice" },
      { id: "r3", reporter_uid: "user_bob", target_uid: null }
    );
    mockDb._tables.user_blocks.push(
      { blocker_uid: "user_alice", blocked_uid: "user_bob", created_at: 1 },
      { blocker_uid: "user_bob", blocked_uid: "user_alice", created_at: 2 },
      { blocker_uid: "user_bob", blocked_uid: "user_carol", created_at: 3 }
    );
    mockDb._tables.user_restrictions.push(
      { uid: "user_alice", ai_disabled: 1 },
      { uid: "user_bob", rooms_disabled: 1 }
    );
  };

  const deleteRequest = (token?: string) =>
    new Request("https://api.zenspace.app/account", {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

  const env = (extra: Record<string, unknown> = {}) => ({
    ...baseEnv,
    FIREBASE_SERVICE_ACCOUNT: serviceAccount,
    DB: mockDb,
    ...extra,
  });

  it("Test 1: thiếu token thì trả 401", async () => {
    const res = await worker.fetch(deleteRequest(), env());
    expect(res.status).toBe(401);
  });

  it("Test 2: thiếu service account thì 503 và không xoá gì", async () => {
    seed();
    const fetchMock = stubAdminFetch();

    const res = await worker.fetch(deleteRequest("valid-token-alice"), {
      ...baseEnv,
      DB: mockDb,
    });
    expect(res.status).toBe(503);
    expect(mockDb._tables.user_data.map((row) => row.uid)).toEqual([
      "user_alice",
      "user_bob",
    ]);
    expect(mockDb._tables.deleted_accounts).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Test 3: xoá dữ liệu, gọi Admin API đúng uid, ghi tombstone", async () => {
    seed();
    const fetchMock = stubAdminFetch();

    const res = await worker.fetch(deleteRequest("valid-token-alice"), env());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.authDeleted).toBe(true);

    expect(mockDb._tables.user_data.map((row) => row.uid)).toEqual(["user_bob"]);
    expect(mockDb._tables.chat_usage.map((row) => row.uid)).toEqual(["user_bob"]);
    expect(mockDb._tables.meet_sessions.map((row) => row.identity)).toEqual([
      "user-user_bob",
    ]);
    expect(mockDb._tables.meet_rooms.map((row) => row.name)).toEqual(["phong-cua-bob"]);
    expect(mockDb._tables.meet_rooms[0].co_host_uids).toBe('["user_bob"]');
    expect(mockDb._tables.meet_audit_logs.map((row) => row.id)).toEqual(["a3"]);
    expect(mockDb._tables.content_reports.map((row) => row.id)).toEqual(["r3"]);
    expect(
      mockDb._tables.user_blocks.map((row) => `${row.blocker_uid}->${row.blocked_uid}`)
    ).toEqual(["user_bob->user_carol"]);
    expect(mockDb._tables.user_restrictions.map((row) => row.uid)).toEqual([
      "user_bob",
    ]);
    expect(mockDb._tables.deleted_accounts.map((row) => row.uid)).toEqual([
      "user_alice",
    ]);

    expect(body.deleted).toMatchObject({
      userData: 1,
      chatUsage: 1,
      meetSessions: 1,
      meetRooms: 1,
      meetCohosts: 1,
      meetAudit: 2,
      reports: 2,
      blocks: 2,
      restrictions: 1,
    });

    // Gọi OAuth trước, sau đó accounts:delete với localId lấy từ vé.
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://oauth2.googleapis.com/token"
    );
    const deleteCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("identitytoolkit.googleapis.com")
    );
    expect(deleteCall).toBeTruthy();
    const deleteInit = (deleteCall?.[1] ?? {}) as RequestInit;
    const payload = JSON.parse(String(deleteInit.body));
    expect(payload).toEqual({ localId: "user_alice" });
    expect((deleteInit.headers as Record<string, string>).Authorization).toBe(
      "Bearer admin-token"
    );
  });

  it("Test 4: JWT gửi lên OAuth có iss/scope/aud đúng", async () => {
    seed();
    const fetchMock = stubAdminFetch();

    await worker.fetch(deleteRequest("valid-token-alice"), env());

    const tokenCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("oauth2.googleapis.com")
    );
    const tokenInit = (tokenCall?.[1] ?? {}) as RequestInit;
    const form = new URLSearchParams(String(tokenInit.body));
    const assertion = form.get("assertion") || "";
    const [, claimsPart] = assertion.split(".");
    const claims = JSON.parse(
      Buffer.from(claimsPart.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
        "utf8"
      )
    );
    expect(claims.iss).toBe(JSON.parse(serviceAccount).client_email);
    expect(claims.scope).toBe("https://www.googleapis.com/auth/identitytoolkit");
    expect(claims.aud).toBe("https://oauth2.googleapis.com/token");
    expect(form.get("grant_type")).toBe(
      "urn:ietf:params:oauth:grant-type:jwt-bearer"
    );
  });

  it("Test 5: USER_NOT_FOUND coi như đã xoá xong", async () => {
    seed();
    stubAdminFetch({ status: 400, body: { error: { message: "USER_NOT_FOUND" } } });

    const res = await worker.fetch(deleteRequest("valid-token-alice"), env());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authDeleted).toBe(true);
    expect(mockDb._tables.deleted_accounts).toHaveLength(1);
  });

  it("Test 6: Admin API lỗi thì 502, chưa ghi tombstone, retry được", async () => {
    seed();
    stubAdminFetch({
      status: 403,
      body: { error: { message: "PERMISSION_DENIED" } },
    });

    const first = await worker.fetch(deleteRequest("valid-token-alice"), env());
    expect(first.status).toBe(502);
    expect(mockDb._tables.deleted_accounts).toHaveLength(0);
    expect(mockDb._tables.user_data.map((row) => row.uid)).toEqual(["user_bob"]);

    // Tài khoản còn nên bản ghi dữ liệu vẫn đọc được (không bị chặn 403).
    const getRes = await worker.fetch(
      new Request("https://api.zenspace.app/data", {
        method: "GET",
        headers: { Authorization: "Bearer valid-token-alice" },
      }),
      env()
    );
    expect(getRes.status).toBe(200);

    // Sửa xong phía Google thì gọi lại thành công.
    stubAdminFetch();
    const retry = await worker.fetch(deleteRequest("valid-token-alice"), env());
    expect(retry.status).toBe(200);
    expect(mockDb._tables.deleted_accounts).toHaveLength(1);
  });

  it("Test 7: sau khi xoá, GET/POST /data bị chặn 403", async () => {
    seed();
    stubAdminFetch();
    await worker.fetch(deleteRequest("valid-token-alice"), env());

    const getRes = await worker.fetch(
      new Request("https://api.zenspace.app/data", {
        method: "GET",
        headers: { Authorization: "Bearer valid-token-alice" },
      }),
      env()
    );
    expect(getRes.status).toBe(403);

    const postRes = await worker.fetch(
      new Request("https://api.zenspace.app/data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-token-alice",
        },
        body: JSON.stringify({ data: { notes: ["resurrect"] } }),
      }),
      env()
    );
    expect(postRes.status).toBe(403);
    expect(mockDb._tables.user_data.map((row) => row.uid)).toEqual(["user_bob"]);
  });

  it("Test 8: DB chưa có bảng LiveKit vẫn xoá được dữ liệu chính", async () => {
    mockDb = createMockD1();
    mockDb._tables.user_data.push({
      uid: "user_alice",
      data_json: "{}",
      updated_at: 1,
    });
    stubAdminFetch();

    const res = await worker.fetch(deleteRequest("valid-token-alice"), env());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted.meetSessions).toBe(0);
    expect(mockDb._tables.user_data).toHaveLength(0);
  });

  it("Test 8b: xoá tài khoản thì dọn luôn ảnh góp ý trong R2", async () => {
    seed();
    mockDb._tables.user_feedback = [
      { id: "f1", uid: "user_alice", image_key: "feedback/2026-11/f1.jpg", created_at: 1 },
      { id: "f2", uid: "user_bob", image_key: null, created_at: 2 },
    ];
    const deletedKeys: string[][] = [];
    const r2 = {
      async delete(keys: string[] | string) {
        deletedKeys.push(Array.isArray(keys) ? keys : [keys]);
      },
    };
    stubAdminFetch();

    const res = await worker.fetch(deleteRequest("valid-token-alice"), env({ R2: r2 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted.feedback).toBe(1);
    expect(mockDb._tables.user_feedback.map((row) => row.id)).toEqual(["f2"]);
    expect(deletedKeys.flat()).toEqual(["feedback/2026-11/f1.jpg"]);
  });

  it("Test 9: gọi lại lần hai vẫn 200 và dùng lại token Admin", async () => {    seed();
    const fetchMock = stubAdminFetch();

    await worker.fetch(deleteRequest("valid-token-alice"), env());
    const oauthCallsAfterFirst = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("oauth2.googleapis.com")
    ).length;

    const res = await worker.fetch(deleteRequest("valid-token-alice"), env());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted.userData).toBe(0);
    expect(mockDb._tables.user_data.map((row) => row.uid)).toEqual(["user_bob"]);

    const oauthCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("oauth2.googleapis.com")
    ).length;
    expect(oauthCalls).toBe(oauthCallsAfterFirst);
  });

  it("Test 10: CORS cho phép DELETE", async () => {
    const res = await worker.fetch(
      new Request("https://api.zenspace.app/account", {
        method: "OPTIONS",
        headers: { Origin: "http://localhost:3001" },
      }),
      env()
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("DELETE");
  });

  it("Test 11: /health báo đã cấu hình service account", async () => {
    const withSa = await worker.fetch(
      new Request("https://api.zenspace.app/health"),
      env()
    );
    expect((await withSa.json()).authAdmin).toBe(true);

    const withoutSa = await worker.fetch(
      new Request("https://api.zenspace.app/health"),
      { ...baseEnv, DB: mockDb }
    );
    expect((await withoutSa.json()).authAdmin).toBe(false);
  });
});
