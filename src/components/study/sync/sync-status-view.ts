import type { CloudSyncStatus } from "@/lib/cloud-sync";

/**
 * Suy diễn nội dung hiển thị từ trạng thái đồng bộ (hàm thuần, dễ test).
 * Tách khỏi component để nhãn/tooltip không bị fix cứng rải rác.
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
  status: CloudSyncStatus;
  lastSyncedAt: number | null;
  /** Giờ lưu local gần nhất (chỉ để nhắc trong tooltip khi dữ liệu còn nằm máy). */
  savedTime?: string;
}): SyncStatusView {
  const { status, lastSyncedAt, savedTime } = opts;
  const localHint = savedTime ? `Đã lưu trên máy lúc ${savedTime}` : "Dữ liệu vẫn lưu trên thiết bị này";

  switch (status) {
    case "pending":
      return {
        label: "Chờ đồng bộ",
        title: "Có thay đổi chưa gửi lên mây, đang chờ đồng bộ",
        tone: "amber",
        motion: "pulse",
      };
    case "syncing":
      return {
        label: "Đang đồng bộ",
        title: "Đang gửi dữ liệu lên mây...",
        tone: "sky",
        motion: "spin",
      };
    case "error":
      return {
        label: "Chưa đồng bộ",
        title: `Chưa gửi được lên mây, sẽ tự thử lại. ${localHint}.`,
        tone: "rose",
        motion: null,
      };
    case "synced": {
      const at = lastSyncedAt ? formatClockTime(lastSyncedAt) : "";
      return {
        label: "Đã đồng bộ",
        title: at ? `Đã đồng bộ lên mây lúc ${at}` : "Đã đồng bộ lên mây",
        tone: "emerald",
        motion: null,
      };
    }
    case "local":
    default:
      return {
        label: "Đã lưu",
        title: `Chỉ lưu trên thiết bị này. ${localHint}.`,
        tone: "emerald",
        motion: null,
      };
  }
}
