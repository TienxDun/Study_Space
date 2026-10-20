import { describe, it, expect, vi } from "vitest";
import worker from "../../../../workers/data-api/worker.js";

function createMockDb() {
  const settingsStore = new Map<string, { value: string; updated_at: number }>();
  const focusStore = new Map<string, any>();

  const prepare = vi.fn((sql: string) => {
    return {
      bind: vi.fn((...args: any[]) => {
        return {
          first: vi.fn(async () => {
            if (sql.includes("SELECT 1 AS ok FROM users")) {
              return { ok: 1 };
            }
            if (sql.includes("SUM(LENGTH(value))")) {
              let total = 0;
              const prefix = args[0] + ":";
              for (const [k, v] of settingsStore.entries()) {
                if (k.startsWith(prefix)) {
                  total += v.value.length;
                }
              }
              return { total };
            }
            if (sql.includes("count(*) AS n FROM focus_sessions")) {
              return { n: focusStore.size };
            }
            return null;
          }),
          all: vi.fn(async () => {
            if (sql.includes("FROM user_settings")) {
              const results: any[] = [];
              const prefix = args[0] + ":";
              for (const [k, v] of settingsStore.entries()) {
                if (k.startsWith(prefix)) {
                  results.push({ key: k.slice(prefix.length), value: v.value, updated_at: v.updated_at });
                }
              }
              return { results };
            }
            if (sql.includes("FROM focus_sessions")) {
              const results = Array.from(focusStore.values()).filter((s) => s.uid === args[0]);
              return { results };
            }
            return { results: [] };
          }),
          run: vi.fn(async () => {
            if (sql.includes("DELETE FROM focus_sessions")) {
              focusStore.clear();
            }
            return { success: true };
          }),
        };
      }),
    };
  });

  const batch = vi.fn(async (stmts: any[]) => {
    return stmts.map(() => ({ success: true }));
  });

  return { prepare, batch, settingsStore, focusStore };
}

describe("Worker Data-API — Mốc 1 (Bảo vệ máy chủ & tương thích ngược với X-Sync-Version)", () => {
  const env = {
    FIREBASE_PROJECT_ID: "test-project",
    ALLOWED_ORIGINS: "https://zenstudy.space,http://localhost:3001",
    TEST_MODE: true,
    DB: null as any,
  };

  it("Task 1.4: CORS fail-closed và cho phép header X-Sync-Version", async () => {
    const reqOk = new Request("http://localhost/health", {
      method: "GET",
      headers: { Origin: "https://zenstudy.space" },
    });
    const resOk = await worker.fetch(reqOk, env);
    expect(resOk.headers.get("Access-Control-Allow-Origin")).toBe("https://zenstudy.space");
    expect(resOk.headers.get("Access-Control-Allow-Headers")).toContain("X-Sync-Version");

    const reqBad = new Request("http://localhost/health", {
      method: "GET",
      headers: { Origin: "https://evil-site.com" },
    });
    const resBad = await worker.fetch(reqBad, env);
    expect(resBad.headers.get("Access-Control-Allow-Origin")).toBe("null");
  });

  it("Client cũ (không có X-Sync-Version): gặp key quá lớn trả về 413 như cũ để tránh nói dối", async () => {
    const db = createMockDb();
    const envWithDb = { ...env, DB: db };
    const token = "mock-uid:user-legacy";

    const hugeKey = "huge_data";
    const hugeValue = "x".repeat(1_300_000); // 1.3MB > MAX_VALUE_LEN (1.2MB)

    const req = new Request("http://localhost/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        // KHÔNG CÓ X-Sync-Version: 2
      },
      body: JSON.stringify({
        settings: {
          study_theme: "dark",
          [hugeKey]: hugeValue,
        },
      }),
    });

    const res = await worker.fetch(req, envWithDb);
    expect(res.status).toBe(413);
    const data = await res.json();
    expect(data.error).toContain("quá lớn");
    expect(db.batch).not.toHaveBeenCalled();
  });

  it("Client mới (có X-Sync-Version: 2): bỏ qua riêng key lớn và lưu các key hợp lệ còn lại", async () => {
    const db = createMockDb();
    const envWithDb = { ...env, DB: db };
    const token = "mock-uid:user-v2";

    const normalKey = "study_theme";
    const normalValue = "dark";
    const hugeKey = "huge_data";
    const hugeValue = "x".repeat(1_300_000); // 1.3MB > 1.2MB

    const req = new Request("http://localhost/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Sync-Version": "2", // Client mới v2
      },
      body: JSON.stringify({
        settings: {
          [normalKey]: normalValue,
          [hugeKey]: hugeValue,
        },
      }),
    });

    const res = await worker.fetch(req, envWithDb);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.ok).toBe(true);
    expect(data.saved).toBe(1); // Chỉ lưu 1 key hợp lệ
    expect(data.rejected).toBeDefined();
    expect(data.rejected.length).toBe(1);
    expect(data.rejected[0].key).toBe(hugeKey);
    expect(data.rejected[0].reason).toBe("KEY_TOO_LARGE");
    expect(db.batch).toHaveBeenCalledTimes(1);
  });

  it("Task 1.2: POST /focus hỗ trợ nhận mảng nhiều phiên và báo rejected theo id", async () => {
    const db = createMockDb();
    const envWithDb = { ...env, DB: db };
    const token = "mock-uid:user-focus";

    const sessions = [
      {
        id: "session-1",
        taskId: "task-1",
        taskTitle: "Task 1",
        startedAt: 1000,
        endedAt: 2500,
        focusSeconds: 1500,
        plannedSeconds: 1500,
      },
      {
        id: "invalid-session",
        taskId: "", // thiếu taskId -> không hợp lệ
        focusSeconds: 0,
      },
    ];

    const req = new Request("http://localhost/focus", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sessions }),
    });

    const res = await worker.fetch(req, envWithDb);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.ok).toBe(true);
    expect(data.saved).toBe(1);
    expect(data.rejected).toBeDefined();
    expect(data.rejected[0].id).toBe("invalid-session");
    expect(db.batch).toHaveBeenCalledTimes(1);
  });

  it("Task 1.3: Rate limiter trong RAM trả về 429 khi vượt 180 req/phút", async () => {
    const db = createMockDb();
    const envWithDb = { ...env, DB: db };
    const token = "mock-uid:heavy-user";

    // Gửi liên tục 180 request hợp lệ
    for (let i = 0; i < 180; i++) {
      const req = new Request("http://localhost/me", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const res = await worker.fetch(req, envWithDb);
      expect(res.status).toBe(200);
    }

    // Request thứ 181 phải bị chặn với mã 429
    const reqBlocked = new Request("http://localhost/me", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    const resBlocked = await worker.fetch(reqBlocked, envWithDb);
    expect(resBlocked.status).toBe(429);
    expect(resBlocked.headers.get("Retry-After")).toBeDefined();
    const body = await resBlocked.json();
    expect(body.code).toBe("RATE_LIMITED");
  });
});
