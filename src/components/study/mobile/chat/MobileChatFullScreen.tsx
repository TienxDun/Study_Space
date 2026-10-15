"use client";

import type { ReactNode } from "react";
import { ModalShell } from "@/components/ui/ModalShell";

interface MobileChatFullScreenProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

// Bảng chat full màn hình kiểu chatbot điện thoại thường thấy.
export function MobileChatFullScreen({ isOpen, onClose, children }: MobileChatFullScreenProps) {
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      panelKey="mobile-chat-full"
      ariaLabel="Trợ lý học tập"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      panelClassName="fixed inset-0 z-[70] flex flex-col bg-[#0b0f1a] sm:hidden pt-safe pb-safe"
    >
      <div className="flex items-center justify-between px-4 h-14 border-b border-white/10 shrink-0">
        <p className="text-sm font-bold">Trợ lý học tập</p>
        <button
          onClick={onClose}
          aria-label="Đóng chat"
          className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 active:scale-95"
        >
          <span aria-hidden="true" className="text-xl leading-none">×</span>
        </button>
      </div>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </ModalShell>
  );
}
