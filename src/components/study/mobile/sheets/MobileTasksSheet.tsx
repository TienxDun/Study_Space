"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  TrashIcon,
  MagnifyingGlassIcon,
  XIcon,
  PencilLineIcon,
} from "@phosphor-icons/react";
import { useKanbanBoards } from "../../tasks/hooks/useKanbanBoards";
import { CardDetailModal } from "../../tasks/components/CardDetailModal";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { MobileSheetShell } from "./core/MobileSheetShell";
import { KanbanCard } from "../../tasks/types";
import { useFocusStats } from "@/lib/use-focus-stats";
import { MobilePerfProbe } from "../perf/MobilePerfProbe";
import { useRenderTrace } from "../perf/useRenderTrace";
import { SyncStatusBadge } from "@/components/study/sync/SyncStatusBadge";
import { MobileTaskQuickAddBar } from "./components/tasks/MobileTaskQuickAddBar";
import { MobileTaskBoardMenu } from "./components/tasks/MobileTaskBoardMenu";
import { MobileTaskItem } from "./components/tasks/MobileTaskItem";
import { MobileTasksEmptyState } from "./components/tasks/MobileTasksEmptyState";

interface MobileTasksSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  backLabel?: string;
  isEditingDetail?: boolean;
  onOpenDetail?: () => void;
  onCloseDetail?: () => void;
}

/**
 * Bảng quản lý nhiệm vụ (Tasks Sheet) trên thiết bị di động.
 * Điều phối dữ liệu bảng, tìm kiếm, lọc danh mục và chi tiết nhiệm vụ.
 */
export const MobileTasksSheet = React.memo(function MobileTasksSheet({
  isOpen,
  onClose,
  onBack,
  backLabel,
  isEditingDetail,
  onOpenDetail,
  onCloseDetail,
}: MobileTasksSheetProps) {
  const {
    boards,
    activeBoardId,
    setActiveBoardId,
    handleCreateBoard,
    promptDeleteBoard,
    boardToDelete,
    setBoardToDelete,
    handleConfirmDeleteBoard,
    currentBoard,
    updateCurrentBoard,
    searchQuery,
    setSearchQuery,
    selectedCard,
    setSelectedCard,
    isStatusDropdownOpen,
    setIsStatusDropdownOpen,
    handleToggleCardComplete,
    handleMoveCard,
    promptDeleteCard,
    cardToDelete,
    setCardToDelete,
    handleConfirmDeleteCard,
    handleUpdateCardDueDate,
    handleToggleChecklist,
    handleAddChecklistItem,
    handleUpdateChecklistItemText,
    handleDeleteChecklistItem,
  } = useKanbanBoards();

  // Tab lọc theo cột: "all" hoặc column.id
  const [selectedColumnFilter, setSelectedColumnFilter] = useState<string>("all");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeMenuCardId, setActiveMenuCardId] = useState<string | null>(null);

  // Thống kê thời gian tập trung Pomodoro tích lũy theo từng task
  const allTimeStats = useFocusStats("all");
  const focusSecondsByTask = useMemo(
    () => new Map(allTimeStats.byTask.map((t) => [t.taskId, t.focusSeconds] as const)),
    [allTimeStats]
  );

  // Tự động đóng popup con khi đóng bảng, đổi bộ lọc hoặc gõ tìm kiếm
  useEffect(() => {
    setActiveMenuCardId(null);
  }, [selectedColumnFilter, searchQuery, isOpen]);

  // Điều hướng xem/sửa chi tiết task đồng bộ cùng Mobile Stack Navigation
  const handleSelectCard = React.useCallback(
    (card: KanbanCard | null) => {
      setSelectedCard(card);
      if (card) {
        if (!isEditingDetail) {
          onOpenDetail?.();
        }
      } else {
        if (isEditingDetail) {
          onCloseDetail?.();
        }
      }
    },
    [setSelectedCard, onOpenDetail, onCloseDetail, isEditingDetail]
  );

  // Khi thoát chế độ chi tiết task từ ngăn xếp điều hướng (Back phần cứng hoặc Back UI)
  useEffect(() => {
    if (isEditingDetail === false && selectedCard !== null) {
      setSelectedCard(null);
    }
  }, [isEditingDetail, selectedCard, setSelectedCard]);

  // Nếu toàn bộ bảng Tasks bị đóng, đóng luôn modal chi tiết task để tránh sót lại trên màn hình
  useEffect(() => {
    if (!isOpen && selectedCard !== null) {
      setSelectedCard(null);
    }
  }, [isOpen, selectedCard, setSelectedCard]);

  // Danh sách các cột và toàn bộ thẻ của bảng hiện tại
  const columns = currentBoard?.columns || [];
  const cards = currentBoard?.cards || [];
  const defaultColId = columns[0]?.id || "col-todo";

  // Danh sách các filter theo thứ tự hiển thị
  const filterList = useMemo(
    () => ["all", ...columns.map((c) => c.id)],
    [columns]
  );

  const goToNextFilter = () => {
    setSelectedColumnFilter((curr) => {
      const idx = filterList.indexOf(curr);
      if (idx === -1 || idx >= filterList.length - 1) return curr;
      return filterList[idx + 1];
    });
  };

  const goToPrevFilter = () => {
    setSelectedColumnFilter((curr) => {
      const idx = filterList.indexOf(curr);
      if (idx <= 0) return curr;
      return filterList[idx - 1];
    });
  };

  // Tự động cuộn viên nhộng filter đang active vào giữa tầm nhìn
  const pillRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    const el = pillRefs.current.get(selectedColumnFilter);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [selectedColumnFilter]);

  // Map tra cứu tên cột theo columnId
  const columnMap = useMemo(() => {
    const map = new Map<string, string>();
    columns.forEach((col) => map.set(col.id, col.title));
    return map;
  }, [columns]);

  // Tổng hợp tất cả các thẻ kèm thông tin cột của thẻ đó
  const allCardsWithColumn = useMemo(() => {
    return cards.map((card) => ({
      card,
      colId: card.columnId,
      colTitle: columnMap.get(card.columnId) || "Cần làm",
    }));
  }, [cards, columnMap]);

  // Lọc thẻ theo cột đang chọn và từ khóa tìm kiếm (useDeferredValue giúp gõ tìm kiếm không nghẽn INP)
  const deferredSearchQuery = React.useDeferredValue(searchQuery);
  const displayedCards = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    return allCardsWithColumn.filter(({ card, colId }) => {
      if (selectedColumnFilter !== "all" && colId !== selectedColumnFilter) {
        return false;
      }
      if (q) {
        const matchTitle = card.title.toLowerCase().includes(q);
        const matchDesc = card.description?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc) return false;
      }
      return true;
    });
  }, [allCardsWithColumn, selectedColumnFilter, deferredSearchQuery]);

  useRenderTrace("sheet:tasks", {
    isOpen,
    onClose,
    onBack,
    backLabel,
    isEditingDetail,
    onOpenDetail,
    onCloseDetail,
    activeBoardId,
    searchQuery,
    colFilter: selectedColumnFilter,
    searchOpen: isSearchOpen,
    menuCard: activeMenuCardId,
    cardDangMo: selectedCard?.id,
    boards: boards.length,
    danhTinhBoards: boards,
    danhTinhStats: allTimeStats,
    soThe: displayedCards.length,
    danhTinhCards: displayedCards,
  });

  return (
    <>
      <MobileSheetShell
        isOpen={isOpen}
        onClose={onClose}
        onBack={selectedCard ? (onBack || (() => handleSelectCard(null))) : onBack}
        backLabel={selectedCard ? "Kế hoạch" : backLabel}
        sheetId="tasks"
        title={
          selectedCard ? (
            <div className="group/title relative inline-flex items-center min-w-0 max-w-full">
              <input
                type="text"
                value={selectedCard.title}
                onChange={(e) => {
                  const updatedTitle = e.target.value;
                  handleSelectCard({ ...selectedCard, title: updatedTitle });
                  updateCurrentBoard((b) => ({
                    ...b,
                    cards: b.cards.map((c) =>
                      c.id === selectedCard.id ? { ...c, title: updatedTitle } : c
                    ),
                  }));
                }}
                style={{
                  width: selectedCard.title
                    ? `${Math.max(1.2, selectedCard.title.length + 0.4)}ch`
                    : "16ch",
                }}
                className="text-sm font-semibold tracking-tight text-white bg-transparent border-0 focus:ring-0 focus:outline-none placeholder-white/25 border-b border-dashed border-white/35 focus:border-emerald-400 focus:border-solid transition-colors pb-0.5 px-0.5 max-w-[calc(100vw-210px)]"
                placeholder="Tiêu đề nhiệm vụ..."
              />
              <PencilLineIcon className="w-3.5 h-3.5 text-slate-400 group-focus-within/title:text-emerald-400 shrink-0 ml-1 transition-colors pointer-events-none" />
            </div>
          ) : (
            <MobileTaskBoardMenu
              boards={boards}
              activeBoardId={activeBoardId}
              currentBoard={currentBoard}
              cardCount={allCardsWithColumn.length}
              onSelectBoard={setActiveBoardId}
              onCreateBoard={handleCreateBoard}
              onPromptDeleteBoard={promptDeleteBoard}
              isSheetOpen={isOpen}
            />
          )
        }
        heightClassName="h-[68dvh] max-h-[72dvh]"
        contentScroll={false}
        onSwipeLeft={selectedCard ? undefined : goToNextFilter}
        onSwipeRight={selectedCard ? undefined : goToPrevFilter}
        headerRight={
          selectedCard ? (
            <button
              type="button"
              onClick={() => promptDeleteCard(selectedCard)}
              className="w-8 h-8 rounded-full bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/25 active:scale-90 border border-rose-500/25 hover:border-rose-500/40 flex items-center justify-center text-rose-400 hover:text-rose-300 transition-all shadow-sm cursor-pointer"
              title="Xóa nhiệm vụ này"
              aria-label="Xóa nhiệm vụ này"
            >
              <TrashIcon className="w-4 h-4" weight="bold" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsSearchOpen((prev) => !prev)}
              aria-label="Tìm kiếm việc"
              className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all active:scale-90 ${
                isSearchOpen || searchQuery
                  ? "bg-white/20 border-white/30 text-white"
                  : "bg-white/10 hover:bg-white/15 border-white/15 text-white/80 hover:text-white"
              }`}
            >
              <MagnifyingGlassIcon className="w-4 h-4" />
            </button>
          )
        }
        footer={
          selectedCard ? (
            <div className="shrink-0 px-3.5 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between text-xs select-none">
              <div className="flex items-center gap-2 text-[11px] text-slate-400 truncate">
                <span className="font-medium text-slate-300 truncate">{currentBoard?.title || "Nhiệm vụ học tập"}</span>
              </div>
              <SyncStatusBadge variant="text" className="text-[11px] font-medium" />
            </div>
          ) : (
            <div className="p-2.5 space-y-2 select-none">
              {/* Bộ lọc trạng thái dạng viên nhộng */}
              <div className="overflow-x-auto no-scrollbar pb-0.5">
                <div className="flex items-center justify-center gap-1.5 min-w-full w-max px-1">
                  <button
                    ref={(el) => {
                      if (el) pillRefs.current.set("all", el);
                      else pillRefs.current.delete("all");
                    }}
                    type="button"
                    onClick={() => setSelectedColumnFilter("all")}
                    className={`h-7 px-3 rounded-full text-xs whitespace-nowrap flex items-center gap-1.5 transition-all active:scale-95 shrink-0 cursor-pointer border ${
                      selectedColumnFilter === "all"
                        ? "bg-white/20 border-white/30 text-white font-medium shadow-sm"
                        : "bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white"
                    }`}
                  >
                    <span>Tất cả</span>
                    <span className="text-[10px] opacity-75">({allCardsWithColumn.length})</span>
                  </button>

                  {columns.map((col) => {
                    const isActive = selectedColumnFilter === col.id;
                    const count = cards.filter((c) => c.columnId === col.id).length;
                    return (
                      <button
                        ref={(el) => {
                          if (el) pillRefs.current.set(col.id, el);
                          else pillRefs.current.delete(col.id);
                        }}
                        key={col.id}
                        type="button"
                        onClick={() => setSelectedColumnFilter(col.id)}
                        className={`h-7 px-3 rounded-full text-xs whitespace-nowrap flex items-center gap-1.5 transition-all active:scale-95 shrink-0 cursor-pointer border ${
                          isActive
                            ? "bg-white/20 border-white/30 text-white font-medium shadow-sm"
                            : "bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white"
                        }`}
                      >
                        <span className="truncate max-w-[120px]">{col.title}</span>
                        <span className="text-[10px] opacity-75">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Thanh nhập việc nhanh */}
              <MobileTaskQuickAddBar
                targetColId={
                  selectedColumnFilter !== "all" ? selectedColumnFilter : defaultColId
                }
                updateCurrentBoard={updateCurrentBoard}
              />
            </div>
          )
        }
      >
        {selectedCard ? (
          <CardDetailModal
            embedded
            selectedCard={selectedCard}
            setSelectedCard={handleSelectCard}
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
        ) : (
          <div className="flex-1 min-h-0 flex flex-col space-y-2 pt-0.5 select-none">
            {/* Thanh tìm kiếm */}
            {isSearchOpen && (
              <div className="px-3">
                <div className="relative flex items-center">
                  <MagnifyingGlassIcon className="absolute left-3 w-4 h-4 text-white/40 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm việc..."
                    autoFocus
                    className="lg-input w-full h-9 pl-9 pr-8 text-xs text-white"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 p-1 text-white/50 hover:text-white"
                    >
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Danh sách các công việc */}
            <MobilePerfProbe name="tasks:list">
              <div className="flex-1 min-h-0 px-3 space-y-2 overflow-y-auto custom-study-scroll pb-16 overscroll-contain touch-pan-y no-scrollbar">
                {displayedCards.length > 0 ? (
                  displayedCards.map(({ card, colId, colTitle }, idx) => (
                    <MobileTaskItem
                      key={card.id}
                      card={card}
                      colId={colId}
                      colTitle={colTitle}
                      idx={idx}
                      columns={columns}
                      isMenuOpen={activeMenuCardId === card.id}
                      onToggleMenu={() =>
                        setActiveMenuCardId((prev) =>
                          prev === card.id ? null : card.id
                        )
                      }
                      onCloseMenu={() => setActiveMenuCardId(null)}
                      onToggleComplete={handleToggleCardComplete}
                      onSelectCard={handleSelectCard}
                      onMoveCard={(targetColId) => handleMoveCard(card.id, targetColId)}
                      onPromptDeleteCard={promptDeleteCard}
                      focusSeconds={focusSecondsByTask.get(card.id) ?? 0}
                    />
                  ))
                ) : (
                  <MobileTasksEmptyState
                    selectedColumnFilter={selectedColumnFilter}
                    columns={columns}
                    searchQuery={searchQuery}
                  />
                )}
              </div>
            </MobilePerfProbe>
          </div>
        )}
      </MobileSheetShell>

      {/* Modal xác nhận xóa bảng học tập */}
      <ConfirmDeleteModal
        isOpen={Boolean(boardToDelete)}
        onClose={() => setBoardToDelete(null)}
        onConfirm={handleConfirmDeleteBoard}
        title="Xác nhận xóa bảng học tập"
        description="Bạn có chắc chắn muốn xóa toàn bộ bảng này và tất cả các thẻ công việc bên trong không?"
        itemName={boardToDelete?.title}
        confirmText="Xóa bảng"
        cancelText="Hủy bỏ"
      />

      {/* Modal xác nhận xóa thẻ công việc */}
      <ConfirmDeleteModal
        isOpen={Boolean(cardToDelete)}
        onClose={() => setCardToDelete(null)}
        onConfirm={handleConfirmDeleteCard}
        title="Xác nhận xóa thẻ công việc"
        description="Bạn có chắc chắn muốn xóa việc này không?"
        itemName={cardToDelete?.title}
        confirmText="Xóa việc"
        cancelText="Hủy bỏ"
      />
    </>
  );
});
