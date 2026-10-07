"use client";

import { TimerTab, PomodoroMode } from "../types";

interface SubmodeBarProps {
  currentTab: TimerTab;
  pomoMode: PomodoroMode;
  onSwitchPomoMode: (mode: PomodoroMode) => void;
  clockFullDate: string;
  lapsCount: number;
  isLapsOpen: boolean;
  onToggleLaps: () => void;
}

export function SubmodeBar({
  currentTab,
  pomoMode,
  onSwitchPomoMode,
  clockFullDate,
  lapsCount,
  isLapsOpen,
  onToggleLaps,
}: SubmodeBarProps) {
  return (
    <div className="h-8 flex items-center justify-center mb-2">
      {currentTab === "pomodoro" ? (
        <div className="flex items-center gap-1.5 text-xs font-bold text-white/90 drop-shadow-md">
          <button
            onClick={() => onSwitchPomoMode("focus")}
            className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
              pomoMode === "focus"
                ? "bg-white text-black font-extrabold shadow-sm scale-100"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
          >
            Tập trung
          </button>
          <button
            onClick={() => onSwitchPomoMode("short_break")}
            className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
              pomoMode === "short_break"
                ? "bg-white text-black font-extrabold shadow-sm scale-100"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
          >
            Nghỉ ngắn
          </button>
          <button
            onClick={() => onSwitchPomoMode("long_break")}
            className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
              pomoMode === "long_break"
                ? "bg-white text-black font-extrabold shadow-sm scale-100"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
          >
            Nghỉ dài
          </button>
        </div>
      ) : currentTab === "clock" ? (
        <div className="text-xs sm:text-sm font-semibold text-white/90 tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
          {clockFullDate}
        </div>
      ) : lapsCount > 0 ? (
        <button
          onClick={onToggleLaps}
          className={`px-3 py-0.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            isLapsOpen
              ? "bg-white text-black font-extrabold shadow-sm"
              : "bg-white/20 text-white hover:bg-white/30"
          }`}
        >
          {lapsCount} vòng đã ghi
        </button>
      ) : null}
    </div>
  );
}
