"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  DotsSixVerticalIcon,
  TrashIcon,
  PlusIcon,
  CalendarIcon,
  ClockIcon,
  XIcon,
} from "@phosphor-icons/react";
import { KanbanCard, KanbanColumn, CardPriority } from "../types";
import { KanbanCardItem } from "./KanbanCardItem";
import { PrioritySignalIcon } from "./PrioritySignalIcon";

interface KanbanColumnItemProps {
  column: KanbanColumn;
  colIdx: number;
  totalColumns: number;
  columns: KanbanColumn[];
  colCards: KanbanCard[];
  isColumnDragging: boolean;
  isColCardDragOver: boolean;
  editingColumnId: string | null;
  setEditingColumnId: (id: string | null) => void;
  editingColumnTitle: string;
  setEditingColumnTitle: (title: string) => void;
  handleRenameColumn: (colId: string) => void;
  promptDeleteColumn: (col: KanbanColumn) => void;
  handleColumnDragStart: (e: React.DragEvent, colId: string) => void;
  handleColumnDragEnd: () => void;
  handleColumnDragOver: (e: React.DragEvent, colId: string) => void;
  handleColumnDrop: (e: React.DragEvent, colId: string) => void;
  handleCardDragStart: (e: React.DragEvent, cardId: string, colId: string) => void;
  handleCardDragEnd: () => void;
  handleCardDragOverCol: (e: React.DragEvent, colId: string) => void;
  handleCardDragOverCard: (e: React.DragEvent, cardId: string) => void;
  handleCardDrop: (e: React.DragEvent, colId: string, cardId?: string, overridePos?: "before" | "after") => void;
  draggingCardId: string | null;
  dragOverCardId: string | null;
  dragOverCardPosition: "before" | "after" | null;
  isMeaningfulCardMove: (card: KanbanCard, pos: "before" | "after", currentCards: KanbanCard[]) => boolean;
  focusSecondsByTask?: Map<string, number>;
  onSelectCard: (card: KanbanCard) => void;
  onToggleCardComplete: (cardId: string) => void;
  onMoveCard: (cardId: string, targetColId: string) => void;
  addingCardColId: string | null;
  setAddingCardColId: (colId: string | null) => void;
  newCardTitle: string;
  setNewCardTitle: (title: string) => void;
  newCardDescription: string;
  setNewCardDescription: (desc: string) => void;
  newCardPriority: CardPriority;
  setNewCardPriority: (p: CardPriority) => void;
  newCardDueDate: string;
  setNewCardDueDate: (date: string) => void;
  handleAddCard: (colId: string, openDetail?: boolean) => void;
  draggingColId: string | null;
  dragOverColId?: string | null;
  draggingCard?: KanbanCard | null;
}

export const KanbanColumnItem = React.memo(function KanbanColumnItem({
  column,
  colIdx,
  totalColumns,
  columns,
  colCards,
  isColumnDragging,
  isColCardDragOver,
  editingColumnId,
  setEditingColumnId,
  editingColumnTitle,
  setEditingColumnTitle,
  handleRenameColumn,
  promptDeleteColumn,
  handleColumnDragStart,
  handleColumnDragEnd,
  handleColumnDragOver,
  handleColumnDrop,
  handleCardDragStart,
  handleCardDragEnd,
  handleCardDragOverCol,
  handleCardDragOverCard,
  handleCardDrop,
  draggingCardId,
  dragOverCardId,
  dragOverCardPosition,
  onSelectCard,
  onToggleCardComplete,
  onMoveCard,
  addingCardColId,
  setAddingCardColId,
  newCardTitle,
  setNewCardTitle,
  setNewCardDescription: _setNewCardDescription,
  newCardPriority,
  setNewCardPriority,
  newCardDueDate,
  setNewCardDueDate,
  handleAddCard,
  draggingColId,
  dragOverColId,
  draggingCard,
  focusSecondsByTask,
}: KanbanColumnItemProps) {
  const prevColumn = colIdx > 0 ? columns[colIdx - 1] : null;
  const nextColumn = colIdx < totalColumns - 1 ? columns[colIdx + 1] : null;
  const [isDueDateOpen, setIsDueDateOpen] = useState(false);
  const addCardContainerRef = useRef<HTMLDivElement>(null);

  const cycleNewCardPriority = () => {
    const next =
      newCardPriority === "low" ? "medium" : newCardPriority === "medium" ? "high" : "low";
    setNewCardPriority(next);
  };

  useEffect(() => {
    if (addingCardColId !== column.id) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        addCardContainerRef.current &&
        !addCardContainerRef.current.contains(target)
      ) {
        setAddingCardColId(null);
        setIsDueDateOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [addingCardColId, column.id, setAddingCardColId]);

  return (
    <div
      onDragOver={(e) => {
        if (draggingColId) {
          handleColumnDragOver(e, column.id);
        } else if (draggingCardId) {
          handleCardDragOverCol(e, column.id);
        }
      }}
      onDrop={(e) => {
        if (draggingColId) {
          handleColumnDrop(e, column.id);
        } else if (draggingCardId) {
          handleCardDrop(e, column.id);
        }
      }}
      className={`w-72 md:w-[290px] xl:w-80 flex-shrink-0 flex flex-col rounded-3xl backdrop-blur-md border shadow-lg p-3.5 min-h-[380px] max-h-[calc(100vh-210px)] transition-all ${
        isColumnDragging
          ? "opacity-25 scale-95 border-dashed border-white/20 bg-white/[0.02] shadow-none"
          : isColCardDragOver
          ? "border-sky-400/40 bg-sky-500/[0.03]"
          : "bg-black/30 hover:bg-black/40 border-white/10"
      }`}
    >
      {/* Column Header */}
      <div
        draggable={editingColumnId !== column.id}
        onDragStart={(e) => {
          if (editingColumnId === column.id) {
            e.preventDefault();
            return;
          }
          handleColumnDragStart(e, column.id);
        }}
        onDragEnd={handleColumnDragEnd}
        className="flex items-center justify-between pb-3 px-1 border-b border-white/10 cursor-grab active:cursor-grabbing select-none group/colheader gap-1.5"
        title="Nắm giữ để kéo thả đổi vị trí danh sách"
      >
        {editingColumnId === column.id ? (
          <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-1" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editingColumnTitle}
              onChange={(e) => setEditingColumnTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleRenameColumn(column.id);
                } else if (e.key === "Escape") {
                  setEditingColumnId(null);
                }
              }}
              onBlur={() => handleRenameColumn(column.id)}
              className="w-full px-2.5 py-1 rounded-xl bg-black/60 border border-sky-400/80 text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-sky-400"
              autoFocus
              onFocus={(e) => e.target.select()}
              maxLength={50}
            />
          </div>
        ) : (
          <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-1">
            <DotsSixVerticalIcon className="w-3.5 h-3.5 text-white/30 group-hover/colheader:text-white/70 transition-colors flex-shrink-0" />
            <h3
              onClick={(e) => {
                e.stopPropagation();
                setEditingColumnId(column.id);
                setEditingColumnTitle(column.title);
              }}
              className="text-sm font-bold text-white tracking-wide truncate max-w-full hover:bg-white/10 hover:text-sky-200 px-1.5 py-0.5 rounded-lg cursor-text transition-colors border border-transparent hover:border-white/10"
              title="Nhấn để đổi tên danh sách"
            >
              {column.title}
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-extrabold text-slate-300 flex-shrink-0">
              {colCards.length}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {totalColumns > 1 && (
            <button
              onClick={() => promptDeleteColumn(column)}
              className="p-1 rounded-lg text-white/40 hover:text-rose-400 hover:bg-white/10 transition-colors cursor-pointer"
              title="Xóa cột"
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Cards Scrollable Area */}
      <div
        onDragOver={(e) => handleCardDragOverCol(e, column.id)}
        onDrop={(e) => handleCardDrop(e, column.id)}
        className="flex-1 min-h-[220px] overflow-y-auto overflow-x-hidden py-2 space-y-2 pr-1 custom-study-scroll flex flex-col"
      >
        {(() => {
          // Tính displayCards theo thời gian thực (Live in-place reorder)
          let displayCards = colCards;
          if (draggingCard && draggingCardId) {
            const remainingCards = colCards.filter((c) => c.id !== draggingCardId);
            const isSourceCol = draggingCard.columnId === column.id;
            const targetInThisCol = dragOverCardId
              ? remainingCards.some((c) => c.id === dragOverCardId)
              : false;

            if (targetInThisCol && dragOverCardId) {
              const targetIdx = remainingCards.findIndex((c) => c.id === dragOverCardId);
              if (targetIdx !== -1) {
                const insertIdx = dragOverCardPosition === "after" ? targetIdx + 1 : targetIdx;
                const reordered = [...remainingCards];
                reordered.splice(insertIdx, 0, draggingCard);
                displayCards = reordered;
              }
            } else if (isSourceCol) {
              // Thẻ thuộc cột này và chưa rê vào thẻ khác: Giữ nguyên 100% vị trí ban đầu!
              displayCards = colCards;
            } else if (dragOverColId === column.id) {
              // Thẻ thuộc cột khác và chuột đang ở cột này: thêm vào cuối cột này
              displayCards = [...remainingCards, draggingCard];
            } else {
              displayCards = remainingCards;
            }
          }

          return displayCards.map((card, cardIdx) => {
            const isCardDragging = draggingCardId === card.id;

            return (
              <KanbanCardItem
                key={card.id || `card-${cardIdx}`}
                card={card}
                column={column}
                colIdx={colIdx}
                totalColumns={totalColumns}
                isCardDragging={isCardDragging}
                focusSeconds={focusSecondsByTask?.get(card.id) ?? 0}
                onCardClick={() => onSelectCard(card)}
                onToggleComplete={() => onToggleCardComplete(card.id)}
                onMoveCard={(targetColId) => onMoveCard(card.id, targetColId)}
                prevColumn={prevColumn}
                nextColumn={nextColumn}
                onDragStart={(e) => handleCardDragStart(e, card.id, column.id)}
                onDragEnd={handleCardDragEnd}
                onDragOver={(e) => {
                  if (isCardDragging) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = "move";
                  } else {
                    handleCardDragOverCard(e, card.id);
                  }
                }}
                onDrop={(e) => {
                  if (isCardDragging) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCardDrop(e, column.id);
                  } else {
                    handleCardDrop(e, column.id, card.id);
                  }
                }}
              />
            );
          });
        })()}

        {colCards.length === 0 && addingCardColId !== column.id && (!draggingCard || dragOverColId !== column.id) && (
          <div className="flex-1 min-h-[140px] flex flex-col items-center justify-center p-4 rounded-2xl border border-dashed border-white/5 text-center select-none pointer-events-none">
            <p className="text-xs text-white/30 font-medium">Chưa có nhiệm vụ</p>
            <p className="text-[10px] text-white/20 mt-1">Kéo thả thẻ vào đây hoặc nhấn Thêm</p>
          </div>
        )}

        {/* Modern Inline Quick Add Card */}
        {addingCardColId === column.id && (
          <div
            ref={addCardContainerRef}
            className="p-3 rounded-2xl bg-black/40 backdrop-blur-2xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.5)] space-y-2.5 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Input field */}
            <input
              type="text"
              placeholder="Nhập tên nhiệm vụ..."
              value={newCardTitle}
               onFocus={() => {}}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (newCardTitle.trim()) {
                    handleAddCard(column.id);
                  }
                } else if (e.key === "Escape") {
                   setAddingCardColId(null);
                   setIsDueDateOpen(false);
                }
              }}
              className="w-full px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/10 focus:border-white/25 text-xs font-semibold text-white placeholder-white/30 focus:outline-none transition-all"
              autoFocus
            />

            {/* Inline Due Date & Time Panel (Expandable directly within card without overlapping inputs) */}
            {isDueDateOpen && (
              <div className="p-2.5 rounded-xl bg-black/50 border border-white/10 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hạn chót</span>
                  {newCardDueDate && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewCardDueDate("");
                        setIsDueDateOpen(false);
                      }}
                      className="text-xs text-rose-400 hover:text-rose-300 font-medium cursor-pointer"
                    >
                      Gỡ hạn
                    </button>
                  )}
                </div>

                {(() => {
                  const [dateVal = "", timeVal = ""] = newCardDueDate.includes("T")
                    ? newCardDueDate.split("T")
                    : [newCardDueDate, ""];

                  const todayStr = new Date().toISOString().split("T")[0];
                  const tmrDate = new Date();
                  tmrDate.setDate(tmrDate.getDate() + 1);
                  const tmrStr = tmrDate.toISOString().split("T")[0];

                  return (
                    <div className="space-y-2">
                      {/* Date & Time inputs */}
                      <div className="flex items-center gap-1.5">
                        <input
                          type="date"
                          value={dateVal}
                          onChange={(e) => {
                            const nDate = e.target.value;
                            if (!nDate) {
                              setNewCardDueDate("");
                            } else {
                              setNewCardDueDate(timeVal ? `${nDate}T${timeVal}` : nDate);
                            }
                          }}
                          className="flex-1 min-w-0 h-7 px-2 rounded-lg bg-black/60 border border-white/15 text-xs text-white focus:outline-none cursor-pointer [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                        />
                        {timeVal ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <input
                              type="time"
                              value={timeVal}
                              onChange={(e) => {
                                const nTime = e.target.value;
                                if (dateVal) {
                                  setNewCardDueDate(nTime ? `${dateVal}T${nTime}` : dateVal);
                                }
                              }}
                              className="w-24 h-7 px-1.5 rounded-lg bg-black/60 border border-white/15 text-xs text-white focus:outline-none cursor-pointer [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (dateVal) setNewCardDueDate(dateVal);
                              }}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-white/5 transition-colors cursor-pointer"
                              title="Gỡ giờ"
                            >
                              <XIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              const baseDate = dateVal || todayStr;
                              setNewCardDueDate(`${baseDate}T23:59`);
                            }}
                            className="h-7 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-dashed border-white/20 text-xs text-slate-300 flex items-center gap-1 cursor-pointer shrink-0"
                            title="Thêm giờ"
                          >
                            <ClockIcon className="w-3 h-3 text-slate-400" />
                            <span>+ Giờ</span>
                          </button>
                        )}
                      </div>

                      {/* Quick Date Presets Row */}
                      <div className="flex items-center gap-2 pt-0.5">
                        <span className="text-xs text-slate-400 shrink-0 font-medium">Ngày:</span>
                        <div className="flex items-center gap-1.5 flex-1">
                          <button
                            type="button"
                            onClick={() => {
                              setNewCardDueDate(timeVal ? `${todayStr}T${timeVal}` : todayStr);
                            }}
                            className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer text-center ${
                              dateVal === todayStr
                                ? "bg-sky-500/20 border border-sky-400/40 text-sky-300 font-bold"
                                : "bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 hover:text-white"
                            }`}
                          >
                            Hôm nay
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewCardDueDate(timeVal ? `${tmrStr}T${timeVal}` : tmrStr);
                            }}
                            className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer text-center ${
                              dateVal === tmrStr
                                ? "bg-sky-500/20 border border-sky-400/40 text-sky-300 font-bold"
                                : "bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 hover:text-white"
                            }`}
                          >
                            Ngày mai
                          </button>
                        </div>
                      </div>

                      {/* Quick Time Presets Row */}
                      {dateVal && (
                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="text-xs text-slate-400 shrink-0 font-medium">Giờ:</span>
                          <div className="grid grid-cols-4 gap-1 flex-1">
                            {["09:00", "12:00", "18:00", "23:59"].map((tp) => (
                              <button
                                key={tp}
                                type="button"
                                onClick={() => {
                                  setNewCardDueDate(`${dateVal}T${tp}`);
                                }}
                                className={`py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer text-center ${
                                  timeVal === tp
                                    ? "bg-sky-500/25 border border-sky-400/40 text-sky-200 font-bold"
                                    : "bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 hover:text-white"
                                }`}
                              >
                                {tp}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Action & Option Bar */}
            <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-white/5">
              {/* Optional attributes: Priority & Due Date */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Priority Chip */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={cycleNewCardPriority}
                    className={`h-6 px-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      newCardPriority === "high"
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                        : newCardPriority === "medium"
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    }`}
                    title="Mức độ ưu tiên"
                  >
                    <PrioritySignalIcon priority={newCardPriority} className="w-3 h-3 shrink-0" />
                    <span>
                      {newCardPriority === "high" ? "Cao" : newCardPriority === "medium" ? "Vừa" : "Thấp"}
                    </span>
                  </button>

                </div>

                {/* Due Date Toggle Button */}
                <button
                  type="button"
                    onClick={() => {
                      setIsDueDateOpen(!isDueDateOpen);
                    }}
                  className={`h-6 rounded-lg border text-xs font-medium flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    newCardDueDate || isDueDateOpen
                      ? "px-2 bg-sky-500/15 border-sky-400/40 text-sky-200 font-medium"
                      : "w-6 justify-center bg-white/[0.04] border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/[0.08]"
                  }`}
                  title={newCardDueDate ? `Hạn chót: ${newCardDueDate}` : "Gán hạn chót"}
                >
                  <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
                  {newCardDueDate && (
                    <span>
                      {(() => {
                        const [dPart = "", tPart = ""] = newCardDueDate.split("T");
                        const [, m = "", d = ""] = dPart.split("-");
                        return tPart ? `${d}/${m} ${tPart}` : `${d}/${m}`;
                      })()}
                    </span>
                  )}
                </button>
              </div>

              {/* Action buttons: Cancel & Add */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setAddingCardColId(null);
                    setIsDueDateOpen(false);
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={!newCardTitle.trim()}
                  onClick={() => {
                    if (newCardTitle.trim()) {
                      handleAddCard(column.id);
                    }
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm whitespace-nowrap shrink-0 ${
                    newCardTitle.trim()
                      ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                      : "bg-white/10 text-white/30 cursor-not-allowed"
                  }`}
                >
                  Thêm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Card Quick Button */}
      {addingCardColId !== column.id && (
        <button
          onClick={() => {
            setAddingCardColId(column.id);
            setNewCardTitle("");
            _setNewCardDescription("");
             setNewCardPriority("low");
            setNewCardDueDate("");
          }}
          className="w-full mt-2 py-2 px-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-2 border border-dashed border-white/10 hover:border-white/20 cursor-pointer"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          <span>Thêm thẻ mới</span>
        </button>
      )}
    </div>
  );
});
