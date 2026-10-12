"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  DEFAULT_SPLIT_RATIO,
  STORAGE_SPLIT_RATIO_KEY,
} from "../constants";
import { clampSplitRatio } from "../utils/embed-helpers";

export function useEmbedSplitPane() {
  const [splitRatio, setSplitRatio] = useState<number>(DEFAULT_SPLIT_RATIO);
  const [isResizing, setIsResizing] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const ratioRef = useRef(splitRatio);
  const resizingRef = useRef(false);

  useEffect(() => {
    ratioRef.current = splitRatio;
  }, [splitRatio]);

  // Khôi phục tỉ lệ chia cột từ LocalStorage khi mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SPLIT_RATIO_KEY);
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val)) {
          // Tự động nâng cấp lên default mới nếu người dùng vẫn đang ở tỉ lệ mặc định cũ (44)
          if (val === 44) {
            setSplitRatio(DEFAULT_SPLIT_RATIO);
            try {
              localStorage.setItem(STORAGE_SPLIT_RATIO_KEY, String(DEFAULT_SPLIT_RATIO));
            } catch {}
          } else {
            setSplitRatio(clampSplitRatio(val));
          }
        }
      }
    } catch {}
  }, []);

  const handleMouseDownDivider = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    setIsResizing(true);
  }, []);

  const handleDoubleClickDivider = useCallback(() => {
    resizingRef.current = false;
    setIsResizing(false);
    setSplitRatio(DEFAULT_SPLIT_RATIO);
    try {
      localStorage.setItem(STORAGE_SPLIT_RATIO_KEY, String(DEFAULT_SPLIT_RATIO));
    } catch {}
  }, []);

  // Listener gắn 1 lần duy nhất: kéo thì gom theo khung hình (rAF),
  // thả mới chốt state + lưu — không vẽ lại React mỗi chấm chuột,
  // không tháo/gắn listener liên tục như trước.
  useEffect(() => {
    let raf = 0;
    let latest = -1;

    const apply = () => {
      raf = 0;
      if (latest > 0) setSplitRatio(latest);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const newPercent = ((e.clientX - rect.left) / rect.width) * 100;
      latest = clampSplitRatio(newPercent);
      if (!raf) raf = requestAnimationFrame(apply);
    };

    const handleMouseUp = () => {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      const final = latest > 0 ? latest : ratioRef.current;
      latest = -1;
      setSplitRatio(final);
      setIsResizing(false);
      try {
        localStorage.setItem(STORAGE_SPLIT_RATIO_KEY, String(final));
      } catch {}
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return {
    splitRatio,
    isResizing,
    splitContainerRef,
    handleMouseDownDivider,
    handleDoubleClickDivider,
  };
}
