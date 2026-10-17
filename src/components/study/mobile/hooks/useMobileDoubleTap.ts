"use client";

import { useEffect, useRef } from "react";

interface UseMobileDoubleTapOptions {
  /** Có kích hoạt phát hiện double tap hay không (ví dụ: tắt khi đang mở sheet/modal) */
  enabled?: boolean;
  /** Callback được gọi khi double tap thành công */
  onDoubleTap: () => void;
  /** Thời gian tối đa giữa 2 lần tap (ms), mặc định 320ms */
  maxDelay?: number;
  /** Khoảng cách tối đa giữa 2 vị trí chạm (px), mặc định 32px */
  maxDistance?: number;
}

/**
 * Hook lắng nghe cử chỉ chạm đúp (Double Tap) trên giao diện thiết bị di động.
 * Tối ưu chống nhận diện nhầm:
 * - Bỏ qua khi chạm vào nút bấm (button), ô nhập (input, textarea), liên kết (a), slider, modal...
 * - Bỏ qua cử chỉ vuốt dài, cuộn trang (scroll), hoặc chạm giữ (long press).
 * - Kiểm tra dung sai khoảng cách và khoảng thời gian giữa 2 lần tap liên tiếp.
 */
export function useMobileDoubleTap({
  enabled = true,
  onDoubleTap,
  maxDelay = 320,
  maxDistance = 32,
}: UseMobileDoubleTapOptions) {
  const onDoubleTapRef = useRef(onDoubleTap);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    onDoubleTapRef.current = onDoubleTap;
    enabledRef.current = enabled;
  }, [onDoubleTap, enabled]);

  const touchStartTimeRef = useRef(0);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const isIgnoredRef = useRef(false);

  const lastTapTimeRef = useRef(0);
  const lastTapPosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (!enabledRef.current) return;

      // Chỉ chấp nhận cử chỉ 1 ngón tay
      if (e.touches.length !== 1) {
        isIgnoredRef.current = true;
        return;
      }

      const target = e.target as HTMLElement | null;
      // Bỏ qua nếu chạm vào các thành phần tương tác hoặc form controls
      if (
        target?.closest(
          "button, input, textarea, select, a, [role='button'], [role='slider'], [role='dialog'], [data-prevent-double-tap], audio, video, iframe"
        )
      ) {
        isIgnoredRef.current = true;
        return;
      }

      isIgnoredRef.current = false;
      const touch = e.touches[0];
      touchStartTimeRef.current = Date.now();
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!enabledRef.current || isIgnoredRef.current) {
        isIgnoredRef.current = false;
        return;
      }

      // Chỉ xử lý khi nhấc đúng 1 ngón tay
      if (e.changedTouches.length !== 1) return;

      const touch = e.changedTouches[0];
      const now = Date.now();
      const touchDuration = now - touchStartTimeRef.current;
      const moveDist = Math.hypot(
        touch.clientX - touchStartPosRef.current.x,
        touch.clientY - touchStartPosRef.current.y
      );

      // Nếu chạm quá lâu (> 250ms) hoặc di chuyển ngón tay quá nhiều (> 15px) -> là vuốt/cuộn/giữ -> bỏ qua
      if (touchDuration > 250 || moveDist > 15) {
        lastTapTimeRef.current = 0;
        return;
      }

      const timeSinceLastTap = now - lastTapTimeRef.current;
      const distFromLastTap = Math.hypot(
        touch.clientX - lastTapPosRef.current.x,
        touch.clientY - lastTapPosRef.current.y
      );

      // Kiểm tra khoảng thời gian và khoảng cách giữa 2 lần tap liên tiếp
      if (
        timeSinceLastTap > 30 &&
        timeSinceLastTap <= maxDelay &&
        distFromLastTap <= maxDistance
      ) {
        // Double tap hợp lệ!
        lastTapTimeRef.current = 0;
        onDoubleTapRef.current();
      } else {
        // Ghi nhận lần tap đầu tiên
        lastTapTimeRef.current = now;
        lastTapPosRef.current = { x: touch.clientX, y: touch.clientY };
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [maxDelay, maxDistance]);
}
