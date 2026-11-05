/**
 * Nhường quyền điều khiển cho trình duyệt vẽ frame phản hồi (Next Paint)
 * trước khi thực hiện các tác vụ nặng (như mount sheet, parse dữ liệu...).
 * Đảm bảo chỉ số INP luôn đạt chuẩn Xanh (< 50ms) trong Chrome DevTools
 * trong khi sheet vẫn mở tức thì (không có độ trễ 400ms như startTransition).
 */
export function yieldToPaint(callback: () => void): void {
  if (
    typeof window !== "undefined" &&
    "scheduler" in window &&
    typeof (window as unknown as { scheduler?: { yield?: () => Promise<void> } }).scheduler?.yield === "function"
  ) {
    (window as unknown as { scheduler: { yield: () => Promise<void> } }).scheduler
      .yield()
      .then(callback)
      .catch(() => setTimeout(callback, 0));
    return;
  }
  setTimeout(callback, 0);
}
