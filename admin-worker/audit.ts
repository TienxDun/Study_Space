/**
 * Audit D1 (bảng admin_audit) và các bộ đếm giới hạn tần suất ghi trong RAM
 * cho từng nhóm hành động: cờ hệ thống, cấu hình chat, nội dung.
 * Map chỉ chặn trong một isolate, đủ cho mục đích chống bấm tay nhanh.
 */

import type { AdminEnv } from "./shared";

const FLAG_WRITE_LIMIT = 10;
const FLAG_WRITE_WINDOW_MS = 60 * 1000;
const CHAT_CFG_WRITE_LIMIT = 10;
const CHAT_CFG_WRITE_WINDOW_MS = 60 * 1000;
// P2c: mỗi lần lưu nội dung ghi một version mới đủ 3 dòng nên cho phép nhiều hơn.
const CONTENT_WRITE_LIMIT = 20;
const CONTENT_WRITE_WINDOW_MS = 60 * 1000;

export async function logAudit(
  env: AdminEnv,
  entry: { actorEmail: string; action: string; target: string; detail: unknown },
): Promise<boolean> {
  if (!env.DB) return false;
  try {
    await env.DB.prepare(
      "INSERT INTO admin_audit (actor_email, action, target, detail_json, created_at) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(
        entry.actorEmail.slice(0, 200),
        entry.action,
        entry.target,
        JSON.stringify(entry.detail).slice(0, 4000),
        Date.now(),
      )
      .run();
    return true;
  } catch {
    return false;
  }
}

const flagWriteLog = new Map<string, number[]>();

/** Test dùng để xóa bộ đếm giới hạn ghi giữa các ca. */
export function __resetFlagWriteLog(): void {
  flagWriteLog.clear();
}

export function allowFlagWrite(email: string): boolean {
  const now = Date.now();
  const hits = (flagWriteLog.get(email) || []).filter((at) => now - at < FLAG_WRITE_WINDOW_MS);
  if (hits.length >= FLAG_WRITE_LIMIT) {
    flagWriteLog.set(email, hits);
    return false;
  }
  hits.push(now);
  flagWriteLog.set(email, hits);
  return true;
}

const chatWriteLog = new Map<string, number[]>();

/** Test dùng để xóa bộ đếm giới hạn ghi cấu hình chat giữa các ca. */
export function __resetChatWriteLog(): void {
  chatWriteLog.clear();
}

export function allowChatWrite(email: string): boolean {
  const now = Date.now();
  const hits = (chatWriteLog.get(email) || []).filter((at) => now - at < CHAT_CFG_WRITE_WINDOW_MS);
  if (hits.length >= CHAT_CFG_WRITE_LIMIT) {
    chatWriteLog.set(email, hits);
    return false;
  }
  hits.push(now);
  chatWriteLog.set(email, hits);
  return true;
}

const contentWriteLog = new Map<string, number[]>();

/** Test dùng để xóa bộ đếm giới hạn ghi nội dung giữa các ca. */
export function __resetContentWriteLog(): void {
  contentWriteLog.clear();
}

export function allowContentWrite(email: string): boolean {
  const now = Date.now();
  const hits = (contentWriteLog.get(email) || []).filter(
    (at) => now - at < CONTENT_WRITE_WINDOW_MS,
  );
  if (hits.length >= CONTENT_WRITE_LIMIT) {
    contentWriteLog.set(email, hits);
    return false;
  }
  hits.push(now);
  contentWriteLog.set(email, hits);
  return true;
}

// P2e: xử lý báo cáo và đặt hạn chế tài khoản là thao tác nhạy cảm nhưng
// người vận hành có thể xử lý liên tiếp; 30 lần/phút là đủ và chặn bấm lặp.
const REPORT_WRITE_LIMIT = 30;
const REPORT_WRITE_WINDOW_MS = 60 * 1000;
const reportWriteLog = new Map<string, number[]>();

/** Test dùng để xóa bộ đếm giới hạn xử lý báo cáo giữa các ca. */
export function __resetReportWriteLog(): void {
  reportWriteLog.clear();
}

export function allowReportWrite(email: string): boolean {
  const now = Date.now();
  const hits = (reportWriteLog.get(email) || []).filter(
    (at) => now - at < REPORT_WRITE_WINDOW_MS,
  );
  if (hits.length >= REPORT_WRITE_LIMIT) {
    reportWriteLog.set(email, hits);
    return false;
  }
  hits.push(now);
  reportWriteLog.set(email, hits);
  return true;
}
