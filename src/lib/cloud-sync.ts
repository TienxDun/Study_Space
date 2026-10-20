"use client";

import { STORAGE_KEYS } from "@/lib/storage-keys";
import { deleteLocalImages } from "@/components/study/chat/utils/imageStorage";
import {
  FocusSession,
  focusSessionStore,
  EVENT_FOCUS_SESSION_LOGGED,
} from "@/lib/focus-sessions";
import { StudyNote, isNoteActive } from "@/components/study/notes/types";
import { saveStorageJSON } from "@/lib/safe-storage";

/**
 * Đồng bộ dữ liệu học tập lên Cloudflare D1 (qua Worker `data-api`) — Mốc 2 v5.3 (Hardened).
 *
 * Khắc phục triệt để:
 * 1. Logout/login cùng UID không bị mất dữ liệu nhờ wipe sạch lastSyncedAt theo prefix.
 * 2. Không đè dữ liệu khi sửa trong lần sync đầu tiên (bỏ cản trở !bootstrapped).
 * 3. Token fail vẫn giữ active & bootstrapped để theo dõi dirty chuẩn xác.
 * 4. Dọn sạch STALE_EPOCH khỏi cả hàng đợi lẫn store để chống hồi sinh phiên.
 * 5. Delta sync semantics: chỉ push khi local dirty, không push oan key không đổi.
 * 6. Logout sau khi sync fail giữ nguyên 100% dữ liệu máy và dừng wipe.
 * 7. Retry 401, exponential backoff (2s → 5s → 15s → 45s ±20%), try/catch fail-safe.
 * 8. Note conflict rescue hoàn toàn độc lập với lệch đồng hồ; hỗ trợ restore note.
 * 9. hasUnsyncedChanges không bị false positive do multiNotes.
 * 10. While loop cho needsResync chống race condition.
 */

export let DATA_API_URL = (process.env.NEXT_PUBLIC_DATA_API_URL || "").replace(/\/+$/, "");

export function setDataApiUrl(url: string): void {
  DATA_API_URL = url.replace(/\/+$/, "");
}

export function cloudConfigured(): boolean {
  return Boolean(DATA_API_URL || process.env.NEXT_PUBLIC_DATA_API_URL);
}

export const SYNCED_KEYS: readonly string[] = [
  STORAGE_KEYS.sceneId,
  STORAGE_KEYS.clockSeconds,
  STORAGE_KEYS.clock12Hour,
  STORAGE_KEYS.stopwatchMs,
  STORAGE_KEYS.pomoDurations,
  STORAGE_KEYS.pomoCount,
  STORAGE_KEYS.mood,
  STORAGE_KEYS.trackId,
  STORAGE_KEYS.shuffle,
  STORAGE_KEYS.loop,
  STORAGE_KEYS.kanbanBoards,
  STORAGE_KEYS.activeBoard,
  STORAGE_KEYS.customEmbeds,
  STORAGE_KEYS.multiNotes,
  STORAGE_KEYS.notesTheme,
  STORAGE_KEYS.favoriteScenes,
  STORAGE_KEYS.slideshowEnabled,
  STORAGE_KEYS.slideshowIntervalMin,
  STORAGE_KEYS.activeFocusTask,
  STORAGE_KEYS.tourCompleted,
  STORAGE_KEYS.tourQuestState,
];

const SYNC_SET = new Set<string>(SYNCED_KEYS);
const MAX_FOCUS_SESSIONS = 2000;

export const CLOUD_META_KEY = "study_space_cloud_meta_v1";
export const CLOUD_UID_KEY = "study_space_cloud_uid_v1";
export const CLOUD_BOOT_PREFIX = "study_space_cloud_boot_";

const PUSH_DEBOUNCE_MS = 2000;
const TOL_MS = 2000;

export const EVENT_CLOUD_SYNCED = "study_space_cloud_synced";
export const EVENT_CLOUD_STATUS = "study_space_cloud_status";
export const EVENT_CLOUD_FOCUS_STALE = "study_space_cloud_focus_stale";

export type CloudSyncStatus = "local" | "pending" | "syncing" | "synced" | "error";

export interface CloudSyncState {
  status: CloudSyncStatus;
  lastSyncedAt: number | null;
}

const INITIAL_SYNC_STATE: CloudSyncState = { status: "local", lastSyncedAt: null };
let syncState: CloudSyncState = INITIAL_SYNC_STATE;
const statusListeners = new Set<() => void>();

export function getSyncState(): CloudSyncState {
  return syncState;
}

export function getServerSyncState(): CloudSyncState {
  return INITIAL_SYNC_STATE;
}

export function subscribeSyncState(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

function emitSyncState(): void {
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new Event(EVENT_CLOUD_STATUS));
    } catch {}
  }
  for (const listener of statusListeners) {
    try {
      listener();
    } catch {}
  }
}

function setSyncStatus(status: CloudSyncStatus, at?: number): void {
  const lastSyncedAt = at ?? syncState.lastSyncedAt;
  if (syncState.status === status && syncState.lastSyncedAt === lastSyncedAt) return;
  syncState = { status, lastSyncedAt };
  emitSyncState();
}

export interface CloudMetaEntry {
  local: number;
  synced: number;
  del?: boolean;
  dirty?: boolean;
  oversize?: boolean;
}
export type CloudMeta = Record<string, CloudMetaEntry>;

export const MAX_VALUE_LEN = 524_288; // 512KB UTF-8 theo Mốc 3 v5.5
export const MAX_SYNC_BATCH = 40; // Tối đa 40 keys trong một lượt sync

const textEncoder = new TextEncoder();
export function getByteLength(str: string | null): number {
  if (typeof str !== "string") return 0;
  return textEncoder.encode(str).byteLength;
}

export function hasOversizeKeys(): string[] {
  const meta = readMeta();
  const res: string[] = [];
  for (const [k, v] of Object.entries(meta)) {
    if (v && v.oversize) res.push(k);
  }
  return res;
}

export function downloadOversizeBackup(keys: string[]): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  try {
    const backupData: Record<string, any> = {};
    for (const k of keys) {
      const val = rawGet(k);
      try { backupData[k] = val ? JSON.parse(val) : val; } catch { backupData[k] = val; }
    }
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `study_space_oversize_backup_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {}
}

export interface SyncPlan {
  apply: Record<string, string>;
  push: Record<string, string>;
  remove: string[];
  meta: CloudMeta;
}

export function bootFlagKey(uid: string): string {
  return CLOUD_BOOT_PREFIX + uid;
}

/* ---------------- Truy cập localStorage "thô" ---------------- */

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function rawGet(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function rawSet(key: string, value: string): void {
  try {
    const s = storage();
    if (!s) return;
    if (origSetItem) origSetItem.call(s, key, value);
    else s.setItem(key, value);
  } catch {}
}

function rawRemove(key: string): void {
  try {
    const s = storage();
    if (!s) return;
    if (origRemoveItem) origRemoveItem.call(s, key);
    else s.removeItem(key);
  } catch {}
}

function resetLocalSyncedData(): void {
  for (const key of SYNCED_KEYS) rawRemove(key);
  metaCache = {};
  rawRemove(CLOUD_META_KEY);
  focusSessionStore.clear();
  rawRemove(STORAGE_KEYS.focusSessions);
  try {
    const s = storage();
    if (s) {
      const del: string[] = [];
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (
          k &&
          (k.startsWith("chat-msgs:") ||
            k.startsWith("chat-remember:") ||
            k.startsWith(`${STORAGE_KEYS.lastSyncedAt}_`) ||
            k.startsWith(`${STORAGE_KEYS.focusEpoch}_`) ||
            k.startsWith(`${STORAGE_KEYS.pendingFocusQueue}_`) ||
            k.startsWith("study_space_last_prune_check_") ||
            k.startsWith(CLOUD_BOOT_PREFIX) ||
            k.startsWith("study_space_backup_"))
        ) {
          del.push(k);
        }
      }
      for (const k of del) rawRemove(k);
    }
  } catch {}
  void deleteLocalImages();
}

export function isUserActivelyEditing(key?: string): boolean {
  if (typeof document === "undefined") return false;
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const isInput =
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable ||
    el.getAttribute("contenteditable") === "true";
  if (!isInput) return false;
  if (!key) return true;
  if (key === STORAGE_KEYS.multiNotes) {
    return Boolean(
      el.closest(".notes-editor") ||
        el.closest("[data-note-editor]") ||
        el.closest(".tiptap") ||
        el.closest(".ProseMirror") ||
        el.id === "note-title-input" ||
        isInput
    );
  }
  if (key === STORAGE_KEYS.kanbanBoards) {
    return Boolean(
      el.closest(".kanban-board") || el.closest("[data-kanban]") || isInput
    );
  }
  return true;
}

function readMetaStored(): CloudMeta {
  const raw = rawGet(CLOUD_META_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const res: CloudMeta = {};
    for (const [k, v] of Object.entries(parsed as CloudMeta)) {
      if (v && typeof v === "object") {
        const isDirty = v.dirty || v.del || v.local > (v.synced || 0) + TOL_MS;
        res[k] = { ...v, dirty: isDirty, oversize: Boolean(v.oversize) };
      }
    }
    return res;
  } catch {
    return {};
  }
}

let metaCache: CloudMeta | null = null;

export function readMeta(): CloudMeta {
  if (!metaCache) metaCache = readMetaStored();
  return metaCache;
}

function persistMeta(): void {
  try {
    if (!metaCache) return;
    rawSet(CLOUD_META_KEY, JSON.stringify(metaCache));
  } catch {}
}

/* ---------------- Quản lý Focus Epoch & Queue ---------------- */

export function focusEpochStorageKey(uid: string): string {
  return `${STORAGE_KEYS.focusEpoch}_${uid}`;
}

export function pendingFocusQueueKey(uid: string): string {
  return `${STORAGE_KEYS.pendingFocusQueue}_${uid}`;
}

export function getCurrentFocusEpoch(uid?: string): number {
  const currentUid = uid || rawGet(CLOUD_UID_KEY);
  if (!currentUid) return 1;
  const val = rawGet(focusEpochStorageKey(currentUid));
  return Number(val) || 1;
}

export function enqueuePendingFocus(session: FocusSession, uid?: string): void {
  const currentUid = uid || rawGet(CLOUD_UID_KEY);
  if (!currentUid) return;
  const qKey = pendingFocusQueueKey(currentUid);
  const raw = rawGet(qKey);
  let queue: FocusSession[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) queue = parsed;
    } catch {}
  }
  const epoch = session.focusEpoch ?? getCurrentFocusEpoch(currentUid);
  const item: FocusSession = { ...session, focusEpoch: epoch };
  if (!queue.some((s) => s.id === item.id)) {
    queue.push(item);
    rawSet(qKey, JSON.stringify(queue));
  }
}

/* ---------------- Bộ chặn: phát hiện thay đổi tức thì ---------------- */

let active = false;
let tokenFn: ((forceRefresh?: boolean) => Promise<string | null>) | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false;
let inFlightPromise: Promise<SyncResult> | null = null;
let needsResync = false;
let origSetItem: Storage["setItem"] | null = null;
let origRemoveItem: Storage["removeItem"] | null = null;
const inFlightKeys = new Set<string>();

export let consecutiveFailures = 0;
export let lastRetryAfterMs: number | null = null;
export const BACKOFF_DELAYS = [2000, 5000, 15000, 45000];

export const PUSH_DEBOUNCE_BASE_MS = 2000;
export const PUSH_DEBOUNCE_ADAPTIVE_MS = 5000;
export const MAX_WAIT_CEILING_MS = 10000;
export const CONTINUOUS_TYPING_WINDOW_MS = 30000;

export let continuousTypingSince: number | null = null;
export let firstUnsyncedChangeAt: number | null = null;
export let lastEditAt: number = 0;

export function getBackoffDelay(): number {
  if (lastRetryAfterMs !== null && lastRetryAfterMs > 0) {
    return lastRetryAfterMs;
  }
  const base = BACKOFF_DELAYS[Math.min(consecutiveFailures, BACKOFF_DELAYS.length - 1)];
  const jitter = base * (0.8 + Math.random() * 0.4);
  return Math.round(jitter);
}

function noteLocalChange(key: string, removed: boolean): void {
  // Bỏ chặn !bootstrapped: Nếu người dùng sửa trong lần sync đầu, vẫn ghi nhận dirty!
  if (!active || !SYNC_SET.has(key)) return;
  const meta = readMeta();
  const prev = meta[key] || { local: 0, synced: 0 };
  const now = Date.now();
  meta[key] = { local: now, synced: prev.synced, del: removed, dirty: true, oversize: false };
  persistMeta();
  if (syncing) {
    needsResync = true;
    inFlightKeys.add(key);
  }

  // State Machine Adaptive Debounce: Tách biệt continuous session và first change ceiling
  if (continuousTypingSince === null) {
    continuousTypingSince = now;
  }
  if (firstUnsyncedChangeAt === null) {
    firstUnsyncedChangeAt = now;
  }
  lastEditAt = now;

  const isContinuous = (now - continuousTypingSince) >= CONTINUOUS_TYPING_WINDOW_MS;
  const targetDebounce = isContinuous ? PUSH_DEBOUNCE_ADAPTIVE_MS : PUSH_DEBOUNCE_BASE_MS;
  const timeSinceFirstUnsynced = now - firstUnsyncedChangeAt;
  const timeUntilCeiling = Math.max(0, MAX_WAIT_CEILING_MS - timeSinceFirstUnsynced);
  const actualDelay = Math.min(targetDebounce, timeUntilCeiling);

  schedulePush(actualDelay);
  if (tokenFn) setSyncStatus("pending");
}

function installInterceptor(): void {
  if (typeof window === "undefined") return;
  const targets: Storage[] = [];
  if (window.localStorage) targets.push(window.localStorage);
  if (window.sessionStorage) targets.push(window.sessionStorage);
  if (window.Storage && window.Storage.prototype) targets.push(window.Storage.prototype as any);
  if (typeof Storage !== "undefined" && Storage.prototype) targets.push(Storage.prototype as any);

  try {
    for (const target of targets) {
      if (!target || (target.setItem as any)?.__zen_intercepted) continue;
      const origSet = target.setItem;
      const origRemove = target.removeItem;
      if (!origSet || !origRemove) continue;

      if (!origSetItem) origSetItem = origSet;
      if (!origRemoveItem) origRemoveItem = origRemove;

      const patchedSet = function (this: Storage, key: string, value: string) {
        origSet.call(this, key, value);
        const isSession = typeof window !== "undefined" && this === window.sessionStorage;
        if (!isSession) noteLocalChange(key, false);
      };
      (patchedSet as any).__zen_intercepted = true;

      const patchedRemove = function (this: Storage, key: string) {
        origRemove.call(this, key);
        const isSession = typeof window !== "undefined" && this === window.sessionStorage;
        if (!isSession) noteLocalChange(key, true);
      };
      (patchedRemove as any).__zen_intercepted = true;

      try {
        Object.defineProperty(target, "setItem", {
          value: patchedSet,
          writable: true,
          configurable: true,
        });
        Object.defineProperty(target, "removeItem", {
          value: patchedRemove,
          writable: true,
          configurable: true,
        });
      } catch {
        target.setItem = patchedSet;
        target.removeItem = patchedRemove;
      }
    }

    window.addEventListener(EVENT_FOCUS_SESSION_LOGGED, () => {
      if (!active || !tokenFn) return;
      const uid = rawGet(CLOUD_UID_KEY);
      if (!uid) return;
      const latest = focusSessionStore.list();
      if (latest.length > 0) {
        enqueuePendingFocus(latest[latest.length - 1], uid);
        schedulePush();
      }
    });

    // Khi có mạng lại: reset bộ đếm lỗi và thử sync ngay kèm jitter 0-1s
    window.addEventListener("online", () => {
      consecutiveFailures = 0;
      schedulePush(Math.random() * 1000);
    });

    window.addEventListener("pagehide", () => {
      persistMeta();
      if (!active || !tokenFn) return;
      const meta = readMeta();
      const dirtyEntries = Object.entries(meta).filter(([, e]) => e && e.dirty && !e.del);
      if (!dirtyEntries.length) return;

      const smallSettings: Record<string, string> = {};
      let totalBytes = 0;
      for (const [k] of dirtyEntries) {
        const val = rawGet(k);
        if (typeof val === "string") {
          if (totalBytes + val.length > 10000) break;
          smallSettings[k] = val;
          totalBytes += val.length;
        }
      }

      if (Object.keys(smallSettings).length > 0 && DATA_API_URL) {
        void tokenFn().then((tok) => {
          if (!tok) return;
          try {
            fetch(DATA_API_URL + "/settings", {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${tok}`,
                "X-Sync-Version": "2",
              },
              body: JSON.stringify({ settings: smallSettings }),
              keepalive: true,
            }).catch(() => {});
          } catch {}
        });
      }
    });
  } catch {}
}

/* ---------------- Pre-pass Merge Ghi chú & Cứu bài khi xung đột ---------------- */

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

function formatConflictTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseNotesArray(raw: string | null): StudyNote[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseArray(raw: string | null): Array<Record<string, unknown>> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mergeSessionArrays(localRaw: string | null, serverRaw: string | null): string {
  const byId = new Map<string, Record<string, unknown>>();
  for (const item of parseArray(serverRaw)) {
    if (item && typeof item.id === "string") byId.set(item.id, item);
  }
  for (const item of parseArray(localRaw)) {
    if (item && typeof item.id === "string") byId.set(item.id, item);
  }
  const merged = [...byId.values()].sort(
    (a, b) => (Number(a.startedAt) || 0) - (Number(b.startedAt) || 0)
  );
  const pruned = merged.length > MAX_FOCUS_SESSIONS ? merged.slice(merged.length - MAX_FOCUS_SESSIONS) : merged;
  return JSON.stringify(pruned);
}

export function mergeStudyNotes(
  localRaw: string | null,
  serverRaw: string | null,
  now: number
): { raw: string; hasConflict: boolean } {
  const localList = parseNotesArray(localRaw);
  const serverList = parseNotesArray(serverRaw);

  if (!localList.length && !serverList.length) return { raw: "[]", hasConflict: false };
  if (!localList.length) return { raw: serverRaw || "[]", hasConflict: false };
  if (!serverList.length) return { raw: localRaw || "[]", hasConflict: false };

  const byId = new Map<string, { local?: StudyNote; server?: StudyNote }>();
  for (const n of serverList) {
    if (n && typeof n.id === "string") byId.set(n.id, { server: n });
  }
  for (const n of localList) {
    if (n && typeof n.id === "string") {
      const entry = byId.get(n.id) || {};
      entry.local = n;
      byId.set(n.id, entry);
    }
  }

  const resultNotes: StudyNote[] = [];
  let hasConflict = false;

  for (const [id, { local, server }] of byId.entries()) {
    if (local && !server) {
      resultNotes.push(local);
      continue;
    }
    if (!local && server) {
      resultNotes.push(server);
      continue;
    }
    if (!local || !server) continue;

    const localActive = isNoteActive(local);
    const serverActive = isNoteActive(server);

    // Trường hợp 1: Cả hai bên cùng active
    if (localActive && serverActive) {
      if (local.content === server.content) {
        resultNotes.push(local.updatedAt >= server.updatedAt ? local : server);
      } else {
        // XUNG ĐỘT NỘI DUNG: Server làm chủ, cứu bản local (hoàn toàn miễn nhiễm lệch đồng hồ)
        hasConflict = true;
        resultNotes.push(server);

        const hash = simpleHash(id + local.content + local.updatedAt);
        const conflictCopy: StudyNote = {
          id: `${id}~conflict~${hash}`,
          title: `[Bản sao xung đột - ${formatConflictTime(local.updatedAt)}] ${local.title || "Ghi chú"}`,
          content: local.content,
          updatedAt: now,
          isPinned: false,
        };
        resultNotes.push(conflictCopy);
      }
      continue;
    }

    // Trường hợp 2: Server xóa, máy local còn active
    if (!serverActive && localActive) {
      // P1-3: Nếu local đã khôi phục sau khi server xóa, local note thắng!
      if (local.restoredAt && local.restoredAt > (server.deletedAt || 0)) {
        resultNotes.push(local);
        continue;
      }
      resultNotes.push(server); // Giữ tombstone
      // Cứu bài nếu local có nội dung (không phụ thuộc so sánh đồng hồ)
      if (local.content && local.content.trim() !== "") {
        hasConflict = true;
        const hash = simpleHash(id + local.content + local.updatedAt);
        const rescueCopy: StudyNote = {
          id: `${id}~conflict~${hash}`,
          title: `[Bản sao ghi chú đã xóa - ${formatConflictTime(local.updatedAt)}] ${local.title || "Ghi chú"}`,
          content: local.content,
          updatedAt: now,
          isPinned: false,
        };
        resultNotes.push(rescueCopy);
      }
      continue;
    }

    // Trường hợp 3: Local xóa, server còn active
    if (serverActive && !localActive) {
      // P1-3: Nếu server đã khôi phục sau khi local xóa, server note thắng!
      if (server.restoredAt && server.restoredAt > (local.deletedAt || 0)) {
        resultNotes.push(server);
        continue;
      }
      resultNotes.push(local); // Giữ tombstone
      if (server.content && server.content.trim() !== "") {
        hasConflict = true;
        const hash = simpleHash(id + server.content + server.updatedAt);
        const rescueCopy: StudyNote = {
          id: `${id}~conflict~${hash}`,
          title: `[Bản sao ghi chú đã xóa - ${formatConflictTime(server.updatedAt)}] ${server.title || "Ghi chú"}`,
          content: server.content,
          updatedAt: now,
          isPinned: false,
        };
        resultNotes.push(rescueCopy);
      }
      continue;
    }

    // Trường hợp 4: Cả hai bên đều đã xóa -> giữ tombstone mới nhất
    resultNotes.push({
      ...server,
      deletedAt: Math.max(server.deletedAt || 0, local.deletedAt || 0),
      updatedAt: Math.max(server.updatedAt || 0, local.updatedAt || 0),
    });
  }

  return { raw: JSON.stringify(resultNotes), hasConflict };
}

/* ---------------- Tính toán kế hoạch đồng bộ (planSync) ---------------- */

export function planSync(opts: {
  keys: readonly string[];
  local: Record<string, string | null>;
  server: Record<string, string | null>;
  serverUpdated: Record<string, number>;
  meta: CloudMeta;
  now: number;
  tol?: number;
  unionKeys?: Set<string>;
  isDelta?: boolean;
}): SyncPlan {
  const tol = opts.tol ?? TOL_MS;
  const apply: Record<string, string> = {};
  const push: Record<string, string> = {};
  const remove: string[] = [];
  const meta: CloudMeta = { ...opts.meta };

  for (const key of opts.keys) {
    const localRaw = opts.local[key] ?? null;
    const serverRaw = opts.server[key] ?? null;
    const s = opts.serverUpdated[key] || 0;
    const prev = meta[key] || { local: 0, synced: 0, dirty: false };
    const localHas = localRaw !== null;
    const serverHas = serverRaw !== null;

    // Giới hạn 512KB và xử lý oversize: nếu key vẫn vượt 512KB thì bỏ qua không đưa vào push
    const bytes = getByteLength(localRaw);
    if (prev.oversize && bytes > MAX_VALUE_LEN) {
      meta[key] = { ...prev, oversize: true, dirty: false };
      continue;
    }

    // Phân nhánh Pre-pass đặc biệt cho MultiNotes
    if (key === STORAGE_KEYS.multiNotes) {
      if (!localHas && !serverHas) {
        meta[key] = {
          local: prev.local || opts.now,
          synced: Math.max(prev.synced, s, opts.now),
          del: false,
          dirty: false,
        };
        continue;
      }
      const merged = mergeStudyNotes(localRaw, serverRaw, opts.now);
      if (merged.raw !== localRaw) {
        apply[key] = merged.raw;
      }
      const needsPush = localHas ? (merged.raw !== serverRaw) : false;
      if (needsPush) {
        push[key] = merged.raw;
      }
      meta[key] = {
        local: needsPush ? opts.now : Math.max(prev.synced, s),
        synced: Math.max(prev.synced, s),
        del: false,
        dirty: needsPush || (prev.dirty === true),
      };
      continue;
    }

    // Hỗ trợ unionKeys legacy
    if (opts.unionKeys && opts.unionKeys.has(key)) {
      if (localHas && serverHas) {
        const merged = mergeSessionArrays(localRaw, serverRaw);
        if (merged !== localRaw) apply[key] = merged;
        if (merged !== serverRaw) push[key] = merged;
        meta[key] = { local: Math.max(prev.local, opts.now), synced: Math.max(prev.synced, s) };
      } else if (localHas) {
        push[key] = localRaw as string;
        meta[key] = { local: prev.local || opts.now, synced: prev.synced, dirty: true };
      } else if (serverHas) {
        apply[key] = serverRaw as string;
        meta[key] = { local: s, synced: s, del: false, dirty: false };
      }
      continue;
    }

    // Cả hai bên đều không có: dọn sạch cờ del / dirty nếu có
    if (!localHas && !serverHas) {
      meta[key] = {
        local: prev.local || opts.now,
        synced: Math.max(prev.synced, s, opts.now),
        del: false,
        dirty: false,
      };
      continue;
    }

    // Máy không có, server có
    if (serverHas && !localHas) {
      const wantsDelete = prev.del === true && prev.local > Math.max(prev.synced, s) + tol;
      if (wantsDelete) {
        remove.push(key);
        // GIỮ del: true cho đến khi DELETE thành công trên mạng!
        meta[key] = { local: prev.local, synced: prev.synced, del: true, dirty: false };
      } else {
        apply[key] = serverRaw as string;
        meta[key] = { local: s, synced: s };
      }
      continue;
    }

    // Máy có, server không có
    if (localHas && !serverHas) {
      if (opts.isDelta) {
        // Trong delta sync: key vắng mặt nghĩa là KHÔNG THAY ĐỔI trên server.
        // Chỉ đẩy lên nếu máy local có cờ dirty!
        if (prev.dirty === true) {
          push[key] = localRaw as string;
          // GIỮ dirty: true cho đến khi PUT thành công trên mạng!
          meta[key] = { local: prev.local || opts.now, synced: prev.synced, del: false, dirty: true };
        }
      } else {
        // Full sync: server thực sự chưa có key này
        push[key] = localRaw as string;
        // GIỮ dirty: true cho đến khi PUT thành công trên mạng!
        meta[key] = { local: prev.local || opts.now, synced: prev.synced, del: false, dirty: true };
      }
      continue;
    }

    // Cả hai bên cùng có: so sánh cờ dirty và mốc máy chủ
    if (prev.dirty === true) {
      if (s > prev.synced && prev.synced > 0) {
        // Cả hai cùng sửa: server thắng
        if (serverRaw !== localRaw) apply[key] = serverRaw as string;
        meta[key] = { local: s, synced: s };
      } else {
        // Chỉ local sửa
        if (localRaw !== serverRaw) push[key] = localRaw as string;
        // GIỮ dirty: true cho đến khi PUT thành công trên mạng!
        meta[key] = { local: prev.local || opts.now, synced: Math.max(prev.synced, s), del: false, dirty: true };
      }
    } else {
      // Fallback: So sánh mốc thời gian
      if (s > prev.local + tol) {
        if (serverRaw !== localRaw) apply[key] = serverRaw as string;
        meta[key] = { local: s, synced: s };
      } else if (localRaw !== serverRaw) {
        push[key] = localRaw as string;
        meta[key] = { local: prev.local || opts.now, synced: Math.max(prev.synced, s), del: false, dirty: true };
      } else {
        meta[key] = { local: Math.max(prev.local, s), synced: Math.max(prev.synced, s) };
      }
    }
  }

  return { apply, push, remove, meta };
}

/* ---------------- Gọi API & Khóa Đa Tab ---------------- */

async function apiFetch(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    let res = await fetch((DATA_API_URL || "") + path, {
      ...init,
      signal: init.signal ?? ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Sync-Version": "2",
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
    });

    // 401: Refresh token và thử lại 1 lần
    if (res.status === 401 && tokenFn) {
      try {
        const freshToken = await tokenFn(true);
        if (freshToken && freshToken !== token) {
          res = await fetch((DATA_API_URL || "") + path, {
            ...init,
            signal: init.signal ?? ctrl.signal,
            headers: {
              "Content-Type": "application/json",
              "X-Sync-Version": "2",
              Authorization: `Bearer ${freshToken}`,
              ...(init.headers || {}),
            },
          });
        }
      } catch {}
    }

    // 429: Ghi nhận Retry-After để áp dụng backoff chuẩn xác
    if (res.status === 429) {
      const retryAfter = res.headers?.get ? res.headers.get("Retry-After") : null;
      if (retryAfter) {
        const sec = parseInt(retryAfter, 10);
        if (!isNaN(sec) && sec > 0) {
          lastRetryAfterMs = sec * 1000;
        }
      }
    }

    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchServer(token: string, since: number = 0): Promise<{
  settings: Record<string, string>;
  deleted: string[];
  updated: Record<string, number>;
  serverTime: number;
}> {
  const query = since > 0 ? `?since=${since}` : `?since=0`;
  const res = await apiFetch(`/settings${query}`, token, { method: "GET" });
  if (!res.ok) throw new Error(`GET /settings ${res.status}`);
  const data = await res.json();
  return {
    settings: (data && data.settings) || {},
    deleted: Array.isArray(data && data.deleted) ? data.deleted : [],
    updated: (data && data.updated) || {},
    serverTime: typeof (data && data.serverTime) === "number" ? data.serverTime : Date.now(),
  };
}

let syncChannel: BroadcastChannel | null = null;
function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
    if (!syncChannel) {
      try {
        syncChannel = new BroadcastChannel("study_sync_channel");
        syncChannel.onmessage = (evt) => {
          if (evt.data && evt.data.type === "SYNCED" && evt.data.uid === rawGet(CLOUD_UID_KEY)) {
            setSyncStatus("synced", evt.data.at);
          }
        };
      } catch {}
    }
  }
  return syncChannel;
}

function broadcastSyncEvent(at: number, uid: string): void {
  try {
    getBroadcastChannel()?.postMessage({ type: "SYNCED", at, uid });
  } catch {}
}

async function withSyncLock<T>(fn: () => Promise<T>, fallbackValue: T): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks && typeof navigator.locks.request === "function") {
    try {
      return await navigator.locks.request("study_space_sync_lock", { ifAvailable: true }, async (lock) => {
        if (!lock) return fallbackValue;
        return await fn();
      });
    } catch {}
  }

  const LOCK_KEY = "study_space_tab_sync_lock";
  const now = Date.now();
  try {
    const rawLock = rawGet(LOCK_KEY);
    if (rawLock) {
      const lockTime = Number(rawLock) || 0;
      if (now - lockTime < 10000) return fallbackValue;
    }
    rawSet(LOCK_KEY, String(now));
  } catch {}

  try {
    return await fn();
  } finally {
    try {
      rawRemove(LOCK_KEY);
    } catch {}
  }
}

/* ---------------- Đồng bộ Focus Sessions với API riêng ---------------- */

async function syncFocusSessions(token: string, uid: string): Promise<boolean> {
  const epochKey = focusEpochStorageKey(uid);
  const queueKey = pendingFocusQueueKey(uid);
  let currentEpoch = getCurrentFocusEpoch(uid);

  // 1. Đẩy queue lên POST /focus
  const rawQueue = rawGet(queueKey);
  let queue: FocusSession[] = [];
  if (rawQueue) {
    try {
      const parsed = JSON.parse(rawQueue);
      if (Array.isArray(parsed)) queue = parsed;
    } catch {}
  }

  const staleEpochIds = new Set<string>();

  if (queue.length > 0) {
    const batch = queue.slice(0, 200).map((s) => ({
      ...s,
      focusEpoch: s.focusEpoch ?? currentEpoch,
    }));
    try {
      const postRes = await apiFetch("/focus", token, {
        method: "POST",
        body: JSON.stringify({ sessions: batch }),
      });
      if (postRes.ok) {
        const postData = await postRes.json().catch(() => null);
        if (postData && typeof postData.epoch === "number") {
          currentEpoch = postData.epoch;
          rawSet(epochKey, String(currentEpoch));
        }

        const sentIds = new Set(batch.map((b) => b.id));
        const rejectedOverflowIds = new Set<string>();
        if (postData && Array.isArray(postData.rejected)) {
          for (const rej of postData.rejected) {
            if (rej.reason === "STALE_EPOCH") {
              staleEpochIds.add(rej.id);
            } else if (rej.reason === "BATCH_OVERFLOW") {
              rejectedOverflowIds.add(rej.id);
            }
          }
        }

        // Dọn queue
        const remainingQueue = queue.filter((s) => !sentIds.has(s.id) || rejectedOverflowIds.has(s.id));
        rawSet(queueKey, JSON.stringify(remainingQueue));

        // DỌN SẠCH CÁC PHIÊN STALE KHỎI LOCAL STORE ĐỂ KHÔNG BỊ HỒI SINH!
        if (staleEpochIds.size > 0) {
          const currentStore = focusSessionStore.list();
          const cleanStore = currentStore.filter((s) => !staleEpochIds.has(s.id));
          if (cleanStore.length !== currentStore.length) {
            saveStorageJSON(STORAGE_KEYS.focusSessions, cleanStore);
          }
          if (typeof window !== "undefined") {
            try {
              window.dispatchEvent(
                new CustomEvent(EVENT_CLOUD_FOCUS_STALE, {
                  detail: { staleIds: Array.from(staleEpochIds) },
                })
              );
            } catch {}
          }
        }
      }
    } catch {
      // Lỗi mạng khi đẩy focus
    }
  }

  // 2. Kéo các phiên từ server về qua GET /focus
  try {
    const getRes = await apiFetch("/focus", token, { method: "GET" });
    if (getRes.ok) {
      const getData = await getRes.json().catch(() => null);
      if (getData) {
        if (typeof getData.epoch === "number") {
          currentEpoch = getData.epoch;
          rawSet(epochKey, String(currentEpoch));
        }
        if (Array.isArray(getData.sessions)) {
          const localList = focusSessionStore.list();
          const byId = new Map<string, FocusSession>();
          for (const s of getData.sessions) {
            if (s && typeof s.id === "string") byId.set(s.id, s);
          }
          for (const s of localList) {
            if (s && typeof s.id === "string" && !staleEpochIds.has(s.id)) {
              const sEpoch = typeof s.focusEpoch === "number" ? s.focusEpoch : (currentEpoch === 1 ? 1 : 0);
              if (sEpoch >= currentEpoch) {
                byId.set(s.id, s);
              }
            }
          }
          const merged = [...byId.values()].sort((a, b) => a.startedAt - b.startedAt);
          const capped =
            merged.length > MAX_FOCUS_SESSIONS
              ? merged.slice(merged.length - MAX_FOCUS_SESSIONS)
              : merged;
          saveStorageJSON(STORAGE_KEYS.focusSessions, capped);
        }
      }
      return true;
    }
  } catch {}

  return false;
}

export async function clearCloudFocus(token: string, uid: string): Promise<{ ok: boolean; epoch?: number }> {
  const epochKey = focusEpochStorageKey(uid);
  const queueKey = pendingFocusQueueKey(uid);
  try {
    const res = await apiFetch("/focus", token, { method: "DELETE" });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      const newEpoch = Number(data && data.epoch) || (getCurrentFocusEpoch(uid) + 1);
      rawSet(epochKey, String(newEpoch));
      rawRemove(queueKey);
      focusSessionStore.clear();
      return { ok: true, epoch: newEpoch };
    }
  } catch {}
  return { ok: false };
}

/* ---------------- Một lượt đồng bộ: kéo về + đẩy lên ---------------- */

export interface SyncResult {
  applied: number;
  pushed: number;
  removed: number;
  ok: boolean;
}

async function doSync(): Promise<SyncResult> {
  const result: SyncResult = { applied: 0, pushed: 0, removed: 0, ok: false };
  const uid = rawGet(CLOUD_UID_KEY);
  if (!active || !tokenFn || !uid) return result;

  inFlightKeys.clear();
  syncing = true;
  try {
    const token = await tokenFn();
    if (!token) {
      setSyncStatus("local");
      return result;
    }
    setSyncStatus("syncing");

    const lastSyncedKey = `${STORAGE_KEYS.lastSyncedAt}_${uid}`;
    const lastSyncedAt = Number(rawGet(lastSyncedKey)) || 0;
    const isDelta = lastSyncedAt > 0;

    const local: Record<string, string | null> = {};
    for (const key of SYNCED_KEYS) local[key] = rawGet(key);

    const currentMeta = readMeta();

    // 1. Thử thực hiện qua combined endpoint POST /sync có CAS
    const pushCandidates: Record<string, string> = {};
    const baseUpdated: Record<string, number> = {};
    const removeCandidates: string[] = [];

    for (const key of SYNCED_KEYS) {
      const m = currentMeta[key];
      const val = local[key];
      if (m && m.oversize && getByteLength(val) > MAX_VALUE_LEN) {
        continue;
      }
      if (m && m.del) {
        removeCandidates.push(key);
        baseUpdated[key] = m.synced || 0;
      } else if (val !== null && (m?.dirty || !isDelta)) {
        pushCandidates[key] = val;
        baseUpdated[key] = m?.synced || 0;
      }
    }

    if (Object.keys(pushCandidates).length + removeCandidates.length <= MAX_SYNC_BATCH) {
      try {
        const syncRes = await apiFetch("/sync", token, {
          method: "POST",
          body: JSON.stringify({
            changes: pushCandidates,
            deleted: removeCandidates,
            reviveKeys: [],
            baseUpdated,
            since: lastSyncedAt,
          }),
        });

        if (syncRes.ok) {
          const syncData = await syncRes.json().catch(() => null);
          if (syncData && syncData.ok) {
            const at = syncData.at || Date.now();
            let failed = false;
            const next = readMeta();
            const pushKeys = Object.keys(pushCandidates);

            // Xử lý rejected
            const rejectedKeys = new Set<string>();
            if (Array.isArray(syncData.rejected)) {
              for (const rej of syncData.rejected) {
                if (!rej || !rej.key) continue;
                rejectedKeys.add(rej.key);
                if (rej.reason === "KEY_DELETED") {
                  rawRemove(rej.key);
                  next[rej.key] = { local: at, synced: at, del: false, dirty: false, oversize: false };
                } else if (rej.reason === "KEY_TOO_LARGE") {
                  next[rej.key] = { ...(next[rej.key] || { local: at, synced: at }), dirty: false, oversize: true };
                } else if (rej.reason === "RETIRED_KEY") {
                  next[rej.key] = { ...(next[rej.key] || { local: at, synced: at }), dirty: false };
                } else if (rej.reason === "CONFLICT") {
                  if (rej.key === STORAGE_KEYS.multiNotes) {
                    const localNotes = rawGet(STORAGE_KEYS.multiNotes);
                    const merged = mergeStudyNotes(localNotes, rej.serverValue || (syncData.settings && syncData.settings[rej.key]), at);
                    rawSet(STORAGE_KEYS.multiNotes, merged.raw);
                    next[rej.key] = { local: at, synced: at, dirty: true, del: false, oversize: false };
                    needsResync = true;
                    schedulePush(500);
                  } else {
                    try {
                      rawSet(`study_space_backup_${rej.key}_conflict_${Date.now()}`, rawGet(rej.key) || "");
                    } catch {}
                    const serverVal = rej.serverValue || (syncData.settings && syncData.settings[rej.key]) || "";
                    rawSet(rej.key, serverVal);
                    next[rej.key] = { local: at, synced: rej.serverUpdatedAt || at, del: false, dirty: false, oversize: false };
                  }
                }
              }
            }

            // Keys push thành công
            for (const k of pushKeys) {
              if (rejectedKeys.has(k)) continue;
              if (inFlightKeys.has(k)) {
                next[k] = { ...next[k], synced: at, dirty: true };
              } else {
                next[k] = { local: at, synced: at, del: false, dirty: false, oversize: false };
              }
              result.pushed += 1;
            }

            // Keys remove thành công
            for (const k of removeCandidates) {
              if (rejectedKeys.has(k)) continue;
              if (inFlightKeys.has(k)) {
                next[k] = { ...next[k], synced: at };
              } else {
                next[k] = { local: at, synced: at, del: false, dirty: false, oversize: false };
              }
              result.removed += 1;
            }

            // Áp dụng server settings mới
            if (syncData.settings && typeof syncData.settings === "object") {
              const keysToDefer: string[] = [];
              for (const [k, v] of Object.entries(syncData.settings as Record<string, string>)) {
                if (pushKeys.includes(k) || rejectedKeys.has(k)) continue;
                if ((k === STORAGE_KEYS.multiNotes || k === STORAGE_KEYS.kanbanBoards) && isUserActivelyEditing(k)) {
                  keysToDefer.push(k);
                  continue;
                }
                rawSet(k, v);
                result.applied += 1;
                next[k] = {
                  local: (syncData.updated && syncData.updated[k]) || at,
                  synced: (syncData.updated && syncData.updated[k]) || at,
                  del: false,
                  dirty: false,
                  oversize: false,
                };
              }

              if (keysToDefer.length > 0 && typeof document !== "undefined") {
                const activeEl = document.activeElement;
                if (activeEl) {
                  const onBlur = () => {
                    schedulePush(500);
                  };
                  activeEl.addEventListener("blur", onBlur, { once: true });
                }
              }
            }

            // Xử lý server deleted keys
            if (Array.isArray(syncData.deleted)) {
              for (const delKey of syncData.deleted) {
                if (removeCandidates.includes(delKey)) continue;
                rawRemove(delKey);
                result.removed += 1;
                next[delKey] = {
                  local: syncData.serverTime || at,
                  synced: syncData.serverTime || at,
                  del: false,
                  dirty: false,
                  oversize: false,
                };
              }
            }

            metaCache = next;

            // Đồng bộ Focus
            const focusOk = await syncFocusSessions(token, uid);
            if (!focusOk) failed = true;

            // Background Prune
            const pruneKey = `study_space_last_prune_check_${uid}`;
            const lastPrune = Number(rawGet(pruneKey)) || 0;
            if (Date.now() - lastPrune > 24 * 3600 * 1000 && focusSessionStore.list().length >= 2000) {
              rawSet(pruneKey, String(Date.now()));
              void apiFetch("/focus/prune", token, { method: "POST" });
            }

            if (!failed) {
              rawSet(lastSyncedKey, String(syncData.serverTime || at));
              consecutiveFailures = 0;
              lastRetryAfterMs = null;
              firstUnsyncedChangeAt = null;
              if (Date.now() - lastEditAt > 10_000) continuousTypingSince = null;
            } else {
              consecutiveFailures++;
              schedulePush(getBackoffDelay());
            }

            result.ok = !failed;
            setSyncStatus(failed ? "error" : "synced", failed ? undefined : Date.now());
            if (!failed) {
              broadcastSyncEvent(Date.now(), uid);
              try {
                window.dispatchEvent(new Event(EVENT_CLOUD_SYNCED));
              } catch {}
            }
            return result;
          }
        }
      } catch {
        // Tự động fallback sang GET /settings + PUT /settings cũ
      }
    }

    // 1. GET /settings (Delta Sync Fallback)
    let server;
    try {
      server = await fetchServer(token, lastSyncedAt);
    } catch {
      consecutiveFailures++;
      setSyncStatus("error");
      schedulePush(getBackoffDelay());
      return result;
    }

    // 2. Xử lý các key bị soft-delete trên server (deleted array)
    if (server.deleted && server.deleted.length > 0) {
      const next = readMeta();
      for (const delKey of server.deleted) {
        const localVal = rawGet(delKey);
        if (localVal !== null) {
          const m = next[delKey];
          if (m && m.dirty) {
            try {
              rawSet(`study_space_backup_${delKey}_conflict_${Date.now()}`, localVal);
            } catch {}
          }
          rawRemove(delKey);
          result.removed += 1;
        }
        next[delKey] = {
          local: server.serverTime,
          synced: server.serverTime,
          del: false,
          dirty: false,
        };
      }
      metaCache = next;
    }

    // 3. Tính toán planSync với cờ isDelta
    for (const key of SYNCED_KEYS) local[key] = rawGet(key);

    const plan = planSync({
      keys: SYNCED_KEYS,
      local,
      server: server.settings,
      serverUpdated: server.updated,
      meta: readMeta(),
      now: Date.now(),
      isDelta,
    });

    // P0-4: Hoãn áp dụng nếu người dùng đang chủ động soạn thảo
    const keysToDefer: string[] = [];
    for (const [k, v] of Object.entries(plan.apply)) {
      if ((k === STORAGE_KEYS.multiNotes || k === STORAGE_KEYS.kanbanBoards) && isUserActivelyEditing(k)) {
        keysToDefer.push(k);
        continue;
      }
      rawSet(k, v);
      result.applied += 1;
    }

    if (keysToDefer.length > 0 && typeof document !== "undefined") {
      const activeEl = document.activeElement;
      if (activeEl) {
        const onBlur = () => {
          schedulePush(500);
        };
        activeEl.addEventListener("blur", onBlur, { once: true });
      }
    }

    // Khởi tạo metaCache với plan.meta, bảo lưu meta cũ cho các key bị hoãn
    const metaBeforeApply = readMeta();
    const nextMeta: CloudMeta = { ...plan.meta };
    for (const deferredKey of keysToDefer) {
      nextMeta[deferredKey] = metaBeforeApply[deferredKey] || {
        local: Date.now(),
        synced: 0,
        dirty: true,
      };
    }
    metaCache = nextMeta;

    let at = server.serverTime || Date.now();
    let failed = false;

    // 4. PUT /settings
    const pushKeys = Object.keys(plan.push);
    if (pushKeys.length) {
      const body: Record<string, string> = {};
      for (const k of pushKeys) body[k] = plan.push[k];
      try {
        const putRes = await apiFetch("/settings", token, {
          method: "PUT",
          body: JSON.stringify({ settings: body }),
        });

        if (putRes.ok) {
          const data = await putRes.json().catch(() => null);
          if (data && typeof data.at === "number") at = data.at;
          const next = readMeta();
          for (const k of pushKeys) {
            if (inFlightKeys.has(k)) {
              next[k] = { ...next[k], synced: at, dirty: true };
            } else {
              next[k] = { local: at, synced: at, del: false, dirty: false };
            }
          }
          if (data && Array.isArray(data.rejected)) {
            for (const rej of data.rejected) {
              if (rej && rej.key) {
                if (rej.reason === "KEY_DELETED") {
                  rawRemove(rej.key);
                  next[rej.key] = { local: at, synced: at, del: false, dirty: false };
                } else if (rej.reason === "KEY_TOO_LARGE") {
                  next[rej.key] = { ...(next[rej.key] || { local: at, synced: at }), dirty: false, oversize: true };
                } else if (rej.reason === "RETIRED_KEY") {
                  next[rej.key] = { ...(next[rej.key] || { local: at, synced: at }), dirty: false };
                }
              }
            }
          }
          metaCache = next;
          result.pushed = pushKeys.length;
        } else {
          failed = true;
        }
      } catch {
        failed = true;
      }
    }

    // 5. DELETE /settings
    if (plan.remove.length) {
      try {
        const delRes = await apiFetch("/settings", token, {
          method: "DELETE",
          body: JSON.stringify({ keys: plan.remove }),
        });
        if (delRes.ok) {
          const next = readMeta();
          for (const k of plan.remove) {
            if (inFlightKeys.has(k)) {
              next[k] = { ...next[k], synced: at };
            } else {
              next[k] = { local: at, synced: at, del: false, dirty: false };
            }
          }
          metaCache = next;
          result.removed += plan.remove.length;
        } else {
          failed = true;
        }
      } catch {
        failed = true;
      }
    }

    // 6. Đồng bộ Focus Sessions qua endpoint riêng
    const focusOk = await syncFocusSessions(token, uid);
    if (!focusOk) {
      failed = true;
    }

    // 7. Cập nhật mốc lastSyncedAt
    if (!failed) {
      rawSet(lastSyncedKey, String(server.serverTime));
      consecutiveFailures = 0;
      lastRetryAfterMs = null;
    } else {
      consecutiveFailures++;
      schedulePush(getBackoffDelay());
    }

    // Sửa dứt điểm cờ result.ok: chỉ true khi không có lỗi nào
    result.ok = !failed;
    setSyncStatus(failed ? "error" : "synced", failed ? undefined : Date.now());

    if (!failed) {
      broadcastSyncEvent(Date.now(), uid);
      try {
        window.dispatchEvent(new Event(EVENT_CLOUD_SYNCED));
      } catch {}
    }

    return result;
  } finally {
    syncing = false;
    persistMeta();
  }
}

async function syncOnce(): Promise<SyncResult> {
  const empty: SyncResult = { applied: 0, pushed: 0, removed: 0, ok: false };
  if (!active || !tokenFn) return empty;
  return withSyncLock(async () => {
    return doSync();
  }, empty);
}

function schedulePush(delayMs: number = PUSH_DEBOUNCE_MS): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void syncNow();
  }, delayMs);
}

/* ---------------- Vòng đời ---------------- */

export async function startCloudSync(
  uid: string,
  getToken: (forceRefresh?: boolean) => Promise<string | null>
): Promise<{ applied: number }> {
  installInterceptor();
  if (!DATA_API_URL) return { applied: 0 };

  const lastUid = rawGet(CLOUD_UID_KEY);
  if (lastUid && lastUid !== uid) resetLocalSyncedData();
  rawSet(CLOUD_UID_KEY, uid);

  tokenFn = getToken;
  active = true; // Bật dirty tracking ngay từ đầu, không để lọt thao tác khi khởi động!

  const token = await getToken();
  if (!token) {
    setSyncStatus("local");
    return { applied: 0 };
  }

  // Migration pha 1: Nếu còn các phiên legacy trong local store chưa được sync
  const legacySessions = focusSessionStore.list();
  if (legacySessions.length > 0) {
    const qKey = pendingFocusQueueKey(uid);
    const existingQueueRaw = rawGet(qKey);
    let existingQueue: FocusSession[] = [];
    if (existingQueueRaw) {
      try {
        const parsed = JSON.parse(existingQueueRaw);
        if (Array.isArray(parsed)) existingQueue = parsed;
      } catch {}
    }
    const queuedIds = new Set(existingQueue.map((s) => s.id));
    const epoch = getCurrentFocusEpoch(uid);
    const toEnqueue = legacySessions
      .filter((s) => {
        if (queuedIds.has(s.id)) return false;
        if (typeof s.focusEpoch === "number") {
          return s.focusEpoch >= epoch;
        }
        return epoch === 1;
      })
      .map((s) => ({ ...s, focusEpoch: s.focusEpoch ?? epoch }));
    if (toEnqueue.length > 0) {
      rawSet(qKey, JSON.stringify([...existingQueue, ...toEnqueue]));
    }
  }

  const result = await syncNow();
  return { applied: result.applied };
}

export function stopCloudSync(): void {
  active = false;
  tokenFn = null;
  consecutiveFailures = 0;
  lastRetryAfterMs = null;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  persistMeta();
  setSyncStatus("local");
}

export function startGuestTracking(): void {
  installInterceptor();
  tokenFn = null;
  active = true;
  setSyncStatus("local");
}

export function hasUnsyncedChanges(): boolean {
  if (pushTimer) return true;
  try {
    const meta = readMeta();
    for (const key of Object.keys(meta)) {
      const e = meta[key];
      if (e && (e.dirty === true || e.del === true || e.oversize === true)) return true;
    }
    const uid = rawGet(CLOUD_UID_KEY);
    if (uid) {
      const qKey = pendingFocusQueueKey(uid);
      const qRaw = rawGet(qKey);
      if (qRaw) {
        const parsed = JSON.parse(qRaw);
        if (Array.isArray(parsed) && parsed.length > 0) return true;
      }
    }
  } catch {}
  return false;
}

export function resetSyncMemory(): void {
  active = false;
  tokenFn = null;
  metaCache = null;
  consecutiveFailures = 0;
  lastRetryAfterMs = null;
  syncing = false;
  needsResync = false;
  inFlightKeys.clear();
  inFlightPromise = null;
  continuousTypingSince = null;
  firstUnsyncedChangeAt = null;
  lastEditAt = 0;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  syncState = INITIAL_SYNC_STATE;
  emitSyncState();
}

export async function syncNow(): Promise<SyncResult> {
  if (syncing) {
    needsResync = true;
    return inFlightPromise ?? { applied: 0, pushed: 0, removed: 0, ok: false };
  }
  inFlightPromise = (async () => {
    let result = await syncOnce();
    // Vòng lặp while xử lý triệt để race condition: bất kỳ thay đổi nào xảy ra trong các lượt sync đều được tiếp tục
    while (needsResync) {
      needsResync = false;
      result = await syncOnce();
    }
    if (result.ok && pushTimer) {
      clearTimeout(pushTimer);
      pushTimer = null;
    }
    return result;
  })();
  try {
    return await inFlightPromise;
  } finally {
    inFlightPromise = null;
  }
}
