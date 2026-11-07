"use client";

import React, { useState, useRef, useEffect, memo } from "react";
import {
  ChatTextIcon,
  XIcon,
  PaperPlaneTiltIcon,
  CircleNotchIcon,
} from "@phosphor-icons/react";
import type { ReceivedChatMessage } from "@livekit/components-react";

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const MobileChatMessageRow = memo(function MobileChatMessageRow({
  message,
  isMe,
}: {
  message: ReceivedChatMessage;
  isMe: boolean;
}) {
  return (
    <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
      <div className="flex items-baseline gap-1.5 mb-0.5 px-1">
        <span className="text-[11px] font-bold text-slate-300">
          {isMe ? "Bạn" : message.from?.name || message.from?.identity || "Thành viên"}
        </span>
        <span className="text-[9px] text-slate-500">
          {formatTime(message.timestamp)}
        </span>
      </div>
      <div
        className={`max-w-[82%] px-3 py-1.5 rounded-2xl text-xs leading-relaxed break-words ${
          isMe
            ? "bg-emerald-500/25 border border-emerald-400/30 text-emerald-100 rounded-tr-sm"
            : "bg-white/10 border border-white/10 text-slate-100 rounded-tl-sm"
        }`}
      >
        {message.message}
      </div>
    </div>
  );
});

export interface MobileRoomChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  chatMessages: ReceivedChatMessage[];
  localIdentity?: string;
  onSend: (text: string) => Promise<void>;
}

/**
 * Ngăn kéo chat dạng bottom-sheet trượt lên từ đáy phòng học trên điện thoại.
 */
export const MobileRoomChatDrawer = memo(function MobileRoomChatDrawer({
  isOpen,
  onClose,
  chatMessages,
  localIdentity,
  onSend,
}: MobileRoomChatDrawerProps) {
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const sendingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isOpen]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sendingRef.current) return;
    sendingRef.current = true;
    setIsSending(true);
    try {
      await onSend(text);
      setDraft("");
    } catch {
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 h-[65%] surface-frost border-t border-white/25 rounded-t-3xl shadow-[0_-16px_50px_rgba(0,0,0,0.85)] flex flex-col z-30 animate-in slide-in-from-bottom duration-250 ease-out">
      {/* Header Chat */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <ChatTextIcon className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold text-white">Tin nhắn phòng học</h3>
          <span className="text-[11px] text-slate-400">
            ({chatMessages.length})
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
          title="Đóng chat"
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Danh sách tin nhắn */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-2.5 custom-study-scroll select-text">
        {chatMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <p className="text-xs text-slate-400">Chưa có tin nhắn nào.</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Gửi lời chào đầu tiên tới các bạn học nhé! 👋
            </p>
          </div>
        ) : (
          chatMessages.map((m) => (
            <MobileChatMessageRow
              key={m.id}
              message={m}
              isMe={m.from?.identity === localIdentity}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Ô nhập tin nhắn */}
      <div className="p-2.5 bg-black/60 border-t border-white/10 flex items-center gap-2 pb-[calc(env(safe-area-inset-bottom,0.5rem)+0.5rem)] shrink-0">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder="Nhắn tin cho cả phòng..."
          maxLength={500}
          className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white/[0.08] border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400/50"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!draft.trim() || isSending}
          aria-busy={isSending || undefined}
          className="w-8.5 h-8.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          title={isSending ? "Đang gửi…" : "Gửi tin nhắn"}
        >
          {isSending ? (
            <CircleNotchIcon className="w-3.5 h-3.5 animate-spin" weight="bold" />
          ) : (
            <PaperPlaneTiltIcon className="w-3.5 h-3.5" weight="fill" />
          )}
        </button>
      </div>
    </div>
  );
});
