"use client";

import React, { useState, useRef } from "react";
import { PlusIcon } from "@phosphor-icons/react";
import { PrioritySignalIcon } from "@/components/study/tasks/components/PrioritySignalIcon";
import { KanbanCard, KanbanBoard, CardPriority } from "@/components/study/tasks/types";

export interface MobileTaskQuickAddBarProps {
  targetColId: string;
  updateCurrentBoard: (mutator: (board: KanbanBoard) => KanbanBoard) => void;
}

/**
 * Thanh thêm việc nhanh tách riêng khỏi danh sách.
 * Giữ state gõ phím ở đây để mỗi ký tự chỉ render lại thanh này,
 * không kéo theo render lại toàn bộ thẻ việc phía trên.
 */
export const MobileTaskQuickAddBar = React.memo(function MobileTaskQuickAddBar({
  targetColId,
  updateCurrentBoard,
}: MobileTaskQuickAddBarProps) {
  const [quickTitle, setQuickTitle] = useState("");
  const [quickPriority, setQuickPriority] = useState<CardPriority>("low");
  const inputRef = useRef<HTMLInputElement>(null);

  const cycleQuickPriority = () => {
    setQuickPriority((prev) => {
      if (prev === "low") return "medium";
      if (prev === "medium") return "high";
      return "low";
    });
  };

  const handleQuickAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const title = quickTitle.trim();
    if (!title) {
      inputRef.current?.focus();
      return;
    }

    const newCard: KanbanCard = {
      id: "card-" + Date.now(),
      columnId: targetColId,
      title,
      checklist: [],
      priority: quickPriority,
      createdAt: Date.now(),
    };

    updateCurrentBoard((board) => ({
      ...board,
      cards: [...board.cards, newCard],
    }));

    setQuickTitle("");
    setQuickPriority("low");
    inputRef.current?.focus();
  };

  return (
    <form onSubmit={handleQuickAdd} className="flex items-center gap-1.5">
      {/* Nút chọn độ ưu tiên nhanh - Ghost Glass Button */}
      <button
        type="button"
        onClick={cycleQuickPriority}
        title={`Độ ưu tiên: ${
          quickPriority === "high"
            ? "Cao (Gấp)"
            : quickPriority === "low"
            ? "Thấp"
            : "Vừa"
        } - Chạm để đổi`}
        aria-label="Chọn độ ưu tiên"
        className="h-9 px-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 flex items-center gap-1 text-[11px] font-medium text-white/80 hover:text-white shrink-0 cursor-pointer transition-all active:scale-95"
      >
        <PrioritySignalIcon priority={quickPriority} className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[10px] text-white/80">
          {quickPriority === "high" ? "Gấp" : quickPriority === "low" ? "Thấp" : "Vừa"}
        </span>
      </button>

      <input
        ref={inputRef}
        type="text"
        value={quickTitle}
        onChange={(e) => setQuickTitle(e.target.value)}
        placeholder="Nhập việc cần làm..."
        className="lg-input flex-1 h-9 px-3 text-xs text-white min-w-0"
      />
      {/* Nút Thêm việc - Ghost Glass Button */}
      <button
        type="submit"
        aria-label="Thêm việc"
        className="h-9 px-3.5 rounded-xl border border-white/20 bg-white/15 hover:bg-white/25 active:scale-95 text-white text-xs font-semibold flex items-center gap-1 transition-all shrink-0 cursor-pointer shadow-sm"
      >
        <PlusIcon className="w-4 h-4" weight="bold" />
        <span>Thêm</span>
      </button>
    </form>
  );
});
