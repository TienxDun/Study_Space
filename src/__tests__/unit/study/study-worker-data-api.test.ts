import { describe, it, expect, beforeEach } from "vitest";
import { createWorker } from "../../../../workers/data-api/worker.js";

interface UserRow {
  uid: string;
  focus_epoch: number;
  created_at: number;
  updated_at: number;
}

interface SettingRow {
  uid: string;
  key: string;
  value: string;
  updated_at: number;
  deleted_at: number | null;
}

interface FocusRow {
  id: string;
  uid: string;
  task_id: string;
  task_title?: string;
  board_id?: string | null;
  started_at: number;
  ended_at: number;
  focus_seconds: number;
  planned_seconds: number;
  created_at: number;
  focus_epoch: number;
}

/**
 * Stateful In-Memory SQLite Mock cho Cloudflare D1
 * Lưu giữ state thực sự giữa các truy vấn để test hành vi database.
 */
function createStatefulD1() {
  const users = new Map<string, UserRow>();
  const settings = new Map<string, SettingRow>(); // composite key: `${uid}:${key}`
  const focus = new Map<string, FocusRow>(); // key: id

  function executeSql(sql: string, params: any[]) {
    const s = sql.trim();

    // 1. users: INSERT ON CONFLICT DO NOTHING
    if (s.startsWith("INSERT INTO users") && s.includes("ON CONFLICT(uid) DO NOTHING")) {
      const [uid, created_at, updated_at, focus_epoch] = params;
      if (!users.has(uid)) {
        users.set(uid, {
          uid,
          created_at: Number(created_at),
          updated_at: Number(updated_at),
          focus_epoch: Number(focus_epoch) || 1,
        });
        return { meta: { changes: 1 }, results: [] };
      }
      return { meta: { changes: 0 }, results: [] };
    }

    // 2. users: DELETE /focus atomic increment RETURNING focus_epoch
    if (s.startsWith("INSERT INTO users") && s.includes("focus_epoch = focus_epoch + 1")) {
      const [uid, created_at, updated_at] = params;
      let user = users.get(uid);
      if (!user) {
        user = { uid, focus_epoch: 2, created_at: Number(created_at), updated_at: Number(updated_at) };
      } else {
        user.focus_epoch += 1;
        user.updated_at = Number(updated_at);
      }
      users.set(uid, user);
      return { meta: { changes: 1 }, results: [{ focus_epoch: user.focus_epoch }] };
    }

    // 3. users: SELECT focus_epoch FROM users WHERE uid = ?
    if (s.startsWith("SELECT focus_epoch FROM users WHERE uid = ?")) {
      const [uid] = params;
      const user = users.get(uid);
      return {
        first: () => (user ? { focus_epoch: user.focus_epoch } : null),
        all: () => ({ results: user ? [{ focus_epoch: user.focus_epoch }] : [] }),
      };
    }

    // 4. users: SELECT 1 AS ok FROM users WHERE uid = ?
    if (s.includes("SELECT 1 AS ok FROM users WHERE uid = ?")) {
      const [uid] = params;
      const exists = users.has(uid);
      return {
        first: () => (exists ? { ok: 1 } : null),
        all: () => ({ results: exists ? [{ ok: 1 }] : [] }),
      };
    }

    // 5. user_settings: INSERT / UPDATE with deleted_at = NULL (Revive)
    if (s.startsWith("INSERT INTO user_settings") && s.includes("deleted_at = NULL") && !s.includes("WHERE user_settings.deleted_at IS NULL")) {
      const [uid, key, value, updated_at] = params;
      const id = `${uid}:${key}`;
      settings.set(id, {
        uid,
        key,
        value: String(value),
        updated_at: Number(updated_at),
        deleted_at: null,
      });
      return { meta: { changes: 1 }, results: [] };
    }

    // 6. user_settings: Conditional INSERT / UPDATE WHERE deleted_at IS NULL
    if (s.startsWith("INSERT INTO user_settings") && s.includes("WHERE user_settings.deleted_at IS NULL")) {
      const [uid, key, value, updated_at] = params;
      const id = `${uid}:${key}`;
      const existing = settings.get(id);
      if (existing && existing.deleted_at !== null) {
        // Đang bị soft-delete -> WHERE condition false -> no change
        return { meta: { changes: 0 }, results: [] };
      }
      settings.set(id, {
        uid,
        key,
        value: String(value),
        updated_at: Number(updated_at),
        deleted_at: null,
      });
      return { meta: { changes: 1 }, results: [] };
    }

    // 7. user_settings: UPSERT Soft-Delete Tombstone
    if (s.startsWith("INSERT INTO user_settings") && s.includes("value = ''") && s.includes("deleted_at = excluded.deleted_at")) {
      const [uid, key, updated_at, deleted_at] = params;
      const id = `${uid}:${key}`;
      settings.set(id, {
        uid,
        key,
        value: "",
        updated_at: Number(updated_at),
        deleted_at: Number(deleted_at),
      });
      return { meta: { changes: 1 }, results: [] };
    }

    // 8. user_settings: GET active (deleted_at IS NULL)
    if (s.includes("FROM user_settings") && s.includes("deleted_at IS NULL")) {
      const [uid, since] = params;
      const threshold = Number(since) || 0;
      const res: SettingRow[] = [];
      for (const row of settings.values()) {
        if (row.uid === uid && row.deleted_at === null && row.updated_at >= threshold) {
          res.push(row);
        }
      }
      return {
        all: () => ({ results: res }),
        first: () => (res.length ? res[0] : null),
      };
    }

    // 9. user_settings: GET deleted (deleted_at IS NOT NULL)
    if (s.includes("FROM user_settings") && s.includes("deleted_at IS NOT NULL")) {
      const [uid, since] = params;
      const threshold = Number(since) || 0;
      const res: { key: string }[] = [];
      for (const row of settings.values()) {
        if (row.uid === uid && row.deleted_at !== null && row.updated_at >= threshold) {
          res.push({ key: row.key });
        }
      }
      return {
        all: () => ({ results: res }),
        first: () => (res.length ? res[0] : null),
      };
    }

    // 10. focus_sessions: Conditional Insert with focus_epoch check
    if (s.startsWith("INSERT INTO focus_sessions")) {
      const [
        id, uid, taskId, taskTitle, boardId,
        startedAt, endedAt, focusSeconds, plannedSeconds,
        createdAt, focusEpoch, checkEpoch, checkUid
      ] = params;

      const user = users.get(checkUid);
      const currentEpoch = user ? user.focus_epoch : 1;

      if (Number(checkEpoch) < currentEpoch) {
        // Epoch cũ -> WHERE condition false
        return { meta: { changes: 0 }, results: [] };
      }

      if (focus.has(id)) {
        // ON CONFLICT(id) DO NOTHING
        return { meta: { changes: 0 }, results: [] };
      }

      focus.set(id, {
        id,
        uid,
        task_id: taskId,
        task_title: taskTitle,
        board_id: boardId,
        started_at: Number(startedAt),
        ended_at: Number(endedAt),
        focus_seconds: Number(focusSeconds),
        planned_seconds: Number(plannedSeconds),
        created_at: Number(createdAt),
        focus_epoch: Number(focusEpoch),
      });
      return { meta: { changes: 1 }, results: [] };
    }

    // 11. focus_sessions: DELETE FROM focus_sessions WHERE uid = ?
    if (s.startsWith("DELETE FROM focus_sessions WHERE uid = ?")) {
      const [uid] = params;
      let count = 0;
      for (const [id, f] of focus.entries()) {
        if (f.uid === uid) {
          focus.delete(id);
          count++;
        }
      }
      return { meta: { changes: count }, results: [] };
    }

    // 11.5. focus_sessions: SELECT id FROM focus_sessions WHERE uid = ? AND id IN (...)
    if (s.includes("SELECT id FROM focus_sessions WHERE uid = ? AND id IN")) {
      const [uid, ...ids] = params;
      const idSet = new Set(ids);
      const res: { id: string }[] = [];
      for (const [id, f] of focus.entries()) {
        if (f.uid === uid && idSet.has(id)) {
          res.push({ id });
        }
      }
      return {
        all: () => ({ results: res }),
        first: () => (res.length ? res[0] : null),
      };
    }

    // 12. focus_sessions: GET
    if (s.includes("FROM focus_sessions WHERE uid = ?")) {
      const [uid, from, to] = params;
      const min = Number(from) || 0;
      const max = Number(to) || Number.MAX_SAFE_INTEGER;
      const res: FocusRow[] = [];
      for (const f of focus.values()) {
        if (f.uid === uid && f.started_at >= min && f.started_at < max) {
          res.push(f);
        }
      }
      res.sort((a, b) => b.started_at - a.started_at);
      return {
        all: () => ({ results: res }),
        first: () => (res.length ? res[0] : null),
      };
    }

    // 13. Health table count check
    if (s.includes("sqlite_master WHERE type = 'table'")) {
      return {
        first: () => ({ n: 5 }),
        all: () => ({ results: [{ n: 5 }] }),
      };
    }

    return {
      run: async () => ({ meta: { changes: 0 }, results: [] }),
      first: async () => null,
      all: async () => ({ results: [] }),
    };
  }

  function prepare(sql: string) {
    let boundParams: any[] = [];
    return {
      bind: (...args: any[]) => {
        boundParams = args;
        return {
          run: async () => executeSql(sql, boundParams),
          first: async () => {
            const res = executeSql(sql, boundParams);
            return typeof res.first === "function" ? res.first() : (res.results && res.results[0]) || null;
          },
          all: async () => {
            const res = executeSql(sql, boundParams);
            return typeof res.all === "function" ? res.all() : { results: res.results || [] };
          },
          _sql: sql,
          _params: boundParams,
        };
      },
    };
  }

  async function batch(stmts: any[]) {
    const results = [];
    for (const stmt of stmts) {
      const r = executeSql(stmt._sql, stmt._params);
      results.push(r);
    }
    return results;
  }

  return { prepare, batch, users, settings, focus };
}

describe("Worker Data-API — Mốc 1 (Contract & Stateful Tests)", () => {
  const env = {
    FIREBASE_PROJECT_ID: "test-project",
    ALLOWED_ORIGINS: "https://zenstudy.space,http://localhost:3001",
    DB: null as any,
  };

  // Mock token verifier qua createWorker dependency injection (bỏ hoàn toàn TEST_MODE)
  const worker = createWorker({
    verifyToken: async (_env: unknown, token: string) => {
      if (token && token.startsWith("mock-uid:")) {
        return { uid: token.slice(9) };
      }
      return { code: "BAD_FORMAT" };
    },
  });

  let db: ReturnType<typeof createStatefulD1>;

  beforeEach(() => {
    db = createStatefulD1();
  });

  it("Test 1: Client v1 (không có header v2) gửi key > 1.5MB nhận 413; gửi focus legacy vẫn lưu bình thường", async () => {
    const envWithDb = { ...env, DB: db };
    const token = "mock-uid:user-legacy";

    // 1. Gửi key > 1.5MB -> trả 413 cả batch
    const hugeValue = "x".repeat(1_600_000); // 1.6MB > 1.5MB
    const req1 = new Request("http://localhost/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ settings: { theme: "dark", large: hugeValue } }),
    });

    const res1 = await worker.fetch(req1, envWithDb);
    expect(res1.status).toBe(413);

    // 2. Gửi key legacy study_space_focus_sessions_v1 -> vẫn lưu bình thường
    const req2 = new Request("http://localhost/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        settings: {
          study_space_focus_sessions_v1: JSON.stringify([{ id: "f1", focusSeconds: 1500 }]),
        },
      }),
    });

    const res2 = await worker.fetch(req2, envWithDb);
    expect(res2.status).toBe(200);
    const saved = db.settings.get("user-legacy:study_space_focus_sessions_v1");
    expect(saved).toBeDefined();
    expect(saved?.value).toContain("f1");
  });

  it("Test 2: Client v2 (có X-Sync-Version: 2) gửi key > 1.5MB bị reject riêng lẻ, focus legacy bị RETIRED_KEY", async () => {
    const envWithDb = { ...env, DB: db };
    const token = "mock-uid:user-v2";

    const hugeValue = "x".repeat(1_600_000); // 1.6MB
    const req = new Request("http://localhost/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Sync-Version": "2",
      },
      body: JSON.stringify({
        settings: {
          theme: "dark",
          large: hugeValue,
          study_space_focus_sessions_v1: "[]",
        },
      }),
    });

    const res = await worker.fetch(req, envWithDb);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.rejected).toEqual(
      expect.arrayContaining([
        { key: "study_space_focus_sessions_v1", reason: "RETIRED_KEY" },
        { key: "large", reason: "KEY_TOO_LARGE" },
      ])
    );
    // Key hợp lệ theme vẫn được lưu
    const saved = db.settings.get("user-v2:theme");
    expect(saved?.value).toBe("dark");
    // Retired key không được ghi vào DB
    expect(db.settings.get("user-v2:study_space_focus_sessions_v1")).toBeUndefined();
  });

  it("Test 3: DELETE /settings tạo UPSERT tombstone; first-sync v2 (since=0) nhận được tombstone; v1 không nhận row rỗng", async () => {
    const envWithDb = { ...env, DB: db };
    const token = "mock-uid:user-del";

    // 1. Xóa key chưa từng tồn tại trên server -> UPSERT tombstone
    const delReq = new Request("http://localhost/settings", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ keys: ["offline_note"] }),
    });
    const delRes = await worker.fetch(delReq, envWithDb);
    expect(delRes.status).toBe(200);

    const tombstone = db.settings.get("user-del:offline_note");
    expect(tombstone).toBeDefined();
    expect(tombstone?.deleted_at).toBeGreaterThan(0);
    expect(tombstone?.value).toBe("");

    // 2. Client v1 GET /settings -> không thấy key rỗng
    const getV1Req = new Request("http://localhost/settings", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    const getV1Res = await worker.fetch(getV1Req, envWithDb);
    const v1Data = await getV1Res.json();
    expect(v1Data.settings.offline_note).toBeUndefined();
    expect(v1Data.deleted).toEqual([]);

    // 3. Client v2 GET /settings?since=0 -> nhận được mảng deleted
    const getV2Req = new Request("http://localhost/settings?since=0", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Sync-Version": "2",
      },
    });
    const getV2Res = await worker.fetch(getV2Req, envWithDb);
    const v2Data = await getV2Res.json();
    expect(v2Data.deleted).toContain("offline_note");
    expect(v2Data.serverTime).toBeGreaterThan(0);
  });

  it("Test 4: PUT /settings không revive tự động khi key đang soft-delete; chỉ revive khi có reviveKeys", async () => {
    const envWithDb = { ...env, DB: db };
    const token = "mock-uid:user-revive";

    // Tạo tombstone trước
    db.settings.set("user-revive:archived_task", {
      uid: "user-revive",
      key: "archived_task",
      value: "",
      updated_at: 1000,
      deleted_at: 1000,
    });

    // 1. Ghi bình thường (không revive) -> conditional update không ghi đè tombstone và trả KEY_DELETED
    const putReq1 = new Request("http://localhost/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Sync-Version": "2",
      },
      body: JSON.stringify({ settings: { archived_task: "overwrite" } }),
    });
    const putRes1 = await worker.fetch(putReq1, envWithDb);
    expect(putRes1.status).toBe(200);
    const putData1 = await putRes1.json();
    expect(putData1.saved).toBe(0); // Không tính là saved
    expect(putData1.rejected).toEqual([
      { key: "archived_task", reason: "KEY_DELETED" },
    ]);
    const stillDeleted = db.settings.get("user-revive:archived_task");
    expect(stillDeleted?.deleted_at).toBe(1000); // vẫn giữ nguyên tombstone

    // 2. Ghi với reviveKeys -> deleted_at trở về null và lưu thành công
    const putReq2 = new Request("http://localhost/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Sync-Version": "2",
      },
      body: JSON.stringify({
        settings: { archived_task: "revived_content" },
        reviveKeys: ["archived_task"],
      }),
    });
    const putRes2 = await worker.fetch(putReq2, envWithDb);
    expect(putRes2.status).toBe(200);
    const putData2 = await putRes2.json();
    expect(putData2.saved).toBe(1);
    expect(putData2.rejected).toBeUndefined();
    const revived = db.settings.get("user-revive:archived_task");
    expect(revived?.deleted_at).toBeNull();
    expect(revived?.value).toBe("revived_content");
  });

  it("Test 5: GET /focus trả về sessions kèm epoch; POST /focus conditional insert loại bỏ STALE_EPOCH", async () => {
    const envWithDb = { ...env, DB: db };
    const token = "mock-uid:user-focus";

    // 1. GET ban đầu -> epoch = 1
    const getReq = new Request("http://localhost/focus", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    const getRes = await worker.fetch(getReq, envWithDb);
    const getData = await getRes.json();
    expect(getData.epoch).toBe(1);

    // 2. Clear lịch sử -> atomic increment epoch lên 2
    const delReq = new Request("http://localhost/focus", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const delRes = await worker.fetch(delReq, envWithDb);
    const delData = await delRes.json();
    expect(delData.epoch).toBe(2);

    // 3. POST phiên mang epoch cũ (epoch = 1) -> bị từ chối với STALE_EPOCH
    const postReqStale = new Request("http://localhost/focus", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        session: {
          id: "stale-s1",
          taskId: "t1",
          startedAt: 1000,
          endedAt: 2500,
          focusSeconds: 1500,
          focusEpoch: 1, // cũ hơn user.focus_epoch (2)
        },
      }),
    });
    const staleRes = await worker.fetch(postReqStale, envWithDb);
    const staleData = await staleRes.json();
    expect(staleData.rejected).toContainEqual({ id: "stale-s1", reason: "STALE_EPOCH" });
    expect(db.focus.has("stale-s1")).toBe(false);

    // 4. POST phiên mang epoch mới (epoch = 2) -> lưu thành công
    const postReqValid = new Request("http://localhost/focus", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        session: {
          id: "valid-s2",
          taskId: "t1",
          startedAt: 3000,
          endedAt: 4500,
          focusSeconds: 1500,
          focusEpoch: 2,
        },
      }),
    });
    const validRes = await worker.fetch(postReqValid, envWithDb);
    const validData = await validRes.json();
    expect(validData.ok).toBe(true);
    expect(validData.saved).toBe(1);
    expect(validData.epoch).toBe(2);
    expect(db.focus.has("valid-s2")).toBe(true);

    // 5. Gửi lặp lại cùng phiên valid-s2 (idempotent duplicate) -> vẫn báo saved: 1, không reject
    const dupReq = new Request("http://localhost/focus", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        session: {
          id: "valid-s2",
          taskId: "t1",
          startedAt: 3000,
          endedAt: 4500,
          focusSeconds: 1500,
          focusEpoch: 2,
        },
      }),
    });
    const dupRes = await worker.fetch(dupReq, envWithDb);
    const dupData = await dupRes.json();
    expect(dupData.saved).toBe(1);
    expect(dupData.rejected).toBeUndefined();

    // 6. Trường hợp clear chen ngang: client gửi phiên có epoch = 2 nhưng server đã clear tăng lên epoch 3
    await worker.fetch(
      new Request("http://localhost/focus", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }),
      envWithDb
    ); // Epoch giờ là 3

    const postReqIntervened = new Request("http://localhost/focus", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        session: {
          id: "intervened-s3",
          taskId: "t1",
          startedAt: 5000,
          endedAt: 6000,
          focusSeconds: 1000,
          focusEpoch: 2, // Đã bị cũ do clear chen ngang
        },
      }),
    });
    const intervenedRes = await worker.fetch(postReqIntervened, envWithDb);
    const intervenedData = await intervenedRes.json();
    expect(intervenedData.saved).toBe(0);
    expect(intervenedData.rejected).toEqual([
      { id: "intervened-s3", reason: "STALE_EPOCH" },
    ]);
    expect(intervenedData.epoch).toBe(3);
    expect(db.focus.has("intervened-s3")).toBe(false);
  });

  it("Test 6: POST /focus gửi > 200 phiên -> 200 phiên lưu, phần dư báo BATCH_OVERFLOW", async () => {
    const envWithDb = { ...env, DB: db };
    const token = "mock-uid:user-overflow";

    const sessions = [];
    for (let i = 0; i < 210; i++) {
      sessions.push({
        id: `sess-${i}`,
        taskId: "t-all",
        startedAt: 1000 + i,
        endedAt: 2000 + i,
        focusSeconds: 1000,
        focusEpoch: 1,
      });
    }

    const req = new Request("http://localhost/focus", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sessions }),
    });

    const res = await worker.fetch(req, envWithDb);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.saved).toBe(200);
    expect(data.rejected?.length).toBe(10);
    expect(data.rejected?.[0].reason).toBe("BATCH_OVERFLOW");
  });

  it("Test 7: Payload cap 2MB trả 413 ngay lập tức", async () => {
    const envWithDb = { ...env, DB: db };
    const token = "mock-uid:user-payload";

    const req = new Request("http://localhost/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Length": "3000000", // 3MB
      },
      body: JSON.stringify({ settings: { a: "1" } }),
    });

    const res = await worker.fetch(req, envWithDb);
    expect(res.status).toBe(413);
  });

  it("Test 8: Rate limit IP (600/phút) và CORS headers Expose Retry-After", async () => {
    const envWithDb = { ...env, DB: db };
    const token = "mock-uid:user-rate";

    // 1. Kiểm tra CORS Expose Headers
    const corsReq = new Request("http://localhost/health", {
      method: "OPTIONS",
      headers: { Origin: "https://zenstudy.space" },
    });
    const corsRes = await worker.fetch(corsReq, envWithDb);
    expect(corsRes.headers.get("Access-Control-Expose-Headers")).toContain("Retry-After");
    expect(corsRes.headers.get("Access-Control-Expose-Headers")).toContain("X-Sync-Version");

    // 2. IP Rate limit: Gửi dồn dập vượt 600 request từ cùng 1 IP
    const testIp = "192.168.1.100";
    let lastRes: Response | null = null;
    for (let i = 0; i < 602; i++) {
      const r = new Request("http://localhost/settings", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "CF-Connecting-IP": testIp,
        },
      });
      lastRes = await worker.fetch(r, envWithDb);
      if (lastRes && lastRes.status === 429) break;
    }

    expect(lastRes?.status).toBe(429);
    expect(lastRes?.headers.get("Retry-After")).toBeDefined();
  });
});
