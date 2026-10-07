/**
 * Chuyển đổi thời gian từ giây sang định dạng mm:ss
 * @param timeInSeconds Thời gian tính bằng giây
 * @returns Chuỗi định dạng "m:ss" hoặc "0:00" nếu không hợp lệ
 */
export function formatTime(timeInSeconds: number): string {
  if (!isFinite(timeInSeconds) || isNaN(timeInSeconds) || timeInSeconds <= 0) {
    return "0:00";
  }
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

/**
 * Tính toán âm lượng an toàn trong khoảng [0, 1]
 */
export function clampVolume(value: number): number {
  if (isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

/**
 * Chọn index bài hát tiếp theo, hỗ trợ xáo trộn ngẫu nhiên (Shuffle)
 */
export function getNextTrackIndex(
  currentIndex: number,
  totalTracks: number,
  isShuffle: boolean,
  randomFn: () => number = Math.random
): number {
  if (totalTracks <= 1) return 0;
  if (isShuffle) {
    let nextIdx = Math.floor(randomFn() * totalTracks);
    // Nếu có nhiều hơn 1 bài và random ra bài hiện tại, thử lại 1 lần để tránh phát lặp ngay
    if (nextIdx === currentIndex) {
      nextIdx = (nextIdx + 1) % totalTracks;
    }
    return nextIdx;
  }
  return (currentIndex + 1) % totalTracks;
}

/**
 * Chọn index bài hát trước đó
 */
export function getPrevTrackIndex(currentIndex: number, totalTracks: number): number {
  if (totalTracks <= 1) return 0;
  return (currentIndex - 1 + totalTracks) % totalTracks;
}
