"use client";

import { useEffect, useRef } from "react";
import {
  bootFlagKey,
  cloudConfigured,
  startCloudSync,
  startGuestTracking,
  syncNow,
} from "@/lib/cloud-sync";
import { onRemoteWipe } from "@/lib/local-data";

/**
 * Gắn vòng đời đồng bộ D1 vào phiên đăng nhập.
 * - Đăng nhập: kéo dữ liệu mạng về; nếu có thay đổi thì tải lại trang 1 lần
 *   để giao diện đọc đúng dữ liệu vừa kéo.
 * - Đăng xuất: xóa dữ liệu khỏi máy (xem use-auth).
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
  loading: boolean,
  getToken: () => Promise<string | null>
): void {
  const tokenRef = useRef(getToken);

  useEffect(() => {
    tokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    if (!cloudConfigured()) return;
    if (loading) return; // chờ biết chắc đã/chưa đăng nhập
    if (!uid) {
      // Chưa đăng nhập: vẫn ghi mốc sửa để lúc đăng nhập so sánh đúng.
      startGuestTracking();
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
  }, [uid, loading]);

  useEffect(() => {
    // Tab khác vừa xóa dữ liệu (đăng xuất) -> làm mới để không còn hiển thị dữ liệu cũ.
    return onRemoteWipe(() => {
      if (typeof window !== "undefined") window.location.reload();
    });
  }, []);

  useEffect(() => {
    if (loading || !uid || !cloudConfigured()) return;
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
  }, [uid, loading]);
}
