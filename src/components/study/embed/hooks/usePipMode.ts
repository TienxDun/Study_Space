"use client";

import { useState, useEffect, useCallback } from "react";
import { useDragControls, useMotionValue } from "framer-motion";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { clamp } from "@/lib/utils";

const STORAGE_PIP_POS_KEY = STORAGE_KEYS.embedPipPos;
const STORAGE_PIP_SIZE_KEY = STORAGE_KEYS.embedPipSize;

const MIN_PIP_W = 260;
const MIN_PIP_H = 200;
const DEFAULT_PIP_W = 420;
const DEFAULT_PIP_H = 280;

const clampSize = (w: number, h: number) => {
  if (typeof window === "undefined") return { width: w, height: h };
  const maxW = Math.max(MIN_PIP_W, window.innerWidth - 32);
  const maxH = Math.max(MIN_PIP_H, window.innerHeight - 32);
  return {
    width: Math.round(clamp(w, MIN_PIP_W, maxW)),
    height: Math.round(clamp(h, MIN_PIP_H, maxH)),
  };
};

interface UsePipModeOptions {
  isOpen: boolean;
  onPipModeChange?: (isPip: boolean) => void;
  onOpen?: () => void;
}

export function usePipMode({ isOpen, onPipModeChange, onOpen }: UsePipModeOptions) {
  const [isPipMode, setIsPipMode] = useState(false);
  const pipDragControls = useDragControls();
  const pipX = useMotionValue(0);
  const pipY = useMotionValue(0);
  const [pipSize, setPipSize] = useState({ width: DEFAULT_PIP_W, height: DEFAULT_PIP_H });
  const [dragBounds, setDragBounds] = useState({
    left: -800,
    right: 16,
    top: -600,
    bottom: 16,
  });

  // Đọc cỡ PiP đã lưu, kẹp lại cho vừa màn hình hiện tại
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PIP_SIZE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.width === "number" && typeof parsed?.height === "number") {
          setPipSize(clampSize(parsed.width, parsed.height));
        }
      }
    } catch {}
  }, []);

  // Khôi phục vị trí PiP đã lưu trong LocalStorage
  const restorePipPos = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PIP_POS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
          const clampedX = clamp(parsed.x, dragBounds.left, dragBounds.right);
          const clampedY = clamp(parsed.y, dragBounds.top, dragBounds.bottom);
          pipX.set(clampedX);
          pipY.set(clampedY);
        }
      }
    } catch {}
  }, [dragBounds, pipX, pipY]);

  // Cập nhật ranh giới kéo thả PiP động theo kích thước màn hình + cỡ PiP
  useEffect(() => {
    const updateBounds = () => {
      if (typeof window !== "undefined") {
        const leftLimit = -(window.innerWidth - Math.min(pipSize.width, window.innerWidth - 32));
        const topLimit = -(window.innerHeight - 120);
        setDragBounds({
          left: leftLimit,
          right: 16,
          top: topLimit,
          bottom: 16,
        });
        // Màn hình nhỏ lại thì co PiP vào trong
        setPipSize((prev) => {
          const next = clampSize(prev.width, prev.height);
          if (next.width === prev.width && next.height === prev.height) return prev;
          return next;
        });
      }
    };
    updateBounds();
    window.addEventListener("resize", updateBounds);
    return () => window.removeEventListener("resize", updateBounds);
  }, [pipSize.width]);

  // Tự động thoát PiP khi mở lại modal chính
  useEffect(() => {
    if (isOpen) {
      setIsPipMode(false);
    }
  }, [isOpen]);

  // Thông báo thay đổi trạng thái PiP cho parent
  useEffect(() => {
    if (onPipModeChange) {
      onPipModeChange(isPipMode);
    }
  }, [isPipMode, onPipModeChange]);

  const enterPip = useCallback(() => {
    restorePipPos();
    setIsPipMode(true);
  }, [restorePipPos]);

  const exitPip = useCallback(
    (openStudioModal: boolean = false) => {
      setIsPipMode(false);
      if (openStudioModal && onOpen) {
        onOpen();
      }
    },
    [onOpen]
  );

  // Kéo to/nhỏ ở góc dưới phải, y như thẻ Notes / Rooms.
  // PiP neo góc phải/dưới (bottom-24 right-6) nên tăng rộng/cao sẽ nở ngược
  // sang trái/trên — phải đẩy vị trí theo cùng độ nở để khung đi theo chuột.
  // Cỡ + vị trí cập nhật chung 1 nhịp (rAF) để không bị lệch khung,
  // và chặn không cho đẩy khung lòi khỏi màn hình.
  const handlePipResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startW = pipSize.width;
    const startH = pipSize.height;
    const startPosX = pipX.get();
    const startPosY = pipY.get();
    const maxDw = dragBounds.right - startPosX;
    const maxDh = dragBounds.bottom - startPosY;
    let latestW = startW;
    let latestH = startH;
    let rafId: number | null = null;

    // Giữ mép trên/trái đứng yên: nở bao nhiêu thì đẩy vị trí bấy nhiêu
    const apply = () => {
      rafId = null;
      setPipSize({ width: latestW, height: latestH });
      pipX.set(startPosX + (latestW - startW));
      pipY.set(startPosY + (latestH - startH));
    };

    const onMove = (ev: PointerEvent) => {
      const dw = Math.min(ev.clientX - startMouseX, maxDw);
      const dh = Math.min(ev.clientY - startMouseY, maxDh);
      const next = clampSize(startW + dw, startH + dh);
      latestW = next.width;
      latestH = next.height;
      if (!rafId) rafId = requestAnimationFrame(apply);
    };
    const onUp = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      const final = { width: latestW, height: latestH };
      setPipSize(final);
      pipX.set(startPosX + (final.width - startW));
      pipY.set(startPosY + (final.height - startH));
      try {
        localStorage.setItem(STORAGE_PIP_SIZE_KEY, JSON.stringify(final));
        localStorage.setItem(
          STORAGE_PIP_POS_KEY,
          JSON.stringify({ x: pipX.get(), y: pipY.get() })
        );
      } catch {}
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [pipX, pipY, pipSize, dragBounds]);

  // Bấm phím khi đang đứng ở tay kéo: mũi tên đổi cỡ, Enter reset về mặc định.
  // Cũng đẩy vị trí theo để khung nở đúng hướng như kéo chuột.
  const handlePipResizeKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const STEP = 16;
      let dw = 0;
      let dh = 0;
      if (e.key === "ArrowRight") dw = STEP;
      else if (e.key === "ArrowLeft") dw = -STEP;
      else if (e.key === "ArrowDown") dh = STEP;
      else if (e.key === "ArrowUp") dh = -STEP;
      else if (e.key === "Enter") {
        e.preventDefault();
        const target = clampSize(DEFAULT_PIP_W, DEFAULT_PIP_H);
        setPipSize((prev) => {
          const dwT = Math.min(target.width - prev.width, dragBounds.right - pipX.get());
          const dhT = Math.min(target.height - prev.height, dragBounds.bottom - pipY.get());
          const next = clampSize(prev.width + dwT, prev.height + dhT);
          pipX.set(pipX.get() + (next.width - prev.width));
          pipY.set(pipY.get() + (next.height - prev.height));
          try {
            localStorage.setItem(STORAGE_PIP_SIZE_KEY, JSON.stringify(next));
            localStorage.setItem(
              STORAGE_PIP_POS_KEY,
              JSON.stringify({ x: pipX.get(), y: pipY.get() })
            );
          } catch {}
          return next;
        });
        return;
      } else return;
      e.preventDefault();
      setPipSize((prev) => {
        const dwC = Math.min(dw, dragBounds.right - pipX.get());
        const dhC = Math.min(dh, dragBounds.bottom - pipY.get());
        const next = clampSize(prev.width + dwC, prev.height + dhC);
        pipX.set(pipX.get() + (next.width - prev.width));
        pipY.set(pipY.get() + (next.height - prev.height));
        try {
          localStorage.setItem(STORAGE_PIP_SIZE_KEY, JSON.stringify(next));
          localStorage.setItem(
            STORAGE_PIP_POS_KEY,
            JSON.stringify({ x: pipX.get(), y: pipY.get() })
          );
        } catch {}
        return next;
      });
    },
    [pipX, pipY, dragBounds]
  );

  return {
    isPipMode,
    pipDragControls,
    pipX,
    pipY,
    dragBounds,
    pipSize,
    setPipSize,
    enterPip,
    exitPip,
    handlePipResizePointerDown,
    handlePipResizeKeyDown,
  };
}
