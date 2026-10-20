"use client";

import { useEffect, useRef } from "react";
import {
  cloudConfigured,
  startCloudSync,
  stopCloudSync,
  pullData,
} from "@/lib/simple-cloud-sync";

/**
 * Gắn vòng đời đồng bộ Snapshot Cloud Save vào phiên đăng nhập.
 * - Đăng nhập: Kéo dữ liệu từ Cloudflare D1 về nạp vào máy.
 * - Đăng xuất: Dừng đồng bộ.
 * - Tab quay lại: Kéo dữ liệu mới nhất (nếu có cập nhật từ máy khác).
 */
export function useCloudSync(
  uid: string | null | undefined,
  loading: boolean,
  getToken: () => Promise<string | null>
): void {
  const tokenRef = useRef(getToken);

  useEffect(() => {
    tokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    if (!cloudConfigured() || loading) return;

    if (!uid) {
      stopCloudSync();
      return;
    }

    void startCloudSync(uid, () => tokenRef.current());

    return () => {
      stopCloudSync();
    };
  }, [uid, loading]);

  // Khi người dùng chuyển tab và quay lại, tải dữ liệu mới nhất
  useEffect(() => {
    if (loading || !uid || !cloudConfigured()) return;

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void pullData();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [uid, loading]);
}
