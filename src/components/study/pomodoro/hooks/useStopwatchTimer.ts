"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { STORAGE_KEYS } from "@/lib/storage-keys";

interface PersistedStopwatchState {
  baseTime: number; // in milliseconds
  isRunning: boolean;
  startedAt: number | null; // Date.now() when last started
  laps: number[];
  isLapsOpen: boolean;
}

function readPersistedStopwatchState(): PersistedStopwatchState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.stopwatchRunningState);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.baseTime !== "number" || typeof parsed?.isRunning !== "boolean") {
      return null;
    }
    return parsed as PersistedStopwatchState;
  } catch {
    return null;
  }
}

function writePersistedStopwatchState(state: PersistedStopwatchState | null) {
  if (typeof window === "undefined") return;
  try {
    if (!state || (state.baseTime === 0 && !state.isRunning && state.laps.length === 0)) {
      localStorage.removeItem(STORAGE_KEYS.stopwatchRunningState);
    } else {
      localStorage.setItem(STORAGE_KEYS.stopwatchRunningState, JSON.stringify(state));
    }
  } catch {}
}

export function useStopwatchTimer(showMilliseconds = true, enabled = true) {
  const [stopwatchTime, setStopwatchTime] = useState<number>(() => {
    const saved = readPersistedStopwatchState();
    if (!saved) return 0;
    if (saved.isRunning && saved.startedAt) {
      const elapsed = Date.now() - saved.startedAt;
      return Math.max(0, saved.baseTime + elapsed);
    }
    return saved.baseTime || 0;
  });

  const [isStopwatchRunning, setIsStopwatchRunning] = useState<boolean>(() => {
    const saved = readPersistedStopwatchState();
    return saved?.isRunning ?? false;
  });

  const [laps, setLaps] = useState<number[]>(() => {
    const saved = readPersistedStopwatchState();
    return Array.isArray(saved?.laps) ? saved.laps : [];
  });

  const [isLapsOpen, setIsLapsOpen] = useState<boolean>(() => {
    const saved = readPersistedStopwatchState();
    return saved?.isLapsOpen ?? false;
  });

  // Mirror số mili-giây hiện tại vào ref để addLap và lưu trạng thái luôn đọc số mới nhất
  const stopwatchTimeRef = useRef(stopwatchTime);
  const isRunningRef = useRef(isStopwatchRunning);
  const lapsRef = useRef(laps);
  const isLapsOpenRef = useRef(isLapsOpen);

  useEffect(() => {
    stopwatchTimeRef.current = stopwatchTime;
    isRunningRef.current = isStopwatchRunning;
    lapsRef.current = laps;
    isLapsOpenRef.current = isLapsOpen;
  }, [stopwatchTime, isStopwatchRunning, laps, isLapsOpen]);

  const startTimeRef = useRef<number | null>(null);

  // Vòng lặp đếm giờ dựa trên timestamp thực tế để không bị chậm khi máy ngủ (chỉ tick khi enabled)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isStopwatchRunning) {
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now() - stopwatchTimeRef.current;
      }
      if (enabled) {
        const update = () => {
          if (startTimeRef.current !== null) {
            setStopwatchTime(Date.now() - startTimeRef.current);
          }
        };
        update();
        interval = setInterval(update, showMilliseconds ? 30 : 200);
      }
    } else {
      startTimeRef.current = null;
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isStopwatchRunning, showMilliseconds, enabled]);

  // Lưu trạng thái mỗi khi ẩn tab hoặc rời trang
  useEffect(() => {
    const persistCurrentState = () => {
      if (stopwatchTimeRef.current === 0 && !isRunningRef.current && lapsRef.current.length === 0) {
        writePersistedStopwatchState(null);
        return;
      }
      writePersistedStopwatchState({
        baseTime: stopwatchTimeRef.current,
        isRunning: isRunningRef.current,
        startedAt: isRunningRef.current ? Date.now() : null,
        laps: lapsRef.current,
        isLapsOpen: isLapsOpenRef.current,
      });
    };

    const handleVisibilityChange = () => {
      persistCurrentState();
    };

    window.addEventListener("beforeunload", persistCurrentState);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", persistCurrentState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const toggleStopwatch = useCallback(() => {
    setIsStopwatchRunning((prev) => {
      const next = !prev;
      if (!next) {
        startTimeRef.current = null;
      } else {
        startTimeRef.current = Date.now() - stopwatchTimeRef.current;
      }
      writePersistedStopwatchState({
        baseTime: stopwatchTimeRef.current,
        isRunning: next,
        startedAt: next ? Date.now() : null,
        laps: lapsRef.current,
        isLapsOpen: isLapsOpenRef.current,
      });
      return next;
    });
  }, []);

  const resetStopwatch = useCallback(() => {
    startTimeRef.current = null;
    setIsStopwatchRunning(false);
    setStopwatchTime(0);
    setLaps([]);
    writePersistedStopwatchState(null);
  }, []);

  const addLap = useCallback(() => {
    if (isStopwatchRunning) {
      const nextLaps = [stopwatchTimeRef.current, ...lapsRef.current];
      setLaps(nextLaps);
      setIsLapsOpen(true);
      writePersistedStopwatchState({
        baseTime: stopwatchTimeRef.current,
        isRunning: true,
        startedAt: Date.now(),
        laps: nextLaps,
        isLapsOpen: true,
      });
    }
  }, [isStopwatchRunning]);

  const toggleLapsDrawer = useCallback(() => {
    setIsLapsOpen((prev) => {
      const next = !prev;
      writePersistedStopwatchState({
        baseTime: stopwatchTimeRef.current,
        isRunning: isRunningRef.current,
        startedAt: isRunningRef.current ? Date.now() : null,
        laps: lapsRef.current,
        isLapsOpen: next,
      });
      return next;
    });
  }, []);

  const clearLaps = useCallback(() => {
    setLaps([]);
    writePersistedStopwatchState({
      baseTime: stopwatchTimeRef.current,
      isRunning: isRunningRef.current,
      startedAt: isRunningRef.current ? Date.now() : null,
      laps: [],
      isLapsOpen: isLapsOpenRef.current,
    });
  }, []);

  return {
    stopwatchTime,
    isStopwatchRunning,
    laps,
    isLapsOpen,
    setIsLapsOpen,
    toggleStopwatch,
    resetStopwatch,
    addLap,
    toggleLapsDrawer,
    clearLaps,
  };
}
