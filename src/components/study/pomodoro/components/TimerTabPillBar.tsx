"use client";

import { TimerTab } from "../types";

interface TimerTabPillBarProps {
  currentTab: TimerTab;
  onSelectTab: (tab: TimerTab) => void;
}

export function TimerTabPillBar({ currentTab, onSelectTab }: TimerTabPillBarProps) {
  return (
    <div className="flex items-center gap-2.5 mb-2 z-20 transition-all duration-300 opacity-0 -translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0 pointer-events-none group-hover:pointer-events-auto">
      <div className="flex items-center p-1 rounded-full bg-black/80 backdrop-blur-2xl border border-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
        <button
          onClick={() => onSelectTab("clock")}
          className={`w-24 sm:w-28 py-1.5 rounded-full text-xs font-black uppercase tracking-wider text-center transition-all cursor-pointer ${
            currentTab === "clock"
              ? "bg-white text-black shadow-md font-extrabold"
              : "text-white/70 hover:text-white font-bold"
          }`}
        >
          Đồng hồ
        </button>

        <button
          onClick={() => onSelectTab("pomodoro")}
          className={`w-24 sm:w-28 py-1.5 rounded-full text-xs font-black uppercase tracking-wider text-center transition-all cursor-pointer ${
            currentTab === "pomodoro"
              ? "bg-white text-black shadow-md font-extrabold"
              : "text-white/70 hover:text-white font-bold"
          }`}
        >
          Pomodoro
        </button>

        <button
          onClick={() => onSelectTab("stopwatch")}
          className={`w-24 sm:w-28 py-1.5 rounded-full text-xs font-black uppercase tracking-wider text-center transition-all cursor-pointer ${
            currentTab === "stopwatch"
              ? "bg-white text-black shadow-md font-extrabold"
              : "text-white/70 hover:text-white font-bold"
          }`}
        >
          Stopwatch
        </button>
      </div>
    </div>
  );
}
