/**
 * P3.17 — xoá thủ công nhật ký lỗi và nhật ký thao tác quản trị.
 *
 * Không có cơ chế tự xoá nào trong hệ thống; hai endpoint ở đây là đường
 * duy nhất để dọn `admin_error_log` và `admin_audit`. Mọi lần xoá đều audit,
 * riêng lần xoá `admin_audit` ghi dấu sau khi xoá để dòng `audit.clear` còn lại.
 */

import { allowAuditWrite, logAudit } from "./audit";
import { API_PREFIX, json, type AdminEnv } from "./shared";

const AUDIT_LIST_MAX = 100;
const AUDIT_DETAIL_MAX = 500;

type Row = Record<string, unknown>;

async function listAudit(url: URL, env: AdminEnv): Promise<Response> {
  const limitRaw = Number(url.searchParams.get("limit") || 50);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(AUDIT_LIST_MAX, Math.max(1, Math.floor(limitRaw)))
    : 50;
  const beforeRaw = Number(url.searchParams.get("before") || 0);
  const before = Number.isFinite(beforeRaw) && beforeRaw > 0 ? Math.floor(beforeRaw) : 0;

  try {
    const res = await env.DB!.prepare(
      `SELECT id, actor_email, action, target, substr(detail_json, 1, 2000) AS detail_json, created_at
         FROM admin_audit
        WHERE (? = 0 OR created_at < ?)
        ORDER BY created_at DESC
        LIMIT ${limit}`,
    )
      .bind(before, before)
      .all<Row>();

    const rows = Array.isArray(res?.results) ? res.results : [];
    const items = rows.map((row) => ({
      id: Number(row.id) || 0,
      actorEmail: String(row.actor_email || ""),
      action: String(row.action || ""),
      target: String(row.target || ""),
      detail: String(row.detail_json || "").slice(0, AUDIT_DETAIL_MAX),
      createdAt: Number(row.created_at) || 0,
    }));
    const nextBefore =
      rows.length === limit ? Number(rows[rows.length - 1].created_at) || null : null;
    return json({ ok: true, items, nextBefore });
  } catch {
    return json({ error: "d1_error" }, 500);
  }
}

async function clearAudit(env: AdminEnv, email: string): Promise<Response> {
  if (!allowAuditWrite(email)) return json({ error: "rate_limited" }, 429);

  let count = 0;
  try {
    const counted = await env.DB!.prepare("SELECT COUNT(*) AS n FROM admin_audit").first<Row>();
    count = Number(counted?.n) || 0;
    await env.DB!.prepare("DELETE FROM admin_audit").run();
  } catch {
    return json({ error: "d1_error" }, 500);
  }

  const audited = await logAudit(env, {
    actorEmail: email,
    action: "audit.clear",
    target: "admin_audit",
    detail: { count },
  });
  return json({ ok: true, deleted: count, audited });
}

async function clearErrors(env: AdminEnv, email: string): Promise<Response> {
  if (!allowAuditWrite(email)) return json({ error: "rate_limited" }, 429);

  let count = 0;
  try {
    const counted = await env.DB!.prepare(
      "SELECT COUNT(*) AS n FROM admin_error_log",
    ).first<Row>();
    count = Number(counted?.n) || 0;
  } catch {
    return json({ error: "d1_error" }, 500);
  }

  const audited = await logAudit(env, {
    actorEmail: email,
    action: "errors.clear",
    target: "admin_error_log",
    detail: { count },
  });
  if (!audited) return json({ error: "audit_failed" }, 500);

  try {
    await env.DB!.prepare("DELETE FROM admin_error_log").run();
  } catch {
    return json({ error: "d1_error" }, 500);
  }
  return json({ ok: true, deleted: count });
}

export async function handleMaintenanceApi(
  request: Request,
  env: AdminEnv,
  pathname: string,
  email: string,
): Promise<Response> {
  if (!env.DB) return json({ error: "missing_binding" }, 500);
  const method = request.method;

  if (pathname === `${API_PREFIX}/errors`) {
    if (method !== "DELETE") return json({ error: "Chỉ hỗ trợ DELETE." }, 405);
    return clearErrors(env, email);
  }

  if (pathname === `${API_PREFIX}/audit`) {
    if (method === "GET") return listAudit(new URL(request.url), env);
    if (method === "DELETE") return clearAudit(env, email);
    return json({ error: "Chỉ hỗ trợ GET hoặc DELETE." }, 405);
  }

  return json({ error: "Không có endpoint này." }, 404);
}
