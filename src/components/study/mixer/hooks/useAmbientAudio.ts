"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AMBIENT_SOUNDS } from "../../study-types";
import { AmbientSound } from "../types";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { togglePresetVolumes } from "../utils/sound-helpers";

interface UseAmbientAudioOptions {
  isGlobalMuted: boolean;
}

export function useAmbientAudio({ isGlobalMuted }: UseAmbientAudioOptions) {
  const [ambientVolumes, setAmbientVolumes] = useState<Record<string, number>>({});
  const soundAudiosRef = useRef<Record<string, HTMLAudioElement>>({});

  // Khôi phục cài đặt phối âm môi trường từ LocalStorage
  useEffect(() => {
    try {
      const savedVolsStr = localStorage.getItem(STORAGE_KEYS.ambientVols);
      if (savedVolsStr) {
        const parsed = JSON.parse(savedVolsStr);
        if (parsed && typeof parsed === "object") {
          // Chuẩn hoá mọi giá trị > 1 về [0, 1] để tự động chữa lành dữ liệu cũ
          const normalized: Record<string, number> = {};
          Object.entries(parsed).forEach(([k, v]) => {
            if (typeof v === "number" && !isNaN(v)) {
              normalized[k] = v > 1 ? Math.min(1, Math.max(0, v / 100)) : Math.min(1, Math.max(0, v));
            }
          });
          setAmbientVolumes(normalized);
        }
      }
    } catch {}
  }, []);

  const updateAmbientVolumes = useCallback(
    (
      updater:
        | Record<string, number>
        | ((prev: Record<string, number>) => Record<string, number>)
    ) => {
      setAmbientVolumes((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        try {
          localStorage.setItem(STORAGE_KEYS.ambientVols, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    []
  );

  // Khởi tạo Audio đối tượng theo nhu cầu (Lazy): chỉ cấp phát khi âm thanh thật sự được bật,
  // giúp tiết kiệm kênh âm thanh phần cứng và bộ nhớ RAM quý giá trên điện thoại
  const getOrCreateAudio = useCallback((sound: AmbientSound) => {
    if (typeof window === "undefined") return null;
    if (!soundAudiosRef.current[sound.id]) {
      const audio = new Audio(sound.src);
      audio.loop = true;
      audio.preload = "none";
      soundAudiosRef.current[sound.id] = audio;
    }
    return soundAudiosRef.current[sound.id];
  }, []);

  // Cleanup toàn bộ âm thanh khi unmount
  useEffect(() => {
    return () => {
      Object.values(soundAudiosRef.current).forEach((audio) => {
        audio.pause();
        audio.src = "";
      });
      soundAudiosRef.current = {};
    };
  }, []);

  // Cập nhật âm lượng và phát/dừng cho từng âm thanh thiên nhiên đang hoạt động
  useEffect(() => {
    AMBIENT_SOUNDS.forEach((sound: AmbientSound) => {
      const rawVol = ambientVolumes[sound.id] || 0;
      // Chuẩn hoá âm lượng về khoảng [0, 1] cho HTMLMediaElement
      const normalizedVol =
        rawVol > 1
          ? Math.min(1, Math.max(0, rawVol / 100))
          : Math.min(1, Math.max(0, rawVol));
      const effectiveVol = isGlobalMuted ? 0 : normalizedVol;

      if (effectiveVol > 0) {
        const audio = getOrCreateAudio(sound);
        if (audio) {
          audio.volume = effectiveVol;
          if (audio.paused) {
            audio.play().catch(() => {});
          }
        }
      } else {
        const existingAudio = soundAudiosRef.current[sound.id];
        if (existingAudio && !existingAudio.paused) {
          existingAudio.volume = 0;
          existingAudio.pause();
        }
      }
    });
  }, [ambientVolumes, isGlobalMuted, getOrCreateAudio]);

  const toggleSound = useCallback(
    (soundId: string) => {
      updateAmbientVolumes((prev) => {
        const current = prev[soundId] || 0;
        return {
          ...prev,
          [soundId]: current > 0 ? 0 : 0.6,
        };
      });
    },
    [updateAmbientVolumes]
  );

  const handleSoundVolume = useCallback(
    (soundId: string, val: number) => {
      // Đảm bảo giá trị âm lượng luôn thuộc [0, 1]
      const clampedVal =
        val > 1
          ? Math.min(1, Math.max(0, val / 100))
          : Math.min(1, Math.max(0, val));
      updateAmbientVolumes((prev) => ({
        ...prev,
        [soundId]: clampedVal,
      }));
    },
    [updateAmbientVolumes]
  );

  const resetAllSounds = useCallback(() => {
    updateAmbientVolumes({});
  }, [updateAmbientVolumes]);

  const handleTogglePreset = useCallback(
    (recipe: Record<string, number>) => {
      updateAmbientVolumes((prev) => togglePresetVolumes(recipe, prev, AMBIENT_SOUNDS));
    },
    [updateAmbientVolumes]
  );

  const activeCount = Object.values(ambientVolumes).filter((v) => v > 0).length;

  return {
    ambientVolumes,
    activeCount,
    toggleSound,
    handleSoundVolume,
    resetAllSounds,
    handleTogglePreset,
  };
}
