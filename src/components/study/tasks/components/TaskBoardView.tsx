"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  PlusIcon,
} from "@phosphor-icons/react";
import { KanbanBoard, KanbanCard, KanbanColumn, CardPriority } from "../types";
import { KanbanColumnItem } from "./KanbanColumnItem";
import { useFocusStats } from "@/lib/use-focus-stats";

interface TaskBoardViewProps {
  currentBoard: KanbanBoard;
  filterCards: (cards: KanbanCard[]) => KanbanCard[];
  draggingColId: string | null;
  dragOverColTargetId: string | null;
  dragOverColPosition: "before" | "after" | null;
  dragOverColId: string | null;
  draggingCardId: string | null;
  draggingCard: KanbanCard | null;
  dragOverCardId: string | null;
  dragOverCardPosition: "before" | "after" | null;
  isMeaningfulColMove: (colId: string, pos: "before" | "after") => boolean;
  isMeaningfulCardMove: (card: KanbanCard, pos: "before" | "after", currentCards: KanbanCard[]) => boolean;
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
  isAddingColumn: boolean;
  setIsAddingColumn: (isAdding: boolean) => void;
  newColumnTitle: string;
  setNewColumnTitle: (title: string) => void;
  handleAddColumn: () => void;
}

export const TaskBoardView = React.memo(function TaskBoardView({
  currentBoard,
  filterCards,
  draggingColId,
  dragOverColTargetId,
  dragOverColPosition,
  dragOverColId,
  draggingCardId,
  draggingCard,
  dragOverCardId,
  dragOverCardPosition,
  isMeaningfulColMove,
  isMeaningfulCardMove,
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
  isAddingColumn,
  setIsAddingColumn,
  newColumnTitle,
  setNewColumnTitle,
  handleAddColumn,
}: TaskBoardViewProps) {
  // Giờ focus tính 1 lần cho cả bảng rồi chia xuống từng thẻ,
  // khỏi mỗi thẻ nghe log + quét kho riêng (N thẻ = N lần việc).
  const allTimeStats = useFocusStats("all");
  const focusSecondsByTask = useMemo(
    () => new Map(allTimeStats.byTask.map((t) => [t.taskId, t.focusSeconds] as const)),
    [allTimeStats]
  );

  // Xếp cột trực tiếp lúc kéo (y như thẻ): cột đang kéo chèn ngay vào
  // chỗ rê tới, không hiện hộp preview xanh nữa. Thả ra là chốt đúng đó.
  let displayColumns = currentBoard.columns;
  if (
    draggingColId &&
    dragOverColTargetId &&
    dragOverColPosition &&
    isMeaningfulColMove(dragOverColTargetId, dragOverColPosition)
  ) {
    const remaining = currentBoard.columns.filter((c) => c.id !== draggingColId);
    const targetIdx = remaining.findIndex((c) => c.id === dragOverColTargetId);
    const dragged = currentBoard.columns.find((c) => c.id === draggingColId);
    if (targetIdx !== -1 && dragged) {
      const insertIdx = dragOverColPosition === "after" ? targetIdx + 1 : targetIdx;
      const reordered = [...remaining];
      reordered.splice(insertIdx, 0, dragged);
      displayColumns = reordered;
    }
  }

  return (
    <div className="flex items-start gap-5 min-w-max">
      {displayColumns.map((column, colIdx) => {
        const colCards = filterCards(currentBoard.cards.filter((c) => c.columnId === column.id));
        const isColumnDragging = draggingColId === column.id;
        const isColCardDragOver =
          dragOverColId === column.id &&
          draggingCardId !== null &&
          draggingCard?.columnId !== column.id;

        return (
          <motion.div
            key={column.id || `col-${colIdx}`}
            layout
            transition={{ type: "spring", stiffness: 500, damping: 42 }}
            className="flex items-start gap-5 flex-shrink-0"
          >
            <KanbanColumnItem
              column={column}
              colIdx={colIdx}
              totalColumns={currentBoard.columns.length}
              columns={currentBoard.columns}
              colCards={colCards}
              isColumnDragging={isColumnDragging}
              isColCardDragOver={isColCardDragOver}
              editingColumnId={editingColumnId}
              setEditingColumnId={setEditingColumnId}
              editingColumnTitle={editingColumnTitle}
              setEditingColumnTitle={setEditingColumnTitle}
              handleRenameColumn={handleRenameColumn}
              promptDeleteColumn={promptDeleteColumn}
              handleColumnDragStart={handleColumnDragStart}
              handleColumnDragEnd={handleColumnDragEnd}
              handleColumnDragOver={handleColumnDragOver}
              handleColumnDrop={handleColumnDrop}
              handleCardDragStart={handleCardDragStart}
              handleCardDragEnd={handleCardDragEnd}
              handleCardDragOverCol={handleCardDragOverCol}
              handleCardDragOverCard={handleCardDragOverCard}
              handleCardDrop={handleCardDrop}
              draggingCardId={draggingCardId}
              dragOverCardId={dragOverCardId}
              dragOverCardPosition={dragOverCardPosition}
              isMeaningfulCardMove={isMeaningfulCardMove}
              focusSecondsByTask={focusSecondsByTask}
              onSelectCard={onSelectCard}
              onToggleCardComplete={onToggleCardComplete}
              onMoveCard={onMoveCard}
              addingCardColId={addingCardColId}
              setAddingCardColId={setAddingCardColId}
              newCardTitle={newCardTitle}
              setNewCardTitle={setNewCardTitle}
              newCardDescription={newCardDescription}
              setNewCardDescription={setNewCardDescription}
              newCardPriority={newCardPriority}
              setNewCardPriority={setNewCardPriority}
              newCardDueDate={newCardDueDate}
              setNewCardDueDate={setNewCardDueDate}
              handleAddCard={handleAddCard}
              draggingColId={draggingColId}
              dragOverColId={dragOverColId}
              draggingCard={draggingCard}
            />
          </motion.div>
        );
      })}

      {/* Add Column Section */}
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 500, damping: 42 }}
        className="w-72 sm:w-80 flex-shrink-0"
      >
        {isAddingColumn ? (
          <div className="p-3.5 rounded-3xl bg-black/40 border border-white/20 shadow-xl backdrop-blur-xl space-y-3">
            <input
              type="text"
              placeholder="Tên danh sách mới..."
              value={newColumnTitle}
              onChange={(e) => setNewColumnTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddColumn();
                } else if (e.key === "Escape") {
                  setIsAddingColumn(false);
                }
              }}
              className="w-full p-2.5 rounded-xl bg-black/40 border border-white/10 text-xs font-bold text-white placeholder-white/40 focus:outline-none focus:border-white/30"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddingColumn(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white/50 hover:text-white cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleAddColumn}
                className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md cursor-pointer"
              >
                Tạo danh sách
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setIsAddingColumn(true);
              setNewColumnTitle("");
            }}
            className="w-full py-3.5 px-4 rounded-3xl bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-2 border border-dashed border-white/10 hover:border-white/20 cursor-pointer shadow-sm"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Thêm danh sách mới</span>
          </button>
        )}
      </motion.div>
    </div>
  );
});
