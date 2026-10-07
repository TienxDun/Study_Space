"use client";

import { motion } from "framer-motion";
import { TimerTab } from "../types";
import { formatTime, formatStopwatch } from "../utils/timer-formatters";

interface GiantDigitsDisplayProps {
  currentTab: TimerTab;
  clockDigits: string;
  clockPeriod: string;
  timeLeft: number;
  stopwatchTime: number;
  showStopwatchMilliseconds?: boolean;
}

export function GiantDigitsDisplay({
  currentTab,
  clockDigits,
  clockPeriod,
  timeLeft,
  stopwatchTime,
  showStopwatchMilliseconds = false,
}: GiantDigitsDisplayProps) {
  return (
    <div className="h-28 sm:h-32 md:h-36 flex items-center justify-center my-1">
      {currentTab === "clock" ? (
        <motion.div
          key={`${clockDigits}-${clockPeriod}`}
          initial={{ opacity: 0.9 }}
          animate={{ opacity: 1 }}
          className="flex items-baseline justify-center whitespace-nowrap text-7xl sm:text-8xl md:text-9xl font-black tracking-tight text-white drop-shadow-[0_15px_40px_rgba(0,0,0,0.85)] select-none tabular-nums text-center leading-none"
        >
          <span>{clockDigits || "00 : 00"}</span>
          {clockPeriod ? (
            <span className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-widest text-white/60 ml-2.5 sm:ml-3.5 self-center sm:self-end pb-1 sm:pb-2">
              {clockPeriod}
            </span>
          ) : null}
        </motion.div>
      ) : currentTab === "pomodoro" ? (
        <motion.div
          key={timeLeft}
          initial={{ opacity: 0.95 }}
          animate={{ opacity: 1 }}
          className="text-7xl sm:text-8xl md:text-9xl font-black tracking-tight text-white drop-shadow-[0_15px_40px_rgba(0,0,0,0.85)] select-none tabular-nums text-center leading-none"
        >
          {formatTime(timeLeft)}
        </motion.div>
      ) : (
        <div className="text-6xl sm:text-7xl md:text-8xl font-black tracking-tight text-white drop-shadow-[0_15px_40px_rgba(0,0,0,0.85)] select-none tabular-nums text-center leading-none">
          {formatStopwatch(stopwatchTime, showStopwatchMilliseconds)}
        </div>
      )}
    </div>
  );
}
