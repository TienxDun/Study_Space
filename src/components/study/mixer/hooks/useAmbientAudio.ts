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
          setAmbientVolumes(parsed);
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

  // Setup ambient sound audio objects
  useEffect(() => {
    AMBIENT_SOUNDS.forEach((sound: AmbientSound) => {
      if (!soundAudiosRef.current[sound.id]) {
        const audio = new Audio(sound.src);
        audio.loop = true;
        audio.preload = "none";
        soundAudiosRef.current[sound.id] = audio;
      }
    });

    return () => {
      Object.values(soundAudiosRef.current).forEach((audio) => {
        audio.pause();
        audio.src = "";
      });
      soundAudiosRef.current = {};
    };
  }, []);

  // Update volume and play/pause for each ambient track
  useEffect(() => {
    AMBIENT_SOUNDS.forEach((sound: AmbientSound) => {
      const audio = soundAudiosRef.current[sound.id];
      if (audio) {
        const soundVol = ambientVolumes[sound.id] || 0;
        const effectiveVol = isGlobalMuted ? 0 : soundVol;
        audio.volume = effectiveVol;

        if (effectiveVol > 0 && audio.paused) {
          audio.play().catch(() => {});
        } else if (effectiveVol === 0 && !audio.paused) {
          audio.pause();
        }
      }
    });
  }, [ambientVolumes, isGlobalMuted]);

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
      updateAmbientVolumes((prev) => ({
        ...prev,
        [soundId]: val,
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
