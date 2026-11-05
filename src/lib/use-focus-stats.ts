"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

/**
 * Dấu vân tắt nội dung thống kê. getFocusSummary luôn trả object mới, nên nếu
 * so theo danh tính thì mỗi lần refresh (kể cả khi dữ liệu y hệt) đều kéo theo
 * một commit thừa. So chuỗi này thay cho việc đó.
 */
function summarySignature(s: FocusSummary): string {
  return `${s.totalSeconds}|${s.sessions}|${s.byTask.map((t) => `${t.taskId}:${t.focusSeconds}`).join(",")}`;
}

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
  const signatureRef = useRef(summarySignature(EMPTY));

  useEffect(() => {
    const refresh = () => {
      const next = compute();
      const sig = summarySignature(next);
      if (sig === signatureRef.current) return;
      signatureRef.current = sig;
      setSummary(next);
    };
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

/**
 * Đọc 1 lần cả "hôm nay" + "tuần này" trong CÙNG một subscription.
 * Dùng cho dòng thống kê dưới đồng hồ Pomodoro để tránh 2 listener/cửa sổ
 * tính toán song song mỗi lần có phiên mới.
 */
export function useFocusStatsPair(): { today: FocusSummary; week: FocusSummary } {
  const [pair, setPair] = useState<{ today: FocusSummary; week: FocusSummary }>({
    today: EMPTY,
    week: EMPTY,
  });
  const signatureRef = useRef(
    `${summarySignature(EMPTY)}#${summarySignature(EMPTY)}`
  );

  useEffect(() => {
    const refresh = () => {
      const sessions = focusSessionStore.list();
      const next = { today: getTodaySummary(sessions), week: getWeekSummary(sessions) };
      const sig = `${summarySignature(next.today)}#${summarySignature(next.week)}`;
      if (sig === signatureRef.current) return;
      signatureRef.current = sig;
      setPair(next);
    };
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
  }, []);

  return pair;
}
