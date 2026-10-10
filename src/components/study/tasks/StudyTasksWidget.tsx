"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { StudyTasksWidgetProps } from "./types";
import { getDeadlineStatus } from "./utils/task-deadline";
import { useKanbanBoards } from "./hooks/useKanbanBoards";
import { TaskHeader } from "./components/TaskHeader";
import { TaskBoardView } from "./components/TaskBoardView";
import { TaskListView } from "./components/TaskListView";
import { CardDetailModal } from "./components/CardDetailModal";
import { PrioritySignalIcon } from "./components/PrioritySignalIcon";
import { GripVertical } from "lucide-react";

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
    draggingCol,
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

  // Helper: Card Live Preview Placeholder
  const renderCardPlaceholder = (
    targetColId: string,
    targetCardId?: string,
    overridePos?: "before" | "after"
  ) => (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleCardDrop(e, targetColId, targetCardId, overridePos);
      }}
      className="p-3 rounded-2xl border-2 border-dashed border-emerald-400/60 bg-emerald-500/10 backdrop-blur-md space-y-2 select-none shadow-[0_0_15px_rgba(52,211,153,0.2)] animate-pulse cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-bold text-emerald-200 line-clamp-2">
          {draggingCard?.title || "Nhiệm vụ"}
        </span>
        {Boolean(draggingCard?.priority) && (
          <span
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 ${
              draggingCard?.priority === "high"
                ? "bg-rose-500/30 text-rose-200 border border-rose-400/40"
                : draggingCard?.priority === "medium"
                ? "bg-amber-500/30 text-amber-200 border border-amber-400/40"
                : "bg-emerald-500/30 text-emerald-200 border border-emerald-400/40"
            }`}
          >
            <PrioritySignalIcon priority={draggingCard!.priority} className="w-2.5 h-2.5" />
            <span>
              {draggingCard?.priority === "high"
                ? "Cao"
                : draggingCard?.priority === "medium"
                ? "Vừa"
                : "Thấp"}
            </span>
          </span>
        )}
      </div>
      <div className="text-[10px] text-emerald-300/70 font-semibold flex items-center gap-1">
        <span>↓ Thả để đặt thẻ vào đây</span>
      </div>
    </div>
  );

  // Helper: Column Live Preview Placeholder
  const renderColumnPlaceholder = (targetColId: string, overridePos: "before" | "after") => (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleColumnDrop(e, targetColId, overridePos);
      }}
      className="w-72 sm:w-80 flex-shrink-0 flex flex-col rounded-3xl border-2 border-dashed border-emerald-400/60 bg-emerald-500/10 backdrop-blur-md p-3.5 min-h-[260px] shadow-[0_0_20px_rgba(52,211,153,0.2)] select-none animate-pulse cursor-pointer"
    >
      <div className="flex items-center justify-between pb-3 px-1 border-b border-emerald-400/20">
        <div className="flex items-center gap-1.5">
          <GripVertical className="w-3.5 h-3.5 text-emerald-400" />
          <h3 className="text-sm font-bold text-emerald-100 tracking-wide">
            {draggingCol?.title || "Danh sách"}
          </h3>
          <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-[10px] font-extrabold text-emerald-300">
            Vị trí mới
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-8 text-center space-y-2">
        <div className="p-2.5 rounded-2xl bg-emerald-400/15 border border-emerald-400/30 text-emerald-300">
          <GripVertical className="w-5 h-5" />
        </div>
        <p className="text-xs font-semibold text-emerald-200">
          Thả để di chuyển danh sách đến đây
        </p>
      </div>
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-x-0 top-16 bottom-24 z-40 flex items-center justify-center px-3 sm:px-6 pointer-events-none">
            {/* Backdrop */}
            <motion.div
              key="tasks-widget-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs pointer-events-auto cursor-pointer"
              onClick={onClose}
            />

            <motion.div
              key="tasks-widget-panel"
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-[94vw] sm:w-[80vw] h-full rounded-3xl bg-black/40 hover:bg-black/45 backdrop-blur-xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden text-white select-none pointer-events-auto transform-gpu will-change-transform"
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
                    draggingCol={draggingCol}
                    dragOverColTargetId={dragOverColTargetId}
                    dragOverColPosition={dragOverColPosition}
                    dragOverColId={dragOverColId}
                    draggingCardId={draggingCardId}
                    draggingCard={draggingCard}
                    dragOverCardId={dragOverCardId}
                    dragOverCardPosition={dragOverCardPosition}
                    isMeaningfulColMove={isMeaningfulColMove}
                    isMeaningfulCardMove={isMeaningfulCardMove}
                    renderCardPlaceholder={renderCardPlaceholder}
                    renderColumnPlaceholder={renderColumnPlaceholder}
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
                    renderCardPlaceholder={renderCardPlaceholder}
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
    </>
  );
};
