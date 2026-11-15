"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { STUDY_SCENES } from "@/components/study/study-types";
import { useScenePreloader } from "@/lib/use-scene-preloader";
import {
  useSceneSlideshow,
  SLIDESHOW_INTERVALS_MIN,
  DEFAULT_SLIDESHOW_INTERVAL_MIN,
} from "@/lib/use-scene-slideshow";
import { useFavoriteScenes } from "@/lib/use-favorites";
import { STORAGE_KEYS } from "@/lib/storage-keys";

interface UseSceneStateOptions {
  isMobile: boolean;
}

function isNarrowViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
}

export function useSceneState({ isMobile }: UseSceneStateOptions) {
  const {
    currentScene,
    pendingScene,
    isPreloading: isPreloadingScene,
    selectScene: handleSelectScene,
    setCurrentSceneDirectly,
  } = useScenePreloader({
    initialScene: STUDY_SCENES[0],
  });

  // null = chưa từng tự bật/tắt. Mobile mặc định tắt: mỗi lần đổi cảnh chạy
  // hai decoder cùng lúc lúc crossfade, đủ nghẽn máy yếu vài trăm ms.
  // Suy ra từ isMobile mỗi render vì useIsMobile chỉ đúng từ render thứ hai.
  const [slideshowChoice, setSlideshowChoice] = useState<boolean | null>(null);
  const isSlideshowOn = slideshowChoice ?? !isMobile;
  const [slideshowIntervalMin, setSlideshowIntervalMin] = useState(
    DEFAULT_SLIDESHOW_INTERVAL_MIN
  );
  const { favoriteIds } = useFavoriteScenes();

  const slideshowPool = useMemo(() => {
    const favs = STUDY_SCENES.filter((s) => favoriteIds.includes(s.id));
    return favs.length >= 2 ? favs : STUDY_SCENES;
  }, [favoriteIds]);

  const isSlideshowPoolFavorites = slideshowPool.length < STUDY_SCENES.length;

  useSceneSlideshow({
    enabled: isSlideshowOn,
    intervalMin: slideshowIntervalMin,
    currentSceneId: currentScene.id,
    pool: slideshowPool,
    onAdvance: handleSelectScene,
  });

  const handleToggleSlideshow = useCallback(() => {
    const next = !(slideshowChoice ?? !isMobile);
    setSlideshowChoice(next);
    try {
      localStorage.setItem(STORAGE_KEYS.slideshowEnabled, String(next));
    } catch {}
  }, [slideshowChoice, isMobile]);

  const handleCycleSlideshowInterval = useCallback(() => {
    setSlideshowIntervalMin((prev) => {
      const idx = SLIDESHOW_INTERVALS_MIN.indexOf(prev);
      const next =
        SLIDESHOW_INTERVALS_MIN[(idx + 1) % SLIDESHOW_INTERVALS_MIN.length];
      try {
        localStorage.setItem(STORAGE_KEYS.slideshowIntervalMin, String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleRandomScene = useCallback(() => {
    const candidates = slideshowPool.filter((s) => s.id !== currentScene.id);
    const pool = candidates.length > 0 ? candidates : STUDY_SCENES.filter((s) => s.id !== currentScene.id);
    const source = pool.length > 0 ? pool : STUDY_SCENES;
    const next = source[Math.floor(Math.random() * source.length)];
    if (next) {
      handleSelectScene(next);
      return next;
    }
    return null;
  }, [slideshowPool, currentScene.id, handleSelectScene]);

  // Khôi phục cảnh và slideshow từ LocalStorage
  useEffect(() => {
    try {
      const savedSceneId = localStorage.getItem(STORAGE_KEYS.sceneId);
      if (savedSceneId) {
        const found = STUDY_SCENES.find((s) => s.id === savedSceneId);
        if (found) setCurrentSceneDirectly(found);
      } else if (STUDY_SCENES.length > 0 && !isNarrowViewport()) {
        // Điện thoại lần đầu giữ cảnh mặc định: bốc ngẫu nhiên trong 40 cảnh có thể
        // trúng ảnh gốc 1,2–1,5MB, tải ngay dưới Splash/Welcome mà không ai thấy.
        const random =
          STUDY_SCENES[Math.floor(Math.random() * STUDY_SCENES.length)];
        setCurrentSceneDirectly(random, { persist: false });
      }
      const savedSlideshow = localStorage.getItem(STORAGE_KEYS.slideshowEnabled);
      if (savedSlideshow !== null) {
        setSlideshowChoice(savedSlideshow === "true");
      }
      const savedSlideshowMin = localStorage.getItem(STORAGE_KEYS.slideshowIntervalMin);
      const parsedMin = savedSlideshowMin ? parseInt(savedSlideshowMin, 10) : NaN;
      if (SLIDESHOW_INTERVALS_MIN.includes(parsedMin)) {
        setSlideshowIntervalMin(parsedMin);
      }
    } catch {}
  }, [setCurrentSceneDirectly]);

  return useMemo(
    () => ({
      currentScene,
      pendingScene,
      isPreloadingScene,
      handleSelectScene,
      setCurrentSceneDirectly,
      isSlideshowOn,
      slideshowIntervalMin,
      slideshowPool,
      isSlideshowPoolFavorites,
      handleToggleSlideshow,
      handleCycleSlideshowInterval,
      handleRandomScene,
    }),
    [
      currentScene,
      pendingScene,
      isPreloadingScene,
      handleSelectScene,
      setCurrentSceneDirectly,
      isSlideshowOn,
      slideshowIntervalMin,
      slideshowPool,
      isSlideshowPoolFavorites,
      handleToggleSlideshow,
      handleCycleSlideshowInterval,
      handleRandomScene,
    ]
  );
}
