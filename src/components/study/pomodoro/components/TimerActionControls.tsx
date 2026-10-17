"use client";

import { memo } from "react";
import {
  PlayIcon,
  PauseIcon,
  ArrowCounterClockwiseIcon,
  SkipForwardIcon,
  FlagIcon,
} from "@phosphor-icons/react";
import { TimerTab } from "../types";

interface TimerActionControlsProps {
  currentTab: TimerTab;
  isPomoRunning: boolean;
  onTogglePomoRunning: () => void;
  onResetPomo: () => void;
  onSkipPomo: () => void;
  isStopwatchRunning: boolean;
  onToggleStopwatch: () => void;
  onResetStopwatch: () => void;
  onAddLap: () => void;
}

export const TimerActionControls = memo(function TimerActionControls({
  currentTab,
  isPomoRunning,
  onTogglePomoRunning,
  onResetPomo,
  onSkipPomo,
  isStopwatchRunning,
  onToggleStopwatch,
  onResetStopwatch,
  onAddLap,
}: TimerActionControlsProps) {
  if (currentTab === "clock") return null;

  return (
    <div className="relative z-40 h-16 flex items-center justify-center gap-4 sm:gap-6 mt-2 select-none pointer-events-auto">
      {currentTab === "pomodoro" ? (
        <>
          {/* Reset Ghost Button (ẩn khi đang chạy — pause trước rồi mới reset) */}
          {!isPomoRunning && (
            <button
              type="button"
              onClick={onResetPomo}
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-all active:scale-90 cursor-pointer drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] group"
              title="Đặt lại từ đầu"
            >
              <ArrowCounterClockwiseIcon className="w-5 h-5 transition-transform duration-200 group-hover:-rotate-45" />
            </button>
          )}

          {/* Focal Hero Play / Pause Button (Không viền, ánh sáng tỏa tự nhiên) */}
          <button
            type="button"
            onClick={onTogglePomoRunning}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white text-slate-950 hover:bg-slate-100 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-[0_0_28px_rgba(255,255,255,0.4),0_8px_25px_rgba(0,0,0,0.5)] cursor-pointer select-none"
            title={isPomoRunning ? "Tạm dừng" : "Bắt đầu tập trung"}
          >
            {isPomoRunning ? (
              <PauseIcon weight="fill" className="w-7 h-7" />
            ) : (
              <PlayIcon weight="fill" className="w-7 h-7" />
            )}
          </button>

          {/* Skip Ghost Button (ẩn khi đang chạy — pause trước rồi mới bỏ qua) */}
          {!isPomoRunning && (
            <button
              type="button"
              onClick={onSkipPomo}
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-all active:scale-90 cursor-pointer drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] group"
              title="Bỏ qua / Hoàn thành phiên"
            >
              <SkipForwardIcon className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          )}
        </>
      ) : currentTab === "stopwatch" ? (
        <>
          {/* Reset Stopwatch Ghost Button */}
          <button
            type="button"
            onClick={onResetStopwatch}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-all active:scale-90 cursor-pointer drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] group"
            title="Đặt lại từ đầu"
          >
            <ArrowCounterClockwiseIcon className="w-5 h-5 transition-transform duration-200 group-hover:-rotate-45" />
          </button>

          {/* Focal Hero Play / Pause Stopwatch */}
          <button
            type="button"
            onClick={onToggleStopwatch}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white text-slate-950 hover:bg-slate-100 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-[0_0_28px_rgba(255,255,255,0.4),0_8px_25px_rgba(0,0,0,0.5)] cursor-pointer select-none"
            title={isStopwatchRunning ? "Tạm dừng" : "Bắt đầu bấm giờ"}
          >
            {isStopwatchRunning ? (
              <PauseIcon weight="fill" className="w-7 h-7" />
            ) : (
              <PlayIcon weight="fill" className="w-7 h-7" />
            )}
          </button>

          {/* Flag / Lap Ghost Button */}
          <button
            type="button"
            onClick={onAddLap}
            disabled={!isStopwatchRunning}
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${
              isStopwatchRunning
                ? "text-slate-300 hover:text-white hover:bg-white/10 active:scale-90 cursor-pointer drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] group"
                : "text-white/20 cursor-not-allowed drop-shadow-none"
            }`}
            title="Ghi vòng (Lap)"
          >
            <FlagIcon className="w-5 h-5" />
          </button>
        </>
      ) : null}
    </div>
  );
});
