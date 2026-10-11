"use client";

import { Maximize2, X } from "lucide-react";
import { StudyEmbedItem } from "../types";
import { DragControls } from "framer-motion";

interface PipHeaderProps {
  activeItem: StudyEmbedItem | null;
  pipDragControls: DragControls;
  onMaximize: () => void;
  onClose: () => void;
  isDragging?: boolean;
}

export function PipHeader({
  activeItem,
  pipDragControls,
  onMaximize,
  onClose,
  isDragging = false,
}: PipHeaderProps) {
  return (
    <div
      onPointerDown={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest("button") || target.closest("[role='button']")) return;
        pipDragControls.start(e, { snapToCursor: false });
      }}
      className="relative flex items-center justify-between px-3.5 py-2 border-b border-white/10 bg-white/[0.03] text-white cursor-grab active:cursor-grabbing transition-colors select-none"
      title="Nhấn giữ & kéo thả để di chuyển vị trí khắp màn hình"
    >
      {/* Left: Badge & Truncated Title */}
      <div className="flex items-center gap-2 min-w-0 pr-2 pointer-events-none max-w-[40%]">
        {activeItem?.isLive ? (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-bold text-[10px] shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
          </span>
        ) : (
          <span className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-bold text-[10px] shrink-0">
            PiP
          </span>
        )}
        <span className="text-xs font-semibold text-slate-200 truncate">
          {activeItem?.title}
        </span>
      </div>

      {/* Center: Apple-style Grab Bar (sáng xanh khi đang kéo, như Notes/Rooms) */}
      <div
        onPointerDown={(e) => {
          e.stopPropagation();
          pipDragControls.start(e, { snapToCursor: false });
        }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 py-2 px-3 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none group/grab pointer-events-auto"
        title="Nhấn giữ & kéo thả để di chuyển cửa sổ nổi"
      >
        <div
          className={`h-1 rounded-full transition-all duration-200 ${
            isDragging
              ? "w-9 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]"
              : "w-7 bg-white/20 group-hover/grab:bg-white/50 group-hover/grab:w-9"
          }`}
        />
      </div>

      {/* Right: Window Controls */}
      <div className="flex items-center gap-1 shrink-0 z-10">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onMaximize}
          className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Mở rộng ra Studio Modal đầy đủ"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Đóng cửa sổ nổi (Thu về thanh đáy)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
