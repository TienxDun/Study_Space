"use client";

import { STORAGE_KEYS } from "@/lib/storage-keys";

/**
 * Đồng bộ dữ liệu học tập lên Cloudflare D1 (qua Worker `data-api`).
 *
 * Nguyên tắc:
 * - localStorage vẫn là bản chính khi mất mạng; D1 là bản sao trên mạng.
 * - Mở web (đã đăng nhập) -> kéo dữ liệu mạng về trước khi dùng.
 * - Có thay đổi -> đẩy lên sau ~2 giây (gộp nhiều thay đổi một lần).
 * - Xung đột: BẢN MỚI NHẤT THẮNG (theo mốc thời gian), riêng phiên tập trung
 *   thì gộp theo `id` để không mất bài của bên nào.
 *
 * Không đồng bộ các key gắn với riêng từng máy (vị trí/kích thước cửa sổ,
 * trạng thái đang chạy dở, âm lượng, cờ giao diện...).
 */

export const DATA_API_URL = (process.env.NEXT_PUBLIC_DATA_API_URL || "").replace(/\/+$/, "");

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
  STORAGE_KEYS.focusSessions,
];

const SYNC_SET = new Set<string>(SYNCED_KEYS);
// Phiên tập trung chỉ thêm, không sửa -> gộp theo id thay vì "bản mới nhất thắng".
const UNION_KEYS = new Set<string>([STORAGE_KEYS.focusSessions]);
const MAX_FOCUS_SESSIONS = 2000;

const META_KEY = "study_space_cloud_meta_v1";
const UID_KEY = "study_space_cloud_uid_v1";
const BOOT_FLAG_PREFIX = "study_space_cloud_boot_";

const PUSH_DEBOUNCE_MS = 2000;
const META_FLUSH_MS = 1000; // gộp việc ghi bảng theo dõi xuống đĩa
const TOL_MS = 2000; // lệch trong 2 giây coi như bằng nhau (đỡ dập dữ liệu oan)

/** Sự kiện phát ra sau mỗi lần đồng bộ xong (dùng cho UI nếu cần). */
export const EVENT_CLOUD_SYNCED = "study_space_cloud_synced";

export interface CloudMetaEntry {
  local: number;
  synced: number;
  del?: boolean;
}
export type CloudMeta = Record<string, CloudMetaEntry>;

export interface SyncPlan {
  apply: Record<string, string>;
  push: Record<string, string>;
  remove: string[];
  meta: CloudMeta;
}

export function cloudConfigured(): boolean {
  return !!DATA_API_URL;
}

export function bootFlagKey(uid: string): string {
  return BOOT_FLAG_PREFIX + uid;
}

/* ---------------- Truy cập localStorage "thô" (không qua bộ chặn) ---------------- */

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
    // Ghi thẳng qua hàm gốc để không tự kích hoạt bộ chặn (tránh vòng lặp đẩy).
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

/**
 * Khi đăng nhập bằng tài khoản khác trên cùng máy: xóa dữ liệu đồng bộ còn sót
 * của tài khoản trước (nếu không, dữ liệu người A sẽ bị đẩy sang tài khoản B).
 */
function resetLocalSyncedData(): void {
  for (const key of SYNCED_KEYS) rawRemove(key);
  metaCache = {};
  rawRemove(META_KEY);
}

function readMetaStored(): CloudMeta {
  const raw = rawGet(META_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as CloudMeta) : {};
  } catch {
    return {};
  }
}

// Bảng theo dõi giữ trong RAM, chỉ ghi xuống localStorage khi cần — tránh ghi
// đĩa liên tục trong lúc đang gõ (mỗi phím một lần ghi là quá nhiều).
let metaCache: CloudMeta | null = null;
let metaFlushTimer: ReturnType<typeof setTimeout> | null = null;

function readMeta(): CloudMeta {
  if (!metaCache) metaCache = readMetaStored();
  return metaCache;
}

function persistMeta(): void {
  try {
    if (!metaCache) return;
    rawSet(META_KEY, JSON.stringify(metaCache));
  } catch {}
}

/** Hẹn ghi bảng theo dõi xuống đĩa (gộp nhiều lần gõ thành một lần ghi). */
function scheduleMetaFlush(): void {
  if (metaFlushTimer) return;
  metaFlushTimer = setTimeout(() => {
    metaFlushTimer = null;
    persistMeta();
  }, META_FLUSH_MS);
}

/* ---------------- Bộ chặn: biết khi nào dữ liệu đồng bộ bị đổi ---------------- */

let installed = false;
let active = false;
let bootstrapped = false;
let tokenFn: (() => Promise<string | null>) | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false;
let origSetItem: Storage["setItem"] | null = null;
let origRemoveItem: Storage["removeItem"] | null = null;

function noteLocalChange(key: string, removed: boolean): void {
  if (!active || !bootstrapped || !SYNC_SET.has(key)) return;
  const meta = readMeta();
  const prev = meta[key] || { local: 0, synced: 0 };
  meta[key] = { local: Date.now(), synced: prev.synced, del: removed };
  scheduleMetaFlush();
  schedulePush();
}

function installInterceptor(): void {
  if (installed || typeof window === "undefined" || typeof Storage === "undefined") return;
  const proto = Storage.prototype;
  const origSet = proto.setItem;
  const origRemove = proto.removeItem;
  try {
    origSetItem = origSet;
    origRemoveItem = origRemove;
    proto.setItem = function (this: Storage, key: string, value: string) {
      origSet.call(this, key, value);
      if (this === window.localStorage) noteLocalChange(key, false);
    };
    proto.removeItem = function (this: Storage, key: string) {
      origRemove.call(this, key);
      if (this === window.localStorage) noteLocalChange(key, true);
    };
    installed = true;
    // Đóng/ẩn tab: ghi nốt bảng theo dõi để không mất mốc thời gian vừa sửa.
    window.addEventListener("pagehide", persistMeta);
  } catch {
    installed = false;
  }
}

/* ---------------- Gộp phiên tập trung theo id ---------------- */

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

/* ---------------- Tính toán kế hoạch đồng bộ (hàm thuần, dễ test) ---------------- */

export function planSync(opts: {
  keys: readonly string[];
  local: Record<string, string | null>;
  server: Record<string, string | null>;
  serverUpdated: Record<string, number>;
  meta: CloudMeta;
  now: number;
  tol?: number;
  unionKeys?: Set<string>;
}): SyncPlan {
  const tol = opts.tol ?? TOL_MS;
  const unionKeys = opts.unionKeys ?? new Set<string>();
  const apply: Record<string, string> = {};
  const push: Record<string, string> = {};
  const remove: string[] = [];
  const meta: CloudMeta = { ...opts.meta };

  for (const key of opts.keys) {
    const localRaw = opts.local[key] ?? null;
    const serverRaw = opts.server[key] ?? null;
    const s = opts.serverUpdated[key] || 0;
    const prev = meta[key] || { local: 0, synced: 0 };
    const localHas = localRaw !== null;
    const serverHas = serverRaw !== null;

    if (unionKeys.has(key)) {
      if (localHas && serverHas) {
        const merged = mergeSessionArrays(localRaw, serverRaw);
        if (merged !== localRaw) apply[key] = merged;
        if (merged !== serverRaw) push[key] = merged;
        meta[key] = { local: Math.max(prev.local, opts.now), synced: Math.max(prev.synced, s) };
      } else if (localHas) {
        push[key] = localRaw as string;
        meta[key] = { local: prev.local || opts.now, synced: prev.synced };
      } else if (serverHas) {
        apply[key] = serverRaw as string;
        meta[key] = { local: s, synced: s };
      }
      continue;
    }

    if (!localHas && !serverHas) continue;

    if (serverHas && !localHas) {
      const wantsDelete = prev.del === true && prev.local > Math.max(prev.synced, s) + tol;
      if (wantsDelete) {
        remove.push(key);
        meta[key] = { local: prev.local, synced: prev.local, del: false };
      } else {
        apply[key] = serverRaw as string;
        meta[key] = { local: s, synced: s };
      }
      continue;
    }

    if (localHas && !serverHas) {
      push[key] = localRaw as string;
      meta[key] = { local: prev.local || opts.now, synced: prev.synced };
      continue;
    }

    if (s > prev.local + tol) {
      if (serverRaw !== localRaw) apply[key] = serverRaw as string;
      meta[key] = { local: s, synced: s };
    } else if (localRaw !== serverRaw) {
      push[key] = localRaw as string;
      meta[key] = { local: prev.local || opts.now, synced: Math.max(prev.synced, s) };
    } else {
      meta[key] = { local: Math.max(prev.local, s), synced: Math.max(prev.synced, s) };
    }
  }

  return { apply, push, remove, meta };
}

/* ---------------- Gọi API ---------------- */

async function apiFetch(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    return await fetch(DATA_API_URL + path, {
      ...init,
      signal: init.signal ?? ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchServer(token: string): Promise<{
  settings: Record<string, string>;
  updated: Record<string, number>;
}> {
  const res = await apiFetch("/settings", token, { method: "GET" });
  if (!res.ok) throw new Error(`GET /settings ${res.status}`);
  const data = await res.json();
  return {
    settings: (data && data.settings) || {},
    updated: (data && data.updated) || {},
  };
}

/* ---------------- Một lượt đồng bộ: kéo về + đẩy lên ---------------- */

export interface SyncResult {
  applied: number;
  pushed: number;
  removed: number;
}

async function syncOnce(): Promise<SyncResult> {
  const result: SyncResult = { applied: 0, pushed: 0, removed: 0 };
  if (!active || !tokenFn || syncing) return result;
  syncing = true;
  try {
    const token = await tokenFn();
    if (!token) return result;

    let server;
    try {
      server = await fetchServer(token);
    } catch {
      return result; // mất mạng -> để lần sau
    }

    const local: Record<string, string | null> = {};
    for (const key of SYNCED_KEYS) local[key] = rawGet(key);
    const serverMap: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(server.settings)) serverMap[k] = v;

    const plan = planSync({
      keys: SYNCED_KEYS,
      local,
      server: serverMap,
      serverUpdated: server.updated,
      meta: readMeta(),
      now: Date.now(),
      unionKeys: UNION_KEYS,
    });

    for (const [k, v] of Object.entries(plan.apply)) {
      rawSet(k, v);
      result.applied += 1;
    }
    metaCache = plan.meta;

    let at = Date.now();
    const pushKeys = Object.keys(plan.push);
    if (pushKeys.length) {
      const body: Record<string, string> = {};
      for (const k of pushKeys) body[k] = plan.push[k];
      const res = await apiFetch("/settings", token, { method: "PUT", body: JSON.stringify({ settings: body }) });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && typeof data.at === "number") at = data.at;
        const next = readMeta();
        for (const k of pushKeys) next[k] = { local: at, synced: at, del: false };
        result.pushed = pushKeys.length;
      }
    }
    if (plan.remove.length) {
      const res = await apiFetch("/settings", token, { method: "DELETE", body: JSON.stringify({ keys: plan.remove }) });
      if (res.ok) {
        const next = readMeta();
        for (const k of plan.remove) next[k] = { local: at, synced: at, del: false };
        result.removed = plan.remove.length;
      }
    }

    try {
      window.dispatchEvent(new Event(EVENT_CLOUD_SYNCED));
    } catch {}
    return result;
  } finally {
    syncing = false;
    persistMeta();
  }
}

function schedulePush(): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void syncOnce();
  }, PUSH_DEBOUNCE_MS);
}

/* ---------------- Vòng đời ---------------- */

/** Kéo dữ liệu về lần đầu rồi bật đồng bộ. Trả về số key đã đổi từ mạng. */
export async function startCloudSync(
  uid: string,
  getToken: () => Promise<string | null>
): Promise<{ applied: number }> {
  installInterceptor();
  if (!DATA_API_URL) return { applied: 0 };
  const lastUid = rawGet(UID_KEY);
  if (lastUid && lastUid !== uid) resetLocalSyncedData();
  rawSet(UID_KEY, uid);
  tokenFn = getToken;
  active = false; // chưa ghi meta trong lúc kéo về
  bootstrapped = false;
  const token = await getToken();
  if (!token) return { applied: 0 };
  active = true;
  const result = await syncOnce();
  bootstrapped = true;
  return { applied: result.applied };
}

export function stopCloudSync(): void {
  active = false;
  bootstrapped = false;
  tokenFn = null;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  if (metaFlushTimer) {
    clearTimeout(metaFlushTimer);
    metaFlushTimer = null;
  }
  persistMeta();
}

/** Đồng bộ ngay (dùng khi tab quay lại / có mạng lại). */
export async function syncNow(): Promise<SyncResult> {
  return syncOnce();
}
