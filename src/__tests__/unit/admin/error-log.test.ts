import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetErrorLogThrottle,
  logAdminError,
  type AdminEnv,
} from "../../../../admin-worker/_worker";

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

  return { db: db as unknown as AdminEnv["DB"], rows, selects, inserts };
}

beforeEach(() => {
  __resetErrorLogThrottle();
});

describe("logAdminError", () => {
  it("hai lần liên tiếp trong cùng isolate chỉ chèn 1 dòng", async () => {
    const fake = statefulDb();

    expect(await logAdminError({ DB: fake.db }, "chat", "d1_error")).toBe(true);
    expect(await logAdminError({ DB: fake.db }, "chat", "d1_error")).toBe(false);

    expect(fake.inserts).toHaveLength(1);
    expect(fake.selects).toHaveLength(1);
  });

  it("isolate khác (Map rỗng) vẫn thấy dòng cũ trong D1 nên không chèn trùng", async () => {
    const fake = statefulDb();

    await logAdminError({ DB: fake.db }, "livekit", "unreachable");
    __resetErrorLogThrottle();

    expect(await logAdminError({ DB: fake.db }, "livekit", "unreachable")).toBe(false);
    expect(fake.inserts).toHaveLength(1);
  });

  it("quá 1 giờ thì chèn thêm dòng mới", async () => {
    const fake = statefulDb();

    await logAdminError({ DB: fake.db }, "r2", "r2_error");
    fake.rows[0].created_at -= 2 * HOUR;
    __resetErrorLogThrottle();

    expect(await logAdminError({ DB: fake.db }, "r2", "r2_error")).toBe(true);
    expect(fake.inserts).toHaveLength(2);
  });

  it("khác source hoặc code thì không chặn nhau", async () => {
    const fake = statefulDb();

    expect(await logAdminError({ DB: fake.db }, "chat", "d1_error")).toBe(true);
    expect(await logAdminError({ DB: fake.db }, "chat", "http_500")).toBe(true);
    expect(await logAdminError({ DB: fake.db }, "sync", "d1_error")).toBe(true);

    expect(fake.inserts).toHaveLength(3);
  });

  it("D1 lỗi khi đọc dòng gần nhất thì bỏ qua, không chèn và không ném", async () => {
    const fake = statefulDb({ failSelect: true });

    await expect(logAdminError({ DB: fake.db }, "chat", "d1_error")).resolves.toBe(
      false,
    );
    expect(fake.inserts).toHaveLength(0);
  });

  it("thiếu binding DB thì trả false", async () => {
    await expect(logAdminError({}, "chat", "d1_error")).resolves.toBe(false);
  });
});
