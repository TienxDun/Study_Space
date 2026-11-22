"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { useStudySettings } from "@/lib/use-study-settings";
import { useWakeLock } from "@/lib/use-wake-lock";
import {
  SYSTEM_FLAGS_DEFAULT,
  fetchSystemFlags,
  type SystemFlags,
} from "@/lib/system-flags";

interface UseDisplayModeStateOptions {
  isTimerRunning: boolean;
  isExternalStreamActive: boolean;
  isMobile?: boolean;
}

export function useDisplayModeState({
  isTimerRunning,
  isExternalStreamActive,
  isMobile = false,
}: UseDisplayModeStateOptions) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isGlobalMuted, setIsGlobalMuted] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);

  // Cờ hệ thống lấy từ chat-v2 /config
  const [systemFlags, setSystemFlags] = useState<SystemFlags>(SYSTEM_FLAGS_DEFAULT);

  useEffect(() => {
    let cancelled = false;

    const loadFlags = async () => {
      const next = await fetchSystemFlags();
      if (cancelled) return;
      setSystemFlags((prev) =>
        prev.chatEnabled === next.chatEnabled &&
        prev.roomsEnabled === next.roomsEnabled &&
        prev.maintenance === next.maintenance &&
        prev.banner === next.banner
          ? prev
          : next
      );
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") void loadFlags();
    };

    void loadFlags();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void loadFlags();
    }, 60 * 1000);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const handleExitZen = useCallback(() => {
    setIsZenMode(false);
  }, []);

  // Cài đặt chung
  const {
    showClockSeconds,
    isClock12Hour,
    showStopwatchMilliseconds,
    pomodoroDurations,
    soundEnabled,
    soundType,
    toggleClockSeconds: handleToggleClockSeconds,
    toggleClock12Hour: handleToggleClock12Hour,
    toggleStopwatchMilliseconds: handleToggleStopwatchMilliseconds,
    savePomodoroDurations: handleSavePomodoroDurations,
    toggleSound: handleToggleSound,
    selectSoundType: handleSelectSoundType,
    keepAwake,
    toggleKeepAwake: handleToggleKeepAwake,
  } = useStudySettings();

  // Khôi phục mute từ LocalStorage
  useEffect(() => {
    try {
      const savedMute = localStorage.getItem(STORAGE_KEYS.globalMute);
      if (savedMute !== null) {
        setIsGlobalMuted(savedMute === "true");
      }
    } catch {}
  }, []);

  // Giữ màn hình sáng khi học
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);

  useEffect(() => {
    const onMusicState = (e: Event) => {
      setIsMusicPlaying(Boolean((e as CustomEvent).detail?.isPlaying));
    };
    window.addEventListener("zenstudy:music-state", onMusicState);
    return () => {
      window.removeEventListener("zenstudy:music-state", onMusicState);
    };
  }, []);

  // Làm nóng sẵn bảng Không gian khi máy rảnh (chỉ trên Desktop vì mobile dùng MobileScenesSheet)
  useEffect(() => {
    if (isMobile) return;
    let cancelled = false;
    const warmUp = () => {
      if (cancelled) return;
      void import("@/components/study/SceneSelectorWidget").catch(() => {});
    };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let idleId = 0;
    let timer = 0;
    if (typeof w.requestIdleCallback === "function") {
      idleId = w.requestIdleCallback(warmUp, { timeout: 3000 });
    } else {
      timer = window.setTimeout(warmUp, 2000);
    }
    return () => {
      cancelled = true;
      if (idleId && typeof w.cancelIdleCallback === "function") {
        w.cancelIdleCallback(idleId);
      }
      if (timer) window.clearTimeout(timer);
    };
  }, [isMobile]);

  const { supported: wakeLockSupported } = useWakeLock(
    keepAwake && (isTimerRunning || isMusicPlaying || isExternalStreamActive)
  );

  const toggleGlobalMute = useCallback(() => {
    setIsGlobalMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.globalMute, String(next));
      } catch {}
      return next;
    });
  }, []);

  const setGlobalMute = useCallback((muted: boolean) => {
    setIsGlobalMuted(muted);
    try {
      localStorage.setItem(STORAGE_KEYS.globalMute, String(muted));
    } catch {}
  }, []);

  const isFullscreenRef = useRef(false);
  useEffect(() => {
    isFullscreenRef.current = isFullscreen;
  }, [isFullscreen]);

  const toggleFullscreen = useCallback(() => {
    const next = !isFullscreenRef.current;
    if (typeof document !== "undefined") {
      try {
        if (next) {
          if (!document.fullscreenElement) {
            const el = document.documentElement as HTMLElement & {
              requestFullscreen?: () => Promise<void>;
              webkitRequestFullscreen?: () => void;
            };
            const req = el.requestFullscreen || el.webkitRequestFullscreen;
            if (typeof req === "function") {
              const result = req.call(el);
              if (result && typeof (result as Promise<void>).catch === "function") {
                (result as Promise<void>).catch(() => {});
              }
            }
          }
        } else {
          const doc = document as Document & {
            exitFullscreen?: () => Promise<void>;
            webkitExitFullscreen?: () => void;
          };
          if (document.fullscreenElement && (doc.exitFullscreen || doc.webkitExitFullscreen)) {
            const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
            if (typeof exit === "function") {
              const result = exit.call(doc);
              if (result && typeof (result as Promise<void>).catch === "function") {
                (result as Promise<void>).catch(() => {});
              }
            }
          }
        }
      } catch {}
    }
    setIsFullscreen(next);
  }, []);

  return useMemo(
    () => ({
      isFullscreen,
      toggleFullscreen,
      isGlobalMuted,
      toggleGlobalMute,
      setGlobalMute,
      isZenMode,
      setIsZenMode,
      handleExitZen,
      systemFlags,
      showClockSeconds,
      handleToggleClockSeconds,
      isClock12Hour,
      handleToggleClock12Hour,
      showStopwatchMilliseconds,
      handleToggleStopwatchMilliseconds,
      pomodoroDurations,
      handleSavePomodoroDurations,
      soundEnabled,
      handleToggleSound,
      soundType,
      handleSelectSoundType,
      keepAwake,
      handleToggleKeepAwake,
      wakeLockSupported,
      isMusicPlaying,
    }),
    [
      isFullscreen,
      toggleFullscreen,
      isGlobalMuted,
      toggleGlobalMute,
      setGlobalMute,
      isZenMode,
      setIsZenMode,
      handleExitZen,
      systemFlags,
      showClockSeconds,
      handleToggleClockSeconds,
      isClock12Hour,
      handleToggleClock12Hour,
      showStopwatchMilliseconds,
      handleToggleStopwatchMilliseconds,
      pomodoroDurations,
      handleSavePomodoroDurations,
      soundEnabled,
      handleToggleSound,
      soundType,
      handleSelectSoundType,
      keepAwake,
      handleToggleKeepAwake,
      wakeLockSupported,
      isMusicPlaying,
    ]
  );
}
