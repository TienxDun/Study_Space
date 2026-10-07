"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  DEFAULT_SPLIT_RATIO,
  STORAGE_SPLIT_RATIO_KEY,
} from "../constants";
import { clampSplitRatio } from "../utils/embed-helpers";

export function useEmbedSplitPane() {
  const [splitRatio, setSplitRatio] = useState<number>(DEFAULT_SPLIT_RATIO);
  const [isResizing, setIsResizing] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);

  // Khôi phục tỉ lệ chia cột từ LocalStorage khi mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SPLIT_RATIO_KEY);
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val)) {
          setSplitRatio(clampSplitRatio(val));
        }
      }
    } catch {}
  }, []);

  const handleMouseDownDivider = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleDoubleClickDivider = useCallback(() => {
    setSplitRatio(DEFAULT_SPLIT_RATIO);
    try {
      localStorage.setItem(STORAGE_SPLIT_RATIO_KEY, String(DEFAULT_SPLIT_RATIO));
    } catch {}
    toast.info(`Đã đặt lại kích thước video mặc định (${DEFAULT_SPLIT_RATIO}%)`);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const newWidthPx = e.clientX - rect.left;
      const newPercent = (newWidthPx / rect.width) * 100;
      setSplitRatio(clampSplitRatio(newPercent));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      try {
        localStorage.setItem(STORAGE_SPLIT_RATIO_KEY, String(splitRatio));
      } catch {}
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, splitRatio]);

  return {
    splitRatio,
    isResizing,
    splitContainerRef,
    handleMouseDownDivider,
    handleDoubleClickDivider,
  };
}
