"use client";

import { useState, useEffect } from "react";

interface UseRealtimeClockOptions {
  showClockSeconds: boolean;
  isClock12Hour: boolean;
}

export function useRealtimeClock({
  showClockSeconds,
  isClock12Hour,
}: UseRealtimeClockOptions) {
  const [clockDigits, setClockDigits] = useState("");
  const [clockPeriod, setClockPeriod] = useState("");
  const [clockFullDate, setClockFullDate] = useState("");

  useEffect(() => {
    const updateRealtime = () => {
      const now = new Date();
      const hours24 = now.getHours();
      let hours = hours24;
      let period = "";

      if (isClock12Hour) {
        period = hours24 >= 12 ? "PM" : "AM";
        hours = hours24 % 12;
        if (hours === 0) hours = 12;
      }

      const hStr = String(hours).padStart(2, "0");
      const mStr = String(now.getMinutes()).padStart(2, "0");
      const sStr = String(now.getSeconds()).padStart(2, "0");

      setClockDigits(showClockSeconds ? `${hStr} : ${mStr} : ${sStr}` : `${hStr} : ${mStr}`);
      setClockPeriod(period);

      const weekdays = [
        "Chủ Nhật",
        "Thứ Hai",
        "Thứ Ba",
        "Thứ Tư",
        "Thứ Năm",
        "Thứ Sáu",
        "Thứ Bảy",
      ];
      const dayName = weekdays[now.getDay()];
      const dateNum = String(now.getDate()).padStart(2, "0");
      const monthNum = String(now.getMonth() + 1).padStart(2, "0");
      const yearNum = now.getFullYear();
      setClockFullDate(`${dayName}, ${dateNum} tháng ${monthNum}, ${yearNum}`);
    };

    updateRealtime();
    const interval = setInterval(updateRealtime, showClockSeconds ? 1000 : 10000);
    return () => clearInterval(interval);
  }, [showClockSeconds, isClock12Hour]);

  return {
    clockDigits,
    clockPeriod,
    clockFullDate,
  };
}
