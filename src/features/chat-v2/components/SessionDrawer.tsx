"use client";

import { useEffect } from "react";
import { SidebarBody, type SessionSidebarProps } from "./ChatSidebar";

interface SessionDrawerProps extends SessionSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function SessionDrawer({ open, onClose, ...sidebar }: SessionDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Đánh dấu đã xử lý để phím tắt toàn cục không đóng luôn cả khung chat.
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Danh sách phiên chat"
      data-escape-guard=""
    >
      <button
        type="button"
        aria-label="Đóng danh sách phiên"
        onClick={onClose}
        className="chat-v2-anim-fade absolute inset-0 bg-black/55 backdrop-blur-sm"
      />
      <aside className="chat-v2-anim-drawer relative flex h-full w-[288px] max-w-[86vw] flex-col border-r border-chat-border bg-chat-elevated shadow-[var(--chat-shadow-popover)]">
        <SidebarBody {...sidebar} onClose={onClose} />
      </aside>
    </div>
  );
}
