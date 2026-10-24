export interface MsgAttachment {
  id?: string;
  kind: "image" | "text";
  name: string;
  thumb?: string;
  originalUrl?: string;
}

export interface Msg {
  id: string;
  role: "user" | "assistant";
  text: string;
  thoughtSecs?: number;
  rating?: 1 | -1 | null;
  ts?: number;
  attachments?: MsgAttachment[];
}

export interface Session {
  id: string;
  title: string;
  createdAt?: number;
  updatedAt?: number;
}

// Thao tác đang chạy trên một đoạn chat: dùng để khóa nút và hiện loading,
// tránh người dùng bấm lặp sinh ra nhiều lệnh ghi cùng lúc.
export type SessionPendingAction = { type: "delete" | "rename"; sid: string } | null;

// Số tin tối đa tải 1 lần (giữ thấp để vừa free tier Firebase).
export const PAGE_SIZE = 50;
// Số đoạn tối đa hiện trong ngăn phiên.
export const SESSION_LIST_MAX = 20;
