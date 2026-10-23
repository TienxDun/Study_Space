import { PomodoroMode } from "../types";

/**
 * Định dạng thời gian Pomodoro mm : ss
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00 : 00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")} : ${secs.toString().padStart(2, "0")}`;
}

/**
 * Định dạng đồng hồ bấm giờ Stopwatch mm : ss.cs hoặc hh : mm : ss
 */
export function formatStopwatch(ms: number, showMs: boolean = true): string {
  if (isNaN(ms) || ms < 0) return showMs ? "00 : 00.00" : "00 : 00";
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);

  const m = minutes.toString().padStart(2, "0");
  const s = seconds.toString().padStart(2, "0");
  const cs = centiseconds.toString().padStart(2, "0");

  if (hours > 0) {
    return showMs ? `${hours}:${m}:${s}.${cs}` : `${hours}:${m}:${s}`;
  }
  return showMs ? `${m} : ${s}.${cs}` : `${m} : ${s}`;
}

/**
 * Xác định loại giờ nghỉ tiếp theo (nghỉ dài sau mỗi 4 hiệp hoàn thành)
 */
export function getNextBreakType(completedCount: number): PomodoroMode {
  return completedCount % 4 === 0 ? "long_break" : "short_break";
}

/**
 * Số giây focus MỚI phát sinh trong đoạn chạy hiện tại.
 * planned - timeLeft = tổng giây đã chạy; trừ đi phần đã flush trước đó
 * (pause/resume nhiều lần trong 1 phiên không đếm trùng).
 */
export function computeSpanDelta(
  plannedSeconds: number,
  timeLeftSeconds: number,
  flushedSeconds: number
): number {
  if (
    !isFinite(plannedSeconds) ||
    !isFinite(timeLeftSeconds) ||
    !isFinite(flushedSeconds)
  ) {
    return 0;
  }
  return Math.max(
    0,
    Math.floor(plannedSeconds - timeLeftSeconds - flushedSeconds)
  );
}

