import type { Msg } from "../types";

// Cache tin vào máy theo phiên: mở khung hiện ngay 0 lượt đọc,
// listener về sau ghi đè bằng tin tươi. Đổi acc thì xóa cache acc cũ.
const CACHE_V = 1;
const CACHE_MAX = 50;

const cacheKey = (uid: string, sid: string) => `chat-msgs:${uid}:${sid}`;

export function loadCache(uid: string, sid: string): Msg[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(uid, sid));
    if (!raw) return null;
    const j = JSON.parse(raw) as { v?: unknown; msgs?: unknown };
    if (j?.v !== CACHE_V || !Array.isArray(j.msgs)) return null;
    return (j.msgs as Msg[]).slice(-CACHE_MAX);
  } catch {
    return null;
  }
}

export function saveCache(uid: string, sid: string, list: Msg[]) {
  try {
    localStorage.setItem(cacheKey(uid, sid), JSON.stringify({ v: CACHE_V, msgs: list.slice(-CACHE_MAX) }));
  } catch {
    /* máy đầy thì bỏ qua, lần sau tải lại từ mạng */
  }
}

export function clearCache(uid: string) {
  try {
    const prefix = `chat-msgs:${uid}:`;
    const del: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) del.push(k);
    }
    del.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* bỏ qua */
  }
}
