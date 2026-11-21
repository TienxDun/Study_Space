"use client";

import { MoonIcon, PlusIcon, SunIcon, XIcon } from "@phosphor-icons/react";
import { StudySproutMascot } from "@/components/study/chat/components/StudySproutMascot";
import { SessionList } from "./SessionList";
import type { ChatV2SessionMeta } from "../types";

export interface SessionSidebarProps {
  sessions: ChatV2SessionMeta[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
  newChatDisabled: boolean;
  onToggleTheme: (event?: React.MouseEvent) => void;
}

interface ChatSidebarProps extends SessionSidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function ChatSidebar(props: ChatSidebarProps) {
  return (
    <aside
      className="chat-v2-sidebar hidden h-dvh shrink-0 overflow-hidden lg:flex"
      aria-hidden={!props.open}
    >
      <div className="chat-v2-sidebar-panel flex h-full w-[276px] shrink-0 flex-col overflow-hidden">
        <SidebarBody {...props} />
      </div>
    </aside>
  );
}

export function SidebarBody({
  sessions,
  activeId,
  onSelect,
  onRename,
  onDelete,
  onNewChat,
  newChatDisabled,
  onToggleTheme,
  onClose,
}: ChatSidebarProps) {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col px-3 py-4">
      <div className="flex items-center gap-2.5 px-1">
        <StudySproutMascot size={38} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold tracking-tight text-chat-ink">ZenStudy</span>
          <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-chat-accent/70">
            Study assistant
          </span>
        </span>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng danh sách phiên"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-chat-border bg-chat-surface text-chat-sub transition hover:bg-chat-hover hover:text-chat-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/50"
          >
            <XIcon size={15} weight="bold" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onNewChat}
        disabled={newChatDisabled}
        aria-label={newChatDisabled ? "Đang ở cuộc trò chuyện mới" : "Cuộc trò chuyện mới"}
        title={newChatDisabled ? "Đang ở cuộc trò chuyện mới" : "Cuộc trò chuyện mới"}
        className="group mt-6 flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-chat-accent-button px-3 text-[13px] font-semibold text-chat-accent-button-text shadow-[0_10px_28px_var(--chat-accent-shadow)] transition-all hover:bg-chat-accent-button-hover active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/60 disabled:cursor-not-allowed disabled:bg-chat-surface disabled:text-chat-faint disabled:shadow-none disabled:hover:bg-chat-surface disabled:active:scale-100"
      >
        <PlusIcon size={16} weight="bold" className="transition-transform duration-300 group-hover:rotate-90 motion-reduce:transform-none" aria-hidden="true" />
        Cuộc trò chuyện mới
      </button>

      <SessionList
        sessions={sessions}
        activeId={activeId}
        onSelect={onSelect}
        onRename={onRename}
        onDelete={onDelete}
      />

      <div className="mt-auto shrink-0 pt-3">
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-chat-border bg-chat-surface px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-chat-faint">
            Giao diện
          </span>
          <button
            type="button"
            onClick={(e) => onToggleTheme(e)}
            aria-label="Chuyển giao diện sáng/tối"
            title="Chuyển giao diện sáng/tối"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-chat-border bg-chat-elevated text-chat-sub transition hover:border-chat-border-strong hover:bg-chat-hover hover:text-chat-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/50"
          >
            <SunIcon
              className="chat-v2-theme-icon-dark"
              size={15}
              weight="duotone"
              aria-hidden="true"
            />
            <MoonIcon
              className="chat-v2-theme-icon-light"
              size={15}
              weight="duotone"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </div>
  );
}
