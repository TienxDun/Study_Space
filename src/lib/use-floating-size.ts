"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveStorageJSON } from "@/lib/safe-storage";

export interface FloatingSize {
  width: number;
  height: number;
}

interface UseFloatingSizeOptions {
  minWidth: number;
  minHeight: number;
  defaultWidth: number;
  defaultHeight: number;
  storageKey: string;
  /** Mép chừa khi kéo to (mặc định 16px cho khỏi lòi khỏi màn hình). */
  edgeMargin?: number;
}

interface ResizePointer {
  clientX: number;
  clientY: number;
  preventDefault(): void;
  stopPropagation(): void;
}

/**
 * Cỡ khung nổi dùng chung (Notes / Rooms): nhớ cỡ, kẹp trong màn hình,
 * kéo góc gom theo khung hình, thả mới lưu. Vị trí (pos) mỗi chỗ tự lo
 * vì neo khác nhau — truyền anchor + onCommit vào lúc bắt đầu kéo.
 */
export function useFloatingSize({
  minWidth,
  minHeight,
  defaultWidth,
  defaultHeight,
  storageKey,
  edgeMargin = 16,
}: UseFloatingSizeOptions) {
  const clampWindow = useCallback(
    (w: number, h: number): FloatingSize => {
      if (typeof window === "undefined") {
        return { width: Math.round(w), height: Math.round(h) };
      }
      return {
        width: Math.round(
          Math.max(minWidth, Math.min(Math.max(minWidth, window.innerWidth - 32), w))
        ),
        height: Math.round(
          Math.max(minHeight, Math.min(Math.max(minHeight, window.innerHeight - 120), h))
        ),
      };
    },
    [minWidth, minHeight]
  );

  const [size, setSize] = useState<FloatingSize>(() => {
    if (typeof window === "undefined") {
      return { width: defaultWidth, height: defaultHeight };
    }
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.width && parsed?.height) {
          // Tính trực tiếp ở đây để lần vẽ đầu đã đúng cỡ (khỏi giật)
          const w = Math.round(parsed.width);
          const h = Math.round(parsed.height);
          return {
            width: Math.max(
              minWidth,
              Math.min(Math.max(minWidth, window.innerWidth - 32), w)
            ),
            height: Math.max(
              minHeight,
              Math.min(Math.max(minHeight, window.innerHeight - 120), h)
            ),
          };
        }
      }
    } catch {}
    return { width: defaultWidth, height: defaultHeight };
  });

  const sizeRef = useRef(size);
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  // Màn hình đổi cỡ (xoay điện thoại...): co khung vào trong
  useEffect(() => {
    const onResize = () => setSize((prev) => clampWindow(prev.width, prev.height));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampWindow]);

  const beginResize = useCallback(
    (
      e: ResizePointer,
      anchor: { x: number; y: number },
      onCommit?: (size: FloatingSize) => void
    ) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = sizeRef.current.width;
      const startH = sizeRef.current.height;
      let latest: FloatingSize = { width: startW, height: startH };
      let rafId: number | null = null;

      const apply = () => {
        rafId = null;
        setSize(latest);
      };

      const onMove = (ev: PointerEvent) => {
        const maxW =
          typeof window !== "undefined"
            ? Math.max(minWidth, window.innerWidth - anchor.x - edgeMargin)
            : startW;
        const maxH =
          typeof window !== "undefined"
            ? Math.max(minHeight, window.innerHeight - anchor.y - edgeMargin)
            : startH;
        latest = {
          width: Math.round(Math.max(minWidth, Math.min(maxW, startW + (ev.clientX - startX)))),
          height: Math.round(Math.max(minHeight, Math.min(maxH, startH + (ev.clientY - startY)))),
        };
        if (!rafId) rafId = requestAnimationFrame(apply);
      };

      const onUp = () => {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        setSize(latest);
        saveStorageJSON(storageKey, latest);
        onCommit?.(latest);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      // Kéo dở bị hệ giành (cuộc gọi đến, cử chỉ hệ thống): chốt + dọn như thả tay
      window.addEventListener("pointercancel", onUp);
    },
    [minWidth, minHeight, edgeMargin, storageKey]
  );

  return { size, setSize, beginResize };
}
