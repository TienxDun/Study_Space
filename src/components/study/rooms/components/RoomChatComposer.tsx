"use client";

import { useState } from "react";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react";

export interface RoomChatComposerProps {
  onSend: (text: string) => Promise<void> | void;
  disabled?: boolean;
}

/**
 * Ô soạn tin nhắn trong phòng học tách riêng để giữ state draft cục bộ:
 * gõ phím chỉ render lại đúng ô này, không kéo theo lưới video LiveKit.
 */
export function RoomChatComposer({ onSend, disabled }: RoomChatComposerProps) {
  const [draft, setDraft] = useState("");

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await onSend(text);
  };

  return (
    <div className="p-2 border-t border-white/10 shrink-0">
      <div className="flex items-center gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={disabled}
          placeholder="Nhập tin nhắn..."
          className="flex-1 px-3 py-1.5 rounded-xl bg-black/50 border border-white/20 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-white/30 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || !draft.trim()}
          className="w-8 h-8 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 active:scale-95 border border-emerald-400/30 text-emerald-200 flex items-center justify-center cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          title="Gửi"
          aria-label="Gửi tin nhắn"
        >
          <PaperPlaneTiltIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
