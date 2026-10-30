// Chặn người dùng và báo cáo hành vi trong phòng học (P0.5 Phase 4).
// Một đầu ghi dữ liệu: data-api, dùng Firebase ID token như mọi API khác.

const API_URL = (
  process.env.NEXT_PUBLIC_DATA_API_URL || "https://data-api.leutiendung-hht.workers.dev"
).replace(/\/+$/, "");

export interface BlockedUser {
  uid: string;
  name: string;
  createdAt: number;
}

export type RoomReportReason =
  | "harassment"
  | "inappropriate"
  | "recording"
  | "spam"
  | "other";

// Mã lý do phải khớp REPORT_REASONS.room trong workers/data-api/worker.js.
export const ROOM_REPORT_REASONS: ReadonlyArray<{ value: RoomReportReason; label: string }> = [
  { value: "harassment", label: "Quấy rối hoặc xúc phạm" },
  { value: "inappropriate", label: "Nội dung không phù hợp" },
  { value: "recording", label: "Ghi âm, ghi hình trái phép" },
  { value: "spam", label: "Spam hoặc quảng cáo" },
  { value: "other", label: "Lý do khác" },
];

async function apiCall(
  getToken: () => Promise<string | null>,
  path: string,
  init: RequestInit = {}
): Promise<Record<string, unknown>> {
  const token = await getToken();
  if (!token) throw new Error("Phiên đăng nhập đã hết hạn, bạn đăng nhập lại nhé.");
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...((init.headers as Record<string, string>) || {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = String(data?.error || "");
    if (res.status === 401) throw new Error("Phiên đăng nhập đã hết hạn, bạn đăng nhập lại nhé.");
    throw new Error(message || "Máy chủ không phản hồi, bạn thử lại nhé.");
  }
  return data;
}

export async function fetchBlockedUsers(
  getToken: () => Promise<string | null>
): Promise<BlockedUser[]> {
  const data = await apiCall(getToken, "/blocks");
  const list = Array.isArray(data.blocks) ? (data.blocks as BlockedUser[]) : [];
  return list
    .map((item) => ({
      uid: String(item?.uid || ""),
      name: String(item?.name || ""),
      createdAt: Number(item?.createdAt) || 0,
    }))
    .filter((item) => item.uid);
}

export async function blockUser(
  getToken: () => Promise<string | null>,
  targetUid: string,
  targetName = ""
): Promise<void> {
  await apiCall(getToken, "/blocks", {
    method: "POST",
    body: JSON.stringify({ targetUid, targetName }),
  });
}

export async function unblockUser(
  getToken: () => Promise<string | null>,
  targetUid: string
): Promise<void> {
  await apiCall(getToken, `/blocks/${encodeURIComponent(targetUid)}`, { method: "DELETE" });
}

export interface RoomReportInput {
  getToken: () => Promise<string | null>;
  room: string;
  targetUid: string;
  reason: RoomReportReason;
  detail?: string;
}

export async function submitRoomReport(input: RoomReportInput): Promise<void> {
  await apiCall(input.getToken, "/report", {
    method: "POST",
    body: JSON.stringify({
      source: "room",
      room: input.room,
      targetUid: input.targetUid,
      reason: input.reason,
      detail: input.detail?.trim().slice(0, 500) || "",
    }),
  });
}
