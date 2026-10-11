"use client";

import { formatFocusDuration } from "@/lib/focus-sessions";
import { useFocusStats } from "@/lib/use-focus-stats";

/** Dòng thống kê gọn dưới đồng hồ Pomodoro: hôm nay + tuần này tập trung bao lâu. */
export function FocusStatsLine() {
  const today = useFocusStats("today");
  const week = useFocusStats("week");

  return (
    <div
      className="mt-1 text-xs leading-relaxed text-slate-300 select-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
      title={`Hôm nay: ${formatFocusDuration(today.totalSeconds)} • Tuần này: ${formatFocusDuration(week.totalSeconds)}`}
    >
      Hôm nay{" "}
      <span className="font-semibold text-white">
        {formatFocusDuration(today.totalSeconds)}
      </span>
      <span className="mx-1 text-slate-500">•</span>
      Tuần này{" "}
      <span className="font-semibold text-white">
        {formatFocusDuration(week.totalSeconds)}
      </span>
    </div>
  );
}
