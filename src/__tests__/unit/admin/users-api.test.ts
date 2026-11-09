import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import worker, {
  __resetAccessCertsCache,
  type AdminEnv,
} from "../../../../admin-worker/_worker";
import { pacificDay } from "../../../../admin-worker/usage";
import {
  CERT_URL,
  accessRequest,
  baseEnv,
  certsResponse,
  createKeyPair,
  exportJwk,
  fakeKv,
  makeToken,
  validClaims,
} from "./access-fixtures";

type Row = Record<string, any>;

const DATA_BASE = "https://data.example.com";
const TODAY = pacificDay();
const YESTERDAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date(Date.now() - 24 * 60 * 60 * 1000));

const USERS: Row[] = [
  {
    uid: "uid_alice",
    email: "alice@example.com",
    displayName: "Bạn An",
    createdAt: 1700000000000,
    lastSignInAt: 1760000000000,
    disabled: false,
  },
  {
    uid: "uid_bob",
    email: "bob@example.com",
    displayName: "",
    createdAt: 1700000001000,
    lastSignInAt: 1760000001000,
  },
];

function fakeDb(options: { failAudit?: boolean } = {}) {
  const queries: string[] = [];
  const prepare = (query: string) => {
    const q = query.replace(/\s+/g, " ").trim();
    queries.push(q);
    const stmt = {
      bind() {
        return stmt;
      },
      async run() {
        if (options.failAudit && q.startsWith("INSERT INTO admin_audit")) {
          throw new Error("D1 audit lỗi");
        }
        return { meta: { changes: 1 } };
      },
      async first() {
        return null;
      },
      async all() {
        if (q.startsWith("SELECT uid, updated_at FROM user_data")) {
          return {
            results: [{ uid: "uid_alice", updated_at: 1760500000000 }],
          };
        }
        if (q.startsWith("SELECT uid, count FROM chat_usage")) {
          return { results: [{ uid: "uid_alice", count: 7 }] };
        }
        if (q.startsWith("SELECT uid, ai_disabled, rooms_disabled, note")) {
          return {
            results: [{ uid: "uid_bob", ai_disabled: 1, rooms_disabled: 0, note: "theo dõi" }],
          };
        }
        if (q.startsWith("SELECT updated_at, length(")) {
          return { results: [{ updated_at: 1760500000000, bytes: 2048 }] };
        }
        if (q.startsWith("SELECT day, count FROM chat_usage")) {
          return {
            results: [
              { day: TODAY, count: 3 },
              { day: YESTERDAY, count: 9 },
            ],
          };
        }
        if (q.startsWith("SELECT ai_disabled, rooms_disabled, note")) {
          return { results: [{ ai_disabled: 0, rooms_disabled: 1, note: "" }] };
        }
        if (q.includes("FROM content_reports WHERE reporter_uid")) {
          return {
            results: [
              { id: "r-1", source: "ai", status: "open", reason: "spam", created_at: 100 },
            ],
          };
        }
        if (q.includes("FROM content_reports WHERE target_uid")) {
          return {
            results: [
              { id: "r-2", source: "room", status: "resolved", reason: "harassment", created_at: 300 },
            ],
          };
        }
        if (q.startsWith("SELECT blocked_uid")) {
          return { results: [{ blocked_uid: "uid_x", blocked_name: "X", created_at: 5 }] };
        }
        return { results: [] };
      },
    };
    return stmt;
  };
  return { db: { prepare }, queries };
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
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(
  handler: (url: string, init?: RequestInit) => Response | undefined | Promise<Response | undefined>,
): Array<{ url: string; init?: RequestInit }> {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url === CERT_URL) return certsResponse([jwk]);
      const handled = await handler(url, init);
      return handled || new Response("not found", { status: 404 });
    }),
  );
  return calls;
}

function dataApiStub(
  users: Row[] = USERS,
  options: { status?: number; throws?: boolean } = {},
) {
  const seen: string[] = [];
  const calls = stubFetch(async (url) => {
    if (!url.startsWith(DATA_BASE)) return undefined;
    seen.push(url);
    if (options.throws) throw new Error("mất mạng");
    if (options.status) {
      return new Response(JSON.stringify({ ok: false }), { status: options.status });
    }
    const parsed = new URL(url);
    if (parsed.pathname.endsWith("/admin/users/lookup")) {
      const uid = parsed.searchParams.get("uid");
      const email = parsed.searchParams.get("email");
      const user = users.find(
        (item) => item.uid === uid || (email && item.email === email),
      );
      return new Response(JSON.stringify({ ok: true, user: user || null }), { status: 200 });
    }
    return new Response(
      JSON.stringify({ ok: true, users, nextPageToken: "token-2" }),
      { status: 200 },
    );
  });
  return { seen, calls };
}

function req(path: string): Request {
  return accessRequest(token, path);
}

function postReq(path: string): Request {
  return new Request(`https://admin.zenstudy.space${path}`, {
    method: "POST",
    headers: { "Cf-Access-Jwt-Assertion": token, "Content-Type": "application/json" },
  });
}

function envFor(
  fake: ReturnType<typeof fakeDb> | null,
  overrides: Partial<AdminEnv> = {},
): AdminEnv {
  return baseEnv({
    ...(fake ? { DB: fake.db as unknown as AdminEnv["DB"] } : { DB: undefined }),
    ...overrides,
  });
}

describe("Admin P2 — API người dùng (chỉ đọc)", () => {
  it("thiếu Access token thì 401 và không gọi data-api", async () => {
    const fake = fakeDb();
    const data = dataApiStub();
    const res = await worker.fetch(accessRequest(undefined, "/api/admin/users"), envFor(fake));
    expect(res.status).toBe(401);
    expect(data.seen).toHaveLength(0);
  });

  it("gộp danh tính Firebase với số liệu D1 bằng đúng 3 query", async () => {
    const fake = fakeDb();
    dataApiStub();
    const res = await worker.fetch(req("/api/admin/users"), envFor(fake));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.nextPageToken).toBe("token-2");
    expect(body.users).toHaveLength(2);
    expect(body.users[0]).toMatchObject({
      uid: "uid_alice",
      email: "alice@example.com",
      displayName: "Bạn An",
      lastSignInAt: 1760000000000,
      lastSyncAt: 1760500000000,
      chatToday: 7,
      aiDisabled: false,
    });
    expect(body.users[1]).toMatchObject({
      uid: "uid_bob",
      chatToday: 0,
      aiDisabled: true,
      restrictionNote: "theo dõi",
    });
    expect(fake.queries).toHaveLength(3);
  });

  it("ghi cache KV không chứa PII và lần hai không đọc D1", async () => {
    const kv = fakeKv();
    const fake = fakeDb();
    dataApiStub();
    const env = envFor(fake, { FLAGS: kv.kv });

    await worker.fetch(req("/api/admin/users"), env);
    expect(kv.puts).toHaveLength(1);
    expect(kv.puts[0].key.startsWith("usrv1:list:")).toBe(true);
    expect(kv.puts[0].value).not.toContain("alice@example.com");
    expect(kv.puts[0].value).not.toContain("Bạn An");

    fake.queries.length = 0;
    const second = await worker.fetch(req("/api/admin/users"), env);
    expect(second.status).toBe(200);
    expect(fake.queries).toHaveLength(0);
    expect(kv.puts).toHaveLength(1);
    expect((await second.json()).users[0].chatToday).toBe(7);
  });

  it("data-api lỗi hoặc mất mạng thì 502, không đọc D1", async () => {
    const broken = fakeDb();
    dataApiStub(USERS, { status: 500 });
    const failed = await worker.fetch(req("/api/admin/users"), envFor(broken));
    expect(failed.status).toBe(502);
    expect((await failed.json()).error).toBe("data_api_500");
    expect(broken.queries).toHaveLength(0);

    const offline = fakeDb();
    dataApiStub(USERS, { throws: true });
    const unreachable = await worker.fetch(req("/api/admin/users"), envFor(offline));
    expect(unreachable.status).toBe(502);
    expect((await unreachable.json()).error).toBe("data_api_unreachable");
    expect(offline.queries).toHaveLength(0);
  });

  it("giới hạn size trong khoảng 1..50 khi gọi data-api", async () => {
    const fake = fakeDb();
    const data = dataApiStub();
    await worker.fetch(req("/api/admin/users?size=999"), envFor(fake));
    expect(data.seen[0]).toContain("size=50");

    await worker.fetch(req("/api/admin/users?size=0"), envFor(fake));
    expect(data.seen[1]).toContain("size=25");
  });

  it("chi tiết trả 30 ngày chat, báo cáo gộp và khối chặn", async () => {
    const fake = fakeDb();
    dataApiStub();
    const res = await worker.fetch(req("/api/admin/users/uid_alice"), envFor(fake));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.user).toMatchObject({
      uid: "uid_alice",
      email: "alice@example.com",
      chatToday: 3,
      syncBytes: 2048,
      roomsDisabled: true,
    });
    expect(body.chatDays).toEqual([
      { day: TODAY, count: 3 },
      { day: YESTERDAY, count: 9 },
    ]);
    expect(body.reports.map((item: Row) => [item.id, item.role])).toEqual([
      ["r-2", "target"],
      ["r-1", "reporter"],
    ]);
    expect(body.blocks).toHaveLength(1);
    expect(fake.queries).toHaveLength(6);
  });

  it("chi tiết vẫn trả số liệu khi Firebase không có tài khoản", async () => {
    const fake = fakeDb();
    dataApiStub();
    const res = await worker.fetch(req("/api/admin/users/uid_missing"), envFor(fake));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe("");
    expect(body.user.chatToday).toBe(3);
  });

  it("không có D1 thì vẫn trả danh tính, số liệu bằng 0", async () => {
    dataApiStub();
    const res = await worker.fetch(req("/api/admin/users"), envFor(null));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users[0]).toMatchObject({
      email: "alice@example.com",
      chatToday: 0,
      lastSyncAt: 0,
    });
  });

  it("tra theo email chính xác, không có thì user null", async () => {
    const fake = fakeDb();
    const data = dataApiStub();
    const found = await worker.fetch(
      req("/api/admin/users/lookup?email=alice@example.com"),
      envFor(fake),
    );
    expect(found.status).toBe(200);
    const body = await found.json();
    expect(body.user).toMatchObject({ uid: "uid_alice", chatToday: 7 });
    expect(data.seen[0]).toContain("email=alice%40example.com");

    const missing = await worker.fetch(req("/api/admin/users/lookup?email=no@example.com"), envFor(fake));
    expect((await missing.json()).user).toBeNull();
  });

  it("từ chối email sai định dạng và thiếu tham số", async () => {
    const fake = fakeDb();
    dataApiStub();
    const noAt = await worker.fetch(req("/api/admin/users/lookup?email=abc"), envFor(fake));
    expect(noAt.status).toBe(400);
    const empty = await worker.fetch(req("/api/admin/users/lookup"), envFor(fake));
    expect(empty.status).toBe(400);
  });

  it("chỉ nhận GET", async () => {
    const fake = fakeDb();
    dataApiStub();
    const res = await worker.fetch(
      new Request("https://admin.zenstudy.space/api/admin/users", {
        method: "POST",
        headers: { "Cf-Access-Jwt-Assertion": token },
      }),
      envFor(fake),
    );
    expect(res.status).toBe(405);
  });

  it("đặt lại hạn mức chat: 1 audit + 1 DELETE, xóa KV dự phòng và cache chi tiết", async () => {
    const kv = fakeKv();
    const fake = fakeDb();
    dataApiStub();
    const res = await worker.fetch(
      postReq("/api/admin/users/uid_alice/chat-reset"),
      envFor(fake, { FLAGS: kv.kv }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, uid: "uid_alice", day: TODAY });

    expect(fake.queries.some((q) => q.startsWith("INSERT INTO admin_audit"))).toBe(true);
    expect(fake.queries).toContain(
      "DELETE FROM chat_usage WHERE uid = ? AND day = ?",
    );
    expect(kv.deletes).toContain(`user:uid_alice:${TODAY}`);
    expect(kv.deletes.some((key) => key.startsWith("usrv1:one:"))).toBe(true);
  });

  it("audit lỗi thì không xóa hạn mức", async () => {
    const fake = fakeDb({ failAudit: true });
    dataApiStub();
    const res = await worker.fetch(
      postReq("/api/admin/users/uid_alice/chat-reset"),
      envFor(fake),
    );
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("audit_failed");
    expect(fake.queries.some((q) => q.startsWith("DELETE FROM chat_usage"))).toBe(false);
  });

  it("chat-reset chỉ nhận POST và cần D1", async () => {
    const fake = fakeDb();
    dataApiStub();
    const wrong = await worker.fetch(
      accessRequest(token, "/api/admin/users/uid_alice/chat-reset"),
      envFor(fake),
    );
    expect(wrong.status).toBe(405);

    const noDb = await worker.fetch(
      postReq("/api/admin/users/uid_alice/chat-reset"),
      envFor(null),
    );
    expect(noDb.status).toBe(500);
    expect((await noDb.json()).error).toBe("d1_unavailable");
  });
});
