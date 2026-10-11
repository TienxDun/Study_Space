"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FocusSummary,
  EVENT_FOCUS_SESSION_LOGGED,
  focusSessionStore,
  getFocusSummary,
  getMonthSummary,
  getTodaySummary,
  getWeekSummary,
} from "@/lib/focus-sessions";

export type FocusStatsPeriod = "today" | "week" | "month" | "all";

const EMPTY: FocusSummary = { totalSeconds: 0, sessions: 0, byTask: [] };

/** Đọc tổng hợp focus theo kỳ, tự refresh khi có phiên mới/cross-tab/quay lại tab. */
export function useFocusStats(period: FocusStatsPeriod = "today"): FocusSummary {
  const compute = useCallback((): FocusSummary => {
    const sessions = focusSessionStore.list();
    if (period === "week") return getWeekSummary(sessions);
    if (period === "month") return getMonthSummary(sessions);
    if (period === "all")
      return getFocusSummary(sessions, 0, Number.MAX_SAFE_INTEGER);
    return getTodaySummary(sessions);
  }, [period]);

  const [summary, setSummary] = useState<FocusSummary>(EMPTY);

  useEffect(() => {
    const refresh = () => setSummary(compute());
    refresh();
    window.addEventListener(EVENT_FOCUS_SESSION_LOGGED, refresh);
    window.addEventListener("storage", refresh);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(EVENT_FOCUS_SESSION_LOGGED, refresh);
      window.removeEventListener("storage", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [compute]);

  return summary;
}
