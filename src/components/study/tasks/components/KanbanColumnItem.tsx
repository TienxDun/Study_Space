"use client";

import React from "react";
import {
  GripVertical,
  Trash2,
  Plus,
  Calendar,
  X,
} from "lucide-react";
import { KanbanCard, KanbanColumn, CardPriority } from "../types";
import { KanbanCardItem } from "./KanbanCardItem";

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
  renderCardPlaceholder: (colId: string, cardId?: string, overridePos?: "before" | "after") => React.ReactNode;
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
  isMeaningfulCardMove,
  renderCardPlaceholder,
  onSelectCard,
  onToggleCardComplete,
  onMoveCard,
  addingCardColId,
  setAddingCardColId,
  newCardTitle,
  setNewCardTitle,
  newCardDescription,
  setNewCardDescription,
  newCardPriority,
  setNewCardPriority,
  newCardDueDate,
  setNewCardDueDate,
  handleAddCard,
  draggingColId,
}: KanbanColumnItemProps) {
  const prevColumn = colIdx > 0 ? columns[colIdx - 1] : null;
  const nextColumn = colIdx < totalColumns - 1 ? columns[colIdx + 1] : null;

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
      className={`w-72 sm:w-80 flex-shrink-0 flex flex-col rounded-3xl backdrop-blur-md border shadow-lg p-3.5 max-h-[calc(100vh-210px)] transition-all ${
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
            <GripVertical className="w-3.5 h-3.5 text-white/30 group-hover/colheader:text-white/70 transition-colors flex-shrink-0" />
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
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Cards Scrollable Area */}
      <div
        onDragOver={(e) => handleCardDragOverCol(e, column.id)}
        onDrop={(e) => handleCardDrop(e, column.id)}
        className="flex-1 overflow-y-auto py-3 space-y-2 pr-1 custom-study-scroll min-h-[80px]"
      >
        {colCards.map((card, cardIdx) => {
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
            <div key={card.id || `card-${cardIdx}`} className="space-y-2">
              {/* Live Preview Card Placeholder (Before) */}
              {isDragOverBefore && renderCardPlaceholder(column.id, card.id, "before")}

              <KanbanCardItem
                card={card}
                column={column}
                colIdx={colIdx}
                totalColumns={totalColumns}
                isCardDragging={isCardDragging}
                onCardClick={() => onSelectCard(card)}
                onToggleComplete={() => onToggleCardComplete(card.id)}
                onMoveCard={(targetColId) => onMoveCard(card.id, targetColId)}
                prevColumn={prevColumn}
                nextColumn={nextColumn}
                onDragStart={(e) => handleCardDragStart(e, card.id, column.id)}
                onDragEnd={handleCardDragEnd}
                onDragOver={(e) => handleCardDragOverCard(e, card.id)}
                onDrop={(e) => handleCardDrop(e, column.id, card.id)}
              />

              {/* Live Preview Card Placeholder (After) */}
              {isDragOverAfter && renderCardPlaceholder(column.id, card.id, "after")}
            </div>
          );
        })}

        {/* Live Preview Card Placeholder in Empty Column */}
        {colCards.length === 0 && isColCardDragOver && renderCardPlaceholder(column.id)}

        {/* Inline Add Card Input */}
        {addingCardColId === column.id && (
          <div className="p-3 rounded-2xl bg-black/50 border border-white/20 shadow-xl space-y-2.5 backdrop-blur-xl">
            <input
              type="text"
              placeholder="Tiêu đề nhiệm vụ..."
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCard(column.id);
                } else if (e.key === "Escape") {
                  setAddingCardColId(null);
                }
              }}
              className="w-full p-2.5 rounded-xl bg-black/40 border border-white/10 text-xs font-bold text-white placeholder-white/40 focus:outline-none focus:border-white/30"
              autoFocus
            />

            <textarea
              rows={2}
              placeholder="Mô tả chi tiết (tùy chọn)..."
              value={newCardDescription}
              onChange={(e) => setNewCardDescription(e.target.value)}
              className="w-full p-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/30 resize-none"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Ưu tiên:
                </span>
                <div className="grid grid-cols-3 gap-1 p-0.5 rounded-xl bg-black/40 border border-white/10 text-[11px] font-bold">
                  {[
                    {
                      value: "low",
                      label: "Thấp",
                      activeClass: "bg-emerald-500 text-slate-950 font-extrabold shadow-sm",
                      idleClass: "text-emerald-400/80 hover:text-emerald-300",
                    },
                    {
                      value: "medium",
                      label: "Vừa",
                      activeClass: "bg-amber-500 text-slate-950 font-extrabold shadow-sm",
                      idleClass: "text-amber-400/80 hover:text-amber-300",
                    },
                    {
                      value: "high",
                      label: "Cao",
                      activeClass: "bg-rose-500 text-white font-extrabold shadow-sm",
                      idleClass: "text-rose-400/80 hover:text-rose-300",
                    },
                  ].map((p) => {
                    const isSelected = newCardPriority === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setNewCardPriority(p.value as CardPriority)}
                        className={`py-1 rounded-lg text-center transition-all cursor-pointer ${
                          isSelected ? p.activeClass : `${p.idleClass} hover:bg-white/5`
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Hạn chót:
                </span>
                <input
                  type="date"
                  value={newCardDueDate}
                  onChange={(e) => setNewCardDueDate(e.target.value)}
                  className="w-full py-1 px-2 rounded-xl bg-black/40 border border-white/10 text-[11px] font-semibold text-white focus:outline-none focus:border-white/30 cursor-pointer [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => handleAddCard(column.id, true)}
                className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold cursor-pointer underline flex items-center gap-1"
              >
                + Chi tiết & checklist
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAddingCardColId(null)}
                  className="px-2.5 py-1 rounded-xl text-xs font-semibold text-white/50 hover:text-white cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCard(column.id)}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md cursor-pointer"
                >
                  Thêm thẻ
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
            setNewCardDescription("");
            setNewCardPriority("medium");
            setNewCardDueDate("");
          }}
          className="w-full mt-2 py-2 px-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-2 border border-dashed border-white/10 hover:border-white/20 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Thêm thẻ mới</span>
        </button>
      )}
    </div>
  );
});
