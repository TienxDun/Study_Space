"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Scene, STUDY_SCENES } from "@/components/study/study-types";
import { STORAGE_KEYS } from "@/lib/storage-keys";

export interface UseScenePreloaderOptions {
  initialScene?: Scene;
  timeoutMs?: number;
  onSceneChange?: (scene: Scene) => void;
}

export interface UseScenePreloaderReturn {
  currentScene: Scene;
  pendingScene: Scene | null;
  isPreloading: boolean;
  selectScene: (scene: Scene) => void;
  setCurrentSceneDirectly: (scene: Scene) => void;
}

/**
 * Hook quản lý nạp trước bối cảnh (Preload & Buffer-first Transition).
 * Khi mạng chậm, bối cảnh cũ vẫn được giữ nguyên. Chỉ chuyển sang bối cảnh mới
 * khi ảnh/video đã tải xong và đệm đủ dữ liệu (canplaythrough/onload),
 * tránh hiện tượng màn hình đen hoặc vỡ nét poster thumbnail.
 */
export function useScenePreloader({
  initialScene = STUDY_SCENES[0],
  timeoutMs = 12000,
  onSceneChange,
}: UseScenePreloaderOptions = {}): UseScenePreloaderReturn {
  const [currentScene, setCurrentScene] = useState<Scene>(initialScene);
  const [pendingScene, setPendingScene] = useState<Scene | null>(null);
  const [isPreloading, setIsPreloading] = useState(false);

  // Giữ ref để dọn dẹp các tác vụ nạp dở khi người dùng đổi lựa chọn liên tục
  const cancelPreviousPreloadRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (cancelPreviousPreloadRef.current) {
        cancelPreviousPreloadRef.current();
        cancelPreviousPreloadRef.current = null;
      }
    };
  }, []);

  const applyScene = useCallback(
    (scene: Scene) => {
      if (!isMountedRef.current) return;
      setCurrentScene(scene);
      setPendingScene(null);
      setIsPreloading(false);

      try {
        localStorage.setItem(STORAGE_KEYS.sceneId, scene.id);
      } catch {}

      onSceneChange?.(scene);
    },
    [onSceneChange]
  );

  const selectScene = useCallback(
    (targetScene: Scene) => {
      // Nếu chọn lại chính cảnh đang hiển thị thì không cần tải lại
      if (targetScene.id === currentScene.id && !pendingScene) {
        return;
      }

      // Nếu đang tải chính cảnh này rồi thì không bắt đầu lại
      if (pendingScene?.id === targetScene.id) {
        return;
      }

      // Hủy tác vụ nạp trước đó nếu có
      if (cancelPreviousPreloadRef.current) {
        cancelPreviousPreloadRef.current();
        cancelPreviousPreloadRef.current = null;
      }

      setPendingScene(targetScene);
      setIsPreloading(true);

      let isFinished = false;
      let timerId: NodeJS.Timeout | null = null;

      const finish = () => {
        if (isFinished) return;
        isFinished = true;
        if (timerId) clearTimeout(timerId);
        cancelPreviousPreloadRef.current = null;
        applyScene(targetScene);
      };

      // Timeout an toàn (12s) phòng trường hợp mạng quá yếu hoặc mất kết nối
      timerId = setTimeout(() => {
        console.warn(`[ScenePreloader] Quá thời gian nạp trước ${targetScene.name}, tự động kích hoạt chuyển cảnh an toàn.`);
        finish();
      }, timeoutMs);

      // Nạp trước tùy theo định dạng Media (Ảnh hoặc Video)
      if (targetScene.type === "IMAGE") {
        if (typeof window === "undefined") {
          finish();
          return;
        }

        const img = new Image();
        img.src = targetScene.bgUrl;

        // Nếu ảnh đã nằm sẵn trong bộ nhớ đệm trình duyệt
        if (img.complete) {
          finish();
          return;
        }

        img.onload = finish;
        img.onerror = () => {
          console.warn(`[ScenePreloader] Không thể nạp trước ảnh "${targetScene.name}".`);
          finish();
        };

        cancelPreviousPreloadRef.current = () => {
          isFinished = true;
          if (timerId) clearTimeout(timerId);
          img.onload = null;
          img.onerror = null;
        };
      } else {
        // VIDEO 4K/1080p: Tạo Video element ngầm để đệm trước
        if (typeof window === "undefined" || !document.createElement) {
          finish();
          return;
        }

        const video = document.createElement("video");
        video.preload = "auto";
        video.muted = true;
        video.playsInline = true;
        video.src = targetScene.bgUrl;

        const onReady = () => {
          finish();
        };

        const onError = () => {
          console.warn(`[ScenePreloader] Không thể nạp trước video "${targetScene.name}".`);
          finish();
        };

        // canplaythrough: Trình duyệt ước tính đã đệm đủ dữ liệu để phát mượt mà không bị khựng
        video.addEventListener("canplaythrough", onReady, { once: true });
        video.addEventListener("canplay", onReady, { once: true });
        video.addEventListener("error", onError, { once: true });

        // Kích hoạt nạp video
        video.load();

        cancelPreviousPreloadRef.current = () => {
          isFinished = true;
          if (timerId) clearTimeout(timerId);
          video.removeEventListener("canplaythrough", onReady);
          video.removeEventListener("canplay", onReady);
          video.removeEventListener("error", onError);
          video.src = "";
          video.load();
        };
      }
    },
    [currentScene.id, pendingScene, timeoutMs, applyScene]
  );

  const setCurrentSceneDirectly = useCallback((scene: Scene) => {
    if (cancelPreviousPreloadRef.current) {
      cancelPreviousPreloadRef.current();
      cancelPreviousPreloadRef.current = null;
    }
    setPendingScene(null);
    setIsPreloading(false);
    setCurrentScene(scene);
    try {
      localStorage.setItem(STORAGE_KEYS.sceneId, scene.id);
    } catch {}
  }, []);

  return {
    currentScene,
    pendingScene,
    isPreloading,
    selectScene,
    setCurrentSceneDirectly,
  };
}
