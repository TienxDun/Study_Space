import type { SyncState } from "@/lib/simple-cloud-sync";

/**
 * Suy diễn nội dung hiển thị từ trạng thái đồng bộ (hàm thuần, dễ test).
 */
export interface SyncStatusView {
  label: string;
  title: string;
  tone: "emerald" | "amber" | "sky" | "rose";
  motion: "spin" | "pulse" | null;
}

/** Định dạng mốc thời gian thành HH:MM theo giờ máy. */
export function formatClockTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function getSyncStatusView(opts: {
  status: SyncState;
  lastSyncedAt: number | null;
  savedTime?: string;
}): SyncStatusView {
  const { status, lastSyncedAt, savedTime } = opts;
  const localHint = savedTime
    ? `Đã lưu trên máy lúc ${savedTime}`
    : "Dữ liệu vẫn an toàn trên máy";

  switch (status) {
    case "syncing":
      return {
        label: "Đang lưu...",
        title: "Đang gửi dữ liệu lên Cloudflare D1...",
        tone: "sky",
        motion: "spin",
      };
    case "offline":
      return {
        label: "Đang offline",
        title: `Mất mạng hoặc mạng yếu. ${localHint}, sẽ tự động lưu khi có mạng.`,
        tone: "amber",
        motion: null,
      };
    case "error":
      return {
        label: "Lỗi kết nối",
        title: `Chưa gửi được lên đám mây. ${localHint}. Bấm để thử lại ngay.`,
        tone: "rose",
        motion: null,
      };
    case "synced": {
      const at = lastSyncedAt ? formatClockTime(lastSyncedAt) : "";
      return {
        label: "Đã lưu đám mây",
        title: at
          ? `Đã sao lưu lên Cloudflare D1 lúc ${at}. Bấm để đồng bộ ngay.`
          : "Đã sao lưu lên Cloudflare D1. Bấm để đồng bộ ngay.",
        tone: "emerald",
        motion: null,
      };
    }
    case "idle":
    default:
      return {
        label: "Đã lưu trên máy",
        title: `Dữ liệu đang lưu trên thiết bị này. Đăng nhập để tự động sao lưu.`,
        tone: "emerald",
        motion: null,
      };
  }
}
