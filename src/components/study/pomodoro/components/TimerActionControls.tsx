"use client";

import { Play, Pause, RotateCcw, SkipForward, Flag } from "lucide-react";
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

export function TimerActionControls({
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
    <div className="h-16 flex items-center justify-center gap-4 sm:gap-5 mt-2">
      {currentTab === "pomodoro" ? (
        <>
          {/* Reset Circular Button */}
          <button
            onClick={onResetPomo}
            className="w-12 h-12 rounded-full bg-black/80 hover:bg-black text-white/90 hover:text-white backdrop-blur-2xl border border-white/15 flex items-center justify-center transition-all active:scale-90 shadow-[0_8px_25px_rgba(0,0,0,0.5)] cursor-pointer"
            title="Đặt lại từ đầu"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          {/* Big White Circular Play / Pause Button */}
          <button
            onClick={onTogglePomoRunning}
            className="w-16 h-16 rounded-full bg-white text-black hover:bg-slate-100 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-[0_12px_35px_rgba(0,0,0,0.6)] cursor-pointer"
            title={isPomoRunning ? "Tạm dừng" : "Bắt đầu tập trung"}
          >
            {isPomoRunning ? (
              <Pause className="w-7 h-7 fill-current" />
            ) : (
              <Play className="w-7 h-7 fill-current translate-x-0.5" />
            )}
          </button>

          {/* Skip Circular Button */}
          <button
            onClick={onSkipPomo}
            className="w-12 h-12 rounded-full bg-black/80 hover:bg-black text-white/90 hover:text-white backdrop-blur-2xl border border-white/15 flex items-center justify-center transition-all active:scale-90 shadow-[0_8px_25px_rgba(0,0,0,0.5)] cursor-pointer"
            title="Bỏ qua / Hoàn thành phiên"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </>
      ) : currentTab === "stopwatch" ? (
        <>
          {/* Reset Stopwatch */}
          <button
            onClick={onResetStopwatch}
            className="w-12 h-12 rounded-full bg-black/80 hover:bg-black text-white/90 hover:text-white backdrop-blur-2xl border border-white/15 flex items-center justify-center transition-all active:scale-90 shadow-[0_8px_25px_rgba(0,0,0,0.5)] cursor-pointer"
            title="Đặt lại từ đầu"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          {/* Big White Play / Pause Stopwatch */}
          <button
            onClick={onToggleStopwatch}
            className="w-16 h-16 rounded-full bg-white text-black hover:bg-slate-100 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-[0_12px_35px_rgba(0,0,0,0.6)] cursor-pointer"
            title={isStopwatchRunning ? "Tạm dừng" : "Bắt đầu bấm giờ"}
          >
            {isStopwatchRunning ? (
              <Pause className="w-7 h-7 fill-current" />
            ) : (
              <Play className="w-7 h-7 fill-current translate-x-0.5" />
            )}
          </button>

          {/* Flag / Lap Button */}
          <button
            onClick={onAddLap}
            disabled={!isStopwatchRunning}
            className={`w-12 h-12 rounded-full backdrop-blur-2xl border flex items-center justify-center transition-all active:scale-90 shadow-[0_8px_25px_rgba(0,0,0,0.5)] cursor-pointer ${
              isStopwatchRunning
                ? "bg-black/80 hover:bg-black border-white/15 text-white"
                : "bg-black/40 border-white/5 text-white/30 cursor-not-allowed"
            }`}
            title="Ghi vòng (Lap)"
          >
            <Flag className="w-5 h-5" />
          </button>
        </>
      ) : null}
    </div>
  );
}
