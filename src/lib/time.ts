/**
 * Các hàm chuẩn hóa định dạng thời gian dùng chung
 */

/**
 * Định dạng số giây sang dạng phút:giây (mm:ss hoặc m:ss)
 */
export function formatMinutesSeconds(seconds: number, padMinutes = true): string {
  if (!isFinite(seconds) || isNaN(seconds) || seconds <= 0) {
    return padMinutes ? "00:00" : "0:00";
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const mStr = padMinutes ? mins.toString().padStart(2, "0") : mins.toString();
  const sStr = secs.toString().padStart(2, "0");
  return `${mStr}:${sStr}`;
}

/**
 * Định dạng số giây sang giờ/phút dễ đọc (ví dụ "1h 30p" hoặc "45p")
 */
export function formatDurationHuman(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds <= 0) return "0p";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}p` : `${hours}h`;
  }
  return `${minutes}p`;
}
