/**
 * P2e — API báo cáo nội dung & hạn chế tài khoản cho admin shell.
 *
 * Đọc/ghi bảng `content_reports` và `user_restrictions` (D1). Luồng người
 * dùng gửi báo cáo nằm ở `workers/data-api`; file này chỉ phục vụ admin.
 * Mọi hành động ghi đều audit trước và không trả nội dung nhạy cảm ra ngoài.
 */

import { allowReportWrite, logAudit } from "./audit";
import { API_PREFIX, json, type AdminEnv } from "./shared";

const REPORT_STATUS = new Set(["open", "resolved", "dismissed"]);
const REPORT_SOURCE = new Set(["ai", "room"]);
const REPORT_LIST_MAX = 100;
const REPORT_NOTE_MAX = 500;
const REPORT_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;
const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;

type Row = Record<string, unknown>;

function cleanNote(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, REPORT_NOTE_MAX);
}

function text(value: unknown, max = 2000): string {
  return String(value ?? "").slice(0, max);
}

function toReport(row: Row, options: { preview?: boolean } = {}) {
  const base = {
    id: String(row.id || ""),
    source: String(row.source || ""),
    reporterUid: String(row.reporter_uid || ""),
    reporterName: row.reporter_name ? String(row.reporter_name) : "",
    targetUid: row.target_uid ? String(row.target_uid) : null,
    targetName: row.target_name ? String(row.target_name) : "",
    room: row.room ? String(row.room) : null,
    sessionId: row.session_id ? String(row.session_id) : null,
    messageId: row.message_id ? String(row.message_id) : null,
    question: row.question ? String(row.question) : "",
    reason: String(row.reason || ""),
    detail: row.detail ? String(row.detail) : "",
    status: String(row.status || "open"),
    createdAt: Number(row.created_at) || 0,
    resolvedAt: Number(row.resolved_at) || 0,
    resolvedBy: row.resolved_by ? String(row.resolved_by) : "",
    resolutionNote: row.resolution_note ? String(row.resolution_note) : "",
  };
  if (options.preview) {
    return { ...base, contentPreview: text(row.content_preview, 300) };
  }
  return { ...base, content: text(row.content, 8000) };
}

async function readBody(request: Request): Promise<Row | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Row) : null;
  } catch {
    return null;
  }
}

async function listReports(url: URL, env: AdminEnv): Promise<Response> {
  const status = url.searchParams.get("status") || "open";
  if (status !== "all" && !REPORT_STATUS.has(status)) {
    return json({ error: "invalid_status" }, 400);
  }
  const source = url.searchParams.get("source") || "all";
  if (source !== "all" && !REPORT_SOURCE.has(source)) {
    return json({ error: "invalid_source" }, 400);
  }
  const limitRaw = Number(url.searchParams.get("limit") || 50);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(REPORT_LIST_MAX, Math.max(1, Math.floor(limitRaw)))
    : 50;
  const beforeRaw = Number(url.searchParams.get("before") || 0);
  const before = Number.isFinite(beforeRaw) && beforeRaw > 0 ? Math.floor(beforeRaw) : 0;

  try {
    await env.DB!.prepare("DELETE FROM content_reports WHERE created_at < ?")
      .bind(Date.now() - REPORT_RETENTION_MS)
      .run();

    const countsRes = await env.DB!.prepare(
      "SELECT status, COUNT(*) AS n FROM content_reports GROUP BY status",
    ).all<Row>();
    const counts = { open: 0, resolved: 0, dismissed: 0, total: 0 };
    for (const row of Array.isArray(countsRes?.results) ? countsRes.results : []) {
      const key = String(row.status || "");
      const n = Number(row.n) || 0;
      if (key === "open" || key === "resolved" || key === "dismissed") counts[key] = n;
      counts.total += n;
    }

    const rowsRes = await env.DB!.prepare(
      `SELECT id, source, reporter_uid, reporter_name, target_uid, target_name, room,
              session_id, message_id, substr(content, 1, 300) AS content_preview,
              reason, detail, status, created_at, resolved_at, resolved_by, resolution_note
         FROM content_reports
        WHERE (? = 'all' OR status = ?)
          AND (? = 'all' OR source = ?)
          AND (? = 0 OR created_at < ?)
        ORDER BY created_at DESC
        LIMIT ${limit}`,
    )
      .bind(status, status, source, source, before, before)
      .all<Row>();

    const rows = Array.isArray(rowsRes?.results) ? rowsRes.results : [];
    const reports = rows.map((row) => toReport(row, { preview: true }));
    const nextBefore =
      rows.length === limit ? Number(rows[rows.length - 1].created_at) || null : null;
    return json({ ok: true, reports, counts, nextBefore });
  } catch {
    return json({ error: "d1_error" }, 500);
  }
}

async function getReport(env: AdminEnv, id: string): Promise<Response> {
  try {
    const row = await env.DB!.prepare(
      `SELECT id, source, reporter_uid, reporter_name, target_uid, target_name, room,
              session_id, message_id, question, content, reason, detail, status, created_at,
              resolved_at, resolved_by, resolution_note
         FROM content_reports WHERE id = ?`,
    )
      .bind(id)
      .first<Row>();
    if (!row) return json({ error: "not_found" }, 404);
    return json({ ok: true, report: toReport(row) });
  } catch {
    return json({ error: "d1_error" }, 500);
  }
}

async function resolveReport(
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
      "SELECT id, source, reporter_uid, status FROM content_reports WHERE id = ?",
    )
      .bind(id)
      .first<Row>();
  } catch {
    return json({ error: "d1_error" }, 500);
  }
  if (!existing) return json({ error: "not_found" }, 404);
  if (!allowReportWrite(email)) return json({ error: "rate_limited" }, 429);

  const audited = await logAudit(env, {
    actorEmail: email,
    action: "report.resolve",
    target: id,
    detail: {
      status,
      note,
      source: existing.source,
      reporterUid: existing.reporter_uid,
    },
  });
  if (!audited) return json({ error: "audit_failed" }, 500);

  const now = Date.now();
  try {
    const res = await env.DB!.prepare(
      `UPDATE content_reports
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

type RestrictionRow = {
  uid?: string;
  ai_disabled?: number;
  rooms_disabled?: number;
  note?: string;
  updated_at?: number;
  updated_by?: string;
};

function toRestrictions(row: RestrictionRow | null) {
  return {
    uid: String(row?.uid || ""),
    aiDisabled: Number(row?.ai_disabled) === 1,
    roomsDisabled: Number(row?.rooms_disabled) === 1,
    note: String(row?.note || ""),
    updatedAt: Number(row?.updated_at) || 0,
    updatedBy: String(row?.updated_by || ""),
  };
}

export async function handleRestrictionsApi(
  request: Request,
  env: AdminEnv,
  rawUid: string,
  email: string,
): Promise<Response> {
  if (!env.DB) return json({ error: "missing_binding" }, 500);
  let uid = "";
  try {
    uid = decodeURIComponent(rawUid);
  } catch {
    uid = "";
  }
  if (!UID_RE.test(uid)) return json({ error: "invalid_uid" }, 400);

  let existing: RestrictionRow | null = null;
  try {
    existing = await env.DB.prepare(
      "SELECT uid, ai_disabled, rooms_disabled, note, updated_at, updated_by FROM user_restrictions WHERE uid = ?",
    )
      .bind(uid)
      .first<RestrictionRow>();
  } catch {
    return json({ error: "d1_error" }, 500);
  }

  if (request.method === "GET") {
    return json({
      ok: true,
      restrictions: toRestrictions(existing || { uid }),
    });
  }
  if (request.method !== "POST") return json({ error: "Chỉ hỗ trợ GET hoặc POST." }, 405);

  const body = await readBody(request);
  if (!body) return json({ error: "invalid_body" }, 400);
  const aiProvided = typeof body.aiDisabled === "boolean";
  const roomsProvided = typeof body.roomsDisabled === "boolean";
  if (!aiProvided && !roomsProvided && body.note === undefined) {
    return json({ error: "invalid_body" }, 400);
  }

  const before = toRestrictions(existing || { uid });
  const next = {
    uid,
    aiDisabled: aiProvided ? Boolean(body.aiDisabled) : before.aiDisabled,
    roomsDisabled: roomsProvided ? Boolean(body.roomsDisabled) : before.roomsDisabled,
    note: body.note === undefined ? before.note : cleanNote(body.note),
  };
  if (!allowReportWrite(email)) return json({ error: "rate_limited" }, 429);

  const audited = await logAudit(env, {
    actorEmail: email,
    action: "user.restrictions",
    target: `user:${uid}`,
    detail: { before, after: next },
  });
  if (!audited) return json({ error: "audit_failed" }, 500);

  const now = Date.now();
  try {
    await env.DB.prepare(
      `INSERT INTO user_restrictions
         (uid, ai_disabled, rooms_disabled, note, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(uid) DO UPDATE SET
         ai_disabled = excluded.ai_disabled,
         rooms_disabled = excluded.rooms_disabled,
         note = excluded.note,
         updated_at = excluded.updated_at,
         updated_by = excluded.updated_by`,
    )
      .bind(
        uid,
        next.aiDisabled ? 1 : 0,
        next.roomsDisabled ? 1 : 0,
        next.note || null,
        now,
        email.slice(0, 200),
      )
      .run();
  } catch {
    return json({ error: "d1_error" }, 500);
  }

  return json({
    ok: true,
    restrictions: { ...next, updatedAt: now, updatedBy: email.slice(0, 200) },
  });
}

export async function handleReportsApi(
  request: Request,
  env: AdminEnv,
  pathname: string,
  email: string,
): Promise<Response> {
  if (!env.DB) return json({ error: "missing_binding" }, 500);
  const rest = pathname.slice(`${API_PREFIX}/reports`.length);
  const method = request.method;

  if (rest === "" || rest === "/") {
    if (method !== "GET") return json({ error: "Chỉ hỗ trợ GET." }, 405);
    return listReports(new URL(request.url), env);
  }

  const resolveMatch = /^\/([A-Za-z0-9-]{8,64})\/resolve$/.exec(rest);
  if (resolveMatch) {
    if (method !== "POST") return json({ error: "Chỉ hỗ trợ POST." }, 405);
    return resolveReport(request, env, resolveMatch[1], email);
  }

  const detailMatch = /^\/([A-Za-z0-9-]{8,64})$/.exec(rest);
  if (detailMatch) {
    if (method !== "GET") return json({ error: "Chỉ hỗ trợ GET." }, 405);
    return getReport(env, detailMatch[1]);
  }

  return json({ error: "Không có endpoint này." }, 404);
}
