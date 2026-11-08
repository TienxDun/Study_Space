"use client";

import { STORAGE_KEYS } from "@/lib/storage-keys";
import { saveStorageJSON } from "@/lib/safe-storage";
import { generateId } from "@/lib/utils";

/**
 * Ghi nhận thời gian tập trung Pomodoro theo từng task cụ thể.
 *
 * THIẾT KẾ FIREBASE-READY:
 * - Mỗi FocusSession map 1:1 sang 1 document trong collection `focusSessions`
 *   (document id = session.id).
 * - Query tương lai: `where("userId", "==", uid).where("startedAt", ">=", from)`
 *   rồi aggregate phía client (giống hệt getFocusSummary bên dưới).
 * - Trường `userId` / `createdAt` (serverTimestamp) sẽ thêm khi có Firebase Auth,
 *   các hàm aggregate không phụ thuộc chúng nên không phải sửa.
 * - Hiện tại dùng LocalStorageFocusSessionStore (append-only, cap 2000 phiên).
 *   Sau này chỉ cần viết FirebaseFocusSessionStore implement FocusSessionStore.
 */
export interface FocusSession {
  /** Cũng là Firestore document id sau này. */
  id: string;
  taskId: string;
  /** Snapshot tên task lúc hoàn thành (task có thể đổi tên/xóa sau đó). */
  taskTitle: string;
  boardId?: string;
  /** Epoch ms lúc phiên bắt đầu chạy. */
  startedAt: number;
  /** Epoch ms lúc phiên kết thúc. */
  endedAt: number;
  /** Số giây tập trung thực tế được ghi nhận. */
  focusSeconds: number;
  /** Số giây của phiên lúc bắt đầu (chốt trước khi chạy). */
  plannedSeconds: number;
  /** Trong log luôn true — skip/reset không ghi phiên. */
  completed: boolean;
  schemaVersion: 1;
  /** Số đời (epoch) lịch sử xóa của user để chống hồi sinh phiên sau khi clear */
  focusEpoch?: number;
}

export interface FocusSessionInput {
  taskId: string;
  taskTitle: string;
  boardId?: string;
  startedAt: number;
  endedAt: number;
  focusSeconds: number;
  plannedSeconds: number;
  focusEpoch?: number;
}

export interface FocusSessionStore {
  list(): FocusSession[];
  append(session: FocusSession): FocusSession[];
  clear(): void;
}

export const MAX_STORED_SESSIONS = 2000;
export const FOCUS_SESSIONS_SCHEMA_VERSION = 1 as const;

/** Sự kiện khi có phiên focus mới được ghi — UI thống kê nghe để refresh. */
export const EVENT_FOCUS_SESSION_LOGGED = "study_space_focus_session_logged";

function createSessionId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {}
  return generateId();
}

function sanitizeSession(s: FocusSession): FocusSession | null {
  if (!s || typeof s.taskId !== "string" || !s.taskId) return null;
  const focusSeconds = Math.max(0, Math.floor(Number(s.focusSeconds) || 0));
  if (focusSeconds <= 0) return null;
  return {
    id: typeof s.id === "string" && s.id ? s.id : createSessionId(),
    taskId: s.taskId,
    taskTitle: typeof s.taskTitle === "string" ? s.taskTitle : "",
    boardId: typeof s.boardId === "string" ? s.boardId : undefined,
    startedAt: Number(s.startedAt) || 0,
    endedAt: Number(s.endedAt) || 0,
    focusSeconds,
    plannedSeconds: Math.max(0, Math.floor(Number(s.plannedSeconds) || 0)),
    completed: true,
    schemaVersion: FOCUS_SESSIONS_SCHEMA_VERSION,
    focusEpoch: typeof s.focusEpoch === "number" ? s.focusEpoch : undefined,
  };
}

export class LocalStorageFocusSessionStore implements FocusSessionStore {
  list(): FocusSession[] {
    if (typeof window === "undefined") return [];
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_KEYS.focusSessions);
    } catch {
      return [];
    }
    if (!raw) {
      cachedFocusRaw = null;
      cachedFocusList = [];
      return [];
    }
    // Cùng chuỗi thô ⇒ dùng lại kết quả đã parse (JSON.parse + sanitize
    // tới 2000 phiên là việc nặng, không nên lặp lại mỗi lần đọc).
    if (raw === cachedFocusRaw) return cachedFocusList;
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        cachedFocusRaw = raw;
        cachedFocusList = [];
        return [];
      }
      const clean: FocusSession[] = [];
      for (const item of parsed) {
        const s = sanitizeSession(item as FocusSession);
        if (s) clean.push(s);
      }
      cachedFocusRaw = raw;
      cachedFocusList = clean;
      return clean;
    } catch {
      return [];
    }
  }

  append(session: FocusSession): FocusSession[] {
    const clean = sanitizeSession(session);
    if (!clean) return this.list();
    const next = [...this.list(), clean];
    const pruned =
      next.length > MAX_STORED_SESSIONS
        ? next.slice(next.length - MAX_STORED_SESSIONS)
        : next;
    saveStorageJSON(STORAGE_KEYS.focusSessions, pruned);
    cachedFocusRaw = null; // buộc lần đọc sau parse lại theo dữ liệu mới
    return pruned;
  }

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.focusSessions);
    } catch {}
    cachedFocusRaw = null;
    cachedFocusList = [];
  }
}

// Cache dùng chung: chỉ đọc localStorage (rẻ) rồi so chuỗi, hết trùng parse.
let cachedFocusRaw: string | null = null;
let cachedFocusList: FocusSession[] = [];

export const focusSessionStore: FocusSessionStore =
  new LocalStorageFocusSessionStore();

function getStoredFocusEpoch(): number {
  try {
    if (typeof window === "undefined") return 1;
    const uid = localStorage.getItem("study_space_cloud_uid_v1");
    if (uid) {
      const val = localStorage.getItem(`${STORAGE_KEYS.focusEpoch}_${uid}`);
      if (val) return Number(val) || 1;
    }
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`${STORAGE_KEYS.focusEpoch}_`)) {
        const val = localStorage.getItem(k);
        if (val) return Number(val) || 1;
      }
    }
    return 1;
  } catch {
    return 1;
  }
}

/** Ghi 1 phiên focus đã hoàn thành. Skip/reset không gọi hàm này. */
export function logFocusSession(
  input: FocusSessionInput,
  store: FocusSessionStore = focusSessionStore
): FocusSession | null {
  const currentEpoch = input.focusEpoch ?? getStoredFocusEpoch();
  const session = sanitizeSession({
    ...input,
    id: createSessionId(),
    completed: true,
    schemaVersion: FOCUS_SESSIONS_SCHEMA_VERSION,
    focusEpoch: currentEpoch,
  });
  if (!session) return null;
  store.append(session);
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(EVENT_FOCUS_SESSION_LOGGED));
    }
  } catch {}
  return session;
}

/* ---------------- Mốc thời gian (giờ địa phương) ---------------- */

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Tuần bắt đầu từ Thứ Hai (chuẩn VN). */
export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay(); // 0 = CN, 1 = T2, ...
  const diff = (day + 6) % 7; // số ngày lùi về Thứ Hai
  d.setDate(d.getDate() - diff);
  return d;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

/* ---------------- Tổng hợp ---------------- */

export interface TaskFocusTotal {
  taskId: string;
  /** Tên mới nhất của task trong kỳ. */
  taskTitle: string;
  focusSeconds: number;
  sessions: number;
}

export interface FocusSummary {
  totalSeconds: number;
  sessions: number;
  byTask: TaskFocusTotal[];
}

/** Tổng hợp các phiên có startedAt trong [fromMs, toMs). */
export function getFocusSummary(
  sessions: FocusSession[],
  fromMs: number,
  toMs: number
): FocusSummary {
  const byTask = new Map<string, TaskFocusTotal>();
  let totalSeconds = 0;
  let count = 0;
  for (const s of sessions) {
    if (!s || s.startedAt < fromMs || s.startedAt >= toMs) continue;
    totalSeconds += s.focusSeconds;
    count += 1;
    const prev = byTask.get(s.taskId);
    if (prev) {
      prev.focusSeconds += s.focusSeconds;
      prev.sessions += 1;
      if (s.taskTitle) prev.taskTitle = s.taskTitle;
    } else {
      byTask.set(s.taskId, {
        taskId: s.taskId,
        taskTitle: s.taskTitle || s.taskId,
        focusSeconds: s.focusSeconds,
        sessions: 1,
      });
    }
  }
  return {
    totalSeconds,
    sessions: count,
    byTask: [...byTask.values()].sort(
      (a, b) => b.focusSeconds - a.focusSeconds
    ),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function getTodaySummary(
  sessions: FocusSession[],
  now: Date = new Date()
): FocusSummary {
  const from = startOfDay(now).getTime();
  return getFocusSummary(sessions, from, from + DAY_MS);
}

export function getWeekSummary(
  sessions: FocusSession[],
  now: Date = new Date()
): FocusSummary {
  const from = startOfWeek(now).getTime();
  return getFocusSummary(sessions, from, from + 7 * DAY_MS);
}

export function getMonthSummary(
  sessions: FocusSession[],
  now: Date = new Date()
): FocusSummary {
  const start = startOfMonth(now);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return getFocusSummary(sessions, start.getTime(), end.getTime());
}


/** "45 giây" • "25 phút" • "1 giờ 5 phút" • "2 giờ" — dùng cho toast/thống kê. */
export function formatFocusDuration(totalSeconds: number): string {
  const secs = Math.max(0, Math.floor(totalSeconds || 0));
  if (secs < 60) return `${secs} giây`;
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  if (hours <= 0) return `${minutes} phút`;
  if (minutes <= 0) return `${hours} giờ`;
  return `${hours} giờ ${minutes} phút`;
}

/* ---------------- Lịch sử từng ngày ---------------- */

export interface DayFocusEntry {
  /** yyyy-m-d (giờ địa phương), dùng làm key. */
  dateKey: string;
  /** Epoch ms lúc 00:00 của ngày đó. */
  dayStartMs: number;
  totalSeconds: number;
  sessions: number;
  byTask: TaskFocusTotal[];
}

const VI_WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/** "Hôm nay" • "Hôm qua" • "T4, 8/10". */
export function formatDayLabel(dayStartMs: number, now: Date = new Date()): string {
  const day = startOfDay(new Date(dayStartMs)).getTime();
  const today = startOfDay(now).getTime();
  const diffDays = Math.round((today - day) / DAY_MS);
  if (diffDays === 0) return "Hôm nay";
  if (diffDays === 1) return "Hôm qua";
  const d = new Date(day);
  return `${VI_WEEKDAYS[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`;
}

/**
 * Chuỗi ngày có hoạt động, mới nhất trước — từ ngày đầu dùng web tới nay.
 * Mỗi ngày kèm chi tiết từng task để expand xem.
 */
export function getDailySeries(
  sessions: FocusSession[],
  now: Date = new Date()
): DayFocusEntry[] {
  const todayStart = startOfDay(now).getTime();
  const buckets = new Map<string, FocusSession[]>();
  for (const s of sessions) {
    if (!s || s.startedAt > todayStart + DAY_MS) continue;
    const day = startOfDay(new Date(s.startedAt)).getTime();
    const key = `${new Date(day).getFullYear()}-${new Date(day).getMonth()}-${new Date(day).getDate()}`;
    const list = buckets.get(key);
    if (list) list.push(s);
    else buckets.set(key, [s]);
  }
  const entries: DayFocusEntry[] = [];
  for (const [key, list] of buckets) {
    const dayStartMs = startOfDay(new Date(list[0].startedAt)).getTime();
    const summary = getFocusSummary(list, dayStartMs, dayStartMs + DAY_MS);
    entries.push({
      dateKey: key,
      dayStartMs,
      totalSeconds: summary.totalSeconds,
      sessions: summary.sessions,
      byTask: summary.byTask,
    });
  }
  return entries.sort((a, b) => b.dayStartMs - a.dayStartMs);
}
