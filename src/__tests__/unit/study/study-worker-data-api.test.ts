import { describe, it, expect, beforeEach } from "vitest";
import { createWorker } from "../../../../workers/data-api/worker.js";

interface UserDataRow {
  uid: string;
  data_json: string;
  updated_at: number;
}

/**
 * Stateful In-Memory Mock cho Cloudflare D1 (bảng user_data)
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

describe("Worker Data-API — Cloud Save Snapshot Contract Tests", () => {
  let mockDb: ReturnType<typeof createMockD1>;
  let worker: ReturnType<typeof createWorker>;
  const baseEnv = {
    FIREBASE_PROJECT_ID: "test-zenspace-project",
    ALLOWED_ORIGINS: "http://localhost:3000,http://localhost:3001",
  };

  beforeEach(() => {
    mockDb = createMockD1();
    worker = createWorker({
      verifyToken: async (_env: unknown, token: string) => {
        if (token === "valid-token-alice") {
          return { uid: "user_alice" };
        }
        if (token === "valid-token-bob") {
          return { uid: "user_bob" };
        }
        return { error: "INVALID_TOKEN" };
      },
    });
  });

  it("Test 1: GET /health trả về 200 và trạng thái kết nối DB", async () => {
    const req = new Request("https://api.zenspace.app/health", { method: "GET" });
    const res = await worker.fetch(req, { ...baseEnv, DB: mockDb });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.db).toBe(true);
    expect(typeof body.time).toBe("number");
  });

  it("Test 2: OPTIONS preflight trả về 204 kèm Access-Control headers", async () => {
    const req = new Request("https://api.zenspace.app/data", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:3001" },
    });
    const res = await worker.fetch(req, { ...baseEnv, DB: mockDb });

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3001");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });

  it("Test 3: Thiếu hoặc sai Authorization header trả về 401 Unauthorized", async () => {
    // Không có header
    const req1 = new Request("https://api.zenspace.app/data", { method: "GET" });
    const res1 = await worker.fetch(req1, { ...baseEnv, DB: mockDb });
    expect(res1.status).toBe(401);

    // Header token sai
    const req2 = new Request("https://api.zenspace.app/data", {
      method: "GET",
      headers: { Authorization: "Bearer bad-token" },
    });
    const res2 = await worker.fetch(req2, { ...baseEnv, DB: mockDb });
    expect(res2.status).toBe(401);
  });

  it("Test 4: GET /data khi user chưa lưu gì trả về data: null và updatedAt: 0", async () => {
    const req = new Request("https://api.zenspace.app/data", {
      method: "GET",
      headers: { Authorization: "Bearer valid-token-alice" },
    });
    const res = await worker.fetch(req, { ...baseEnv, DB: mockDb });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toBeNull();
    expect(body.updatedAt).toBe(0);
  });

  it("Test 5: POST /data lưu thành công bản snapshot JSON và GET /data đọc lại chính xác", async () => {
    const snapshot = {
      scene_id: "rainy-tokyo",
      volume: 85,
      notes: [{ id: "n1", title: "Ghi chú ôn thi" }],
      tasks: [{ id: "t1", title: "Làm bài tập giải tích", done: false }],
      pomodoro: { totalMinutes: 120 },
    };

    // 1. POST /data
    const postReq = new Request("https://api.zenspace.app/data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token-alice",
      },
      body: JSON.stringify({ data: snapshot }),
    });
    const postRes = await worker.fetch(postReq, { ...baseEnv, DB: mockDb });
    expect(postRes.status).toBe(200);
    const postBody = await postRes.json();
    expect(postBody.ok).toBe(true);
    expect(postBody.updatedAt).toBeGreaterThan(0);

    // 2. GET /data
    const getReq = new Request("https://api.zenspace.app/data", {
      method: "GET",
      headers: { Authorization: "Bearer valid-token-alice" },
    });
    const getRes = await worker.fetch(getReq, { ...baseEnv, DB: mockDb });
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.ok).toBe(true);
    expect(getBody.data).toEqual(snapshot);
    expect(getBody.updatedAt).toBe(postBody.updatedAt);
  });

  it("Test 6: POST /data ghi đè dữ liệu cũ (Upsert Snapshot)", async () => {
    // Lần 1
    const post1 = new Request("https://api.zenspace.app/data", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer valid-token-alice" },
      body: JSON.stringify({ data: { v: 1, note: "Bản cũ" } }),
    });
    await worker.fetch(post1, { ...baseEnv, DB: mockDb });

    // Lần 2 (ghi đè)
    const post2 = new Request("https://api.zenspace.app/data", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer valid-token-alice" },
      body: JSON.stringify({ data: { v: 2, note: "Bản mới" } }),
    });
    const res2 = await worker.fetch(post2, { ...baseEnv, DB: mockDb });
    expect(res2.status).toBe(200);

    // Đọc lại
    const getReq = new Request("https://api.zenspace.app/data", {
      method: "GET",
      headers: { Authorization: "Bearer valid-token-alice" },
    });
    const getRes = await worker.fetch(getReq, { ...baseEnv, DB: mockDb });
    const getBody = await getRes.json();
    expect(getBody.data).toEqual({ v: 2, note: "Bản mới" });
  });

  it("Test 7: POST /data kiểm tra dung lượng tối đa (Payload Cap 2MB) trả 413", async () => {
    const hugePayload = "x".repeat(2_000_001);
    const req = new Request("https://api.zenspace.app/data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token-alice",
      },
      body: JSON.stringify({ data: hugePayload }),
    });

    const res = await worker.fetch(req, { ...baseEnv, DB: mockDb });
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toContain("2MB");
  });

  it("Test 8: POST /data với định dạng body không hợp lệ trả về 400", async () => {
    const req = new Request("https://api.zenspace.app/data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token-alice",
      },
      body: JSON.stringify({ wrongField: "no data field" }),
    });

    const res = await worker.fetch(req, { ...baseEnv, DB: mockDb });
    expect(res.status).toBe(400);
  });

  it("Test 9: Gọi route không tồn tại trả về 404", async () => {
    const req = new Request("https://api.zenspace.app/unknown-route", {
      method: "GET",
      headers: { Authorization: "Bearer valid-token-alice" },
    });

    const res = await worker.fetch(req, { ...baseEnv, DB: mockDb });
    expect(res.status).toBe(404);
  });

  it("Test 10: Phân lập dữ liệu hoàn toàn giữa các user khác nhau", async () => {
    // Alice lưu dữ liệu
    await worker.fetch(
      new Request("https://api.zenspace.app/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-token-alice" },
        body: JSON.stringify({ data: { user: "Alice Secret Notes" } }),
      }),
      { ...baseEnv, DB: mockDb }
    );

    // Bob đọc dữ liệu -> không thấy dữ liệu của Alice
    const bobRes = await worker.fetch(
      new Request("https://api.zenspace.app/data", {
        method: "GET",
        headers: { Authorization: "Bearer valid-token-bob" },
      }),
      { ...baseEnv, DB: mockDb }
    );
    const bobBody = await bobRes.json();
    expect(bobBody.data).toBeNull();

    // Bob lưu dữ liệu của Bob
    await worker.fetch(
      new Request("https://api.zenspace.app/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-token-bob" },
        body: JSON.stringify({ data: { user: "Bob Secret Notes" } }),
      }),
      { ...baseEnv, DB: mockDb }
    );

    // Alice đọc lại -> chỉ thấy của Alice
    const aliceRes = await worker.fetch(
      new Request("https://api.zenspace.app/data", {
        method: "GET",
        headers: { Authorization: "Bearer valid-token-alice" },
      }),
      { ...baseEnv, DB: mockDb }
    );
    const aliceBody = await aliceRes.json();
    expect(aliceBody.data).toEqual({ user: "Alice Secret Notes" });
  });
});
