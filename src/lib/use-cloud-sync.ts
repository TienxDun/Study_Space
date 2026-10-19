"use client";

import { useEffect, useRef } from "react";
import {
  bootFlagKey,
  cloudConfigured,
  startCloudSync,
  stopCloudSync,
  syncNow,
} from "@/lib/cloud-sync";

/**
 * Gắn vòng đời đồng bộ D1 vào phiên đăng nhập.
 * - Đăng nhập: kéo dữ liệu mạng về; nếu có thay đổi thì tải lại trang 1 lần
 *   để giao diện đọc đúng dữ liệu vừa kéo.
 * - Đăng xuất: ngừng đồng bộ (chỉ còn localStorage).
 * - Tab quay lại / có mạng lại: đồng bộ ngay.
 */
const MIN_PULL_GAP_MS = 20000; // đổi tab liên tục cũng không hỏi máy chủ quá dày

function isEditing(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
}

export function useCloudSync(
  uid: string | null | undefined,
  getToken: () => Promise<string | null>
): void {
  const tokenRef = useRef(getToken);

  useEffect(() => {
    tokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    if (!cloudConfigured()) return;
    if (!uid) {
      stopCloudSync();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { applied } = await startCloudSync(uid, () => tokenRef.current());
        if (cancelled || applied <= 0) return;
        let alreadyBooted = false;
        try {
          alreadyBooted = sessionStorage.getItem(bootFlagKey(uid)) === "1";
        } catch {}
        if (alreadyBooted) return;
        try {
          sessionStorage.setItem(bootFlagKey(uid), "1");
        } catch {}
        window.location.reload();
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    if (!uid || !cloudConfigured()) return;
    let last = Date.now();
    const pull = async () => {
      last = Date.now();
      const { applied } = await syncNow();
      if (applied > 0 && !isEditing()) window.location.reload();
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - last < MIN_PULL_GAP_MS) return;
      void pull();
    };
    const onOnline = () => void pull();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [uid]);
}
