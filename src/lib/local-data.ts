"use client";

import { STORAGE_KEYS } from "@/lib/storage-keys";

// Các tiền tố và key đồng bộ từ hệ thống cũ để dọn sạch máy khi đăng xuất
export const CLOUD_BOOT_PREFIX = "study_space_cloud_boot_";
export const CLOUD_META_KEY = "study_space_cloud_meta_v1";
export const CLOUD_UID_KEY = "study_space_cloud_uid";

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
