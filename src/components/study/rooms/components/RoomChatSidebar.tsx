"use client";

import React from "react";
import { XIcon } from "@phosphor-icons/react";
import { RoomChatComposer } from "./RoomChatComposer";

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

export interface RoomChatSidebarProps {
  sideBySide?: boolean;
  chatMessages: Array<{
    timestamp: number;
    message: string;
    from?: { name?: string; identity?: string };
  }>;
  onClose: () => void;
  onSend: (text: string) => Promise<void> | void;
}

/**
 * Khung chat nhắn tin trong phòng học (Desktop).
 * Hiển thị dạng thanh bên khi thẻ rộng, hoặc phía dưới khi thẻ hẹp.
 */
export function RoomChatSidebar({
  sideBySide = true,
  chatMessages,
  onClose,
  onSend,
}: RoomChatSidebarProps) {
  return (
    <div
      className={`shrink-0 flex flex-col bg-black/60 backdrop-blur-2xl overflow-hidden ${
        sideBySide
          ? "w-72 m-2 ml-0 rounded-2xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
          : "h-56 border-t border-white/15"
      }`}
    >
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10 shrink-0">
        <h3 className="text-xs font-bold">Nhắn tin</h3>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Đóng chat"
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5 custom-study-scroll select-text">
        {chatMessages.length === 0 && (
          <p className="text-[11px] text-slate-500 text-center pt-6">
            Chưa có tin nhắn nào. Chào mọi người đi!
          </p>
        )}
        {chatMessages.map((m, idx) => (
          <div key={`${m.timestamp}-${idx}`} className="space-y-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-200 truncate">
                {m.from?.name || m.from?.identity || "Bạn mới"}
              </span>
              <span className="text-[10px] text-slate-500 shrink-0">
                {formatTime(m.timestamp)}
              </span>
            </div>
            <p className="text-xs text-slate-100 leading-relaxed break-words">
              {m.message}
            </p>
          </div>
        ))}
      </div>

      <RoomChatComposer onSend={onSend} />
    </div>
  );
}
