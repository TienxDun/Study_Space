"use client";

import React from "react";
import {
  CheckSquare,
  CheckCircle2,
  Circle,
  Calendar,
  GripVertical,
} from "lucide-react";
import { KanbanBoard, KanbanCard, KanbanColumn } from "../types";
import { getDeadlineStatus } from "../utils/task-deadline";

interface TaskListViewProps {
  currentBoard: KanbanBoard;
  filterCards: (cards: KanbanCard[]) => KanbanCard[];
  draggingCardId: string | null;
  dragOverCardId: string | null;
  dragOverCardPosition: "before" | "after" | null;
  isMeaningfulCardMove: (card: KanbanCard, pos: "before" | "after", currentCards: KanbanCard[]) => boolean;
  renderCardPlaceholder: (colId: string, cardId?: string, overridePos?: "before" | "after") => React.ReactNode;
  editingColumnId: string | null;
  setEditingColumnId: (id: string | null) => void;
  editingColumnTitle: string;
  setEditingColumnTitle: (title: string) => void;
  handleRenameColumn: (colId: string) => void;
  handleCardDragStart: (e: React.DragEvent, cardId: string, colId: string) => void;
  handleCardDragEnd: () => void;
  handleCardDragOverCol: (e: React.DragEvent, colId: string) => void;
  handleCardDragOverCard: (e: React.DragEvent, cardId: string) => void;
  handleCardDrop: (e: React.DragEvent, colId: string, cardId?: string, overridePos?: "before" | "after") => void;
  onSelectCard: (card: KanbanCard) => void;
  onToggleCardComplete: (cardId: string) => void;
}

export const TaskListView = React.memo(function TaskListView({
  currentBoard,
  filterCards,
  draggingCardId,
  dragOverCardId,
  dragOverCardPosition,
  isMeaningfulCardMove,
  renderCardPlaceholder,
  editingColumnId,
  setEditingColumnId,
  editingColumnTitle,
  setEditingColumnTitle,
  handleRenameColumn,
  handleCardDragStart,
  handleCardDragEnd,
  handleCardDragOverCol,
  handleCardDragOverCard,
  handleCardDrop,
  onSelectCard,
  onToggleCardComplete,
}: TaskListViewProps) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {currentBoard.columns.map((col, colIdx) => {
        const colCards = filterCards(currentBoard.cards.filter((c) => c.columnId === col.id));
        return (
          <div
            key={col.id || `col-list-${colIdx}`}
            className="p-4 rounded-3xl bg-black/30 backdrop-blur-md border border-white/10 space-y-3"
          >
            {/* List Header */}
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              {editingColumnId === col.id ? (
                <div className="flex items-center gap-2 max-w-xs flex-1">
                  <input
                    type="text"
                    value={editingColumnTitle}
                    onChange={(e) => setEditingColumnTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleRenameColumn(col.id);
                      } else if (e.key === "Escape") {
                        setEditingColumnId(null);
                      }
                    }}
                    onBlur={() => handleRenameColumn(col.id)}
                    className="w-full px-2.5 py-1 rounded-xl bg-black/60 border border-emerald-400/80 text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    autoFocus
                    onFocus={(e) => e.target.select()}
                    maxLength={50}
                  />
                </div>
              ) : (
                <h3
                  onClick={() => {
                    setEditingColumnId(col.id);
                    setEditingColumnTitle(col.title);
                  }}
                  className="font-bold text-sm text-white flex items-center gap-2 hover:text-emerald-200 cursor-text transition-colors"
                  title="Nhấn để đổi tên danh sách"
                >
                  <span>{col.title}</span>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs text-slate-300 font-mono">
                    {colCards.length}
                  </span>
                </h3>
              )}
            </div>

            {/* List Cards Drag & Drop Container */}
            <div
              onDragOver={(e) => {
                if (draggingCardId) handleCardDragOverCol(e, col.id);
              }}
              onDrop={(e) => {
                if (draggingCardId) handleCardDrop(e, col.id);
              }}
              className="space-y-2 min-h-[48px]"
            >
              {colCards.map((card, cardIdx) => {
                const totalCheck = card.checklist.length;
                const doneCheck = card.checklist.filter((i) => i.completed).length;
                const isFullyDone = totalCheck > 0 && doneCheck === totalCheck;
                const isDoneColumn =
                  /xong|done|hoàn thành/i.test(col.title) ||
                  (currentBoard.columns.length > 1 &&
                    col.id === currentBoard.columns[currentBoard.columns.length - 1].id);
                const isCardCompleted = Boolean(card.completed) || isDoneColumn || isFullyDone;
                const isCardDragging = draggingCardId === card.id;
                const isDragOverBefore =
                  dragOverCardId === card.id &&
                  dragOverCardPosition === "before" &&
                  isMeaningfulCardMove(card, "before", colCards);
                const isDragOverAfter =
                  dragOverCardId === card.id &&
                  dragOverCardPosition === "after" &&
                  isMeaningfulCardMove(card, "after", colCards);

                return (
                  <div key={card.id || `card-list-${cardIdx}`} className="space-y-2">
                    {isDragOverBefore && renderCardPlaceholder(col.id, card.id, "before")}

                    <div
                      draggable
                      onDragStart={(e) => handleCardDragStart(e, card.id, col.id)}
                      onDragEnd={handleCardDragEnd}
                      onDragOver={(e) => handleCardDragOverCard(e, card.id)}
                      onDrop={(e) => handleCardDrop(e, col.id, card.id)}
                      onClick={() => onSelectCard(card)}
                      className={`group p-3 rounded-2xl border transition-all cursor-grab active:cursor-grabbing select-none ${
                        Boolean(card.description) ? "space-y-1.5" : ""
                      } ${
                        isCardDragging
                          ? "opacity-25 border-dashed border-white/20 bg-white/[0.02] shadow-none"
                          : "bg-white/[0.05] hover:bg-white/[0.09] border-white/10 hover:border-white/20 shadow-sm"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 min-w-0">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <GripVertical className="w-3.5 h-3.5 text-white/20 group-hover:text-white/60 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleCardComplete(card.id);
                            }}
                            className="p-0.5 rounded-md hover:bg-white/10 text-white/40 hover:text-emerald-400 transition-colors flex-shrink-0 cursor-pointer flex items-center justify-center"
                            title={isCardCompleted ? "Đánh dấu chưa hoàn thành" : "Hoàn thành nhiệm vụ"}
                          >
                            {isCardCompleted ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />
                            ) : (
                              <Circle className="w-4 h-4 text-white/30 hover:text-emerald-400 transition-colors" />
                            )}
                          </button>

                          {card.priority === "high" && (
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)] shrink-0"
                              title="Mức độ ưu tiên: Cao"
                            />
                          )}
                          {card.priority === "medium" && (
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.7)] shrink-0"
                              title="Mức độ ưu tiên: Vừa"
                            />
                          )}
                          {card.priority === "low" && (
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-emerald-400/80 shrink-0"
                              title="Mức độ ưu tiên: Thấp"
                            />
                          )}

                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <h4
                              className={`text-xs font-semibold leading-normal truncate transition-colors ${
                                isCardCompleted
                                  ? "line-through text-slate-500"
                                  : "text-white group-hover:text-emerald-200"
                              }`}
                            >
                              {card.title}
                            </h4>
                            {Boolean(card.description) && (
                              <span className="text-[11px] text-slate-400/70 font-normal truncate hidden md:inline max-w-xs lg:max-w-sm">
                                — {card.description}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {card.dueDate &&
                            (() => {
                              const dStatus = getDeadlineStatus(card.dueDate);
                              if (!dStatus) return null;
                              return (
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-medium border ${dStatus.badgeClass}`}
                                >
                                  <Calendar className="w-3 h-3" />
                                  <span>{dStatus.label}</span>
                                </span>
                              );
                            })()}

                          {card.checklist.length > 0 && (
                            <span className="text-[10px] text-slate-300 bg-white/10 border border-white/10 px-2 py-0.5 rounded-lg font-mono flex items-center gap-1">
                              <CheckSquare className="w-3 h-3 text-emerald-400" />
                              <span>
                                {card.checklist.filter((i) => i.completed).length}/
                                {card.checklist.length}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isDragOverAfter && renderCardPlaceholder(col.id, card.id, "after")}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
});
