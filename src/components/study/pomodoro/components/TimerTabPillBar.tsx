"use client";

import { TimerTab } from "../types";

interface TimerTabPillBarProps {
  currentTab: TimerTab;
  onSelectTab: (tab: TimerTab) => void;
}

export function TimerTabPillBar({ currentTab, onSelectTab }: TimerTabPillBarProps) {
  return (
    <div className="flex items-center gap-2.5 mb-2 z-20 transition-all duration-300 opacity-0 -translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0 pointer-events-none group-hover:pointer-events-auto">
      <div className="flex items-center gap-1.5 p-1 rounded-full drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
        <button
          onClick={() => onSelectTab("clock")}
          className={`w-24 sm:w-28 py-1.5 rounded-full text-xs font-black uppercase tracking-wider text-center transition-all cursor-pointer active:scale-95 ${
            currentTab === "clock"
              ? "bg-white text-slate-950 font-black shadow-[0_0_20px_rgba(255,255,255,0.35)]"
              : "text-white/80 hover:text-white hover:bg-white/10 font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
          }`}
        >
          Đồng hồ
        </button>

        <button
          onClick={() => onSelectTab("pomodoro")}
          className={`w-24 sm:w-28 py-1.5 rounded-full text-xs font-black uppercase tracking-wider text-center transition-all cursor-pointer active:scale-95 ${
            currentTab === "pomodoro"
              ? "bg-white text-slate-950 font-black shadow-[0_0_20px_rgba(255,255,255,0.35)]"
              : "text-white/80 hover:text-white hover:bg-white/10 font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
          }`}
        >
          Pomodoro
        </button>

        <button
          onClick={() => onSelectTab("stopwatch")}
          className={`w-24 sm:w-28 py-1.5 rounded-full text-xs font-black uppercase tracking-wider text-center transition-all cursor-pointer active:scale-95 ${
            currentTab === "stopwatch"
              ? "bg-white text-slate-950 font-black shadow-[0_0_20px_rgba(255,255,255,0.35)]"
              : "text-white/80 hover:text-white hover:bg-white/10 font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
          }`}
        >
          Stopwatch
        </button>
      </div>
    </div>
  );
}
