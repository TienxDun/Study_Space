import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import worker, {
  __resetAccessCertsCache,
  __resetFeedbackWriteLog,
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
const DAY = 24 * 60 * 60 * 1000;

const SEED_FEEDBACK: Row[] = [
  {
    id: "feedback-0001",
    uid: "user_alice",
    name: "Bạn An",
    kind: "bug",
    message: "Nút bấm ở bảng công việc không phản hồi trên điện thoại.",
    contact: "an@example.com",
    app_version: "v0.1.0",
    platform: "android",
    viewport: "390x844",
    locale: "vi-VN",
    status: "open",
    created_at: NOW - 2000,
    resolved_at: 0,
    resolved_by: "",
    resolution_note: "",
    image_key: "feedback/2026-11/feedback-0001.jpg",
  },
  {
    id: "feedback-0002",
    uid: "user_bob",
    name: "Bạn Bình",
    kind: "idea",
    message: "Mong có thêm chế độ học nhóm theo chủ đề.",
    contact: null,
    app_version: "v0.1.0",
    platform: "web",
    viewport: "1280x800",
    locale: "vi-VN",
    status: "open",
    created_at: NOW - 3000,
    resolved_at: 0,
    resolved_by: "",
    resolution_note: "",
  },
  {
    id: "feedback-0003",
    uid: "user_carol",
    name: null,
    kind: "other",
    message: "Cảm ơn nhóm phát triển, ứng dụng rất hữu ích.",
    contact: null,
    app_version: "",
    platform: "web",
    viewport: "1440x900",
    locale: "en-US",
    status: "resolved",
    created_at: NOW - 1000,
    resolved_at: NOW - 500,
    resolved_by: "admin@example.com",
    resolution_note: "Đã đọc.",
  },
];

function fakeDb(options: { failAudit?: boolean } = {}) {
  const items: Row[] = SEED_FEEDBACK.map((row) => ({ ...row }));
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
        if (q.startsWith("DELETE FROM user_feedback WHERE id = ?")) {
          const [id] = bound;
          const index = items.findIndex((row) => row.id === id);
          if (index === -1) return { meta: { changes: 0 } };
          items.splice(index, 1);
          return { meta: { changes: 1 } };
        }
        if (q.startsWith("DELETE FROM user_feedback WHERE status IN")) {
          let removed = 0;
          for (let i = items.length - 1; i >= 0; i -= 1) {
            if (items[i].status === "resolved" || items[i].status === "dismissed") {
              items.splice(i, 1);
              removed += 1;
            }
          }
          return { meta: { changes: removed } };
        }
        if (q.startsWith("UPDATE user_feedback SET status")) {
          const [status, resolvedAt, resolvedBy, note, id] = bound;
          const row = items.find((item) => item.id === id);
          if (!row) return { meta: { changes: 0 } };
          row.status = status;
          row.resolved_at = resolvedAt;
          row.resolved_by = resolvedBy;
          row.resolution_note = note;
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        if (q.startsWith("SELECT id, uid, kind, status, image_key FROM user_feedback")) {
          const [id] = bound;
          return items.find((row) => row.id === id) || null;
        }
        if (q.startsWith("SELECT id, uid, kind, status FROM user_feedback")) {
          const [id] = bound;
          return items.find((row) => row.id === id) || null;
        }
        if (q.startsWith("SELECT image_key FROM user_feedback WHERE id = ?")) {
          const [id] = bound;
          const row = items.find((item) => item.id === id);
          return row ? { image_key: row.image_key || null } : null;
        }
        if (
          q.startsWith("SELECT id, uid, name, kind, message") &&
          q.includes("FROM user_feedback WHERE id = ?")
        ) {
          const [id] = bound;
          return items.find((row) => row.id === id) || null;
        }
        return null;
      },
      async all() {
        if (q.startsWith("SELECT id, image_key FROM user_feedback WHERE status IN")) {
          return {
            results: items
              .filter((row) => row.status === "resolved" || row.status === "dismissed")
              .map((row) => ({ id: row.id, image_key: row.image_key || null })),
          };
        }
        if (q.startsWith("SELECT status, COUNT(*) AS n FROM user_feedback")) {
          const counts = new Map<string, number>();
          for (const row of items) {
            counts.set(row.status, (counts.get(row.status) || 0) + 1);
          }
          return {
            results: Array.from(counts.entries()).map(([status, n]) => ({ status, n })),
          };
        }
        if (q.startsWith("SELECT id, uid, name, kind, substr(message, 1, 300)")) {
          const [statusParam, statusValue, kindParam, kindValue, beforeParam, beforeValue] = bound;
          const limitMatch = /LIMIT (\d+)/.exec(q);
          const limit = limitMatch ? Number(limitMatch[1]) : 50;
          const rows = items
            .filter((row) => {
              if (statusParam !== "all" && row.status !== statusValue) return false;
              if (kindParam !== "all" && row.kind !== kindValue) return false;
              if (Number(beforeParam) !== 0 && Number(row.created_at) >= Number(beforeValue)) {
                return false;
              }
              return true;
            })
            .slice()
            .sort((a, b) => Number(b.created_at) - Number(a.created_at))
            .slice(0, limit)
            .map((row) => ({
              ...row,
              message_preview: String(row.message || "").slice(0, 300),
            }));
          return { results: rows };
        }
        return { results: [] };
      },
    };
    return stmt;
  };

  return { db: { prepare }, items, events };
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
  __resetFeedbackWriteLog();
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

function fakeR2(objects: Record<string, { body: string; contentType?: string }> = {}) {
  const deleted: string[] = [];
  const bucket = {
    list: async () => ({ objects: [] }),
    get: async (key: string) => {
      const item = objects[key];
      if (!item) return null;
      const bytes = new TextEncoder().encode(item.body);
      return {
        body: new Blob([bytes]).stream(),
        size: bytes.byteLength,
        httpMetadata: { contentType: item.contentType },
      };
    },
    delete: async (keys: string | string[]) => {
      deleted.push(...(Array.isArray(keys) ? keys : [keys]));
    },
  };
  return { bucket, deleted };
}

function envFor(
  fake: ReturnType<typeof fakeDb>,
  extra: Partial<AdminEnv> = {},
): AdminEnv {
  return baseEnv({ DB: fake.db as unknown as AdminEnv["DB"], ...extra });
}

describe("Admin P3.16 — API góp ý", () => {
  it("thiếu Access token thì 401", async () => {
    const fake = fakeDb();
    stubCerts();
    const res = await worker.fetch(req("/api/admin/feedback", { withToken: false }), envFor(fake));
    expect(res.status).toBe(401);
  });

  it("lọc theo trạng thái/loại, trả số đếm và trích nội dung", async () => {
    const fake = fakeDb();
    stubCerts();
    const res = await worker.fetch(
      req("/api/admin/feedback?status=open&kind=all&limit=50"),
      envFor(fake),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.feedback.map((item: Row) => item.id)).toEqual([
      "feedback-0001",
      "feedback-0002",
    ]);
    expect(body.counts).toEqual({ open: 2, resolved: 1, dismissed: 0, total: 3 });
    expect(body.feedback[0]).toMatchObject({
      uid: "user_alice",
      name: "Bạn An",
      kind: "bug",
      hasImage: true,
      preview: "Nút bấm ở bảng công việc không phản hồi trên điện thoại.",
    });
    expect(body.feedback[1].hasImage).toBe(false);
    expect(body.feedback[0].message).toBeUndefined();
  });

  it("từ chối trạng thái/loại không hợp lệ", async () => {
    const fake = fakeDb();
    stubCerts();
    const badStatus = await worker.fetch(
      req("/api/admin/feedback?status=spam"),
      envFor(fake),
    );
    expect(badStatus.status).toBe(400);
    const badKind = await worker.fetch(req("/api/admin/feedback?kind=spam"), envFor(fake));
    expect(badKind.status).toBe(400);
  });

  it("phân trang bằng before, không tự dọn góp ý cũ", async () => {
    const fake = fakeDb();
    fake.items.push({
      id: "feedback-old-1",
      uid: "user_alice",
      name: "Bạn An",
      kind: "bug",
      message: "góp ý cũ",
      status: "open",
      created_at: Date.now() - 181 * DAY,
    });
    stubCerts();

    const first = await worker.fetch(
      req("/api/admin/feedback?status=open&kind=all&limit=1"),
      envFor(fake),
    );
    const firstBody = await first.json();
    expect(firstBody.feedback.map((item: Row) => item.id)).toEqual(["feedback-0001"]);
    expect(firstBody.nextBefore).toBe(
      fake.items.find((row) => row.id === "feedback-0001")!.created_at,
    );
    expect(fake.items.some((row) => row.id === "feedback-old-1")).toBe(true);

    const second = await worker.fetch(
      req(`/api/admin/feedback?status=open&kind=all&limit=1&before=${firstBody.nextBefore}`),
      envFor(fake),
    );
    expect((await second.json()).feedback.map((item: Row) => item.id)).toEqual([
      "feedback-0002",
    ]);
  });

  it("lấy chi tiết trả nội dung đầy đủ, không có thì 404", async () => {
    const fake = fakeDb();
    stubCerts();
    const ok = await worker.fetch(req("/api/admin/feedback/feedback-0001"), envFor(fake));
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.feedback.message).toBe(
      "Nút bấm ở bảng công việc không phản hồi trên điện thoại.",
    );
    expect(body.feedback.contact).toBe("an@example.com");
    expect(body.feedback.platform).toBe("android");
    expect(body.feedback.hasImage).toBe(true);

    const missing = await worker.fetch(req("/api/admin/feedback/feedback-9999"), envFor(fake));
    expect(missing.status).toBe(404);
  });

  it("ảnh đính kèm trả qua proxy Access với cache riêng", async () => {
    const fake = fakeDb();
    const r2 = fakeR2({
      "feedback/2026-11/feedback-0001.jpg": {
        body: "jpeg-bytes",
        contentType: "image/jpeg",
      },
    });
    stubCerts();

    const res = await worker.fetch(
      req("/api/admin/feedback/feedback-0001/image"),
      envFor(fake, { R2: r2.bucket }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=300");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await res.text()).toBe("jpeg-bytes");

    // Góp ý không có ảnh, id lạ hoặc R2 mất file đều là 404.
    const noImage = await worker.fetch(
      req("/api/admin/feedback/feedback-0002/image"),
      envFor(fake, { R2: r2.bucket }),
    );
    expect(noImage.status).toBe(404);

    const unknown = await worker.fetch(
      req("/api/admin/feedback/feedback-9999/image"),
      envFor(fake, { R2: r2.bucket }),
    );
    expect(unknown.status).toBe(404);

    fake.items.find((row) => row.id === "feedback-0001")!.image_key =
      "feedback/2026-11/lost.jpg";
    const lost = await worker.fetch(
      req("/api/admin/feedback/feedback-0001/image"),
      envFor(fake, { R2: r2.bucket }),
    );
    expect(lost.status).toBe(404);
  });

  it("xoá một góp ý: audit trước, xoá dòng và ảnh R2", async () => {
    const fake = fakeDb();
    const r2 = fakeR2();
    stubCerts();

    const res = await worker.fetch(
      req("/api/admin/feedback/feedback-0001", { method: "DELETE" }),
      envFor(fake, { R2: r2.bucket }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deleted: 1 });
    expect(fake.events).toContain("audit:feedback.delete");
    expect(fake.items.some((row) => row.id === "feedback-0001")).toBe(false);
    expect(r2.deleted).toEqual(["feedback/2026-11/feedback-0001.jpg"]);

    const missing = await worker.fetch(
      req("/api/admin/feedback/feedback-0001", { method: "DELETE" }),
      envFor(fake, { R2: r2.bucket }),
    );
    expect(missing.status).toBe(404);
  });

  it("xoá góp ý khi audit lỗi thì giữ nguyên dòng", async () => {
    const broken = fakeDb({ failAudit: true });
    stubCerts();
    const res = await worker.fetch(
      req("/api/admin/feedback/feedback-0001", { method: "DELETE" }),
      envFor(broken),
    );
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("audit_failed");
    expect(broken.items.some((row) => row.id === "feedback-0001")).toBe(true);
  });

  it("xóa loạt chỉ đụng góp ý đã xử lý/đã bỏ qua và xoá ảnh kèm", async () => {
    const fake = fakeDb();
    const r2 = fakeR2();
    fake.items.push({
      id: "feedback-0004",
      uid: "user_bob",
      name: "Bạn Bình",
      kind: "bug",
      message: "góp ý đã bỏ qua",
      status: "dismissed",
      created_at: NOW - 4000,
      image_key: "feedback/2026-11/feedback-0004.jpg",
    });
    stubCerts();

    const res = await worker.fetch(
      req("/api/admin/feedback/purge", { method: "POST" }),
      envFor(fake, { R2: r2.bucket }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deleted: 2 });
    expect(fake.events).toContain("audit:feedback.purge");
    expect(fake.items.map((row) => row.id).sort()).toEqual([
      "feedback-0001",
      "feedback-0002",
    ]);
    expect(r2.deleted).toEqual(["feedback/2026-11/feedback-0004.jpg"]);
  });

  it("xóa loạt khi không có mục đã xử lý thì không audit", async () => {
    const fake = fakeDb();
    fake.items.splice(2, 1);
    stubCerts();
    const res = await worker.fetch(
      req("/api/admin/feedback/purge", { method: "POST" }),
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
      req("/api/admin/feedback/feedback-0001", { method: "POST", body: {} }),
      envFor(fake),
    );
    expect(res.status).toBe(405);
  });

  it("xử lý góp ý: audit trước, đổi trạng thái; audit lỗi thì không ghi", async () => {
    const fake = fakeDb();
    stubCerts();
    const res = await worker.fetch(
      req("/api/admin/feedback/feedback-0001/status", {
        method: "POST",
        body: { status: "resolved", note: "Đã sửa ở bản kế tiếp." },
      }),
      envFor(fake),
    );
    expect(res.status).toBe(200);
    expect(fake.events).toContain("audit:feedback.resolve");
    expect(fake.items.find((row) => row.id === "feedback-0001")).toMatchObject({
      status: "resolved",
      resolution_note: "Đã sửa ở bản kế tiếp.",
      resolved_by: "admin@example.com",
    });

    const broken = fakeDb({ failAudit: true });
    const failed = await worker.fetch(
      req("/api/admin/feedback/feedback-0002/status", {
        method: "POST",
        body: { status: "dismissed" },
      }),
      envFor(broken),
    );
    expect(failed.status).toBe(500);
    expect((await failed.json()).error).toBe("audit_failed");
    expect(broken.items.find((row) => row.id === "feedback-0002")!.status).toBe("open");
  });

  it("từ chối trạng thái không hợp lệ và id không tồn tại", async () => {
    const fake = fakeDb();
    stubCerts();
    const bad = await worker.fetch(
      req("/api/admin/feedback/feedback-0001/status", {
        method: "POST",
        body: { status: "open" },
      }),
      envFor(fake),
    );
    expect(bad.status).toBe(400);

    const missing = await worker.fetch(
      req("/api/admin/feedback/feedback-9999/status", {
        method: "POST",
        body: { status: "resolved" },
      }),
      envFor(fake),
    );
    expect(missing.status).toBe(404);
  });

  it("giới hạn ghi 30 lượt mỗi phút", async () => {
    const fake = fakeDb();
    stubCerts();
    const env = envFor(fake);
    for (let i = 0; i < 30; i += 1) {
      const res = await worker.fetch(
        req("/api/admin/feedback/feedback-0001/status", {
          method: "POST",
          body: { status: "resolved" },
        }),
        env,
      );
      expect(res.status).toBe(200);
    }
    const limited = await worker.fetch(
      req("/api/admin/feedback/feedback-0001/status", {
        method: "POST",
        body: { status: "resolved" },
      }),
      env,
    );
    expect(limited.status).toBe(429);
    expect((await limited.json()).error).toBe("rate_limited");
  });

  it("thiếu binding DB thì 500", async () => {
    stubCerts();
    const res = await worker.fetch(req("/api/admin/feedback"), baseEnv());
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("missing_binding");
  });
});
