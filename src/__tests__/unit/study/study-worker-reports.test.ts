import { describe, it, expect, beforeEach } from "vitest";
import { createWorker } from "../../../../workers/data-api/worker.js";

type Row = Record<string, any>;

/**
 * D1 giả lập cho bảng P0.5: content_reports, user_blocks, deleted_accounts.
 * Chỉ hỗ trợ đúng các câu SQL mà data-api dùng.
 */
function createMockD1() {
  const tables: Record<string, Row[]> = {
    content_reports: [],
    user_blocks: [],
    deleted_accounts: [],
  };

  const table = (name: string): Row[] => {
    if (!tables[name]) tables[name] = [];
    return tables[name];
  };

  const execute = (sql: string, params: any[]) => {
    const s = sql.replace(/\s+/g, " ").trim();

    if (s.startsWith("INSERT INTO content_reports")) {
      const [
        id,
        source,
        reporter_uid,
        target_uid,
        room,
        session_id,
        message_id,
        content,
        reason,
        detail,
        created_at,
      ] = params;
      table("content_reports").push({
        id,
        source,
        reporter_uid,
        target_uid,
        room,
        session_id,
        message_id,
        content,
        reason,
        detail,
        status: "open",
        created_at,
      });
      return { meta: { changes: 1 } };
    }

    if (s.startsWith("DELETE FROM content_reports WHERE created_at < ?")) {
      const [cutoff] = params;
      const before = table("content_reports").length;
      tables.content_reports = table("content_reports").filter(
        (row) => Number(row.created_at) >= Number(cutoff)
      );
      return { meta: { changes: before - tables.content_reports.length } };
    }

    if (s.startsWith("INSERT INTO user_blocks")) {
      const [blocker_uid, blocked_uid, created_at] = params;
      const exists = table("user_blocks").some(
        (row) => row.blocker_uid === blocker_uid && row.blocked_uid === blocked_uid
      );
      if (!exists) table("user_blocks").push({ blocker_uid, blocked_uid, created_at });
      return { meta: { changes: exists ? 0 : 1 } };
    }

    if (s.startsWith("DELETE FROM user_blocks WHERE blocker_uid = ? AND blocked_uid = ?")) {
      const [blocker, blocked] = params;
      const before = table("user_blocks").length;
      tables.user_blocks = table("user_blocks").filter(
        (row) => !(row.blocker_uid === blocker && row.blocked_uid === blocked)
      );
      return { meta: { changes: before - tables.user_blocks.length } };
    }

    return { meta: { changes: 0 } };
  };

  const first = (sql: string, params: any[]) => {
    const s = sql.replace(/\s+/g, " ").trim();
    if (s.startsWith("SELECT uid FROM deleted_accounts")) {
      const [uid] = params;
      const row = table("deleted_accounts").find((item) => item.uid === uid);
      return row ? { uid: row.uid } : null;
    }
    if (s.startsWith("SELECT COUNT(*) AS n FROM content_reports")) {
      const [uid, since] = params;
      const n = table("content_reports").filter(
        (row) => row.reporter_uid === uid && Number(row.created_at) >= Number(since)
      ).length;
      return { n };
    }
    return null;
  };

  const all = (sql: string, params: any[]) => {
    const s = sql.replace(/\s+/g, " ").trim();
    if (s.startsWith("SELECT blocked_uid, created_at FROM user_blocks")) {
      const [uid] = params;
      const results = table("user_blocks")
        .filter((row) => row.blocker_uid === uid)
        .sort((a, b) => Number(b.created_at) - Number(a.created_at))
        .map((row) => ({ blocked_uid: row.blocked_uid, created_at: row.created_at }));
      return { results };
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
    _tables: tables,
  };
}

describe("Worker Data-API — Báo cáo nội dung & chặn", () => {
  let mockDb: ReturnType<typeof createMockD1>;
  let worker: ReturnType<typeof createWorker>;

  const baseEnv = {
    FIREBASE_PROJECT_ID: "test-zenspace-project",
    ALLOWED_ORIGINS: "http://localhost:3000,http://localhost:3001",
  };

  const env = () => ({ ...baseEnv, DB: mockDb });

  const call = (
    path: string,
    options: { method?: string; token?: string; body?: unknown } = {}
  ) => {
    const headers: Record<string, string> = {};
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    return worker.fetch(
      new Request(`https://api.zenspace.app${path}`, {
        method: options.method || "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      }),
      env()
    );
  };

  beforeEach(() => {
    mockDb = createMockD1();
    worker = createWorker({
      verifyToken: async (_env: unknown, token: string) => {
        if (token === "valid-token-alice") return { uid: "user_alice" };
        if (token === "valid-token-bob") return { uid: "user_bob" };
        return { error: "INVALID_TOKEN" };
      },
    });
  });

  it("thiếu token thì 401", async () => {
    const res = await call("/report", {
      method: "POST",
      body: { source: "ai", reason: "inaccurate", content: "sai" },
    });
    expect(res.status).toBe(401);
  });

  it("báo cáo AI hợp lệ được lưu đúng trường", async () => {
    const res = await call("/report", {
      method: "POST",
      token: "valid-token-alice",
      body: {
        source: "ai",
        reason: "inaccurate",
        content: "Câu trả lời này sai kiến thức.",
        sessionId: "sid-1",
        messageId: "msg-1",
        detail: "Sai công thức.",
        targetUid: "ignored-for-ai",
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBe("open");

    const row = mockDb._tables.content_reports[0];
    expect(row).toMatchObject({
      source: "ai",
      reporter_uid: "user_alice",
      target_uid: null,
      room: null,
      session_id: "sid-1",
      message_id: "msg-1",
      content: "Câu trả lời này sai kiến thức.",
      reason: "inaccurate",
      detail: "Sai công thức.",
      status: "open",
    });
    expect(typeof row.id).toBe("string");
  });

  it("từ chối source/reason không hợp lệ và thiếu nội dung AI", async () => {
    const badSource = await call("/report", {
      method: "POST",
      token: "valid-token-alice",
      body: { source: "video", reason: "other", content: "x" },
    });
    expect(badSource.status).toBe(400);

    const badReason = await call("/report", {
      method: "POST",
      token: "valid-token-alice",
      body: { source: "ai", reason: "spam", content: "x" },
    });
    expect(badReason.status).toBe(400);

    const noContent = await call("/report", {
      method: "POST",
      token: "valid-token-alice",
      body: { source: "ai", reason: "other" },
    });
    expect(noContent.status).toBe(400);
    expect(mockDb._tables.content_reports).toHaveLength(0);
  });

  it("báo cáo phòng cần room + targetUid và không cho tự báo cáo", async () => {
    const ok = await call("/report", {
      method: "POST",
      token: "valid-token-alice",
      body: {
        source: "room",
        reason: "harassment",
        room: "phong-hoc-1",
        targetUid: "user_bob",
      },
    });
    expect(ok.status).toBe(200);
    expect(mockDb._tables.content_reports[0]).toMatchObject({
      source: "room",
      room: "phong-hoc-1",
      target_uid: "user_bob",
      reporter_uid: "user_alice",
    });

    const missing = await call("/report", {
      method: "POST",
      token: "valid-token-alice",
      body: { source: "room", reason: "harassment", targetUid: "user_bob" },
    });
    expect(missing.status).toBe(400);

    const self = await call("/report", {
      method: "POST",
      token: "valid-token-alice",
      body: {
        source: "room",
        reason: "harassment",
        room: "phong-hoc-1",
        targetUid: "user_alice",
      },
    });
    expect(self.status).toBe(400);
  });

  it("giới hạn 10 báo cáo/ngày/UID, không tính báo cáo cũ", async () => {
    const now = Date.now();
    for (let i = 0; i < 10; i += 1) {
      mockDb._tables.content_reports.push({
        id: `old-${i}`,
        source: "ai",
        reporter_uid: "user_alice",
        reason: "other",
        status: "open",
        created_at: now,
      });
    }

    const blocked = await call("/report", {
      method: "POST",
      token: "valid-token-alice",
      body: { source: "ai", reason: "other", content: "câu 11" },
    });
    expect(blocked.status).toBe(429);
    const blockedBody = await blocked.json();
    expect(blockedBody.code).toBe("RATE_LIMITED");

    // Báo cáo từ 2 ngày trước không tính vào hôm nay.
    mockDb._tables.content_reports = mockDb._tables.content_reports
      .slice(0, 9)
      .concat({
        id: "old-day",
        source: "ai",
        reporter_uid: "user_alice",
        reason: "other",
        status: "open",
        created_at: now - 2 * 24 * 60 * 60 * 1000,
      });

    const allowed = await call("/report", {
      method: "POST",
      token: "valid-token-alice",
      body: { source: "ai", reason: "other", content: "câu mới" },
    });
    expect(allowed.status).toBe(200);
  });

  it("chặn, bỏ chặn và danh sách chặn hoạt động idempotent", async () => {
    const empty = await call("/blocks", { token: "valid-token-alice" });
    expect(empty.status).toBe(200);
    expect((await empty.json()).blocks).toEqual([]);

    const first = await call("/blocks", {
      method: "POST",
      token: "valid-token-alice",
      body: { targetUid: "user_bob" },
    });
    expect(first.status).toBe(200);

    const again = await call("/blocks", {
      method: "POST",
      token: "valid-token-alice",
      body: { targetUid: "user_bob" },
    });
    expect(again.status).toBe(200);
    expect(mockDb._tables.user_blocks).toHaveLength(1);

    const self = await call("/blocks", {
      method: "POST",
      token: "valid-token-alice",
      body: { targetUid: "user_alice" },
    });
    expect(self.status).toBe(400);

    const list = await call("/blocks", { token: "valid-token-alice" });
    const listBody = await list.json();
    expect(listBody.blocks).toHaveLength(1);
    expect(listBody.blocks[0].uid).toBe("user_bob");

    const removed = await call("/blocks/user_bob", {
      method: "DELETE",
      token: "valid-token-alice",
    });
    expect((await removed.json()).removed).toBe(true);

    const removedAgain = await call("/blocks/user_bob", {
      method: "DELETE",
      token: "valid-token-alice",
    });
    expect((await removedAgain.json()).removed).toBe(false);
    expect(mockDb._tables.user_blocks).toHaveLength(0);
  });

  it("tài khoản đã xoá bị chặn ở /report và /blocks", async () => {
    mockDb._tables.deleted_accounts.push({
      uid: "user_alice",
      deleted_at: Date.now(),
    });

    const report = await call("/report", {
      method: "POST",
      token: "valid-token-alice",
      body: { source: "ai", reason: "other", content: "x" },
    });
    expect(report.status).toBe(403);

    const blocks = await call("/blocks", { token: "valid-token-alice" });
    expect(blocks.status).toBe(403);
  });
});
