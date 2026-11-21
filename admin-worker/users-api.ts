/**
 * Trang "Người dùng" (P2 — quản lý người dùng).
 *
 * Danh tính lấy từ Firebase qua `data-api` (Bearer ADMIN_TOKEN); số liệu lấy
 * từ D1 bằng query `IN (...)` theo đúng trang đang xem. Mỗi request tối đa
 * 3 query (danh sách) hoặc 6 query (chi tiết) — trần Workers Free là 50.
 *
 * Cache KV chỉ giữ số liệu theo uid, không giữ email/tên (PII), TTL 60 giây.
 * Xem `docs/features/USER_MANAGEMENT_PLAN.md`.
 */

import { allowReportWrite, logAudit } from "./audit";
import { API_PREFIX, json, trimUrl, type AdminEnv } from "./shared";
import { pacificDay } from "./usage";

const PAGE_DEFAULT = 25;
const PAGE_MAX = 50;
const CACHE_TTL_SECONDS = 60;
const DATA_API_TIMEOUT_MS = 5000;

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  createdAt: number;
  lastSignInAt: number;
  disabled: boolean;
}

interface Activity {
  lastSyncAt: number;
  syncBytes: number;
  chatToday: number;
  aiDisabled: boolean;
  roomsDisabled: boolean;
  restrictionNote: string;
}

type AuthPage =
  | { ok: true; users: AuthUser[]; nextPageToken: string }
  | { ok: false; error: string };

function normalizeUser(raw: Record<string, unknown>): AuthUser {
  return {
    uid: String(raw?.uid || ""),
    email: String(raw?.email || ""),
    displayName: String(raw?.displayName || ""),
    createdAt: Number(raw?.createdAt) || 0,
    lastSignInAt: Number(raw?.lastSignInAt) || 0,
    disabled: !!raw?.disabled,
  };
}

function dataApiBase(env: AdminEnv): { base: string; token: string } | null {
  const base = trimUrl(env.DATA_API_URL);
  const token = String(env.ADMIN_TOKEN || "").trim();
  return base && token ? { base, token } : null;
}

async function callDataApi(env: AdminEnv, path: string): Promise<Response | null> {
  const conf = dataApiBase(env);
  if (!conf) return null;
  try {
    return await fetch(`${conf.base}${path}`, {
      headers: { Authorization: `Bearer ${conf.token}` },
      signal: AbortSignal.timeout(DATA_API_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
}

async function fetchAuthPage(
  env: AdminEnv,
  size: number,
  pageToken: string,
): Promise<AuthPage> {
  const query = new URLSearchParams({ size: String(size) });
  if (pageToken) query.set("pageToken", pageToken);
  const res = await callDataApi(env, `/admin/users?${query.toString()}`);
  if (!res) return { ok: false, error: "data_api_unreachable" };
  if (!res.ok) return { ok: false, error: `data_api_${res.status}` };
  const body = (await res.json().catch(() => null)) as
    | { ok?: boolean; users?: Record<string, unknown>[]; nextPageToken?: string }
    | null;
  if (!body?.ok || !Array.isArray(body.users)) {
    return { ok: false, error: "data_api_bad_payload" };
  }
  return {
    ok: true,
    users: body.users.map(normalizeUser).filter((user) => user.uid),
    nextPageToken: String(body.nextPageToken || ""),
  };
}

type LookupResult =
  | { ok: true; user: AuthUser | null }
  | { ok: false; error: string };

export async function lookupIdentity(
  env: AdminEnv,
  params: { uid?: string; email?: string },
): Promise<LookupResult> {
  const query = params.uid
    ? `uid=${encodeURIComponent(params.uid)}`
    : `email=${encodeURIComponent(params.email || "")}`;
  const res = await callDataApi(env, `/admin/users/lookup?${query}`);
  if (!res) return { ok: false, error: "data_api_unreachable" };
  if (!res.ok) return { ok: false, error: `data_api_${res.status}` };
  const body = (await res.json().catch(() => null)) as
    | { ok?: boolean; user?: Record<string, unknown> | null }
    | null;
  if (!body?.ok) return { ok: false, error: "data_api_bad_payload" };
  return { ok: true, user: body.user ? normalizeUser(body.user) : null };
}

/** Khóa cache: băm danh sách uid + ngày để không lưu PII vào KV. */
async function activityKey(kind: string, salt: string): Promise<string> {
  const text = `${kind}:${salt}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `usrv1:${kind}:${hex.slice(0, 40)}`;
}

async function cacheGet(env: AdminEnv, key: string): Promise<string | null> {
  if (!env.FLAGS) return null;
  try {
    return await env.FLAGS.get(key);
  } catch {
    return null;
  }
}

async function cachePut(env: AdminEnv, key: string, value: string): Promise<void> {
  if (!env.FLAGS) return;
  try {
    await env.FLAGS.put(key, value, { expirationTtl: CACHE_TTL_SECONDS });
  } catch {
    /* cache lỗi không ảnh hưởng kết quả */
  }
}

/** Xóa cache chi tiết của một uid sau khi admin vừa sửa dữ liệu của người đó. */
export async function clearUserDetailCache(env: AdminEnv, uid: string): Promise<void> {
  if (!env.FLAGS?.delete) return;
  try {
    await env.FLAGS.delete(await activityKey("one", `${pacificDay()}:${uid}`));
  } catch {
    /* cache lỗi thì để TTL 60 giây tự hết */
  }
}

function emptyActivity(): Activity {
  return {
    lastSyncAt: 0,
    syncBytes: 0,
    chatToday: 0,
    aiDisabled: false,
    roomsDisabled: false,
    restrictionNote: "",
  };
}

/** 3 query cho tối đa 50 uid: đồng bộ, chat hôm nay, hạn chế. */
async function readActivity(
  env: AdminEnv,
  uids: string[],
  options: { cache?: boolean } = {},
): Promise<Map<string, Activity>> {
  const result = new Map<string, Activity>();
  const db = env.DB;
  if (!db || uids.length === 0) return result;
  const useCache = options.cache !== false;
  const day = pacificDay();
  const key = await activityKey("list", `${day}:${uids.slice().sort().join(",")}`);
  const cached = useCache ? await cacheGet(env, key) : null;
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as Record<string, Activity>;
      for (const uid of uids) result.set(uid, { ...emptyActivity(), ...(parsed[uid] || {}) });
      return result;
    } catch {
      /* cache hỏng thì đọc D1 */
    }
  }

  const marks = uids.map(() => "?").join(",");
  try {
    const [sync, chat, restrict] = await Promise.all([
      db
        .prepare(
          `SELECT uid, updated_at FROM user_data WHERE uid IN (${marks})`,
        )
        .bind(...uids)
        .all<{ uid: string; updated_at: number }>(),
      db
        .prepare(`SELECT uid, count FROM chat_usage WHERE uid IN (${marks}) AND day = ?`)
        .bind(...uids, day)
        .all<{ uid: string; count: number }>(),
      db
        .prepare(
          `SELECT uid, ai_disabled, rooms_disabled, note FROM user_restrictions WHERE uid IN (${marks})`,
        )
        .bind(...uids)
        .all<{ uid: string; ai_disabled: number; rooms_disabled: number; note: string }>(),
    ]);

    for (const uid of uids) result.set(uid, emptyActivity());
    for (const row of sync.results || []) {
      const item = result.get(String(row.uid));
      if (!item) continue;
      item.lastSyncAt = Number(row.updated_at) || 0;
    }
    for (const row of chat.results || []) {
      const item = result.get(String(row.uid));
      if (item) item.chatToday = Number(row.count) || 0;
    }
    for (const row of restrict.results || []) {
      const item = result.get(String(row.uid));
      if (!item) continue;
      item.aiDisabled = !!row.ai_disabled;
      item.roomsDisabled = !!row.rooms_disabled;
      item.restrictionNote = String(row.note || "");
    }

    const serialized: Record<string, Activity> = {};
    for (const [uid, item] of result) serialized[uid] = item;
    if (useCache) await cachePut(env, key, JSON.stringify(serialized));
  } catch {
    /* D1 lỗi: trả số 0, danh tính vẫn hiển thị */
  }
  return result;
}

async function listUsers(request: Request, env: AdminEnv): Promise<Response> {
  const url = new URL(request.url);
  const rawSize = Number(url.searchParams.get("size"));
  const size =
    Number.isFinite(rawSize) && rawSize >= 1
      ? Math.min(PAGE_MAX, Math.floor(rawSize))
      : PAGE_DEFAULT;
  const pageToken = String(url.searchParams.get("pageToken") || "").slice(0, 2048);

  const page = await fetchAuthPage(env, size, pageToken);
  if (!page.ok) {
    console.warn("admin users: không lấy được danh sách", { error: page.error });
    return json({ ok: false, error: page.error }, 502);
  }

  const activity = await readActivity(
    env,
    page.users.map((user) => user.uid),
    { cache: !pageToken },
  );
  return json({
    ok: true,
    users: page.users.map((user) => ({ ...user, ...(activity.get(user.uid) || emptyActivity()) })),
    nextPageToken: page.nextPageToken,
  });
}

async function userDetail(env: AdminEnv, uid: string): Promise<Response> {
  const found = await lookupIdentity(env, { uid });
  const identity = found.ok ? found.user : null;
  const base = { ...emptyActivity(), uid, email: "", displayName: "", createdAt: 0, lastSignInAt: 0, disabled: false };
  const db = env.DB;
  if (!db) {
    return json({ ok: true, user: { ...base, ...(identity || {}) }, chatDays: [], reports: [], blocks: [] });
  }

  const key = await activityKey("one", `${pacificDay()}:${uid}`);
  const cached = await cacheGet(env, key);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as {
        activity: Activity;
        chatDays: { day: string; count: number }[];
        reports: Record<string, unknown>[];
        blocks: Record<string, unknown>[];
      };
      return json({
        ok: true,
        user: { ...base, ...(identity || {}), ...(parsed.activity || {}) },
        chatDays: parsed.chatDays || [],
        reports: parsed.reports || [],
        blocks: parsed.blocks || [],
      });
    } catch {
      /* cache hỏng thì đọc D1 */
    }
  }

  const empty = { results: [] as Record<string, unknown>[] };
  try {
    const [sync, chat, restrict, byMe, aboutMe, blocks] = await Promise.all([
      db
        .prepare(
          "SELECT updated_at, length(CAST(data_json AS BLOB)) AS bytes FROM user_data WHERE uid = ?",
        )
        .bind(uid)
        .all<{ updated_at: number; bytes: number }>(),
      db
        .prepare("SELECT day, count FROM chat_usage WHERE uid = ? ORDER BY day DESC LIMIT 30")
        .bind(uid)
        .all<{ day: string; count: number }>(),
      db
        .prepare("SELECT ai_disabled, rooms_disabled, note FROM user_restrictions WHERE uid = ?")
        .bind(uid)
        .all<{ ai_disabled: number; rooms_disabled: number; note: string }>(),
      db
        .prepare(
          "SELECT id, source, status, reason, created_at FROM content_reports WHERE reporter_uid = ? ORDER BY created_at DESC LIMIT 10",
        )
        .bind(uid)
        .all<Record<string, unknown>>(),
      db
        .prepare(
          "SELECT id, source, status, reason, created_at FROM content_reports WHERE target_uid = ? ORDER BY created_at DESC LIMIT 10",
        )
        .bind(uid)
        .all<Record<string, unknown>>(),
      db
        .prepare(
          "SELECT blocked_uid, blocked_name, created_at FROM user_blocks WHERE blocker_uid = ? LIMIT 20",
        )
        .bind(uid)
        .all<Record<string, unknown>>(),
    ]);

    const activity = emptyActivity();
    const syncRow = (sync.results || [])[0];
    if (syncRow) {
      activity.lastSyncAt = Number(syncRow.updated_at) || 0;
      activity.syncBytes = Number(syncRow.bytes) || 0;
    }
    const restrictRow = (restrict.results || [])[0];
    if (restrictRow) {
      activity.aiDisabled = !!restrictRow.ai_disabled;
      activity.roomsDisabled = !!restrictRow.rooms_disabled;
      activity.restrictionNote = String(restrictRow.note || "");
    }
    const today = pacificDay();
    const chatDays = (chat.results || []).map((row) => ({
      day: String(row.day || ""),
      count: Number(row.count) || 0,
    }));
    activity.chatToday = chatDays.find((row) => row.day === today)?.count || 0;

    const reportRows: Array<Record<string, unknown>> = [
      ...(byMe.results || []).map((row) => ({ ...row, role: "reporter" })),
      ...(aboutMe.results || []).map((row) => ({ ...row, role: "target" })),
    ];
    const reports = reportRows
      .sort((a, b) => Number(b.created_at) - Number(a.created_at))
      .slice(0, 10);

    await cachePut(env, key, JSON.stringify({ activity, chatDays, reports, blocks: blocks.results || [] }));

    return json({
      ok: true,
      user: { ...base, ...(identity || {}), ...activity },
      chatDays,
      reports,
      blocks: blocks.results || [],
    });
  } catch {
    return json({
      ok: true,
      user: { ...base, ...(identity || {}) },
      chatDays: empty.results,
      reports: [],
      blocks: [],
      degraded: true,
    });
  }
}

/**
 * Đặt lại hạn mức chat của một uid trong ngày (giờ Thái Bình Dương, giống Worker chat v2).
 * Ghi thật: 1 audit + 1 DELETE chat_usage; xóa thêm key KV dự phòng và cache chi tiết.
 */
async function resetChatQuota(env: AdminEnv, uid: string, actor: string): Promise<Response> {
  if (!env.DB) return json({ error: "d1_unavailable" }, 500);
  if (!allowReportWrite(actor)) return json({ error: "rate_limited" }, 429);

  const day = pacificDay();
  const audited = await logAudit(env, {
    actorEmail: actor,
    action: "user.chat_reset",
    target: `user:${uid}`,
    detail: { day },
  });
  if (!audited) return json({ error: "audit_failed" }, 500);

  try {
    await env.DB.prepare("DELETE FROM chat_usage WHERE uid = ? AND day = ?")
      .bind(uid, day)
      .run();
  } catch {
    return json({ error: "d1_error" }, 500);
  }

  // Worker chat chỉ đọc KV khi D1 lỗi, nhưng xóa luôn để số cũ không hồi sinh.
  if (env.FLAGS?.delete) {
    try {
      await env.FLAGS.delete(`user:${uid}:${day}`);
    } catch {
      /* KV lỗi không ảnh hưởng D1 */
    }
  }
  await clearUserDetailCache(env, uid);

  return json({ ok: true, uid, day });
}

async function lookupUser(request: Request, env: AdminEnv): Promise<Response> {
  const url = new URL(request.url);
  const uid = String(url.searchParams.get("uid") || "").trim().slice(0, 128);
  const email = String(url.searchParams.get("email") || "").trim().slice(0, 254);
  if (!uid && !email) return json({ error: "Cần email." }, 400);
  if (!uid && !email.includes("@")) return json({ error: "Email không hợp lệ." }, 400);

  const found = await lookupIdentity(env, uid ? { uid } : { email });
  if (!found.ok) {
    console.warn("admin users: không tra được tài khoản", { error: found.error });
    return json({ ok: false, error: found.error }, 502);
  }
  if (!found.user) return json({ ok: true, user: null });

  const activity = await readActivity(env, [found.user.uid]);
  return json({
    ok: true,
    user: { ...found.user, ...(activity.get(found.user.uid) || emptyActivity()) },
  });
}

export async function handleUsersApi(
  request: Request,
  env: AdminEnv,
  pathname: string,
  actorEmail: string,
): Promise<Response | null> {
  if (pathname === `${API_PREFIX}/users`) {
    if (request.method !== "GET") return json({ error: "Chỉ hỗ trợ GET." }, 405);
    return listUsers(request, env);
  }

  if (pathname === `${API_PREFIX}/users/lookup`) {
    if (request.method !== "GET") return json({ error: "Chỉ hỗ trợ GET." }, 405);
    return lookupUser(request, env);
  }

  const reset = new RegExp(`^${API_PREFIX}/users/([^/]+)/chat-reset$`).exec(pathname);
  if (reset) {
    if (request.method !== "POST") return json({ error: "Chỉ hỗ trợ POST." }, 405);
    const uid = decodeURIComponent(reset[1] || "").slice(0, 128);
    if (!uid) return json({ error: "Thiếu uid." }, 400);
    return resetChatQuota(env, uid, actorEmail);
  }

  const detail = new RegExp(`^${API_PREFIX}/users/([^/]+)$`).exec(pathname);
  if (detail) {
    if (request.method !== "GET") return json({ error: "Chỉ hỗ trợ GET." }, 405);
    const uid = decodeURIComponent(detail[1] || "").slice(0, 128);
    if (!uid) return json({ error: "Thiếu uid." }, 400);
    return userDetail(env, uid);
  }

  return null;
}
