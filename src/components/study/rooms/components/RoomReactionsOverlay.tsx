"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { MeetReactionEvent } from "../utils/meet-protocol";

interface RoomReactionsOverlayProps {
  reactions: MeetReactionEvent[];
}

/**
 * Hiệu ứng cảm xúc bay lên trên khung hình video phòng học nhóm (Phase 2):
 * - Không chặn click/tương tác video (pointer-events-none)
 * - Tự động biến mất sau 2.5 giây
 * - Đặt vị trí ngẫu nhiên theo chiều ngang để không chồng lên nhau
 */
export function RoomReactionsOverlay({ reactions }: RoomReactionsOverlayProps) {
  // Tính vị trí x ngẫu nhiên cố định theo reaction.id để animation mượt mà
  const getHorizontalOffset = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash << 5) - hash + id.charCodeAt(i);
      hash |= 0;
    }
    const pct = Math.abs(hash) % 70 + 15; // 15% .. 85%
    return `${pct}%`;
  };

  return (
    <div className="absolute inset-x-0 top-0 bottom-20 pointer-events-none z-20 overflow-hidden">
      <AnimatePresence>
        {reactions.map((r) => {
          const leftPos = getHorizontalOffset(r.id);
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 20, scale: 0.6 }}
              animate={{ opacity: 1, y: -160, scale: 1.2 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 2.2, ease: "easeOut" }}
              style={{ left: leftPos }}
              className="absolute bottom-6 flex flex-col items-center gap-1 select-none"
            >
              <span className="text-3xl filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] animate-pulse">
                {r.emoji}
              </span>
              <span className="text-[10px] font-semibold text-white/90 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 shadow-sm max-w-[120px] truncate">
                {r.senderName}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
