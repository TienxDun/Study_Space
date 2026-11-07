"use client";

import React, { useRef } from "react";
import {
  CheckCircleIcon,
  CircleIcon,
  CheckSquareIcon,
  TimerIcon,
} from "@phosphor-icons/react";
import { KanbanCard, KanbanColumn } from "@/components/study/tasks/types";
import { getDeadlineStatus } from "@/components/study/tasks/utils/task-deadline";
import { PrioritySignalIcon } from "@/components/study/tasks/components/PrioritySignalIcon";
import { formatFocusDuration } from "@/lib/focus-sessions";
import { startFocusTask } from "@/lib/use-focus-task";
import { MobileTaskBubbleMenu } from "./MobileTaskBubbleMenu";

export interface MobileTaskItemProps {
  card: KanbanCard;
  colId: string;
  colTitle: string;
  idx: number;
  columns: KanbanColumn[];
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onToggleComplete: (cardId: string) => void;
  onSelectCard: (card: KanbanCard) => void;
  onMoveCard: (targetColId: string) => void;
  onPromptDeleteCard: (card: KanbanCard) => void;
  focusSeconds: number;
}

/**
 * Hiển thị một thẻ công việc dạng danh sách trên điện thoại.
 * Hỗ trợ checkbox 1 chạm, nhấn để mở chi tiết, nhấn giữ mở menu thao tác nhanh.
 */
export const MobileTaskItem = React.memo(function MobileTaskItem({
  card,
  colId,
  colTitle,
  idx,
  columns,
  isMenuOpen,
  onToggleMenu,
  onCloseMenu,
  onToggleComplete,
  onSelectCard,
  onMoveCard,
  onPromptDeleteCard,
  focusSeconds,
}: MobileTaskItemProps) {
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startLongPress = () => {
    longPressTimerRef.current = setTimeout(() => {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(30);
        } catch {}
      }
      onToggleMenu();
    }, 450);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const deadline = getDeadlineStatus(card.dueDate);
  const isDoneColumn = /xong|done|hoàn thành/i.test(colTitle);
  const isCompleted = Boolean(card.completed) || isDoneColumn;
  const checklistTotal = card.checklist?.length || 0;
  const checklistDone = card.checklist?.filter((i) => i.completed).length || 0;

  const hasFocusTime = focusSeconds > 0 || (card.pomodoros !== undefined && card.pomodoros > 0);
  const formattedFocusTime =
    focusSeconds > 0
      ? formatFocusDuration(focusSeconds)
      : `${card.pomodoros} phiên`;

  return (
    <div
      onTouchStart={startLongPress}
      onTouchMove={cancelLongPress}
      onTouchEnd={cancelLongPress}
      onTouchCancel={cancelLongPress}
      style={{ "--stagger-idx": Math.min(idx, 10) } as React.CSSProperties}
      className={`group rounded-2xl border transition-all select-none p-3 sheet-stagger-item ${
        isMenuOpen ? "relative z-30" : "relative z-0"
      } ${
        isCompleted
          ? "bg-white/[0.02] border-emerald-500/20 opacity-80"
          : "bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08]"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox tròn lớn 1 chạm */}
        <button
          type="button"
          onClick={() => onToggleComplete(card.id)}
          aria-label={isCompleted ? "Đánh dấu chưa xong" : "Đánh dấu hoàn thành"}
          className="mt-0.5 shrink-0 active:scale-90 transition-transform cursor-pointer"
        >
          {isCompleted ? (
            <CheckCircleIcon
              weight="fill"
              className="w-5 h-5 text-emerald-400"
            />
          ) : (
            <CircleIcon
              weight="regular"
              className="w-5 h-5 text-white/35 hover:text-white/60 transition-colors"
            />
          )}
        </button>

        {/* Thân thẻ: Bấm để mở chi tiết */}
        <div
          onClick={() => onSelectCard(card)}
          className="flex-1 min-w-0 cursor-pointer"
        >
          <p
            className={`text-xs font-semibold leading-snug break-words ${
              isCompleted
                ? "line-through text-white/40"
                : "text-white/90 group-hover:text-white"
            }`}
          >
            {card.title}
          </p>

          {/* Thông tin phụ: Nhãn cột, Mức độ ưu tiên, Pomodoro, Deadline, Checklist */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {/* Nhãn cột hiện tại */}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium border ${
                isDoneColumn
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
                  : "bg-white/[0.06] text-white/60 border-white/[0.06]"
              }`}
            >
              {colTitle}
            </span>

            {/* Mức độ ưu tiên */}
            {Boolean(card.priority) && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium flex items-center gap-1 ${
                  card.priority === "high"
                    ? "bg-rose-500/15 text-rose-300 border border-rose-400/30"
                    : card.priority === "low"
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/30"
                    : "bg-amber-500/15 text-amber-300 border border-amber-400/30"
                }`}
              >
                <PrioritySignalIcon priority={card.priority} className="w-2.5 h-2.5 shrink-0" />
                <span>
                  {card.priority === "high"
                    ? "Gấp"
                    : card.priority === "low"
                    ? "Thấp"
                    : "Vừa"}
                </span>
              </span>
            )}

            {/* Thời gian tập trung Pomodoro đã ghi nhận */}
            {hasFocusTime && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-md font-medium font-mono flex items-center gap-1 bg-amber-500/15 text-amber-200 border border-amber-400/30 shadow-xs"
                title={`Thời gian tập trung Pomodoro: ${formattedFocusTime}`}
              >
                <TimerIcon className="w-2.5 h-2.5 shrink-0 text-amber-300" weight="fill" />
                <span>{formattedFocusTime}</span>
              </span>
            )}

            {/* Deadline nếu có */}
            {deadline && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold flex items-center gap-1 ${
                  deadline.isOverdue
                    ? "bg-rose-500/15 text-rose-300 border border-rose-400/30"
                    : deadline.isToday
                    ? "bg-amber-500/15 text-amber-300 border border-amber-400/30"
                    : "bg-white/10 text-white/70"
                }`}
              >
                {deadline.label}
              </span>
            )}

            {/* Checklist nếu có */}
            {checklistTotal > 0 && (
              <span className="text-[10px] text-white/50 flex items-center gap-1">
                <CheckSquareIcon className="w-3 h-3 text-emerald-400" />
                <span>
                  {checklistDone}/{checklistTotal}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Bubble Menu: Thao tác nhanh dạng bong bóng nổi */}
        <MobileTaskBubbleMenu
          card={card}
          columns={columns}
          currentColId={colId}
          isOpen={isMenuOpen}
          onToggle={onToggleMenu}
          onClose={onCloseMenu}
          onStartFocus={() => {
            startFocusTask({ id: card.id, title: card.title });
          }}
          onSelectDetail={() => onSelectCard(card)}
          onMoveCard={(targetColId) => onMoveCard(targetColId)}
          onDeleteCard={() => onPromptDeleteCard(card)}
          hasFocusTime={hasFocusTime}
          formattedFocusTime={formattedFocusTime}
        />
      </div>
    </div>
  );
});
