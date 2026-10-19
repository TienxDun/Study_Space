"use client";

import {
  XIcon,
  PlusIcon,
  ClockCounterClockwiseIcon,
  BrainIcon,
  ArrowsOutSimpleIcon,
  ArrowsInSimpleIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import { StudySproutMascot } from "./StudySproutMascot";

interface ChatUser {
  photoURL: string | null;
  displayName: string | null;
  email: string | null;
}

interface ChatHeaderProps {
  user: ChatUser | null;
  loading: boolean;
  drawerOpen: boolean;
  remember: boolean;
  onToggleRemember: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
  onNewChat?: () => void;
  onToggleDrawer: () => void;
  onClose: () => void;
  onSignOut?: () => void;
}

// Tiêu đề khung chat: logo mascot, ZenStudy AI, nút toggle nhớ ngữ cảnh, nút đoạn chat mới, lịch sử phiên, phóng to, đóng.
export function ChatHeader({
  loading,
  drawerOpen,
  remember,
  onToggleRemember,
  expanded,
  onToggleExpand,
  onNewChat,
  onToggleDrawer,
  onClose,
}: ChatHeaderProps) {
  return (
    <div className="relative z-30 flex items-center justify-between gap-2 pl-3.5 pr-2.5 py-2.5 border-b border-white/10 bg-slate-950/85 backdrop-blur-2xl shadow-xs">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <StudySproutMascot size={32} />
        <div className="min-w-0 leading-tight">
          <div className="text-sm font-semibold tracking-tight truncate text-white whitespace-nowrap">
            Trợ lý học tập
          </div>
          <div className="text-[11px] font-medium mt-0.5 flex items-center gap-1 text-emerald-400 whitespace-nowrap overflow-hidden">
            <span>ZenStudy AI</span>
            <SparkleIcon size={10} weight="fill" className="text-emerald-300 shrink-0" aria-hidden="true" />
          </div>
        </div>
      </div>
      <div className="relative flex items-center gap-1 shrink-0">
        {/* Nút bật/tắt nhớ ngữ cảnh: đổi màu icon và border trực tiếp */}
        <button
          type="button"
          onClick={onToggleRemember}
          title={
            remember
              ? "Nhớ hội thoại: Đang BẬT (AI kết nối các câu trước. Bấm để tắt)"
              : "Nhớ hội thoại: Đang TẮT (AI trả lời từng câu độc lập. Bấm để bật)"
          }
          aria-label={remember ? "Nhớ hội thoại đang bật, bấm để tắt" : "Nhớ hội thoại đang tắt, bấm để bật"}
          className={`h-8 w-8 grid place-items-center rounded-lg border transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 active:scale-95 ${
            remember
              ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.3)] hover:bg-emerald-500/25"
              : "bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10"
          }`}
        >
          <BrainIcon
            size={16}
            weight={remember ? "fill" : "regular"}
            className={remember ? "text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]" : "text-zinc-400"}
            aria-hidden="true"
          />
        </button>

        {loading ? (
          <div className="text-xs text-zinc-400 px-1" role="status">
            Đang tải…
          </div>
        ) : (
          <>
            {onNewChat && (
              <button
                onClick={onNewChat}
                title="Đoạn chat mới"
                aria-label="Tạo đoạn chat mới"
                className="h-8 w-8 grid place-items-center rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-300 hover:text-white cursor-pointer transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <PlusIcon size={15} weight="bold" aria-hidden="true" />
              </button>
            )}
            <button
              onClick={onToggleDrawer}
              data-drawer-toggle
              title="Lịch sử đoạn chat"
              aria-label="Mở danh sách đoạn chat"
              aria-expanded={drawerOpen}
              className={`h-8 w-8 grid place-items-center rounded-lg border transition-all cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                drawerOpen
                  ? "bg-white/20 border-white/25 text-white"
                  : "bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-300 hover:text-white"
              }`}
            >
              <ClockCounterClockwiseIcon size={15} weight="bold" aria-hidden="true" />
            </button>
          </>
        )}
        <button
          onClick={onToggleExpand}
          title={expanded ? "Thu nhỏ khung chat" : "Mở rộng khung chat (đọc bài giải dễ hơn)"}
          aria-label={expanded ? "Thu nhỏ khung chat" : "Mở rộng khung chat"}
          className="h-8 w-8 grid place-items-center rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-200 hover:text-white transition-all cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          {expanded ? (
            <ArrowsInSimpleIcon size={15} weight="bold" aria-hidden="true" />
          ) : (
            <ArrowsOutSimpleIcon size={15} weight="bold" aria-hidden="true" />
          )}
        </button>
        <button
          onClick={onClose}
          title="Đóng trợ lý (Esc hoặc C)"
          aria-label="Đóng trợ lý học tập (Esc hoặc C)"
          className="h-8 w-8 grid place-items-center rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-200 hover:text-white transition-all cursor-pointer touch-manipulation active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <XIcon size={15} weight="bold" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
