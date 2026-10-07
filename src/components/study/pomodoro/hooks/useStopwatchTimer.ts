"use client";

import { useState, useEffect, useCallback } from "react";

export function useStopwatchTimer() {
  const [stopwatchTime, setStopwatchTime] = useState(0); // in milliseconds
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const [isLapsOpen, setIsLapsOpen] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isStopwatchRunning) {
      const startTime = Date.now() - stopwatchTime;
      interval = setInterval(() => {
        setStopwatchTime(Date.now() - startTime);
      }, 30); // ~33fps for smooth centiseconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isStopwatchRunning]);

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
      setLaps((prev) => [stopwatchTime, ...prev]);
      setIsLapsOpen(true);
    }
  }, [isStopwatchRunning, stopwatchTime]);

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
