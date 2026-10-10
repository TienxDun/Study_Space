"use client";

import React from "react";
import {
  CheckSquare,
  CheckCircle2,
  Circle,
  Calendar,
  ArrowLeft,
  ArrowRight,
  GripVertical,
  Timer,
} from "lucide-react";
import { KanbanCard, KanbanColumn } from "../types";
import { getDeadlineStatus } from "../utils/task-deadline";
import { startFocusTask } from "@/lib/use-focus-task";
import { PrioritySignalIcon } from "./PrioritySignalIcon";

interface KanbanCardItemProps {
  card: KanbanCard;
  column: KanbanColumn;
  colIdx: number;
  totalColumns: number;
  isCardDragging: boolean;
  onCardClick: () => void;
  onToggleComplete: () => void;
  onMoveCard: (targetColId: string) => void;
  prevColumn: KanbanColumn | null;
  nextColumn: KanbanColumn | null;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export const KanbanCardItem = React.memo(function KanbanCardItem({
  card,
  column,
  colIdx,
  totalColumns,
  isCardDragging,
  onCardClick,
  onToggleComplete,
  onMoveCard,
  prevColumn,
  nextColumn,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: KanbanCardItemProps) {
  const totalCheck = card.checklist.length;
  const doneCheck = card.checklist.filter((i) => i.completed).length;
  const progressPercent = totalCheck > 0 ? Math.round((doneCheck / totalCheck) * 100) : 0;
  const isFullyDone = totalCheck > 0 && doneCheck === totalCheck;
  const isDoneColumn = /xong|done|hoàn thành/i.test(column.title) || (totalColumns > 1 && colIdx === totalColumns - 1);
  const isCardCompleted = Boolean(card.completed) || isDoneColumn || isFullyDone;

  return (
    <div
      draggable={!isCardDragging}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={() => {
        if (!isCardDragging) onCardClick();
      }}
      className={`group p-3 rounded-2xl backdrop-blur-md border shadow-sm transition-all select-none space-y-2 relative ${
        isCardDragging
          ? "cursor-grabbing opacity-90 ring-1 ring-white/20 bg-white/[0.08] border-white/12"
          : "bg-white/[0.08] hover:bg-white/[0.14] border-white/12 hover:border-white/25 cursor-grab active:cursor-grabbing"
      }`}
    >
      {/* Title, Quick Checkbox, Priority Micro-Dot & Grip */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Quick Complete Checkbox */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete();
            }}
            className={`rounded-md hover:bg-white/10 text-white/40 hover:text-emerald-400 transition-all duration-200 flex-shrink-0 cursor-pointer flex items-center justify-center overflow-hidden ${
              isCardCompleted
                ? "w-5 h-5 p-0.5 opacity-100"
                : "w-0 h-5 p-0 opacity-0 -mr-2 group-hover:w-5 group-hover:p-0.5 group-hover:opacity-100 group-hover:mr-0 focus-visible:w-5 focus-visible:p-0.5 focus-visible:opacity-100 focus-visible:mr-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400"
            }`}
            title={isCardCompleted ? "Đánh dấu chưa hoàn thành" : "Hoàn thành nhiệm vụ"}
          >
            {isCardCompleted ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 fill-emerald-400/20 shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-white/30 hover:text-emerald-400 transition-colors shrink-0" />
            )}
          </button>

          {/* Priority Signal Bars */}
          {Boolean(card.priority) && (
            <span
              title={`Mức độ ưu tiên: ${
                card.priority === "high"
                  ? "Cao"
                  : card.priority === "medium"
                  ? "Vừa"
                  : "Thấp"
              }`}
              className="flex items-center"
            >
              <PrioritySignalIcon priority={card.priority} className="w-3 h-3 shrink-0" />
            </span>
          )}

          {/* Card Title */}
          <h4
            className={`text-xs font-semibold leading-normal break-words [overflow-wrap:anywhere] min-w-0 flex-1 transition-all ${
              isCardCompleted ? "line-through text-slate-500" : "text-slate-100 group-hover:text-emerald-200"
            }`}
          >
            {card.title}
          </h4>
        </div>

        <GripVertical className="w-3.5 h-3.5 text-white/20 group-hover:text-white/60 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Progress bar if checklist exists */}
      {totalCheck > 0 && (
        <div className="space-y-1 pt-0.5">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1 text-slate-300">
              <CheckSquare className="w-3 h-3 text-emerald-400" />
              <span>
                {doneCheck}/{totalCheck}
              </span>
            </span>
            <span className="text-xs text-slate-400">{progressPercent}%</span>
          </div>
          <div className="w-full h-1 rounded-full bg-black/40 border border-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-400/90 transition-all duration-300 shadow-[0_0_4px_rgba(52,211,153,0.4)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Card Footer: Deadline & Pomodoro Badges */}
      <div
        className={`flex items-center justify-between text-xs text-slate-400 ${
          card.dueDate || (card.pomodoros && card.pomodoros > 0) ? "pt-1.5 border-t border-white/5" : "pt-0"
        }`}
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          {card.dueDate &&
            (() => {
              const dStatus = getDeadlineStatus(card.dueDate);
              if (!dStatus) return null;
              return (
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] border ${dStatus.badgeClass}`}
                >
                  <Calendar className="w-2.5 h-2.5" />
                  <span>{dStatus.shortLabel}</span>
                </span>
              );
            })()}

          {card.pomodoros !== undefined && card.pomodoros > 0 && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono"
              title={`Đã tích lũy ${card.pomodoros} phiên Pomodoro (${card.pomodoros * 25} phút)`}
            >
              <span>🍅</span>
              <span>{card.pomodoros}</span>
            </span>
          )}
        </div>

        {/* Quick Actions (Focus Pomodoro & Move Column) */}
        <div
          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => startFocusTask({ id: card.id, title: card.title })}
            className="p-1 rounded-md hover:bg-amber-500/20 text-white/50 hover:text-amber-300 transition-colors cursor-pointer"
            title="Tập trung vào nhiệm vụ này với Pomodoro"
          >
            <Timer className="w-3 h-3" />
          </button>
          {prevColumn && (
            <button
              onClick={() => onMoveCard(prevColumn.id)}
              className="p-1 rounded-md hover:bg-white/20 text-white/60 hover:text-white cursor-pointer"
              title={`Chuyển sang: ${prevColumn.title}`}
            >
              <ArrowLeft className="w-3 h-3" />
            </button>
          )}
          {nextColumn && (
            <button
              onClick={() => onMoveCard(nextColumn.id)}
              className="p-1 rounded-md hover:bg-white/20 text-white/60 hover:text-white cursor-pointer"
              title={`Chuyển sang: ${nextColumn.title}`}
            >
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
