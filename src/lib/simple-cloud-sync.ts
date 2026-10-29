/**
 * ZenStudy — Simple Cloud Sync Module (Snapshot Save Game)
 * Đồng bộ toàn bộ dữ liệu người dùng lên Cloudflare D1 theo mô hình Snapshot Document.
 * Tinh giản, nhẹ nhàng, không CAS, không Tombstone.
 */

import { useSyncExternalStore } from "react";
import { STORAGE_KEYS } from "./storage-keys";
import { focusSessionStore } from "./focus-sessions";

export type SyncState =
  | "idle"
  | "synced"
  | "syncing"
  | "offline"
  | "error"
  | "pending"
  | "local";

export interface SyncStatusInfo {
  state: SyncState;
  lastSyncedAt: number;
  hasPendingChanges: boolean;
  errorMessage?: string;
}

export const EVENT_SYNC_STATUS_CHANGED = "study_space_sync_status_changed";
export const EVENT_CLOUD_SYNCED = "study_space_cloud_synced";

// Danh sách các key cài đặt cần đóng gói
const SETTINGS_KEYS = [
  STORAGE_KEYS.sceneId,
  STORAGE_KEYS.globalMute,
  STORAGE_KEYS.pomoVisible,
  STORAGE_KEYS.clockSeconds,
  STORAGE_KEYS.clock12Hour,
  STORAGE_KEYS.stopwatchMs,
  STORAGE_KEYS.pomoDurations,
  STORAGE_KEYS.soundEnabled,
  STORAGE_KEYS.pomoSoundType,
  STORAGE_KEYS.pomoCount,
  STORAGE_KEYS.mood,
  STORAGE_KEYS.trackId,
  STORAGE_KEYS.volume,
  STORAGE_KEYS.shuffle,
  STORAGE_KEYS.loop,
  STORAGE_KEYS.ambientVols,
  STORAGE_KEYS.customEmbeds,
  STORAGE_KEYS.activeEmbed,
  STORAGE_KEYS.embedViewMode,
  STORAGE_KEYS.favoriteScenes,
  STORAGE_KEYS.slideshowEnabled,
  STORAGE_KEYS.slideshowIntervalMin,
  STORAGE_KEYS.activeFocusTask,
  STORAGE_KEYS.activeBoard,
] as const;

let apiBaseUrl =
  process.env.NEXT_PUBLIC_DATA_API_URL ||
  "https://data-api.leutiendung-hht.workers.dev";

export function setDataApiUrl(url: string) {
  apiBaseUrl = url.replace(/\/+$/, "");
}

export function cloudConfigured(): boolean {
  return Boolean(apiBaseUrl);
}


let activeUid: string | null = null;
let tokenProvider: (() => Promise<string | null>) | null = null;
let currentState: SyncState = "idle";
let lastSyncedTime = 0;
let pendingChanges = false;
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let lastErrorMessage = "";

let isNotifyScheduled = false;

function notifyStatusChange() {
  if (typeof window === "undefined") return;
  if (isNotifyScheduled) return;
  isNotifyScheduled = true;

  const dispatch = () => {
    isNotifyScheduled = false;
    try {
      window.dispatchEvent(
        new CustomEvent(EVENT_SYNC_STATUS_CHANGED, {
          detail: getSyncStatus(),
        })
      );
    } catch {}
  };

  if (typeof queueMicrotask === "function") {
    queueMicrotask(dispatch);
  } else {
    setTimeout(dispatch, 0);
  }
}

let cachedStatus: SyncStatusInfo = {
  state: "idle",
  lastSyncedAt: 0,
  hasPendingChanges: false,
};

export function getSyncStatus(): SyncStatusInfo {
  if (
    cachedStatus.state === currentState &&
    cachedStatus.lastSyncedAt === lastSyncedTime &&
    cachedStatus.hasPendingChanges === pendingChanges &&
    cachedStatus.errorMessage === (lastErrorMessage || undefined)
  ) {
    return cachedStatus;
  }
  cachedStatus = {
    state: currentState,
    lastSyncedAt: lastSyncedTime,
    hasPendingChanges: pendingChanges,
    errorMessage: lastErrorMessage || undefined,
  };
  return cachedStatus;
}

// ---------- Đóng gói dữ liệu từ máy ----------
export function packLocalData() {
  const settings: Record<string, string> = {};
  for (const k of SETTINGS_KEYS) {
    try {
      const v = localStorage.getItem(k);
      if (v !== null) settings[k] = v;
    } catch {}
  }

  let notes: unknown[] = [];
  try {
    const rawNotes = localStorage.getItem(STORAGE_KEYS.multiNotes);
    if (rawNotes) notes = JSON.parse(rawNotes);
  } catch {}

  let tasks: unknown[] = [];
  try {
    const rawTasks = localStorage.getItem(STORAGE_KEYS.kanbanBoards);
    if (rawTasks) tasks = JSON.parse(rawTasks);
  } catch {}

  const focusSessions = focusSessionStore.list();

  return {
    version: 1,
    updatedAt: Date.now(),
    settings,
    notes,
    tasks,
    focusSessions,
  };
}

// ---------- Nạp dữ liệu từ mây về máy ----------
export function unpackToLocal(payload: any) {
  if (!payload || typeof payload !== "object") return;

  // 1. Nạp cài đặt
  if (payload.settings && typeof payload.settings === "object") {
    for (const [k, v] of Object.entries(payload.settings)) {
      if (typeof v === "string") {
        try {
          localStorage.setItem(k, v);
        } catch {}
      }
    }
  }

  // 2. Nạp ghi chú
  if (Array.isArray(payload.notes)) {
    try {
      localStorage.setItem(
        STORAGE_KEYS.multiNotes,
        JSON.stringify(payload.notes)
      );
    } catch {}
  }

  // 3. Nạp việc cần làm (tasks/kanban)
  if (Array.isArray(payload.tasks)) {
    try {
      localStorage.setItem(
        STORAGE_KEYS.kanbanBoards,
        JSON.stringify(payload.tasks)
      );
    } catch {}
  }

  // 4. Nạp phiên tập trung
  if (Array.isArray(payload.focusSessions)) {
    try {
      localStorage.setItem(
        STORAGE_KEYS.focusSessions,
        JSON.stringify(payload.focusSessions)
      );
    } catch {}
  }

  // Phát tín hiệu để các component cập nhật lại giao diện ngay
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new Event(EVENT_CLOUD_SYNCED));
      window.dispatchEvent(new Event("storage"));
    } catch {}
  }
}

// ---------- Gọi API ----------
async function apiCall(path: string, options: RequestInit = {}) {
  if (!tokenProvider) throw new Error("Chưa có hàm cung cấp token.");
  const token = await tokenProvider();
  if (!token) throw new Error("Không thể lấy token xác thực.");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  const res = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
  });

  return res;
}

// ---------- Kéo dữ liệu về (Pull) ----------
export async function pullData(): Promise<boolean> {
  if (!activeUid || !tokenProvider) return false;

  currentState = "syncing";
  notifyStatusChange();

  try {
    const res = await apiCall("/data", { method: "GET" });
    if (!res.ok) {
      throw new Error(`Máy chủ trả về mã lỗi: ${res.status}`);
    }

    const resJson = await res.json();
    if (resJson && resJson.ok && resJson.data) {
      unpackToLocal(resJson.data);
      lastSyncedTime = resJson.updatedAt || Date.now();
    } else {
      // Tài khoản mới chưa có dữ liệu trên mây: đẩy dữ liệu hiện tại lên
      await pushData();
      return true;
    }

    currentState = "synced";
    pendingChanges = false;
    lastErrorMessage = "";
    notifyStatusChange();
    return true;
  } catch (err: any) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      currentState = "offline";
    } else {
      currentState = "error";
      lastErrorMessage = err?.message || "Lỗi khi tải dữ liệu.";
    }
    notifyStatusChange();
    return false;
  }
}

// ---------- Đẩy dữ liệu lên (Push) ----------
export async function pushData(): Promise<boolean> {
  if (!activeUid || !tokenProvider) return false;

  // Kiểm tra rớt mạng
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    currentState = "offline";
    pendingChanges = true;
    notifyStatusChange();
    return false;
  }

  currentState = "syncing";
  notifyStatusChange();

  try {
    const packet = packLocalData();
    const res = await apiCall("/data", {
      method: "POST",
      body: JSON.stringify({ data: packet }),
    });

    if (!res.ok) {
      throw new Error(`Máy chủ trả về mã lỗi: ${res.status}`);
    }

    const resJson = await res.json();
    lastSyncedTime = resJson?.updatedAt || Date.now();
    currentState = "synced";
    pendingChanges = false;
    lastErrorMessage = "";
    notifyStatusChange();
    return true;
  } catch (err: any) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      currentState = "offline";
      pendingChanges = true;
    } else {
      currentState = "error";
      lastErrorMessage = err?.message || "Lỗi khi lưu dữ liệu.";
    }
    notifyStatusChange();
    return false;
  }
}

// ---------- Xoá toàn bộ dữ liệu tài khoản trên mây ----------
// Worker xoá D1 rồi xoá tài khoản Firebase bằng service account.
export async function deleteCloudAccount(token: string): Promise<void> {
  if (!token) throw new Error("Không thể lấy token xác thực.");

  const res = await fetch(`${apiBaseUrl}/account`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = String(body?.error || body?.code || "");
    } catch {
      /* body rỗng hoặc không phải JSON */
    }
    const err = new Error(detail || `Máy chủ trả về mã lỗi: ${res.status}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
}

// ---------- Tự động lưu sau 2 giây (Debounce) ----------
export function scheduleAutoSave() {
  if (!activeUid || !tokenProvider) return;
  currentState = "pending";

  pendingChanges = true;
  notifyStatusChange();

  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }

  autoSaveTimer = setTimeout(() => {
    void pushData();
  }, 2000);
}

// ---------- Nút "Đồng bộ ngay" (Sync Now) ----------
export async function syncNow(): Promise<boolean> {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
  return await pushData();
}

// ---------- Khởi động & Quản lý vòng đời ----------
function handleOnline() {
  if (pendingChanges || currentState === "offline") {
    void pushData();
  }
}

function handleOffline() {
  currentState = "offline";
  notifyStatusChange();
}

const WATCHED_KEYS: Set<string> = new Set([
  ...SETTINGS_KEYS,
  STORAGE_KEYS.multiNotes,
  STORAGE_KEYS.oldNotes,
  STORAGE_KEYS.kanbanBoards,
  STORAGE_KEYS.activeBoard,
  STORAGE_KEYS.focusSessions,
]);

let isStoragePatched = false;
function ensureStoragePatched() {
  if (isStoragePatched || typeof window === "undefined" || !window.localStorage) return;
  isStoragePatched = true;

  const originalSet = window.localStorage.setItem.bind(window.localStorage);
  const originalRemove = window.localStorage.removeItem.bind(window.localStorage);

  window.localStorage.setItem = function (key: string, value: string) {
    originalSet(key, value);
    if (WATCHED_KEYS.has(key)) {
      scheduleAutoSave();
    }
  };

  window.localStorage.removeItem = function (key: string) {
    originalRemove(key);
    if (WATCHED_KEYS.has(key)) {
      scheduleAutoSave();
    }
  };
}

export async function startCloudSync(
  uid: string,
  getToken: () => Promise<string | null>
) {
  activeUid = uid;
  tokenProvider = getToken;
  currentState = "syncing";
  notifyStatusChange();

  ensureStoragePatched();

  if (typeof window !== "undefined") {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
  }

  return await pullData();
}

export function stopCloudSync() {
  activeUid = null;
  tokenProvider = null;
  currentState = "idle";
  pendingChanges = false;
  lastErrorMessage = "";

  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }

  if (typeof window !== "undefined") {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  }

  notifyStatusChange();
}

// ---------- Dọn sạch máy khi Đăng xuất ----------
export function clearLocalUserData() {
  stopCloudSync();

  // Xóa các cài đặt và dữ liệu cá nhân
  for (const k of SETTINGS_KEYS) {
    try {
      localStorage.removeItem(k);
    } catch {}
  }
  try {
    localStorage.removeItem(STORAGE_KEYS.multiNotes);
    localStorage.removeItem(STORAGE_KEYS.oldNotes);
    localStorage.removeItem(STORAGE_KEYS.kanbanBoards);
    localStorage.removeItem(STORAGE_KEYS.activeBoard);
    localStorage.removeItem(STORAGE_KEYS.focusSessions);
  } catch {}

  focusSessionStore.clear();

  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new Event("storage"));
    } catch {}
  }
}

// ---------- Hook React Theo Dõi Trạng Thái ----------
function subscribeSyncStatus(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT_SYNC_STATUS_CHANGED, onStoreChange);
  return () => {
    window.removeEventListener(EVENT_SYNC_STATUS_CHANGED, onStoreChange);
  };
}

export function useSyncStatus(): SyncStatusInfo {
  return useSyncExternalStore(
    subscribeSyncStatus,
    getSyncStatus,
    getSyncStatus
  );
}
