"use client";

import React, { useState, useEffect } from "react";
import {
  TimerIcon,
  ArrowRightIcon,
  PencilLineIcon,
  TrashIcon,
  CaretLeftIcon,
  CaretRightIcon,
  DotsThreeVerticalIcon,
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { KanbanCard, KanbanColumn } from "../../tasks/types";

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
  // Chế độ menu: "actions" (danh sách chức năng chính) hoặc "columns" (danh sách cột chuyển)
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
      {/* Nút Trigger 3 chấm tròn dạng kính mờ */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-label="Tùy chọn công việc"
        className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer active:scale-90 shadow-sm ${
          isOpen
            ? "bg-white/20 text-white border-white/30"
            : "bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border-white/15"
        }`}
      >
        <DotsThreeVerticalIcon className="w-4 h-4" weight="bold" />
      </button>

      {/* Menu thả xuống ngữ cảnh có chữ mô tả rõ ràng */}
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

            {/* Khung menu thả xuống dạng kính mờ tối giản & hiện đại */}
            <motion.div
              key={`menu-dropdown-${card.id}`}
              initial={{ opacity: 0, scale: 0.92, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -6 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 top-full mt-1.5 z-50 w-max min-w-[210px] max-w-[calc(100vw-1.5rem)] p-1.5 rounded-2xl bg-neutral-950/92 backdrop-blur-2xl border border-white/15 shadow-[0_16px_40px_rgba(0,0,0,0.85)] text-white select-none"
              onClick={(e) => e.stopPropagation()}
            >
              {mode === "actions" ? (
                <div className="flex flex-col space-y-0.5">
                  {/* Mục 1: Bắt đầu Pomodoro */}
                  <button
                    type="button"
                    onClick={() => {
                      onStartFocus();
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer group/item"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-white/[0.08] border border-white/10 flex items-center justify-center shrink-0">
                        <TimerIcon className="w-4 h-4 text-white/80 group-hover:text-white transition-colors" weight="fill" />
                      </div>
                      <span className="truncate">Học với Pomodoro</span>
                    </div>
                    {hasFocusTime && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-white/10 text-white/70 border border-white/10 shrink-0 ml-2 whitespace-nowrap">
                        {formattedFocusTime}
                      </span>
                    )}
                  </button>

                  {/* Mục 2: Chuyển trạng thái / Chuyển cột */}
                  {targetColumns.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setMode("columns")}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer group/item"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-white/[0.08] border border-white/10 flex items-center justify-center shrink-0">
                          <ArrowRightIcon className="w-4 h-4 text-white/80 group-hover:text-white transition-colors" weight="bold" />
                        </div>
                        <span className="truncate">Chuyển trạng thái</span>
                      </div>
                      <CaretRightIcon className="w-3.5 h-3.5 text-white/40 group-hover:text-white/70 shrink-0 ml-2 transition-colors" weight="bold" />
                    </button>
                  )}

                  {/* Mục 3: Xem & Sửa chi tiết */}
                  <button
                    type="button"
                    onClick={() => {
                      onSelectDetail();
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer group/item"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-white/[0.08] border border-white/10 flex items-center justify-center shrink-0">
                        <PencilLineIcon className="w-4 h-4 text-white/80 group-hover:text-white transition-colors" weight="bold" />
                      </div>
                      <span className="truncate">Chi tiết công việc</span>
                    </div>
                  </button>

                  {/* Phân cách nhẹ */}
                  <div className="my-1 border-t border-white/[0.08]" />

                  {/* Mục 4: Xóa việc này */}
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteCard();
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-white/70 hover:text-rose-400 hover:bg-rose-500/10 active:scale-[0.98] transition-all cursor-pointer group/item"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                        <TrashIcon className="w-4 h-4 text-rose-400 group-hover:text-rose-300 transition-colors" weight="bold" />
                      </div>
                      <span className="truncate text-rose-300 group-hover:text-rose-200">Xóa việc này</span>
                    </div>
                  </button>
                </div>
              ) : (
                /* Chế độ phụ: Chuyển sang cột khác */
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/[0.08] mb-0.5">
                    <button
                      type="button"
                      onClick={() => setMode("actions")}
                      className="flex items-center gap-1 text-[11px] font-semibold text-white/70 hover:text-white cursor-pointer px-1.5 py-0.5 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <CaretLeftIcon className="w-3.5 h-3.5" weight="bold" />
                      <span>Quay lại</span>
                    </button>
                    <span className="text-[10px] text-white/40">Chuyển sang</span>
                  </div>

                  <div className="space-y-0.5">
                    {targetColumns.map((col) => (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => {
                          onMoveCard(col.id);
                          onClose();
                        }}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer group/col"
                      >
                        <span className="min-w-0 truncate">{col.title}</span>
                        <ArrowRightIcon className="w-3.5 h-3.5 text-white/40 group-hover:text-white/70 shrink-0 ml-2 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
});
