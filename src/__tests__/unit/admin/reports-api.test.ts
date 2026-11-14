import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import worker, {
  __resetAccessCertsCache,
  __resetReportWriteLog,
  type AdminEnv,
} from "../../../../admin-worker/_worker";
import {
  CERT_URL,
  accessRequest,
  baseEnv,
  certsResponse,
  createKeyPair,
  exportJwk,
  makeToken,
  validClaims,
} from "./access-fixtures";

type Row = Record<string, any>;

const NOW = Date.now();

const SEED_REPORTS: Row[] = [
  {
    id: "report-0001",
    source: "ai",
    reporter_uid: "user_alice",
    reporter_name: "Bạn An",
    target_uid: null,
    target_name: null,
    room: null,
    session_id: "sid-1",
    message_id: "msg-1",
    content: "Câu trả lời sai kiến thức.",
    question: "Newton là gì?",
    reason: "inaccurate",
    detail: "",
    status: "open",
    created_at: NOW - 2000,
    resolved_at: 0,
    resolved_by: "",
    resolution_note: "",
  },
  {
    id: "report-0002",
    source: "room",
    reporter_uid: "user_alice",
    target_uid: "user_bob",
    room: "phong-1",
    session_id: null,
    message_id: null,
    content: "Quấy rối trong phòng.",
    reason: "harassment",
    detail: "",
    status: "open",
    created_at: NOW - 3000,
    resolved_at: 0,
    resolved_by: "",
    resolution_note: "",
  },
  {
    id: "report-0003",
    source: "room",
    reporter_uid: "user_bob",
    target_uid: "user_carol",
    room: "phong-2",
    session_id: null,
    message_id: null,
    content: "Đã xử lý trước đó.",
    reason: "spam",
    detail: "",
    status: "resolved",
    created_at: NOW - 1000,
    resolved_at: NOW - 1500,
    resolved_by: "admin@example.com",
    resolution_note: "Đã nhắc nhở.",
  },
];

function fakeDb(options: { failAudit?: boolean } = {}) {
  const reports: Row[] = SEED_REPORTS.map((row) => ({ ...row }));
  const restrictions = new Map<string, Row>();
  const events: string[] = [];

  const prepare = (query: string) => {
    const q = query.replace(/\s+/g, " ").trim();
    let bound: unknown[] = [];
    const stmt = {
      bind(...values: unknown[]) {
        bound = values;
        return stmt;
      },
      async run() {
        if (q.startsWith("INSERT INTO admin_audit")) {
          if (options.failAudit) throw new Error("D1 audit lỗi");
          events.push(`audit:${String(bound[1])}`);
          return {};
        }
        if (q.startsWith("DELETE FROM content_reports WHERE id = ?")) {
          const [id] = bound;
          const index = reports.findIndex((row) => row.id === id);
          if (index === -1) return { meta: { changes: 0 } };
          reports.splice(index, 1);
          return { meta: { changes: 1 } };
        }
        if (q.startsWith("DELETE FROM content_reports WHERE status IN")) {
          let removed = 0;
          for (let i = reports.length - 1; i >= 0; i -= 1) {
            if (reports[i].status === "resolved" || reports[i].status === "dismissed") {
              reports.splice(i, 1);
              removed += 1;
            }
          }
          return { meta: { changes: removed } };
        }
        if (q.startsWith("UPDATE content_reports SET status")) {
          const [status, resolvedAt, resolvedBy, note, id] = bound;
          const row = reports.find((item) => item.id === id);
          if (!row) return { meta: { changes: 0 } };
          row.status = status;
          row.resolved_at = resolvedAt;
          row.resolved_by = resolvedBy;
          row.resolution_note = note;
          return { meta: { changes: 1 } };
        }
        if (q.startsWith("INSERT INTO user_restrictions")) {
          const [uid, ai, rooms, note, updatedAt, updatedBy] = bound;
          restrictions.set(String(uid), {
            uid,
            ai_disabled: ai,
            rooms_disabled: rooms,
            note,
            updated_at: updatedAt,
            updated_by: updatedBy,
          });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        if (q.startsWith("SELECT COUNT(*) AS n FROM content_reports WHERE status IN")) {
          const n = reports.filter(
            (row) => row.status === "resolved" || row.status === "dismissed",
          ).length;
          return { n };
        }
        if (q.startsWith("SELECT id, source, reporter_uid, status FROM content_reports")) {
          const [id] = bound;
          return reports.find((row) => row.id === id) || null;
        }
        if (q.startsWith("SELECT uid, ai_disabled")) {
          const [uid] = bound;
          return restrictions.get(String(uid)) || null;
        }
        if (
          q.startsWith("SELECT id, source, reporter_uid") &&
          q.includes(" resolution_note ") &&
          q.includes("FROM content_reports WHERE id = ?")
        ) {
          const [id] = bound;
          return reports.find((row) => row.id === id) || null;
        }
        return null;
      },
      async all() {
        if (q.startsWith("SELECT status, COUNT(*) AS n FROM content_reports")) {
          const counts = new Map<string, number>();
          for (const row of reports) {
            counts.set(row.status, (counts.get(row.status) || 0) + 1);
          }
          return {
            results: Array.from(counts.entries()).map(([status, n]) => ({ status, n })),
          };
        }
        if (q.startsWith("SELECT id, source, reporter_uid") && q.includes("content_preview")) {
          const [statusParam, statusValue, sourceParam, sourceValue, beforeParam, beforeValue] =
            bound;
          const limitMatch = /LIMIT (\d+)/.exec(q);
          const limit = limitMatch ? Number(limitMatch[1]) : 50;
          let rows = reports.filter((row) => {
            if (statusParam !== "all" && row.status !== statusValue) return false;
            if (sourceParam !== "all" && row.source !== sourceValue) return false;
            if (Number(beforeParam) !== 0 && Number(row.created_at) >= Number(beforeValue)) {
              return false;
            }
            return true;
          });
          rows = rows
            .slice()
            .sort((a, b) => Number(b.created_at) - Number(a.created_at))
            .slice(0, limit)
            .map((row) => ({
              ...row,
              content_preview: String(row.content || "").slice(0, 300),
            }));
          return { results: rows };
        }
        return { results: [] };
      },
    };
    return stmt;
  };

  return { db: { prepare }, reports, restrictions, events };
}

let pair: CryptoKeyPair;
let jwk: JsonWebKey;
let token: string;

beforeAll(async () => {
  pair = await createKeyPair();
  jwk = await exportJwk(pair);
  token = await makeToken(pair.privateKey, validClaims());
});

beforeEach(() => {
  __resetAccessCertsCache();
  __resetReportWriteLog();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubCerts(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === CERT_URL) return certsResponse([jwk]);
      return new Response("not found", { status: 404 });
    }),
  );
}

function req(
  path: string,
  options: { method?: string; body?: unknown; withToken?: boolean } = {},
): Request {
  const base = accessRequest(options.withToken === false ? undefined : token, path);
  if (!options.method && options.body === undefined) return base;
  return new Request(base.url, {
    method: options.method || "GET",
    headers: {
      ...(options.withToken === false ? {} : { "Cf-Access-Jwt-Assertion": token }),
      "Content-Type": "application/json",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

function envFor(fake: ReturnType<typeof fakeDb>): AdminEnv {
  return baseEnv({ DB: fake.db as unknown as AdminEnv["DB"] });
}

describe("Admin P2e — API báo cáo", () => {
  it("thiếu Access token thì 401", async () => {
    const fake = fakeDb();
    stubCerts();
    const res = await worker.fetch(req("/api/admin/reports", { withToken: false }), envFor(fake));
    expect(res.status).toBe(401);
  });

  it("lọc theo trạng thái/nguồn và trả số đếm", async () => {
    const fake = fakeDb();
    stubCerts();
    const res = await worker.fetch(
      req("/api/admin/reports?status=open&source=all&limit=50"),
      envFor(fake),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.reports.map((item: Row) => item.id)).toEqual([
      "report-0001",
      "report-0002",
    ]);
    expect(body.counts).toEqual({ open: 2, resolved: 1, dismissed: 0, total: 3 });
    expect(body.reports[0]).toMatchObject({
      source: "ai",
      reporterUid: "user_alice",
      contentPreview: "Câu trả lời sai kiến thức.",
    });
    expect(body.reports[0].content).toBeUndefined();
  });

  it("phân trang bằng before, không tự dọn báo cáo cũ", async () => {
    const fake = fakeDb();
    fake.reports.push({
      id: "report-old-1",
      source: "ai",
      reporter_uid: "user_alice",
      status: "open",
      content: "báo cáo cũ",
      reason: "other",
      created_at: Date.now() - 181 * 24 * 60 * 60 * 1000,
    });
    stubCerts();

    const first = await worker.fetch(
      req("/api/admin/reports?status=open&source=all&limit=1"),
      envFor(fake),
    );
    const firstBody = await first.json();
    expect(firstBody.reports.map((item: Row) => item.id)).toEqual(["report-0001"]);
    expect(firstBody.nextBefore).toBe(
      fake.reports.find((row) => row.id === "report-0001")!.created_at,
    );
    expect(fake.reports.some((row) => row.id === "report-old-1")).toBe(true);

    const second = await worker.fetch(
      req(
        `/api/admin/reports?status=open&source=all&limit=1&before=${firstBody.nextBefore}`,
      ),
      envFor(fake),
    );
    expect((await second.json()).reports.map((item: Row) => item.id)).toEqual([
      "report-0002",
    ]);
  });

  it("lấy chi tiết trả nội dung đầy đủ, không có thì 404", async () => {
    const fake = fakeDb();
    stubCerts();
    const ok = await worker.fetch(req("/api/admin/reports/report-0001"), envFor(fake));
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.report.content).toBe("Câu trả lời sai kiến thức.");
    expect(body.report.question).toBe("Newton là gì?");
    expect(body.report.reporterName).toBe("Bạn An");

    const missing = await worker.fetch(req("/api/admin/reports/report-9999"), envFor(fake));
    expect(missing.status).toBe(404);
  });

  it("xử lý báo cáo: audit trước, đổi trạng thái; audit lỗi thì không ghi", async () => {
    const fake = fakeDb();
    stubCerts();
    const res = await worker.fetch(
      req("/api/admin/reports/report-0001/resolve", {
        method: "POST",
        body: { status: "resolved", note: "Đã kiểm tra." },
      }),
      envFor(fake),
    );
    expect(res.status).toBe(200);
    expect(fake.events).toContain("audit:report.resolve");
    expect(fake.reports.find((row) => row.id === "report-0001")).toMatchObject({
      status: "resolved",
      resolution_note: "Đã kiểm tra.",
      resolved_by: "admin@example.com",
    });

    const broken = fakeDb({ failAudit: true });
    const failed = await worker.fetch(
      req("/api/admin/reports/report-0002/resolve", {
        method: "POST",
        body: { status: "dismissed" },
      }),
      envFor(broken),
    );
    expect(failed.status).toBe(500);
    expect((await failed.json()).error).toBe("audit_failed");
    expect(broken.reports.find((row) => row.id === "report-0002")!.status).toBe("open");
  });

  it("từ chối trạng thái không hợp lệ", async () => {
    const fake = fakeDb();
    stubCerts();
    const res = await worker.fetch(
      req("/api/admin/reports/report-0001/resolve", {
        method: "POST",
        body: { status: "open" },
      }),
      envFor(fake),
    );
    expect(res.status).toBe(400);
  });

  it("xoá một báo cáo: audit trước, rồi xoá dòng", async () => {
    const fake = fakeDb();
    stubCerts();
    const res = await worker.fetch(
      req("/api/admin/reports/report-0001", { method: "DELETE" }),
      envFor(fake),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deleted: 1 });
    expect(fake.events).toContain("audit:report.delete");
    expect(fake.reports.some((row) => row.id === "report-0001")).toBe(false);

    const missing = await worker.fetch(
      req("/api/admin/reports/report-0001", { method: "DELETE" }),
      envFor(fake),
    );
    expect(missing.status).toBe(404);
  });

  it("xoá báo cáo khi audit lỗi thì giữ nguyên dòng", async () => {
    const broken = fakeDb({ failAudit: true });
    stubCerts();
    const res = await worker.fetch(
      req("/api/admin/reports/report-0001", { method: "DELETE" }),
      envFor(broken),
    );
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("audit_failed");
    expect(broken.reports.some((row) => row.id === "report-0001")).toBe(true);
  });

  it("xóa loạt chỉ đụng báo cáo đã xử lý/đã bỏ qua", async () => {
    const fake = fakeDb();
    stubCerts();
    const res = await worker.fetch(
      req("/api/admin/reports/purge", { method: "POST" }),
      envFor(fake),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deleted: 1 });
    expect(fake.events).toContain("audit:report.purge");
    expect(fake.reports.map((row) => row.id).sort()).toEqual([
      "report-0001",
      "report-0002",
    ]);
  });

  it("xóa loạt khi không có mục đã xử lý thì không audit", async () => {
    const fake = fakeDb();
    fake.reports.splice(2, 1);
    stubCerts();
    const res = await worker.fetch(
      req("/api/admin/reports/purge", { method: "POST" }),
      envFor(fake),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deleted: 0 });
    expect(fake.events).toEqual([]);
  });

  it("chỉ nhận DELETE ở endpoint chi tiết", async () => {
    const fake = fakeDb();
    stubCerts();
    const res = await worker.fetch(
      req("/api/admin/reports/report-0001", { method: "POST", body: {} }),
      envFor(fake),
    );
    expect(res.status).toBe(405);
  });

  it("đọc mặc định và lưu hạn chế tài khoản", async () => {
    const fake = fakeDb();
    stubCerts();
    const before = await worker.fetch(
      req("/api/admin/users/user_bob/restrictions"),
      envFor(fake),
    );
    expect((await before.json()).restrictions).toMatchObject({
      aiDisabled: false,
      roomsDisabled: false,
    });

    const saved = await worker.fetch(
      req("/api/admin/users/user_bob/restrictions", {
        method: "POST",
        body: { aiDisabled: true, roomsDisabled: false, note: "Quấy rối trong phòng." },
      }),
      envFor(fake),
    );
    expect(saved.status).toBe(200);
    expect(fake.events).toContain("audit:user.restrictions");
    expect(fake.restrictions.get("user_bob")).toMatchObject({
      ai_disabled: 1,
      rooms_disabled: 0,
      note: "Quấy rối trong phòng.",
      updated_by: "admin@example.com",
    });
  });
});
