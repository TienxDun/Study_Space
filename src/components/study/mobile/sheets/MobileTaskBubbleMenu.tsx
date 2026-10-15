"use client";

import React, { useState, useEffect } from "react";
import {
  TimerIcon,
  ArrowRightIcon,
  PencilLineIcon,
  TrashIcon,
  XIcon,
  CaretLeftIcon,
  DotsThreeVerticalIcon,
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { KanbanCard, KanbanColumn } from "../../tasks/types";
import { GlassIcon } from "@/components/ui/GlassIcon";

interface MobileTaskBubbleMenuProps {
  card: KanbanCard;
  columns: KanbanColumn[];
  currentColId: string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onStartFocus: () => void;
  onSelectDetail: () => void;
  onMoveCard: (targetColId: string) => void;
  onDeleteCard: () => void;
  hasFocusTime: boolean;
  formattedFocusTime: string;
}

export const MobileTaskBubbleMenu = React.memo(function MobileTaskBubbleMenu({
  card,
  columns,
  currentColId,
  isOpen,
  onToggle,
  onClose,
  onStartFocus,
  onSelectDetail,
  onMoveCard,
  onDeleteCard,
  hasFocusTime,
  formattedFocusTime,
}: MobileTaskBubbleMenuProps) {
  // Chế độ menu: "actions" (các bong bóng chức năng chính) hoặc "columns" (các bong bóng chuyển cột)
  const [mode, setMode] = useState<"actions" | "columns">("actions");

  // Reset về chế độ "actions" mỗi khi mở menu
  useEffect(() => {
    if (isOpen) {
      setMode("actions");
    }
  }, [isOpen]);

  const targetColumns = columns.filter((c) => c.id !== currentColId);

  return (
    <div className="relative shrink-0 flex items-center">
      {/* Nút Trigger cơ bản (3 chấm tròn kính mờ) */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.88 }}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-label="Tùy chọn nhanh"
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
          isOpen
            ? "bg-white/20 text-white border border-white/30 shadow-md rotate-90"
            : "bg-white/[0.04] hover:bg-white/10 text-white/40 hover:text-white border border-white/[0.08]"
        }`}
      >
        <DotsThreeVerticalIcon className="w-4 h-4" />
      </motion.button>

      {/* Hiệu ứng Bubble Menu khi mở */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Lớp nền trong suốt bắt click-outside tự động đóng */}
            <motion.div
              key={`bubble-backdrop-${card.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            />

            {/* Cụm bong bóng hành động nổi bật (Liquid Glass Bubble Cluster) */}
            <motion.div
              key={`bubble-cluster-${card.id}`}
              initial={{ opacity: 0, scale: 0.82, x: 12 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.82, x: 12 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
              className="absolute right-0 -top-1.5 z-50 flex items-center gap-1.5 p-1.5 rounded-full bg-neutral-950/95 backdrop-blur-2xl border border-white/20 shadow-[0_16px_40px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.25)] text-white"
              onClick={(e) => e.stopPropagation()}
            >
              {mode === "actions" ? (
                <>
                  {/* Bong bóng 1: Bắt đầu Pomodoro */}
                  <div className="relative">
                    <GlassIcon
                      icon={<TimerIcon className="w-4.5 h-4.5" weight="fill" />}
                      title="Học với Pomodoro"
                      aria-label="Học với Pomodoro"
                      variant="liquid"
                      plate="none"
                      size={36}
                      onClick={() => {
                        onStartFocus();
                        onClose();
                      }}
                    />
                    {hasFocusTime && (
                      <span className="absolute -top-1 -right-1 px-1 py-0.2 rounded-full text-[8.5px] font-mono font-bold bg-amber-400 text-neutral-950 shadow-xs border border-amber-300 pointer-events-none z-20">
                        {formattedFocusTime}
                      </span>
                    )}
                  </div>

                  {/* Bong bóng 2: Chuyển cột (Move column) */}
                  {targetColumns.length > 0 && (
                    <GlassIcon
                      icon={<ArrowRightIcon className="w-4 h-4" weight="bold" />}
                      title="Chuyển cột"
                      aria-label="Chuyển cột"
                      variant="liquid"
                      plate="none"
                      size={36}
                      onClick={() => setMode("columns")}
                    />
                  )}

                  {/* Bong bóng 3: Xem & Chỉnh sửa chi tiết */}
                  <GlassIcon
                    icon={<PencilLineIcon className="w-4 h-4" weight="bold" />}
                    title="Chi tiết việc"
                    aria-label="Chi tiết việc"
                    variant="liquid"
                    plate="none"
                    size={36}
                    onClick={() => {
                      onSelectDetail();
                      onClose();
                    }}
                  />

                  {/* Bong bóng 4: Xóa thẻ */}
                  <GlassIcon
                    icon={<TrashIcon className="w-4 h-4" weight="bold" />}
                    title="Xóa việc này"
                    aria-label="Xóa việc này"
                    variant="liquid"
                    plate="none"
                    size={36}
                    onClick={() => {
                      onDeleteCard();
                      onClose();
                    }}
                  />

                  {/* Bong bóng 5: Đóng menu */}
                  <GlassIcon
                    icon={<XIcon className="w-3.5 h-3.5" />}
                    title="Đóng"
                    aria-label="Đóng tùy chọn"
                    variant="liquid"
                    plate="none"
                    size={32}
                    onClick={onClose}
                  />
                </>
              ) : (
                /* Chế độ phụ: Chọn cột đích dạng các bong bóng nhộng (Column Pills) */
                <div className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.88 }}
                    onClick={() => setMode("actions")}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                    title="Quay lại"
                  >
                    <CaretLeftIcon className="w-4 h-4" />
                  </motion.button>

                  <div className="flex items-center gap-1 max-w-[210px] overflow-x-auto scrollbar-none py-0.5">
                    {targetColumns.map((col) => (
                      <motion.button
                        key={col.id}
                        type="button"
                        whileTap={{ scale: 0.92 }}
                        onClick={() => {
                          onMoveCard(col.id);
                          onClose();
                        }}
                        className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/[0.08] hover:bg-sky-500/25 text-white/90 hover:text-sky-200 border border-white/15 hover:border-sky-400/35 whitespace-nowrap active:scale-95 transition-all cursor-pointer"
                      >
                        {col.title}
                      </motion.button>
                    ))}
                  </div>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.88 }}
                    onClick={onClose}
                    className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white flex items-center justify-center ml-0.5"
                  >
                    <XIcon className="w-3 h-3" />
                  </motion.button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
});
