"use client";

import { useEffect, useState, useRef } from "react";
import { UsersIcon, TimerIcon } from "@phosphor-icons/react";

interface RoomSessionTimerProps {
  sessionMaxMinutes?: number;
  onExpire: () => void;
  compact?: boolean;
  participantsCount?: number;
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
  participantsCount,
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
        className="inline-flex items-center gap-2 text-[11px] tabular-nums shrink-0 select-none"
        title={
          typeof participantsCount === "number"
            ? `${participantsCount} người trong phòng • Đã học ${formatElapsed(elapsedSec)} • Hạn phiên còn ${formatSessionCountdown(remainingSec)}`
            : `Đã học ${formatElapsed(elapsedSec)} • Hạn phiên còn ${formatSessionCountdown(remainingSec)}`
        }
      >
        {/* Số người trong phòng */}
        {typeof participantsCount === "number" && (
          <>
            <div className="flex items-center gap-1.5 text-slate-300">
              <UsersIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" weight="bold" />
              <span className="font-semibold">{participantsCount}</span>
            </div>
            <div className="h-3 w-px bg-white/15 shrink-0" />
          </>
        )}

        {/* Thời gian đã học */}
        <div className="flex items-center gap-1.5 text-emerald-300">
          <TimerIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" weight="bold" />
          <span className="font-semibold font-mono tracking-tight">
            {formatElapsed(elapsedSec)}
          </span>
        </div>

        {/* Cảnh báo khi phòng sắp hết hạn (<= 5 phút) */}
        {(isWarning || isUrgent) && (
          <>
            <span className="text-white/20">•</span>
            <span
              className={`font-semibold font-mono ${
                isUrgent ? "text-rose-400 animate-pulse" : "text-amber-300"
              }`}
            >
              còn {formatSessionCountdown(remainingSec)}
            </span>
          </>
        )}
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
