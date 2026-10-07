"use client";

import { GripVertical } from "lucide-react";

interface ResizableDividerProps {
  isResizing: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}

export function ResizableDivider({
  isResizing,
  onMouseDown,
  onDoubleClick,
}: ResizableDividerProps) {
  return (
    <>
      {/* Invisible Pointer Shield across entire screen when dragging */}
      {isResizing && (
        <div className="fixed inset-0 z-50 cursor-col-resize select-none pointer-events-auto" />
      )}

      {/* Interactive Resizable Divider */}
      <div
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
        className={`hidden md:flex relative items-center justify-center w-3 -mx-1.5 group/divider cursor-col-resize select-none z-30 touch-none shrink-0 ${
          isResizing ? "cursor-col-resize" : ""
        }`}
        title="Nhấn giữ & kéo sang trái/phải để chỉnh kích thước video • Nhấp đúp để đặt lại mặc định (44%)"
      >
        {/* Vertical Hairline Divider */}
        <div
          className={`w-[1px] h-full transition-colors ${
            isResizing
              ? "bg-accent-music w-[2px] shadow-[0_0_10px_rgba(52,211,153,0.9)]"
              : "bg-line/10 group-hover/divider:bg-white/40"
          }`}
        />

        {/* Floating Grip Handle Pill */}
        <div
          className={`absolute w-4 h-10 rounded-full flex items-center justify-center transition-all ${
            isResizing
              ? "bg-accent-music text-panel shadow-[0_0_12px_rgba(52,211,153,0.8)] scale-110 opacity-100"
              : "bg-panel/90 border border-line/25 group-hover/divider:border-white/50 text-slate-400 group-hover/divider:text-white shadow-md opacity-0 group-hover/divider:opacity-100"
          }`}
        >
          <GripVertical className="w-2.5 h-2.5" />
        </div>
      </div>
    </>
  );
}
