import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import worker, {
  __resetAccessCertsCache,
  __resetAuditWriteLog,
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

const SEED_AUDIT: Row[] = [
  {
    id: 3,
    actor_email: "admin@example.com",
    action: "feedback.delete",
    target: "feedback-0001",
    detail_json: '{"kind":"bug"}',
    created_at: NOW - 1000,
  },
  {
    id: 2,
    actor_email: "admin@example.com",
    action: "flags.update",
    target: "cfg:flags",
    detail_json: "{}",
    created_at: NOW - 2000,
  },
];

function fakeDb(options: { failAudit?: boolean } = {}) {
  const audit: Row[] = SEED_AUDIT.map((row) => ({ ...row }));
  const errors: Row[] = [{ id: 1 }, { id: 2 }];

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
          audit.push({
            id: audit.length + 1,
            actor_email: String(bound[0]),
            action: String(bound[1]),
            target: String(bound[2]),
            detail_json: String(bound[3]),
            created_at: Number(bound[4]),
          });
          return {};
        }
        if (q === "DELETE FROM admin_audit") {
          const changes = audit.length;
          audit.length = 0;
          return { meta: { changes } };
        }
        if (q === "DELETE FROM admin_error_log") {
          const changes = errors.length;
          errors.length = 0;
          return { meta: { changes } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        if (q === "SELECT COUNT(*) AS n FROM admin_audit") return { n: audit.length };
        if (q === "SELECT COUNT(*) AS n FROM admin_error_log") return { n: errors.length };
        return null;
      },
      async all() {
        if (q.startsWith("SELECT id, actor_email, action, target")) {
          const [beforeParam, beforeValue] = bound;
          const limitMatch = /LIMIT (\d+)/.exec(q);
          const limit = limitMatch ? Number(limitMatch[1]) : 50;
          const rows = audit
            .filter(
              (row) =>
                Number(beforeParam) === 0 || Number(row.created_at) < Number(beforeValue),
            )
            .slice()
            .sort((a, b) => Number(b.created_at) - Number(a.created_at))
            .slice(0, limit);
          return { results: rows };
        }
        return { results: [] };
      },
    };
    return stmt;
  };

  return { db: { prepare }, audit, errors };
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
  __resetAuditWriteLog();
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
  options: { method?: string; withToken?: boolean } = {},
): Request {
  return new Request(
    accessRequest(options.withToken === false ? undefined : token, path).url,
    {
      method: options.method || "GET",
      headers: options.withToken === false ? {} : { "Cf-Access-Jwt-Assertion": token },
    },
  );
}

function envFor(fake: ReturnType<typeof fakeDb>): AdminEnv {
  return baseEnv({ DB: fake.db as unknown as AdminEnv["DB"] });
}

describe("Admin P3.17 — nhật ký lỗi và thao tác", () => {
  it("thiếu Access token thì 401", async () => {
    const fake = fakeDb();
    stubCerts();
    const res = await worker.fetch(
      req("/api/admin/audit", { withToken: false }),
      envFor(fake),
    );
    expect(res.status).toBe(401);
  });

  it("đọc nhật ký thao tác, mới nhất trước", async () => {
    const fake = fakeDb();
    stubCerts();
    const res = await worker.fetch(req("/api/admin/audit?limit=50"), envFor(fake));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.items.map((item: Row) => item.action)).toEqual([
      "feedback.delete",
      "flags.update",
    ]);
    expect(body.items[0]).toMatchObject({
      actorEmail: "admin@example.com",
      target: "feedback-0001",
      detail: '{"kind":"bug"}',
    });
  });

  it("phân trang nhật ký bằng before", async () => {
    const fake = fakeDb();
    stubCerts();
    const first = await worker.fetch(req("/api/admin/audit?limit=1"), envFor(fake));
    const firstBody = await first.json();
    expect(firstBody.items).toHaveLength(1);
    expect(firstBody.nextBefore).toBe(SEED_AUDIT[0].created_at);

    const second = await worker.fetch(
      req(`/api/admin/audit?limit=2&before=${firstBody.nextBefore}`),
      envFor(fake),
    );
    const secondBody = await second.json();
    expect(secondBody.items[0].action).toBe("flags.update");
    expect(secondBody.nextBefore).toBeNull();
  });

  it("xoá nhật ký thao tác vẫn giữ dòng audit.clear", async () => {
    const fake = fakeDb();
    stubCerts();
    const res = await worker.fetch(
      req("/api/admin/audit", { method: "DELETE" }),
      envFor(fake),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deleted: 2, audited: true });
    expect(fake.audit).toHaveLength(1);
    expect(fake.audit[0]).toMatchObject({
      action: "audit.clear",
      target: "admin_audit",
      detail_json: '{"count":2}',
    });
  });

  it("xoá nhật ký lỗi: audit trước rồi mới xoá", async () => {
    const fake = fakeDb();
    stubCerts();
    const res = await worker.fetch(
      req("/api/admin/errors", { method: "DELETE" }),
      envFor(fake),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deleted: 2 });
    expect(fake.errors).toHaveLength(0);
    expect(fake.audit.some((row) => row.action === "errors.clear")).toBe(true);
  });

  it("audit lỗi thì không xoá nhật ký lỗi", async () => {
    const broken = fakeDb({ failAudit: true });
    stubCerts();
    const res = await worker.fetch(
      req("/api/admin/errors", { method: "DELETE" }),
      envFor(broken),
    );
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("audit_failed");
    expect(broken.errors).toHaveLength(2);
  });

  it("chỉ nhận đúng method cho từng endpoint", async () => {
    const fake = fakeDb();
    stubCerts();
    const errorsGet = await worker.fetch(req("/api/admin/errors"), envFor(fake));
    expect(errorsGet.status).toBe(405);

    const auditPost = await worker.fetch(
      req("/api/admin/audit", { method: "POST" }),
      envFor(fake),
    );
    expect(auditPost.status).toBe(405);
  });

  it("giới hạn 10 lần xoá mỗi phút", async () => {
    const fake = fakeDb();
    stubCerts();
    const env = envFor(fake);
    for (let i = 0; i < 10; i += 1) {
      const res = await worker.fetch(
        req("/api/admin/errors", { method: "DELETE" }),
        env,
      );
      expect(res.status).toBe(200);
    }
    const limited = await worker.fetch(
      req("/api/admin/errors", { method: "DELETE" }),
      env,
    );
    expect(limited.status).toBe(429);
    expect((await limited.json()).error).toBe("rate_limited");
  });

  it("thiếu binding DB thì 500", async () => {
    stubCerts();
    const res = await worker.fetch(req("/api/admin/audit"), baseEnv());
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("missing_binding");
  });
});
