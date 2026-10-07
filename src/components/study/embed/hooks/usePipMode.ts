"use client";

import { useState, useEffect, useCallback } from "react";
import { useDragControls, useMotionValue } from "framer-motion";
import { STORAGE_KEYS } from "@/lib/storage-keys";

const STORAGE_PIP_POS_KEY = STORAGE_KEYS.embedPipPos;

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
  const [dragBounds, setDragBounds] = useState({
    left: -800,
    right: 16,
    top: -600,
    bottom: 16,
  });

  // Khôi phục vị trí PiP đã lưu trong LocalStorage
  const restorePipPos = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PIP_POS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
          const clampedX = Math.max(dragBounds.left, Math.min(dragBounds.right, parsed.x));
          const clampedY = Math.max(dragBounds.top, Math.min(dragBounds.bottom, parsed.y));
          pipX.set(clampedX);
          pipY.set(clampedY);
        }
      }
    } catch {}
  }, [dragBounds, pipX, pipY]);

  // Cập nhật ranh giới kéo thả PiP động theo kích thước màn hình
  useEffect(() => {
    const updateBounds = () => {
      if (typeof window !== "undefined") {
        const leftLimit = -(window.innerWidth - 380);
        const topLimit = -(window.innerHeight - 260);
        setDragBounds({
          left: leftLimit,
          right: 16,
          top: topLimit,
          bottom: 16,
        });
      }
    };
    updateBounds();
    window.addEventListener("resize", updateBounds);
    return () => window.removeEventListener("resize", updateBounds);
  }, []);

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

  return {
    isPipMode,
    pipDragControls,
    pipX,
    pipY,
    dragBounds,
    enterPip,
    exitPip,
  };
}
