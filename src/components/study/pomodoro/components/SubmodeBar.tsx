"use client";

import { TimerTab, PomodoroMode } from "../types";

interface SubmodeBarProps {
  currentTab: TimerTab;
  pomoMode: PomodoroMode;
  clockFullDate: string;
  lapsCount: number;
  isLapsOpen: boolean;
  onToggleLaps: () => void;
  /** true khi đồng hồ focus đang chạy — chấm trạng thái nhịp theo. */
  isRunning?: boolean;
}

const MODE_STATUS: Record<PomodoroMode, { label: string; dot: string; text: string }> = {
  focus: {
    label: "Đang tập trung",
    dot: "bg-emerald-400",
    text: "text-emerald-300",
  },
  short_break: {
    label: "Nghỉ ngắn",
    dot: "bg-sky-400",
    text: "text-sky-300",
  },
  long_break: {
    label: "Nghỉ dài",
    dot: "bg-violet-400",
    text: "text-violet-300",
  },
};

export function SubmodeBar({
  currentTab,
  pomoMode,
  clockFullDate,
  lapsCount,
  isLapsOpen,
  onToggleLaps,
  isRunning = false,
}: SubmodeBarProps) {
  // Tab pomodoro chỉ hiển thị 1 trạng thái hiện tại (chuyển phase tự động
  // khi hết giờ, muốn qua nhanh thì pause rồi bấm Bỏ qua).
  const status = MODE_STATUS[pomoMode];
  return (
    <div className="h-8 flex items-center justify-center mb-2">
      {currentTab === "pomodoro" ? (
        <p
          role="status"
          className="flex items-center gap-2 text-sm font-bold drop-shadow-md h-8"
        >
          <span
            aria-hidden="true"
            className={`w-1.5 h-1.5 rounded-full ${status.dot} ${
              isRunning && pomoMode === "focus" ? "animate-pulse" : ""
            }`}
          />
          <span className={status.text}>{status.label}</span>
        </p>
      ) : currentTab === "clock" ? (
        <div className="text-xs sm:text-sm font-semibold text-white/90 tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
          {clockFullDate}
        </div>
      ) : lapsCount > 0 ? (
        <button
          onClick={onToggleLaps}
          className={`px-3 py-0.5 rounded-full text-xs font-bold transition-all cursor-pointer border backdrop-blur-md shadow-[0_2px_12px_rgba(0,0,0,0.6)] ${
            isLapsOpen
              ? "bg-white text-black border-white font-extrabold shadow-sm"
              : "bg-black/40 text-white border-white/25 hover:bg-black/55 hover:border-white/40"
          }`}
        >
          {lapsCount} vòng đã ghi
        </button>
      ) : null}
    </div>
  );
}
