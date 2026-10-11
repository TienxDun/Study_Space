"use client";

import { useState, useEffect, useCallback } from "react";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { KanbanBoard } from "@/components/study/study-types";
import {
  PomodoroSessionResult,
  FocusSpanInfo,
} from "@/components/study/pomodoro/types";
import {
  logFocusSession,
  focusSessionStore,
  getTodaySummary,
  formatFocusDuration,
} from "@/lib/focus-sessions";
import { toast } from "sonner";

export interface ActiveFocusTask {
  id: string;
  title: string;
}

/** Task gán cho thời gian focus không gắn task cụ thể (vẫn tính vào ngày/tuần). */
export const UNGROUPED_FOCUS_TASK: ActiveFocusTask = {
  id: "__ungrouped__",
  title: "Tập trung tự do",
};

export const EVENT_START_FOCUS = "study_space_start_focus";
export const EVENT_CLEAR_FOCUS = "study_space_clear_focus";
export const EVENT_POMO_COMPLETED = "study_space_pomo_completed";

export function getStoredFocusTask(): ActiveFocusTask | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.activeFocusTask);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function startFocusTask(task: ActiveFocusTask) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.activeFocusTask, JSON.stringify(task));
    window.dispatchEvent(new CustomEvent(EVENT_START_FOCUS, { detail: task }));
  } catch {}
}

export function clearFocusTask() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEYS.activeFocusTask);
    window.dispatchEvent(new CustomEvent(EVENT_CLEAR_FOCUS));
  } catch {}
}

/** Tăng +1 số phiên Pomodoro cho một task trong Kanban Boards LocalStorage */
export function incrementTaskPomodoroInStorage(
  taskId: string,
  session?: PomodoroSessionResult
): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.kanbanBoards);
    if (!raw) return 0;
    const boards: KanbanBoard[] = JSON.parse(raw);
    let newCount = 0;
    const updated = boards.map((b) => ({
      ...b,
      cards: b.cards.map((c) => {
        if (c.id === taskId) {
          newCount = (c.pomodoros || 0) + 1;
          return { ...c, pomodoros: newCount };
        }
        return c;
      }),
    }));
    localStorage.setItem(STORAGE_KEYS.kanbanBoards, JSON.stringify(updated));
    window.dispatchEvent(
      new CustomEvent(EVENT_POMO_COMPLETED, {
        detail: {
          taskId,
          newCount,
          focusSeconds: session?.focusSeconds ?? 0,
          startedAt: session?.startedAt ?? Date.now(),
        },
      })
    );
    return newCount;
  } catch {
    return 0;
  }
}

/** Hook quản lý Focus Task đồng bộ toàn app */
export function useFocusTask() {
  const [focusTask, setFocusTask] = useState<ActiveFocusTask | null>(null);

  useEffect(() => {
    setFocusTask(getStoredFocusTask());

    const handleStart = (e: Event) => {
      const custom = e as CustomEvent<ActiveFocusTask>;
      if (custom.detail) {
        setFocusTask(custom.detail);
      }
    };

    const handleClear = () => {
      setFocusTask(null);
    };

    window.addEventListener(EVENT_START_FOCUS, handleStart);
    window.addEventListener(EVENT_CLEAR_FOCUS, handleClear);

    return () => {
      window.removeEventListener(EVENT_START_FOCUS, handleStart);
      window.removeEventListener(EVENT_CLEAR_FOCUS, handleClear);
    };
  }, []);

  const handleStartFocus = useCallback((task: ActiveFocusTask) => {
    startFocusTask(task);
    toast.success(`Bắt đầu tập trung vào: “${task.title}”`, {
      description: "Đồng hồ Pomodoro đã được gán mục tiêu này.",
    });
  }, []);

  const handleClearFocus = useCallback(() => {
    clearFocusTask();
    toast.info("Đã hủy liên kết nhiệm vụ với Pomodoro");
  }, []);

  const handleCompleteSession = useCallback(
    (task: ActiveFocusTask, session?: PomodoroSessionResult) => {
      // Thời gian đã được ghi dần qua từng span (logFocusTime) nên ở đây
      // chỉ +1 đếm phiên và toast — không ghi trùng.
      const count = incrementTaskPomodoroInStorage(task.id, session);
      const today = getTodaySummary(focusSessionStore.list());
      toast.success("Hoàn thành phiên Pomodoro!", {
        description: `“${task.title}” • Phiên này ${formatFocusDuration(
          session?.focusSeconds ?? 0
        )} • Hôm nay ${formatFocusDuration(today.totalSeconds)} (${count} phiên task này).`,
      });
    },
    []
  );

  /**
   * Ghi thầm lặng 1 đoạn focus (pause/skip/reset/hết giờ/tắt tab đều gọi).
   * Không toast để khỏi spam — số liệu tự hiện ở dòng thống kê + toast
   * tổng khi hết phiên.
   */
  const handleLogFocusTime = useCallback(
    (task: ActiveFocusTask | null, span: FocusSpanInfo) => {
      if (!span || span.seconds < 1) return;
      const target = task ?? UNGROUPED_FOCUS_TASK;
      logFocusSession({
        taskId: target.id,
        taskTitle: target.title,
        startedAt: span.startedAt,
        endedAt: span.endedAt,
        focusSeconds: span.seconds,
        plannedSeconds: span.plannedSeconds,
      });
    },
    []
  );

  return {
    focusTask,
    startFocus: handleStartFocus,
    clearFocus: handleClearFocus,
    completeSession: handleCompleteSession,
    logFocusTime: handleLogFocusTime,
  };
}
