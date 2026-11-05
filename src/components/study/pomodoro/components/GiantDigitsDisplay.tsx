"use client";

import { memo } from "react";
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

export const GiantDigitsDisplay = memo(function GiantDigitsDisplay({
  currentTab,
  clockDigits,
  clockPeriod,
  timeLeft,
  stopwatchTime,
  showStopwatchMilliseconds = false,
}: GiantDigitsDisplayProps) {
  // Có giây thì dòng giờ dài hơn hẳn: co cỡ chữ theo bề ngang để không bị cắt
  // trên điện thoại hẹp, còn màn hình lớn vẫn giữ nguyên cỡ cũ.
  const clockHasSeconds = clockDigits.split(":").length > 2;
  const clockSize = clockHasSeconds
    ? "text-[clamp(2.75rem,15vw,4.5rem)] sm:text-8xl md:text-9xl"
    : "text-7xl sm:text-8xl md:text-9xl";

  return (
    <div className="h-28 sm:h-32 md:h-36 flex items-center justify-center my-1">
      {currentTab === "clock" ? (
        // Giữ nguyên khung, chỉ đổi chữ — không đập đi xây lại mỗi giây
        <div
          className={`flex items-baseline justify-center whitespace-nowrap font-black tracking-tight text-white clock-glow sm:drop-shadow-[0_15px_40px_rgba(0,0,0,0.85)] select-none tabular-nums text-center leading-none ${clockSize}`}
        >
          <span>{clockDigits || "00 : 00"}</span>
          {clockPeriod ? (
            <span className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-widest text-white/60 ml-2.5 sm:ml-3.5 self-center sm:self-end pb-1 sm:pb-2">
              {clockPeriod}
            </span>
          ) : null}
        </div>
      ) : currentTab === "pomodoro" ? (
        <div className="text-6xl min-[380px]:text-7xl sm:text-[5rem] font-black tracking-tight text-white clock-glow sm:drop-shadow-[0_15px_40px_rgba(0,0,0,0.85)] select-none tabular-nums text-center leading-none">
          {formatTime(timeLeft)}
        </div>
      ) : (
        <div className="text-6xl sm:text-7xl md:text-8xl font-black tracking-tight text-white clock-glow sm:drop-shadow-[0_15px_40px_rgba(0,0,0,0.85)] select-none tabular-nums text-center leading-none">
          {formatStopwatch(stopwatchTime, showStopwatchMilliseconds)}
        </div>
      )}
    </div>
  );
});
