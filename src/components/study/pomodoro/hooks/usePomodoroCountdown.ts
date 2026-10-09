"use client";

import { useState, useEffect, useCallback } from "react";
import { PomodoroMode, PomodoroDurations, PomodoroSoundType } from "../types";
import { playPomodoroSound } from "../../study-sound";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { getNextBreakType } from "../utils/timer-formatters";
import { EVENT_START_FOCUS } from "@/lib/use-focus-task";

interface UsePomodoroCountdownOptions {
  durations: PomodoroDurations;
  soundEnabled: boolean;
  soundType?: PomodoroSoundType;
  onSessionComplete?: (mode: PomodoroMode) => void;
}

export function usePomodoroCountdown({
  durations,
  soundEnabled,
  soundType = "classic_clock",
  onSessionComplete,
}: UsePomodoroCountdownOptions) {
  const [pomoMode, setPomoMode] = useState<PomodoroMode>("focus");
  const [timeLeft, setTimeLeft] = useState(durations.focus * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);

  // Tự động kích hoạt đếm ngược chế độ Focus khi người dùng bấm Bắt đầu tập trung vào Task
  useEffect(() => {
    const handleStartFocus = () => {
      setPomoMode("focus");
      setTimeLeft(durations.focus * 60);
      setIsRunning(true);
    };

    window.addEventListener(EVENT_START_FOCUS, handleStartFocus);
    return () => {
      window.removeEventListener(EVENT_START_FOCUS, handleStartFocus);
    };
  }, [durations.focus]);

  // Khôi phục số phiên hoàn thành từ LocalStorage
  useEffect(() => {
    try {
      const savedCount = localStorage.getItem(STORAGE_KEYS.pomoCount);
      if (savedCount) setCompletedSessions(parseInt(savedCount, 10) || 0);
    } catch {}
  }, []);

  // Cập nhật lại timeLeft khi thời gian cài đặt thay đổi và đang tạm dừng
  useEffect(() => {
    if (!isRunning) {
      setTimeLeft(durations[pomoMode] * 60);
    }
  }, [durations, pomoMode, isRunning]);

  const playChime = useCallback(() => {
    playPomodoroSound(soundType, soundEnabled);
  }, [soundType, soundEnabled]);

  const switchPomoMode = useCallback(
    (mode: PomodoroMode) => {
      setPomoMode(mode);
      setTimeLeft(durations[mode] * 60);
      setIsRunning(false);
    },
    [durations]
  );

  const handleComplete = useCallback(() => {
    setIsRunning(false);
    playChime();

    if (pomoMode === "focus") {
      const nextCount = completedSessions + 1;
      setCompletedSessions(nextCount);
      try {
        localStorage.setItem(STORAGE_KEYS.pomoCount, String(nextCount));
      } catch {}
      if (onSessionComplete) onSessionComplete("focus");

      const nextBreak = getNextBreakType(nextCount);
      switchPomoMode(nextBreak);
    } else {
      if (onSessionComplete) onSessionComplete(pomoMode);
      switchPomoMode("focus");
    }
  }, [completedSessions, onSessionComplete, playChime, pomoMode, switchPomoMode]);

  // Vòng lặp đếm ngược mỗi giây
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (isRunning && timeLeft === 0) {
      handleComplete();
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeLeft, handleComplete]);

  const toggleRunning = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  const resetPomodoro = useCallback(() => {
    setIsRunning(false);
    setTimeLeft(durations[pomoMode] * 60);
  }, [durations, pomoMode]);

  return {
    pomoMode,
    timeLeft,
    isRunning,
    completedSessions,
    switchPomoMode,
    toggleRunning,
    resetPomodoro,
    skipSession: handleComplete,
  };
}
