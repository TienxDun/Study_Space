"use client";

import { ListIcon, PlusIcon, SidebarSimpleIcon, XIcon } from "@phosphor-icons/react";

interface ChatTopbarProps {
  title: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenSessions: () => void;
  onNewChat: () => void;
  newChatDisabled: boolean;
  railAvailable: boolean;
  railOpen: boolean;
  onToggleRail: () => void;
  onClose?: () => void;
}

export function ChatTopbar({
  title,
  sidebarOpen,
  onToggleSidebar,
  onOpenSessions,
  onNewChat,
  newChatDisabled,
  railAvailable,
  railOpen,
  onToggleRail,
  onClose,
}: ChatTopbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-chat-border/60 bg-chat-bg/80 backdrop-blur-md sm:backdrop-blur-2xl">
      <div className="flex w-full items-center gap-2 px-3 py-3 sm:gap-4 sm:px-4 lg:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng trợ lý, quay lại không gian học"
              title="Đóng trợ lý (Esc)"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-chat-border bg-chat-surface text-chat-sub transition hover:border-chat-border-strong hover:bg-chat-hover hover:text-chat-ink active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/50"
            >
              <XIcon size={16} weight="bold" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onOpenSessions}
            aria-label="Mở danh sách phiên chat"
            aria-haspopup="dialog"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-chat-border bg-chat-surface text-chat-sub transition hover:border-chat-border-strong hover:bg-chat-hover hover:text-chat-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/50 lg:hidden"
          >
            <ListIcon size={16} weight="bold" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={sidebarOpen ? "Ẩn thanh phiên chat" : "Hiện thanh phiên chat"}
            aria-pressed={sidebarOpen}
            title={sidebarOpen ? "Ẩn thanh phiên" : "Hiện thanh phiên"}
            className="hidden h-9 w-9 shrink-0 place-items-center rounded-xl border border-chat-border bg-chat-surface text-chat-sub transition hover:border-chat-border-strong hover:bg-chat-hover hover:text-chat-ink active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/50 lg:grid"
          >
            <SidebarSimpleIcon size={16} weight="duotone" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-[13px] font-semibold tracking-tight text-chat-ink sm:text-sm">
              {title}
            </h1>
            <p className="flex items-center gap-1.5 truncate text-[10px] text-chat-muted">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-chat-accent" />
              Trợ lý học tập
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {railAvailable ? (
            <button
              type="button"
              onClick={onToggleRail}
              aria-label={railOpen ? "Ẩn chi tiết phiên" : "Hiện chi tiết phiên"}
              aria-pressed={railOpen}
              title={railOpen ? "Ẩn chi tiết phiên" : "Hiện chi tiết phiên"}
              className="hidden h-10 w-10 shrink-0 place-items-center rounded-full border border-chat-border bg-chat-surface text-chat-sub transition hover:border-chat-border-strong hover:bg-chat-hover hover:text-chat-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/50 aria-pressed:border-chat-accent-border aria-pressed:bg-chat-accent-soft aria-pressed:text-chat-accent sm:grid"
            >
              <SidebarSimpleIcon size={16} weight="duotone" className="-scale-x-100" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onNewChat}
            disabled={newChatDisabled}
            aria-label={newChatDisabled ? "Đang ở cuộc trò chuyện mới" : "Cuộc trò chuyện mới"}
            title={newChatDisabled ? "Đang ở cuộc trò chuyện mới" : "Cuộc trò chuyện mới"}
            className={`group grid h-10 w-10 shrink-0 place-items-center rounded-full border border-chat-accent-border bg-chat-accent-soft text-chat-accent transition-all hover:border-chat-accent hover:bg-chat-accent-button hover:text-chat-accent-button-text active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/50 disabled:cursor-not-allowed disabled:border-chat-border disabled:bg-chat-surface disabled:text-chat-faint disabled:hover:border-chat-border disabled:hover:bg-chat-surface disabled:hover:text-chat-faint disabled:active:scale-100 ${sidebarOpen ? "lg:hidden" : ""}`}
          >
            <PlusIcon size={17} weight="bold" className="transition-transform duration-300 group-hover:rotate-90 motion-reduce:transform-none" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
