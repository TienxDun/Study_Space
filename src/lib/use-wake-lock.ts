"use client";

import { useEffect, useRef, useState } from "react";

interface WakeLockSentinelLike {
  readonly released: boolean;
  release(): Promise<void>;
  addEventListener(type: "release", listener: () => void): void;
  removeEventListener(type: "release", listener: () => void): void;
}

const getWakeLock = ():
  | { request(type: "screen"): Promise<WakeLockSentinelLike> }
  | null => {
  if (typeof navigator === "undefined") return null;
  const withLock = navigator as Navigator & {
    wakeLock?: { request(type: "screen"): Promise<WakeLockSentinelLike> };
  };
  return withLock.wakeLock ?? null;
};

/** Máy này có hỗ trợ giữ màn hình sáng không (máy cũ/iOS cũ thì không). */
export const isWakeLockSupported = (): boolean => getWakeLock() !== null;

/**
 * Giữ màn hình sáng khi `wantLock=true` (đang chạy giờ / phát nhạc / phát đài).
 * - Ẩn tab thì hệ tự nhả khóa, hiện lại tự xin lại.
 * - Máy từ chối (tiết kiệm pin, không hỗ trợ) thì im lặng bỏ qua.
 */
export const useWakeLock = (wantLock: boolean) => {
  const [supported] = useState(isWakeLockSupported);
  const [locked, setLocked] = useState(false);
  const wantRef = useRef(wantLock);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const releasingOursRef = useRef(false);

  useEffect(() => {
    wantRef.current = wantLock;
  }, [wantLock]);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;

    const acquire = async () => {
      if (!wantRef.current || document.hidden) return;
      if (sentinelRef.current && !sentinelRef.current.released) return;
      try {
        const wl = getWakeLock();
        if (!wl) return;
        const sentinel = await wl.request("screen");
        if (cancelled) {
          try {
            await sentinel.release();
          } catch {}
          return;
        }
        sentinelRef.current = sentinel;
        setLocked(true);
        const onRelease = () => {
          if (sentinelRef.current === sentinel) sentinelRef.current = null;
          setLocked(false);
          // Hệ tự nhả (ẩn tab, tiết kiệm pin): còn cần thì xin lại
          if (!releasingOursRef.current && wantRef.current && !document.hidden) {
            acquire();
          }
          releasingOursRef.current = false;
        };
        sentinel.addEventListener("release", onRelease);
      } catch {
        // Máy từ chối: thử lại ở lần hiện tab sau, không báo ồn
      }
    };

    const release = async () => {
      const s = sentinelRef.current;
      sentinelRef.current = null;
      if (s && !s.released) {
        releasingOursRef.current = true;
        try {
          await s.release();
        } catch {}
      }
      setLocked(false);
    };

    if (wantLock) acquire();
    else release();

    const onVisibility = () => {
      if (document.visibilityState === "visible" && wantRef.current) acquire();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [wantLock, supported]);

  // Rời trang thì nhả khóa cho sạch
  useEffect(
    () => () => {
      const s = sentinelRef.current;
      sentinelRef.current = null;
      if (s && !s.released) {
        try {
          const p = s.release();
          if (p && typeof p.catch === "function") p.catch(() => {});
        } catch {}
      }
    },
    []
  );

  return { supported, locked };
};
