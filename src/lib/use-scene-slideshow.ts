"use client";

import { useEffect } from "react";
import type { Scene } from "@/components/study/study-types";

export const SLIDESHOW_INTERVALS_MIN = [5, 15, 30, 60];
export const DEFAULT_SLIDESHOW_INTERVAL_MIN = 15;

interface UseSceneSlideshowOptions {
  enabled: boolean;
  intervalMin: number;
  currentSceneId: string;
  pool: Scene[];
  onAdvance: (scene: Scene) => void;
}

/**
 * Slideshow bối cảnh: hết mỗi lượt intervalMin thì preload + crossfade
 * sang cảnh ngẫu nhiên khác cảnh hiện tại (tận dụng selectScene sẵn có).
 * - Đổi cảnh tay sẽ reset đếm ngược (nhờ dep currentSceneId).
 * - Tab đang ẩn thì bỏ qua lượt để khỏi tốn băng thông preload video.
 */
export function useSceneSlideshow({
  enabled,
  intervalMin,
  currentSceneId,
  pool,
  onAdvance,
}: UseSceneSlideshowOptions) {
  useEffect(() => {
    if (!enabled || pool.length < 2 || intervalMin <= 0) return;

    const timerId = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      const candidates = pool.filter((s) => s.id !== currentSceneId);
      const source = candidates.length > 0 ? candidates : pool;
      const next = source[Math.floor(Math.random() * source.length)];
      if (next) onAdvance(next);
    }, intervalMin * 60 * 1000);

    return () => clearInterval(timerId);
  }, [enabled, intervalMin, currentSceneId, pool, onAdvance]);
}
