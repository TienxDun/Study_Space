"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export function useStopwatchTimer(showMilliseconds = true) {
  const [stopwatchTime, setStopwatchTime] = useState(0); // in milliseconds
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const [isLapsOpen, setIsLapsOpen] = useState(false);

  // Mirror số mili-giây hiện tại vào ref để addLap giữ nguyên identity
  // (không phụ thuộc stopwatchTime đổi 33 lần/giây → không phá memo con).
  const stopwatchTimeRef = useRef(0);
  useEffect(() => {
    stopwatchTimeRef.current = stopwatchTime;
  }, [stopwatchTime]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isStopwatchRunning) {
      const startTime = Date.now() - stopwatchTime;
      // Chỉ tick 30ms khi thật sự hiển thị ms, còn lại 200ms là đủ mượt cho giây.
      interval = setInterval(() => {
        setStopwatchTime(Date.now() - startTime);
      }, showMilliseconds ? 30 : 200);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isStopwatchRunning, showMilliseconds]);

  const toggleStopwatch = useCallback(() => {
    setIsStopwatchRunning((prev) => !prev);
  }, []);

  const resetStopwatch = useCallback(() => {
    setIsStopwatchRunning(false);
    setStopwatchTime(0);
    setLaps([]);
  }, []);

  const addLap = useCallback(() => {
    if (isStopwatchRunning) {
      setLaps((prev) => [stopwatchTimeRef.current, ...prev]);
      setIsLapsOpen(true);
    }
  }, [isStopwatchRunning]);

  const toggleLapsDrawer = useCallback(() => {
    setIsLapsOpen((prev) => !prev);
  }, []);

  const clearLaps = useCallback(() => {
    setLaps([]);
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
