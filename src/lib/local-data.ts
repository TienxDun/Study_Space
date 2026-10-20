"use client";

import { STORAGE_KEYS } from "@/lib/storage-keys";
import { CLOUD_BOOT_PREFIX, CLOUD_META_KEY, CLOUD_UID_KEY, resetSyncMemory } from "@/lib/cloud-sync";
import { CHAT_MEDIA_DB_NAME } from "@/components/study/chat/utils/imageStorage";

// Cache chat cũng là dữ liệu riêng của người dùng, phải xóa cùng.
const EXTRA_PREFIXES = ["chat-msgs:", "chat-remember:"];

const DYNAMIC_PREFIXES = [
  CLOUD_BOOT_PREFIX,
  `${STORAGE_KEYS.lastSyncedAt}_`,
  `${STORAGE_KEYS.focusEpoch}_`,
  `${STORAGE_KEYS.pendingFocusQueue}_`,
  "study_space_last_prune_check_",
  "study_space_backup_",
  ...EXTRA_PREFIXES,
];

const OWN_KEYS = new Set<string>([
  ...Object.values(STORAGE_KEYS),
  CLOUD_META_KEY,
  CLOUD_UID_KEY,
]);

export function shouldWipeKey(key: string): boolean {
  if (OWN_KEYS.has(key)) return true;
  return DYNAMIC_PREFIXES.some((p) => key.startsWith(p));
}

function listWipeKeys(): string[] {
  const out: string[] = [];
  try {
    const ls = window.localStorage;
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k && shouldWipeKey(k)) out.push(k);
    }
  } catch {}
  return out;
}

/** Trên máy còn dữ liệu nào của app không? */
export function hasStoredUserData(): boolean {
  return listWipeKeys().length > 0;
}

const CHANNEL = "study_space_data_v1";

/** Báo các tab khác biết dữ liệu đã bị xóa để chúng cũng làm mới. */
export function broadcastWipe(): void {
  try {
    const ch = new BroadcastChannel(CHANNEL);
    ch.postMessage("wipe");
    ch.close();
  } catch {}
}

export function onRemoteWipe(cb: () => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  try {
    const ch = new BroadcastChannel(CHANNEL);
    ch.onmessage = () => cb();
    return () => ch.close();
  } catch {
    return () => {};
  }
}

function deleteDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(name);
      const done = () => resolve();
      req.onsuccess = done;
      req.onerror = done;
      req.onblocked = done;
    } catch {
      resolve();
    }
  });
}

async function wipeIndexedDb(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const factory = indexedDB as IDBFactory & {
    databases?: () => Promise<Array<{ name?: string }>>;
  };
  let names: string[] = [];
  try {
    if (typeof factory.databases === "function") {
      const list = await factory.databases();
      names = list
        .map((d) => d.name || "")
        .filter(
          (n) =>
            n === CHAT_MEDIA_DB_NAME ||
            n === "firebaseLocalStorageDb" ||
            n.startsWith("firestore/")
        );
    }
  } catch {}
  await Promise.all([...new Set(names)].map(deleteDb));
}

/**
 * Xóa sạch dữ liệu người dùng khỏi máy này: ghi chú/task/cài đặt (localStorage),
 * phiên tạm (sessionStorage), ảnh chat (IndexedDB) và cache Firestore.
 */
export async function wipeLocalUserData(): Promise<void> {
  resetSyncMemory();
  try {
    const ls = window.localStorage;
    for (const key of listWipeKeys()) ls.removeItem(key);
    window.sessionStorage.clear();
  } catch {}
  // Nạp động để không kéo SDK Firebase (~670KB) vào bundle chính.
  try {
    const { terminateFirebaseDb } = await import("@/lib/firebase");
    await terminateFirebaseDb();
  } catch {}
  await wipeIndexedDb();
}
