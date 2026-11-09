import { beforeEach, describe, expect, it } from "vitest";
import {
  __logAdminError,
  __resetErrorLogThrottle,
} from "../../../../workers/chat-proxy/worker.js";

const HOUR = 60 * 60 * 1000;

type ErrorRow = { source: string; code: string; created_at: number };

function statefulDb(options: { failSelect?: boolean } = {}) {
  const rows: ErrorRow[] = [];
  const selects: unknown[][] = [];
  const inserts: unknown[][] = [];

  const db = {
    prepare(query: string) {
      let args: unknown[] = [];
      const stmt = {
        bind(...values: unknown[]) {
          args = values;
          return stmt;
        },
        async run() {
          if (query.includes("INSERT INTO admin_error_log")) {
            inserts.push(args);
            rows.push({
              source: String(args[0]),
              code: String(args[1]),
              created_at: Number(args[3]),
            });
          }
          return {};
        },
        async first() {
          if (query.includes("SELECT created_at FROM admin_error_log")) {
            selects.push(args);
            if (options.failSelect) throw new Error("D1 không phản hồi");
            const [source, code] = args;
            const matches = rows
              .filter((row) => row.source === source && row.code === code)
              .sort((a, b) => b.created_at - a.created_at);
            return matches[0] ?? null;
          }
          return null;
        },
        async all() {
          return { results: [] };
        },
      };
      return stmt;
    },
  };

  return { db, rows, selects, inserts };
}

beforeEach(() => {
  __resetErrorLogThrottle();
});

describe("chat-proxy logAdminError", () => {
  it("hai lần liên tiếp trong cùng isolate chỉ ghi 1 dòng", async () => {
    const fake = statefulDb();

    expect(await __logAdminError({ DB: fake.db }, "fallback_failed")).toBe(true);
    expect(await __logAdminError({ DB: fake.db }, "fallback_failed")).toBe(false);

    expect(fake.inserts).toHaveLength(1);
    expect(fake.selects).toHaveLength(1);
    expect(fake.inserts[0][0]).toBe("chat-proxy");
  });

  it("isolate khác (Map rỗng) vẫn thấy dòng cũ trong D1 nên không ghi trùng", async () => {
    const fake = statefulDb();

    await __logAdminError({ DB: fake.db }, "provider_bad_key");
    __resetErrorLogThrottle();

    expect(await __logAdminError({ DB: fake.db }, "provider_bad_key")).toBe(false);
    expect(fake.inserts).toHaveLength(1);
  });

  it("quá 1 giờ thì ghi thêm dòng mới", async () => {
    const fake = statefulDb();

    await __logAdminError({ DB: fake.db }, "all_busy");
    fake.rows[0].created_at -= 2 * HOUR;
    __resetErrorLogThrottle();

    expect(await __logAdminError({ DB: fake.db }, "all_busy")).toBe(true);
    expect(fake.inserts).toHaveLength(2);
  });

  it("khác code thì không chặn nhau", async () => {
    const fake = statefulDb();

    expect(await __logAdminError({ DB: fake.db }, "fallback_failed")).toBe(true);
    expect(await __logAdminError({ DB: fake.db }, "all_busy")).toBe(true);

    expect(fake.inserts).toHaveLength(2);
  });

  it("D1 lỗi khi đọc dòng gần nhất thì bỏ qua, không ghi và không ném", async () => {
    const fake = statefulDb({ failSelect: true });

    await expect(__logAdminError({ DB: fake.db }, "fallback_failed")).resolves.toBe(false);
    expect(fake.inserts).toHaveLength(0);
  });

  it("thiếu binding DB hoặc code lạ thì trả false", async () => {
    await expect(__logAdminError({}, "fallback_failed")).resolves.toBe(false);

    const fake = statefulDb();
    await expect(__logAdminError({ DB: fake.db }, "khong_co")).resolves.toBe(false);
    expect(fake.inserts).toHaveLength(0);
  });
});
