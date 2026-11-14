/**
 * Nhật ký lỗi D1 (bảng admin_error_log) phục vụ trang admin.
 * Ghi thì throttle 1 dòng/giờ cho cùng source:code, đọc trả về 20 dòng mới nhất.
 */

import type { AdminEnv } from "./shared";

const ERROR_ROWS_LIMIT = 20;
const ERROR_THROTTLE_MS = 60 * 60 * 1000;
const ERROR_MESSAGE_MAX = 200;

const ERROR_SOURCE_LABELS: Record<string, string> = {
  chat: "Số liệu chat",
  sync: "Số liệu đồng bộ",
  livekit: "Số liệu phòng học nhóm",
  errors: "Nhật ký lỗi",
  r2: "Kho tệp",
  flags: "Cờ hệ thống",
};

const errorLogThrottle = new Map<string, number>();

/** Test dùng để xóa bộ nhớ đệm giới hạn tần suất giữa các ca. */
export function __resetErrorLogThrottle(): void {
  errorLogThrottle.clear();
}

/**
 * Ghi một dòng lỗi cho trang admin. Cùng `source:code` chỉ ghi tối đa 1 dòng/giờ.
 * Map trong RAM chỉ chặn trong một isolate, nên phải đọc dòng mới nhất trong D1
 * trước khi chèn để các isolate khác cũng thấy giới hạn này.
 * Không chứa câu hỏi, uid, email hay key; D1 lỗi thì bỏ qua, không làm hỏng request chính.
 */
export async function logAdminError(
  env: AdminEnv,
  source: string,
  code: string,
): Promise<boolean> {
  if (!env.DB) return false;

  const key = `${source}:${code}`;
  const now = Date.now();
  const lastInMemory = errorLogThrottle.get(key) || 0;
  if (now - lastInMemory < ERROR_THROTTLE_MS) return false;

  const message = `${ERROR_SOURCE_LABELS[source] || source} không lấy được (${code}).`;
  try {
    const recent = await env.DB.prepare(
      "SELECT created_at FROM admin_error_log WHERE source = ? AND code = ? ORDER BY created_at DESC LIMIT 1",
    )
      .bind(source, code)
      .first<{ created_at: number }>();
    const lastAt = Math.max(lastInMemory, Number(recent?.created_at) || 0);
    if (now - lastAt < ERROR_THROTTLE_MS) {
      if (recent) errorLogThrottle.set(key, lastAt);
      return false;
    }
    errorLogThrottle.set(key, now);

    await env.DB.prepare(
      "INSERT INTO admin_error_log (source, code, message, created_at) VALUES (?, ?, ?, ?)",
    )
      .bind(source, code, message.slice(0, ERROR_MESSAGE_MAX), now)
      .run();

    return true;
  } catch {
    return false;
  }
}

type ErrorRow = {
  id: number;
  source: string;
  code: string;
  message: string;
  created_at: number;
};

export async function readErrors(env: AdminEnv): Promise<
  | { ok: true; items: Array<Record<string, unknown>> }
  | { ok: false; error: string }
> {
  if (!env.DB) return { ok: false, error: "d1_unavailable" };
  try {
    const res = await env.DB.prepare(
      "SELECT id, source, code, message, created_at FROM admin_error_log ORDER BY created_at DESC LIMIT ?",
    )
      .bind(ERROR_ROWS_LIMIT)
      .all<ErrorRow>();
    const items = (res?.results || []).map((row) => ({
      id: Number(row.id) || 0,
      source: String(row.source || ""),
      code: String(row.code || ""),
      message: String(row.message || "").slice(0, ERROR_MESSAGE_MAX),
      createdAt: Number(row.created_at) || 0,
    }));
    return { ok: true, items };
  } catch {
    return { ok: false, error: "d1_error" };
  }
}
