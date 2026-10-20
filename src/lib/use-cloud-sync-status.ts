"use client";

import { useSyncExternalStore } from "react";
import {
  getServerSyncState,
  getSyncState,
  subscribeSyncState,
  type CloudSyncState,
} from "@/lib/cloud-sync";

/**
 * Theo dõi trạng thái đồng bộ để UI hiển thị đúng (đang chờ / đang gửi / đã đồng bộ / lỗi).
 * Dùng `useSyncExternalStore` nên chỉ re-render khi trạng thái thực sự đổi.
 */
export function useCloudSyncStatus(): CloudSyncState {
  return useSyncExternalStore(subscribeSyncState, getSyncState, getServerSyncState);
}
