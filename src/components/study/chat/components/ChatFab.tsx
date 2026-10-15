"use client";

import { StudySproutMascot } from "./StudySproutMascot";

interface ChatFabProps {
  hasNew: boolean;
  onOpen: () => void;
}

// Nút tròn thông minh (Dynamic Floating Icon) góc màn hình, mở rộng khi hover, mầm cây tri thức nhìn theo chuột.
export function ChatFab({ hasNew, onOpen }: ChatFabProps) {
  return (
    <button
      id="tour-chat-fab"
      onClick={onOpen}
      title="Trò chuyện với trợ lý học tập (Phím tắt: C)"
      aria-label="Mở trợ lý học tập (Phím tắt: C)"
      aria-expanded={false}
      aria-controls="study-chat-panel"
      className="group fixed right-3 sm:right-3.5 bottom-15 sm:bottom-16 max-sm:bottom-[calc(var(--mobile-nav-height)+var(--app-safe-bottom)+var(--mobile-nav-safe-gap)+4rem)] z-40 hidden sm:flex items-center p-1 rounded-full drop-shadow-[0_4px_14px_rgba(0,0,0,0.85)] hover:scale-105 active:scale-95 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:transform-none touch-manipulation cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    >
      <span className="shrink-0 grid place-items-center transition-transform duration-200 group-hover:scale-110">
        <StudySproutMascot size={44} />
      </span>
      <span className="max-w-0 opacity-0 overflow-hidden group-hover:max-w-44 group-hover:opacity-100 group-hover:ml-2 group-focus-visible:max-w-44 group-focus-visible:opacity-100 group-focus-visible:ml-2 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] whitespace-nowrap text-xs sm:text-sm font-semibold text-slate-100 group-hover:text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] select-none flex items-center gap-1.5">
        <span>Hỏi trợ lý</span>
        <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-white/20 text-[10px] font-mono text-white/90 border border-white/25">
          C
        </kbd>
      </span>
      {hasNew && (
        <span
          aria-label="Có tin mới"
          className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-red-500 border-2 border-black/80 shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-pulse"
        />
      )}
    </button>
  );
}
