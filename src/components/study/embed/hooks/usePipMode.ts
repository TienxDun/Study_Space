"use client";

import { useState, useEffect, useCallback } from "react";
import { useDragControls, useMotionValue } from "framer-motion";

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

  // Cập nhật ranh giới kéo thả PiP động theo kích thước màn hình
  useEffect(() => {
    const updateBounds = () => {
      if (typeof window !== "undefined") {
        setDragBounds({
          left: -(window.innerWidth - 380),
          right: 16,
          top: -(window.innerHeight - 260),
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
      pipX.set(0);
      pipY.set(0);
    }
  }, [isOpen, pipX, pipY]);

  // Thông báo thay đổi trạng thái PiP cho parent
  useEffect(() => {
    if (!isPipMode) {
      pipX.set(0);
      pipY.set(0);
    }
    if (onPipModeChange) {
      onPipModeChange(isPipMode);
    }
  }, [isPipMode, pipX, pipY, onPipModeChange]);

  const enterPip = useCallback(() => {
    pipX.set(0);
    pipY.set(0);
    setIsPipMode(true);
  }, [pipX, pipY]);

  const exitPip = useCallback(
    (openStudioModal: boolean = false) => {
      pipX.set(0);
      pipY.set(0);
      setIsPipMode(false);
      if (openStudioModal && onOpen) {
        onOpen();
      }
    },
    [pipX, pipY, onOpen]
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
