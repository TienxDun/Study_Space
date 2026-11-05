"use client";

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { StudyTasksWidgetProps } from "./types";
import { getDeadlineStatus } from "./utils/task-deadline";
import { useKanbanBoards } from "./hooks/useKanbanBoards";
import { TaskHeader } from "./components/TaskHeader";
import { TaskBoardView } from "./components/TaskBoardView";
import { TaskListView } from "./components/TaskListView";
import { CardDetailModal } from "./components/CardDetailModal";
import { MobileUndoSnackbar } from "@/components/study/mobile/feedback/MobileUndoSnackbar";

export { getDeadlineStatus };

export const StudyTasksWidget = ({ isOpen, onClose }: StudyTasksWidgetProps) => {
  const {
    boards,
    setActiveBoardId,
    currentBoard,
    updateCurrentBoard,
    boardToDelete,
    setBoardToDelete,
    columnToDelete,
    setColumnToDelete,
    cardToDelete,
    setCardToDelete,
    searchQuery,
    setSearchQuery,
    viewMode,
    setViewMode,
    selectedCard,
    setSelectedCard,
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
    isAddingColumn,
    setIsAddingColumn,
    newColumnTitle,
    setNewColumnTitle,
    editingColumnId,
    setEditingColumnId,
    editingColumnTitle,
    setEditingColumnTitle,
    isStatusDropdownOpen,
    setIsStatusDropdownOpen,
    isBoardDropdownOpen,
    setIsBoardDropdownOpen,
    isEditingBoardTitle,
    setIsEditingBoardTitle,
    editingBoardTitleText,
    setEditingBoardTitleText,
    draggingCardId,
    dragOverColId,
    dragOverCardId,
    dragOverCardPosition,
    draggingColId,
    dragOverColTargetId,
    dragOverColPosition,
    draggingCard,
    handleAddCard,
    handleCardDragStart,
    handleCardDragEnd,
    handleCardDragOverCol,
    handleCardDragOverCard,
    handleCardDrop,
    handleColumnDragStart,
    handleColumnDragEnd,
    handleColumnDragOver,
    handleColumnDrop,
    handleMoveCard,
    promptDeleteCard,
    handleConfirmDeleteCard,
    lastDeletedCard,
    undoDeleteCard,
    clearDeletedCard,
    handleAddColumn,
    promptDeleteColumn,
    handleConfirmDeleteColumn,
    handleRenameColumn,
    handleToggleChecklist,
    handleToggleCardComplete,
    handleAddChecklistItem,
    handleUpdateChecklistItemText,
    handleDeleteChecklistItem,
    handleCreateBoard,
    promptDeleteBoard,
    handleConfirmDeleteBoard,
    handleUpdateCardDueDate,
    filterCards,
    isMeaningfulColMove,
    isMeaningfulCardMove,
  } = useKanbanBoards();

  // Giữ phím Tab bên trong cửa sổ Kanban khi mở
  const panelRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const isConfirmOpen = Boolean(boardToDelete || columnToDelete || cardToDelete);
  const isCardDetailOpen = Boolean(selectedCard);

  useEffect(() => {
    if (!isOpen) return;
    // Khi có cửa sổ xác nhận xóa nổi lên trên, nhường Tab cho nó
    if (isConfirmOpen) return;
    prevFocusRef.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => panelRef.current?.focus(), 60);

    const getFocusable = (root: HTMLElement): HTMLElement[] => {
      const nodes = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      return nodes.filter((el) => {
        if (el.hasAttribute("disabled")) return false;
        const rect = el.getBoundingClientRect();
        // Bỏ qua ô đang ẩn (rộng/cao = 0)
        if (rect.width === 0 && rect.height === 0) return false;
        return el.offsetParent !== null || el === document.activeElement;
      });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Cửa sổ chi tiết thẻ đã tự chặn Esc, ở đây chỉ lo Tab + Esc đóng Kanban
      if (e.key === "Escape") {
        if (isCardDetailOpen) return;
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = panelRef.current;
      if (!root) return;
      const list = getFocusable(root);
      if (list.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKeyDown, true);
      prevFocusRef.current?.focus?.();
    };
  }, [isOpen, isConfirmOpen, isCardDetailOpen, onClose]);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="hidden sm:flex fixed inset-x-0 top-16 bottom-24 z-[60] items-center justify-center px-3 sm:px-6 pointer-events-none">
            {/* Backdrop */}
            <motion.div
              key="tasks-widget-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs pointer-events-auto cursor-pointer"
              onClick={onClose}
              aria-hidden="true"
            />

            {/* Panel nhận focus lập trình khi mở (đọc dialog) nên tắt outline
                của khung — nút/input bên trong vẫn giữ ring focus riêng. */}
            <motion.div
              key="tasks-widget-panel"
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Quản lý công việc Kanban"
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-[96vw] sm:w-[94vw] lg:w-[90vw] xl:w-[86vw] max-w-[1520px] h-full rounded-3xl bg-black/40 hover:bg-black/45 backdrop-blur-xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden text-white select-none pointer-events-auto transform-gpu will-change-transform outline-none"
            >
              {/* Header Bar */}
              <TaskHeader
                boards={boards}
                currentBoard={currentBoard}
                isBoardDropdownOpen={isBoardDropdownOpen}
                setIsBoardDropdownOpen={setIsBoardDropdownOpen}
                isEditingBoardTitle={isEditingBoardTitle}
                setIsEditingBoardTitle={setIsEditingBoardTitle}
                editingBoardTitleText={editingBoardTitleText}
                setEditingBoardTitleText={setEditingBoardTitleText}
                setActiveBoardId={setActiveBoardId}
                updateCurrentBoard={updateCurrentBoard}
                handleCreateBoard={handleCreateBoard}
                promptDeleteBoard={promptDeleteBoard}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                viewMode={viewMode}
                setViewMode={setViewMode}
                onClose={onClose}
              />

              {/* Main Board / List View Container */}
              <div
                onWheel={(e) => {
                  if (viewMode === "board" && Math.abs(e.deltaX) === 0 && e.deltaY !== 0) {
                    const target = e.target as HTMLElement;
                    const isInsideCardList =
                      target.closest(".custom-study-scroll") !== e.currentTarget &&
                      target.closest(".overflow-y-auto");
                    if (
                      !isInsideCardList &&
                      e.currentTarget.scrollWidth > e.currentTarget.clientWidth
                    ) {
                      e.currentTarget.scrollLeft += e.deltaY;
                    }
                  }
                }}
                className="flex-1 overflow-x-auto overflow-y-auto p-6 pb-6 custom-study-scroll"
              >
                {viewMode === "board" ? (
                  <TaskBoardView
                    currentBoard={currentBoard}
                    filterCards={filterCards}
                    draggingColId={draggingColId}
                    dragOverColTargetId={dragOverColTargetId}
                    dragOverColPosition={dragOverColPosition}
                    dragOverColId={dragOverColId}
                    draggingCardId={draggingCardId}
                    draggingCard={draggingCard}
                    dragOverCardId={dragOverCardId}
                    dragOverCardPosition={dragOverCardPosition}
                    isMeaningfulColMove={isMeaningfulColMove}
                    isMeaningfulCardMove={isMeaningfulCardMove}
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
                    onSelectCard={(c) => setSelectedCard(c)}
                    onToggleCardComplete={handleToggleCardComplete}
                    onMoveCard={handleMoveCard}
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
                    isAddingColumn={isAddingColumn}
                    setIsAddingColumn={setIsAddingColumn}
                    newColumnTitle={newColumnTitle}
                    setNewColumnTitle={setNewColumnTitle}
                    handleAddColumn={handleAddColumn}
                  />
                ) : (
                  <TaskListView
                    currentBoard={currentBoard}
                    filterCards={filterCards}
                    draggingCardId={draggingCardId}
                    dragOverColId={dragOverColId}
                    dragOverCardId={dragOverCardId}
                    dragOverCardPosition={dragOverCardPosition}
                    isMeaningfulCardMove={isMeaningfulCardMove}
                    editingColumnId={editingColumnId}
                    setEditingColumnId={setEditingColumnId}
                    editingColumnTitle={editingColumnTitle}
                    setEditingColumnTitle={setEditingColumnTitle}
                    handleRenameColumn={handleRenameColumn}
                    handleCardDragStart={handleCardDragStart}
                    handleCardDragEnd={handleCardDragEnd}
                    handleCardDragOverCol={handleCardDragOverCol}
                    handleCardDragOverCard={handleCardDragOverCard}
                    handleCardDrop={handleCardDrop}
                    onSelectCard={(c) => setSelectedCard(c)}
                    onToggleCardComplete={handleToggleCardComplete}
                  />
                )}
              </div>

              {/* Card Detail Modal */}
              <CardDetailModal
                selectedCard={selectedCard}
                setSelectedCard={setSelectedCard}
                currentBoard={currentBoard}
                updateCurrentBoard={updateCurrentBoard}
                isStatusDropdownOpen={isStatusDropdownOpen}
                setIsStatusDropdownOpen={setIsStatusDropdownOpen}
                handleMoveCard={handleMoveCard}
                handleUpdateCardDueDate={handleUpdateCardDueDate}
                handleToggleChecklist={handleToggleChecklist}
                handleAddChecklistItem={handleAddChecklistItem}
                handleUpdateChecklistItemText={handleUpdateChecklistItemText}
                handleDeleteChecklistItem={handleDeleteChecklistItem}
                promptDeleteCard={promptDeleteCard}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialogs */}
      <ConfirmDeleteModal
        isOpen={!!boardToDelete}
        onClose={() => setBoardToDelete(null)}
        onConfirm={handleConfirmDeleteBoard}
        title="Xác nhận xóa bảng học tập"
        description="Bạn có chắc chắn muốn xóa toàn bộ bảng này và tất cả các thẻ công việc bên trong không?"
        itemName={boardToDelete?.title}
        confirmText="Xóa bảng"
        cancelText="Hủy bỏ"
      />

      <ConfirmDeleteModal
        isOpen={!!columnToDelete}
        onClose={() => setColumnToDelete(null)}
        onConfirm={handleConfirmDeleteColumn}
        title="Xác nhận xóa danh sách cột"
        description="Toàn bộ các thẻ nhiệm vụ trong cột này sẽ bị xóa vĩnh viễn."
        itemName={columnToDelete?.title}
        confirmText="Xóa cột"
        cancelText="Hủy bỏ"
      />

      <ConfirmDeleteModal
        isOpen={!!cardToDelete}
        onClose={() => setCardToDelete(null)}
        onConfirm={handleConfirmDeleteCard}
        title="Xác nhận xóa thẻ công việc"
        description="Bạn có chắc chắn muốn xóa thẻ nhiệm vụ này không?"
        itemName={cardToDelete?.title}
        confirmText="Xóa thẻ"
        cancelText="Hủy bỏ"
      />

      {/* Mobile: thanh hoàn tác sau khi xóa thẻ, desktop không hiện */}
      {lastDeletedCard && (
        <div className="sm:hidden">
          <MobileUndoSnackbar
            key={lastDeletedCard.deletedAt}
            message={`Đã xóa "${lastDeletedCard.card.title}"`}
            onUndo={undoDeleteCard}
            onTimeout={clearDeletedCard}
          />
        </div>
      )}
    </>
  );
};
