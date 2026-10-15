"use client";

import { StudySproutMascot } from "@/components/study/chat/components/StudySproutMascot";
import { useDragBubble } from "./useDragBubble";

interface MobileChatBubbleProps {
  hasNew: boolean;
  onOpen: () => void;
}

// Bong bóng chat mobile: kéo tự do, nằm trên đồng hồ, bấm mở full màn hình.
export function MobileChatBubble({ hasNew, onOpen }: MobileChatBubbleProps) {
  const { ref, pos, onPointerDown, onPointerMove, endDrag } = useDragBubble();

  return (
    <button
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => {
        if (!endDrag()) onOpen();
      }}
      onPointerCancel={() => endDrag()}
      aria-label="Mở trợ lý học tập"
      className="fixed z-[60] sm:hidden flex items-center p-1 rounded-full drop-shadow-[0_4px_14px_rgba(0,0,0,0.85)] active:scale-95 touch-none select-none"
      style={
        pos
          ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
          : { right: 12, bottom: "calc(var(--mobile-nav-height) + var(--app-safe-bottom) + var(--mobile-nav-safe-gap) + 4.5rem)" }
      }
    >
      <StudySproutMascot size={44} />
      {hasNew && (
        <span aria-label="Có tin mới" className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-red-500 border-2 border-black/80 animate-pulse" />
      )}
    </button>
  );
}
