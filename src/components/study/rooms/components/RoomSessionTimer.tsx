"use client";

import { useEffect, useState, useRef } from "react";

interface RoomSessionTimerProps {
  sessionMaxMinutes?: number;
  onExpire: () => void;
  compact?: boolean;
}

export function formatSessionCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Đồng hồ phiên học nhóm (tính theo Date.now() từ lúc kết nối):
 * - Hiển thị thời gian đã học: "Đã học 12:34"
 * - Hiển thị hạn mức phiên 120 phút: "Hạn phiên: 107:26"
 * Tách riêng thành component để state re-render mỗi giây không làm vẽ lại toàn bộ lưới video LiveKit.
 */
export function RoomSessionTimer({
  sessionMaxMinutes = 120,
  onExpire,
  compact = false,
}: RoomSessionTimerProps) {
  // Mốc thời gian vào phòng (epoch ms), cố định trong suốt phiên kết nối
  const [joinedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const hasExpiredRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const totalAllowedSec = Math.max(1, sessionMaxMinutes) * 60;
  const elapsedSec = Math.max(0, Math.floor((now - joinedAt) / 1000));
  const remainingSec = Math.max(0, totalAllowedSec - elapsedSec);

  // Hết giờ thì ngắt kết nối đúng một lần duy nhất
  useEffect(() => {
    if (remainingSec <= 0 && !hasExpiredRef.current) {
      hasExpiredRef.current = true;
      onExpire();
    }
  }, [remainingSec, onExpire]);

  const isUrgent = remainingSec <= 60;
  const isWarning = remainingSec <= 300;

  if (compact) {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/10 text-[10px] tabular-nums shrink-0 shadow-sm"
        title={`Đã học ${formatElapsed(elapsedSec)} • Hạn phiên còn ${formatSessionCountdown(remainingSec)}`}
      >
        <span className="font-semibold text-emerald-300">
          {formatElapsed(elapsedSec)}
        </span>
        <span className="text-white/20">•</span>
        <span
          className={`font-medium ${
            isUrgent
              ? "text-rose-300 font-bold animate-pulse"
              : isWarning
              ? "text-amber-300 font-semibold"
              : "text-slate-300"
          }`}
        >
          {formatSessionCountdown(remainingSec)}
        </span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 shrink-0">
      {/* Thời lượng đã học */}
      <span
        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-400/25 tabular-nums"
        title="Thời lượng bạn đã học trong phiên này"
      >
        {compact ? "Học " : "Đã học "}
        {formatElapsed(elapsedSec)}
      </span>

      {/* Đếm ngược hạn mức 120 phút */}
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border tabular-nums transition-colors ${
          isUrgent
            ? "bg-rose-500/20 text-rose-300 border-rose-400/30 animate-pulse"
            : isWarning
            ? "bg-amber-500/20 text-amber-300 border-amber-400/30"
            : "bg-white/10 text-slate-300 border-white/15"
        }`}
        title={`Phiên tối đa ${sessionMaxMinutes} phút`}
      >
        {compact ? "" : "Hạn phiên: "}
        {formatSessionCountdown(remainingSec)}
      </span>
    </div>
  );
}
