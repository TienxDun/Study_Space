"use client";

import { toast } from "sonner";

const CHAT_NOTICE_ID = "chat-notice";
// Toaster toàn cục để 1,5s, quá ngắn để đọc câu "hết lượt hôm nay".
const CHAT_NOTICE_MS = 6000;

// Lỗi chat dùng chung một toast: lỗi mới thay lỗi cũ, không xếp chồng.
export function notifyChat(message: string) {
  toast(message, { id: CHAT_NOTICE_ID, duration: CHAT_NOTICE_MS });
}

export function clearChatNotice() {
  toast.dismiss(CHAT_NOTICE_ID);
}
