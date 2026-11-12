/**
 * P3.16 — API góp ý/báo lỗi chung cho admin shell.
 *
 * Đọc/ghi bảng `user_feedback` (D1). Luồng người dùng gửi góp ý nằm ở
 * `workers/data-api/worker.js` (POST /feedback); file này chỉ phục vụ admin.
 * Mọi lần xử lý đều audit trước khi ghi.
 */

import { allowFeedbackWrite, logAudit } from "./audit";
import { API_PREFIX, json, type AdminEnv, type R2ObjectBodyLike } from "./shared";

const FEEDBACK_STATUS = new Set(["open", "resolved", "dismissed"]);
const FEEDBACK_KIND = new Set(["bug", "idea", "other"]);
const FEEDBACK_LIST_MAX = 100;
const FEEDBACK_NOTE_MAX = 500;
const FEEDBACK_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;

type Row = Record<string, unknown>;

function cleanNote(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, FEEDBACK_NOTE_MAX);
}

function text(value: unknown, max = 2000): string {
  return String(value ?? "").slice(0, max);
}

function toFeedback(row: Row, options: { preview?: boolean } = {}) {
  const base = {
    id: String(row.id || ""),
    uid: String(row.uid || ""),
    name: row.name ? String(row.name) : "",
    kind: String(row.kind || ""),
    contact: row.contact ? String(row.contact) : "",
    appVersion: row.app_version ? String(row.app_version) : "",
    platform: row.platform ? String(row.platform) : "",
    viewport: row.viewport ? String(row.viewport) : "",
    locale: row.locale ? String(row.locale) : "",
    hasImage: Boolean(row.image_key),
    status: String(row.status || "open"),
    createdAt: Number(row.created_at) || 0,
    resolvedAt: Number(row.resolved_at) || 0,
    resolvedBy: row.resolved_by ? String(row.resolved_by) : "",
    resolutionNote: row.resolution_note ? String(row.resolution_note) : "",
  };
  if (options.preview) {
    return { ...base, preview: text(row.message_preview, 300) };
  }
  return { ...base, message: text(row.message, 8000) };
}

// Ảnh góp ý nằm trong R2 (`feedback/...`). DB cũ chưa có cột image_key thì
// bỏ qua, không được làm hỏng danh sách.
async function deleteFeedbackImages(env: AdminEnv, keys: string[]): Promise<void> {
  if (!keys.length || !env.R2?.delete) return;
  try {
    await env.R2.delete(keys);
  } catch {
    // Ảnh mồ côi không đáng chặn việc xoá dòng.
  }
}

async function pruneExpiredFeedback(env: AdminEnv): Promise<void> {
  const cutoff = Date.now() - FEEDBACK_RETENTION_MS;
  let keys: string[] = [];
  try {
    const res = await env.DB!.prepare(
      "SELECT image_key FROM user_feedback WHERE created_at < ? AND image_key IS NOT NULL",
    )
      .bind(cutoff)
      .all<Row>();
    keys = (Array.isArray(res?.results) ? res.results : [])
      .map((row) => String(row.image_key || ""))
      .filter(Boolean);
  } catch {
    keys = [];
  }
  await env.DB!.prepare("DELETE FROM user_feedback WHERE created_at < ?").bind(cutoff).run();
  await deleteFeedbackImages(env, keys);
}

async function readBody(request: Request): Promise<Row | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Row) : null;
  } catch {
    return null;
  }
}

async function listFeedback(url: URL, env: AdminEnv): Promise<Response> {
  const status = url.searchParams.get("status") || "open";
  if (status !== "all" && !FEEDBACK_STATUS.has(status)) {
    return json({ error: "invalid_status" }, 400);
  }
  const kind = url.searchParams.get("kind") || "all";
  if (kind !== "all" && !FEEDBACK_KIND.has(kind)) {
    return json({ error: "invalid_kind" }, 400);
  }
  const limitRaw = Number(url.searchParams.get("limit") || 50);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(FEEDBACK_LIST_MAX, Math.max(1, Math.floor(limitRaw)))
    : 50;
  const beforeRaw = Number(url.searchParams.get("before") || 0);
  const before = Number.isFinite(beforeRaw) && beforeRaw > 0 ? Math.floor(beforeRaw) : 0;

  try {
    await pruneExpiredFeedback(env);

    const countsRes = await env.DB!.prepare(
      "SELECT status, COUNT(*) AS n FROM user_feedback GROUP BY status",
    ).all<Row>();
    const counts = { open: 0, resolved: 0, dismissed: 0, total: 0 };
    for (const row of Array.isArray(countsRes?.results) ? countsRes.results : []) {
      const key = String(row.status || "");
      const n = Number(row.n) || 0;
      if (key === "open" || key === "resolved" || key === "dismissed") counts[key] = n;
      counts.total += n;
    }

    const rowsRes = await env.DB!.prepare(
      `SELECT id, uid, name, kind, substr(message, 1, 300) AS message_preview,
              contact, app_version, platform, viewport, locale, status,
              created_at, resolved_at, resolved_by, resolution_note, image_key
         FROM user_feedback
        WHERE (? = 'all' OR status = ?)
          AND (? = 'all' OR kind = ?)
          AND (? = 0 OR created_at < ?)
        ORDER BY created_at DESC
        LIMIT ${limit}`,
    )
      .bind(status, status, kind, kind, before, before)
      .all<Row>();

    const rows = Array.isArray(rowsRes?.results) ? rowsRes.results : [];
    const feedback = rows.map((row) => toFeedback(row, { preview: true }));
    const nextBefore =
      rows.length === limit ? Number(rows[rows.length - 1].created_at) || null : null;
    return json({ ok: true, feedback, counts, nextBefore });
  } catch {
    return json({ error: "d1_error" }, 500);
  }
}

async function getFeedback(env: AdminEnv, id: string): Promise<Response> {
  try {
    const row = await env.DB!.prepare(
      `SELECT id, uid, name, kind, message, contact, app_version, platform, viewport, locale,
              status, created_at, resolved_at, resolved_by, resolution_note, image_key
         FROM user_feedback WHERE id = ?`,
    )
      .bind(id)
      .first<Row>();
    if (!row) return json({ error: "not_found" }, 404);
    return json({ ok: true, feedback: toFeedback(row) });
  } catch {
    return json({ error: "d1_error" }, 500);
  }
}

// Ảnh chỉ xem được sau Cloudflare Access nên cache riêng, ngắn và không
// cho trình duyệt tự đoán kiểu nội dung.
async function getFeedbackImage(env: AdminEnv, id: string): Promise<Response> {
  if (!env.R2?.get) return json({ error: "missing_binding" }, 500);

  let key = "";
  try {
    const row = await env.DB!.prepare("SELECT image_key FROM user_feedback WHERE id = ?")
      .bind(id)
      .first<Row>();
    key = row?.image_key ? String(row.image_key) : "";
  } catch {
    return json({ error: "d1_error" }, 500);
  }
  if (!key) return json({ error: "not_found" }, 404);

  let object: R2ObjectBodyLike | null = null;
  try {
    object = await env.R2.get(key);
  } catch {
    return json({ error: "r2_error" }, 500);
  }
  if (!object?.body) return json({ error: "not_found" }, 404);

  const headers = new Headers({
    "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
  });
  if (Number(object.size) > 0) headers.set("Content-Length", String(object.size));
  return new Response(object.body, { headers });
}

async function resolveFeedback(
  request: Request,
  env: AdminEnv,
  id: string,
  email: string,
): Promise<Response> {
  const body = await readBody(request);
  const status = body?.status;
  if (status !== "resolved" && status !== "dismissed") {
    return json({ error: "invalid_status" }, 400);
  }
  const note = cleanNote(body?.note);

  let existing: Row | null = null;
  try {
    existing = await env.DB!.prepare(
      "SELECT id, uid, kind, status FROM user_feedback WHERE id = ?",
    )
      .bind(id)
      .first<Row>();
  } catch {
    return json({ error: "d1_error" }, 500);
  }
  if (!existing) return json({ error: "not_found" }, 404);
  if (!allowFeedbackWrite(email)) return json({ error: "rate_limited" }, 429);

  const audited = await logAudit(env, {
    actorEmail: email,
    action: "feedback.resolve",
    target: id,
    detail: {
      status,
      note,
      kind: existing.kind,
      uid: existing.uid,
    },
  });
  if (!audited) return json({ error: "audit_failed" }, 500);

  const now = Date.now();
  try {
    const res = await env.DB!.prepare(
      `UPDATE user_feedback
          SET status = ?, resolved_at = ?, resolved_by = ?, resolution_note = ?
        WHERE id = ?`,
    )
      .bind(status, now, email.slice(0, 200), note || null, id)
      .run();
    const changes = Number((res as { meta?: { changes?: number } })?.meta?.changes || 0);
    if (changes === 0) return json({ error: "not_found" }, 404);
  } catch {
    return json({ error: "d1_error" }, 500);
  }
  return json({ ok: true, id, status, resolvedAt: now });
}

export async function handleFeedbackApi(
  request: Request,
  env: AdminEnv,
  pathname: string,
  email: string,
): Promise<Response> {
  if (!env.DB) return json({ error: "missing_binding" }, 500);
  const rest = pathname.slice(`${API_PREFIX}/feedback`.length);
  const method = request.method;

  if (rest === "" || rest === "/") {
    if (method !== "GET") return json({ error: "Chỉ hỗ trợ GET." }, 405);
    return listFeedback(new URL(request.url), env);
  }

  const imageMatch = /^\/([A-Za-z0-9-]{8,64})\/image$/.exec(rest);
  if (imageMatch) {
    if (method !== "GET") return json({ error: "Chỉ hỗ trợ GET." }, 405);
    return getFeedbackImage(env, imageMatch[1]);
  }

  const resolveMatch = /^\/([A-Za-z0-9-]{8,64})\/status$/.exec(rest);
  if (resolveMatch) {
    if (method !== "POST") return json({ error: "Chỉ hỗ trợ POST." }, 405);
    return resolveFeedback(request, env, resolveMatch[1], email);
  }

  const detailMatch = /^\/([A-Za-z0-9-]{8,64})$/.exec(rest);
  if (detailMatch) {
    if (method !== "GET") return json({ error: "Chỉ hỗ trợ GET." }, 405);
    return getFeedback(env, detailMatch[1]);
  }

  return json({ error: "Không có endpoint này." }, 404);
}
