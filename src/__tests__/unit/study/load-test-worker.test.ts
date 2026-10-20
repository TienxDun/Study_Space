import { describe, it, expect, beforeEach } from "vitest";
import { createWorker } from "../../../../workers/data-api/worker.js";

interface UserDataRow {
  uid: string;
  data_json: string;
  updated_at: number;
}

/**
 * Stateful In-Memory SQLite Mock cho bảng user_data của Cloudflare D1
 */
function createMockD1() {
  const table = new Map<string, UserDataRow>();

  return {
    prepare(sql: string) {
      const s = sql.trim();
      let boundParams: any[] = [];

      const stmt = {
        bind(...args: any[]) {
          boundParams = args;
          return stmt;
        },
        async first() {
          if (s.includes("SELECT data_json, updated_at FROM user_data WHERE uid = ?")) {
            const [uid] = boundParams;
            const row = table.get(uid);
            return row ? { data_json: row.data_json, updated_at: row.updated_at } : null;
          }
          return null;
        },
        async run() {
          if (s.includes("INSERT INTO user_data")) {
            const [uid, data_json, updated_at] = boundParams;
            table.set(uid, {
              uid,
              data_json: String(data_json),
              updated_at: Number(updated_at),
            });
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        },
      };

      return stmt;
    },
    _table: table,
  };
}

describe("Worker Data-API — Load Test & High Concurrency (200 Concurrent Users)", () => {
  let mockDb: ReturnType<typeof createMockD1>;
  let worker: ReturnType<typeof createWorker>;

  beforeEach(() => {
    mockDb = createMockD1();
    worker = createWorker({
      verifyToken: async (_env: unknown, token: string) => {
        if (token && token.startsWith("token-")) {
          return { uid: token.replace("token-", "") };
        }
        return { error: "INVALID_TOKEN" };
      },
    });
  });

  it("1. 200 Users đồng thời ghi dữ liệu (200 Concurrent POST /data) — 100% Success", async () => {
    const userCount = 200;
    const users = Array.from({ length: userCount }, (_, i) => ({
      uid: `student_${String(i + 1).padStart(3, "0")}`,
      token: `token-student_${String(i + 1).padStart(3, "0")}`,
      payload: {
        settings: { sceneId: `scene_${i}`, volume: 80 },
        notes: [{ id: `note_${i}`, title: `Ghi chú của học sinh ${i}` }],
        tasks: [{ id: `task_${i}`, title: `Việc cần làm ${i}` }],
      },
    }));

    const startTime = Date.now();

    // Bắn 200 request ghi đồng thời cùng 1 lúc
    const writePromises = users.map((u) => {
      const req = new Request("https://api.zenstudy.space/data", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${u.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: u.payload }),
      });
      return worker.fetch(req, { DB: mockDb as any, ALLOWED_ORIGINS: "*" });
    });

    const responses = await Promise.all(writePromises);
    const duration = Date.now() - startTime;

    // Kiểm tra kết quả
    expect(responses).toHaveLength(userCount);
    for (const res of responses) {
      expect(res.status).toBe(200);
      const json: any = await res.json();
      expect(json.ok).toBe(true);
      expect(typeof json.updatedAt).toBe("number");
    }

    // Đảm bảo cả 200 bản ghi đều nằm trọn vẹn trong Database
    expect(mockDb._table.size).toBe(userCount);

    console.log(
      `\n  🚀 [Load Test] 200 Concurrent POST /data hoàn thành trong ${duration}ms (Trung bình ${(duration / userCount).toFixed(2)}ms/req)`
    );
  });

  it("2. 200 Users đồng thời đọc dữ liệu (200 Concurrent GET /data) — Phân lập 100%", async () => {
    const userCount = 200;

    // Nạp sẵn dữ liệu cho 200 user
    for (let i = 1; i <= userCount; i++) {
      const uid = `student_${String(i).padStart(3, "0")}`;
      mockDb._table.set(uid, {
        uid,
        data_json: JSON.stringify({
          secretNote: `Bí mật riêng của học sinh số ${i}`,
          studentId: i,
        }),
        updated_at: 1000 + i,
      });
    }

    const startTime = Date.now();

    // Bắn 200 request đọc đồng thời
    const readPromises = Array.from({ length: userCount }, (_, i) => {
      const uid = `student_${String(i + 1).padStart(3, "0")}`;
      const req = new Request("https://api.zenstudy.space/data", {
        method: "GET",
        headers: {
          Authorization: `Bearer token-${uid}`,
        },
      });
      return worker.fetch(req, { DB: mockDb as any, ALLOWED_ORIGINS: "*" }).then(async (res) => {
        const json: any = await res.json();
        return { status: res.status, json, expectedId: i + 1 };
      });
    });

    const results = await Promise.all(readPromises);
    const duration = Date.now() - startTime;

    expect(results).toHaveLength(userCount);
    for (const r of results) {
      expect(r.status).toBe(200);
      expect(r.json.ok).toBe(true);
      // Đảm bảo dữ liệu đọc về đúng chính xác học sinh đó, không bị lẫn
      expect(r.json.data.studentId).toBe(r.expectedId);
      expect(r.json.data.secretNote).toBe(`Bí mật riêng của học sinh số ${r.expectedId}`);
    }

    console.log(
      `  📖 [Load Test] 200 Concurrent GET /data hoàn thành trong ${duration}ms (Trung bình ${(duration / userCount).toFixed(2)}ms/req)`
    );
  });

  it("3. Kiểm tra chặn bảo mật khi tải cao: Token giả mạo và Payload quá khổ", async () => {
    // 1. Token không hợp lệ
    const unauthReq = new Request("https://api.zenstudy.space/data", {
      method: "GET",
      headers: { Authorization: "Bearer bad-token" },
    });
    const unauthRes = await worker.fetch(unauthReq, { DB: mockDb as any });
    expect(unauthRes.status).toBe(401);

    // 2. Không có Authorization header
    const noAuthReq = new Request("https://api.zenstudy.space/data", { method: "GET" });
    const noAuthRes = await worker.fetch(noAuthReq, { DB: mockDb as any });
    expect(noAuthRes.status).toBe(401);

    // 3. Payload vượt trần 2MB
    const bigString = "a".repeat(2_100_000);
    const bigReq = new Request("https://api.zenstudy.space/data", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-student_001",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: { bigContent: bigString } }),
    });
    const bigRes = await worker.fetch(bigReq, { DB: mockDb as any });
    expect(bigRes.status).toBe(413);
  });
});
