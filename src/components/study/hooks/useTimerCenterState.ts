"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { TimerTab } from "@/components/study/pomodoro/types";
import { STORAGE_KEYS } from "@/lib/storage-keys";

interface UseTimerCenterStateOptions {
  isMobile: boolean;
  onCloseMobileSheets?: () => void;
  onCloseTasks?: () => void;
  onPomodoroNavActiveChange?: (active: boolean) => void;
}

export function useTimerCenterState({
  isMobile,
  onCloseMobileSheets,
  onCloseTasks,
  onPomodoroNavActiveChange,
}: UseTimerCenterStateOptions) {
  const [isPomodoroVisible, setIsPomodoroVisible] = useState(false);
  const [centerTab, setCenterTab] = useState<TimerTab>("pomodoro");
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Ref lưu các callbacks để không làm re-create các hàm toggle khi render
  const callbacksRef = useRef({
    onCloseMobileSheets,
    onCloseTasks,
    onPomodoroNavActiveChange,
  });

  useEffect(() => {
    callbacksRef.current = {
      onCloseMobileSheets,
      onCloseTasks,
      onPomodoroNavActiveChange,
    };
  });

  // Khôi phục hiển thị Pomodoro từ LocalStorage
  useEffect(() => {
    try {
      const savedPomoVis = localStorage.getItem(STORAGE_KEYS.pomoVisible);
      if (savedPomoVis !== null) {
        setIsPomodoroVisible(savedPomoVis === "true");
      }
    } catch {}
  }, []);

  // Lắng nghe sự kiện Bắt đầu tập trung vào Task
  useEffect(() => {
    const handleStartFocus = () => {
      setIsPomodoroVisible(true);
      setCenterTab("pomodoro");
      if (isMobile) {
        callbacksRef.current.onCloseMobileSheets?.();
      } else {
        callbacksRef.current.onCloseTasks?.();
      }
    };

    window.addEventListener("study_space_start_focus", handleStartFocus);
    return () => {
      window.removeEventListener("study_space_start_focus", handleStartFocus);
    };
  }, [isMobile]);

  // Lắng nghe sự kiện mở Pomodoro
  useEffect(() => {
    const handleOpenPomodoro = () => {
      setIsPomodoroVisible(true);
      setCenterTab("pomodoro");
      if (isMobile) {
        callbacksRef.current.onCloseMobileSheets?.();
      }
    };

    window.addEventListener("study_space_open_pomodoro", handleOpenPomodoro);
    return () => {
      window.removeEventListener("study_space_open_pomodoro", handleOpenPomodoro);
    };
  }, [isMobile]);

  const handleToggleClock = useCallback(() => {
    if (isPomodoroVisible && centerTab === "clock") {
      setIsPomodoroVisible(false);
    } else {
      setIsPomodoroVisible(true);
      setCenterTab("clock");
    }
  }, [isPomodoroVisible, centerTab]);

  const handleTogglePomodoroVisibility = useCallback(() => {
    setIsPomodoroVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.pomoVisible, String(next));
      } catch {}
      callbacksRef.current.onPomodoroNavActiveChange?.(next);
      return next;
    });
  }, []);

  const handleWidgetToggleVisibility = useCallback(() => {
    setIsPomodoroVisible((prev) => !prev);
  }, []);

  return useMemo(
    () => ({
      isPomodoroVisible,
      setIsPomodoroVisible,
      centerTab,
      setCenterTab,
      isTimerRunning,
      setIsTimerRunning,
      handleToggleClock,
      handleTogglePomodoroVisibility,
      handleWidgetToggleVisibility,
    }),
    [
      isPomodoroVisible,
      centerTab,
      isTimerRunning,
      handleToggleClock,
      handleTogglePomodoroVisibility,
      handleWidgetToggleVisibility,
    ]
  );
}
