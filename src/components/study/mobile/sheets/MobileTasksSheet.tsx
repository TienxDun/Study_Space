"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  CheckCircleIcon,
  CircleIcon,
  PlusIcon,
  CheckSquareIcon,
  MagnifyingGlassIcon,
  XIcon,
  TimerIcon,
} from "@phosphor-icons/react";
import { useKanbanBoards } from "../../tasks/hooks/useKanbanBoards";
import { getDeadlineStatus } from "../../tasks/utils/task-deadline";
import { CardDetailModal } from "../../tasks/components/CardDetailModal";
import { PrioritySignalIcon } from "../../tasks/components/PrioritySignalIcon";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { MobileUndoSnackbar } from "../feedback/MobileUndoSnackbar";
import { MobileSheetShell } from "./MobileSheetShell";
import { KanbanCard, CardPriority } from "../../tasks/types";
import { useFocusStats } from "@/lib/use-focus-stats";
import { formatFocusDuration } from "@/lib/focus-sessions";
import { startFocusTask } from "@/lib/use-focus-task";
import { MobileTaskBubbleMenu } from "./MobileTaskBubbleMenu";

interface MobileTasksSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  backLabel?: string;
}

export const MobileTasksSheet = React.memo(function MobileTasksSheet({
  isOpen,
  onClose,
  onBack,
  backLabel,
}: MobileTasksSheetProps) {
  const {
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
    lastDeletedCard,
    undoDeleteCard,
    clearDeletedCard,
    handleUpdateCardDueDate,
    handleToggleChecklist,
    handleAddChecklistItem,
    handleUpdateChecklistItemText,
    handleDeleteChecklistItem,
  } = useKanbanBoards();

  // Tab lọc theo cột: "all" hoặc column.id
  const [selectedColumnFilter, setSelectedColumnFilter] = useState<string>("all");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickPriority, setQuickPriority] = useState<CardPriority>("medium");
  const [activeMenuCardId, setActiveMenuCardId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startLongPress = (cardId: string) => {
    longPressTimerRef.current = setTimeout(() => {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(30);
        } catch {}
      }
      setActiveMenuCardId(cardId);
    }, 450);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Thống kê thời gian tập trung Pomodoro tích lũy theo từng task
  const allTimeStats = useFocusStats("all");
  const focusSecondsByTask = useMemo(
    () => new Map(allTimeStats.byTask.map((t) => [t.taskId, t.focusSeconds] as const)),
    [allTimeStats]
  );

  // Tự động đóng popup con khi đổi bộ lọc hoặc gõ tìm kiếm
  React.useEffect(() => {
    setActiveMenuCardId(null);
  }, [selectedColumnFilter, searchQuery]);

  const cycleQuickPriority = () => {
    setQuickPriority((prev) => {
      if (prev === "low") return "medium";
      if (prev === "medium") return "high";
      return "low";
    });
  };

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

  React.useEffect(() => {
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

  // Lọc thẻ theo cột đang chọn và từ khóa tìm kiếm
  const displayedCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allCardsWithColumn.filter(({ card, colId }) => {
      // Lọc theo cột
      if (selectedColumnFilter !== "all" && colId !== selectedColumnFilter) {
        return false;
      }
      // Lọc theo tìm kiếm
      if (q) {
        const matchTitle = card.title.toLowerCase().includes(q);
        const matchDesc = card.description?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc) return false;
      }
      return true;
    });
  }, [allCardsWithColumn, selectedColumnFilter, searchQuery]);

  // Thêm việc nhanh
  const handleQuickAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const title = quickTitle.trim();
    if (!title) {
      inputRef.current?.focus();
      return;
    }

    // Nếu đang lọc một cột cụ thể thì thêm vào cột đó, ngược lại thêm vào cột đầu tiên
    const targetColId =
      selectedColumnFilter !== "all" ? selectedColumnFilter : defaultColId;

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
    inputRef.current?.focus();
  };

  return (
    <>
      <MobileSheetShell
        isOpen={isOpen}
        onClose={onClose}
        onBack={onBack}
        backLabel={backLabel}
        sheetId="tasks"
        title={`Việc cần làm (${allCardsWithColumn.length})`}
        heightClassName="h-[80dvh] max-h-[85dvh]"
        contentScroll={false}
        onSwipeLeft={goToNextFilter}
        onSwipeRight={goToPrevFilter}
        headerRight={
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
        }
        footer={
          /* Cụm điều khiển ngón tay cái Thumb-Zone: Bộ lọc trạng thái + Thanh thêm nhanh */
          <div className="p-2.5 space-y-2 select-none">
            {/* Bộ lọc trạng thái dạng viên nhộng (Status Pills cuộn ngang) */}
            <div className="overflow-x-auto no-scrollbar pb-0.5">
              <div className="flex items-center justify-center gap-1.5 min-w-full w-max px-1">
                <button
                  ref={(el) => {
                    if (el) pillRefs.current.set("all", el);
                    else pillRefs.current.delete("all");
                  }}
                  type="button"
                  onClick={() => setSelectedColumnFilter("all")}
                  className={`h-7 px-3 rounded-full text-xs whitespace-nowrap flex items-center gap-1.5 transition-all active:scale-95 shrink-0 cursor-pointer ${
                    selectedColumnFilter === "all" ? "lg-tab-active" : "lg-tab-inactive"
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
                      className={`h-7 px-3 rounded-full text-xs whitespace-nowrap flex items-center gap-1.5 transition-all active:scale-95 shrink-0 cursor-pointer ${
                        isActive ? "lg-tab-active" : "lg-tab-inactive"
                      }`}
                    >
                      <span className="truncate max-w-[120px]">{col.title}</span>
                      <span className="text-[10px] opacity-75">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Thanh nhập việc nhanh ở đáy (Quick Add Bar) */}
            <form onSubmit={handleQuickAdd} className="flex items-center gap-1.5">
              {/* Nút chọn độ ưu tiên nhanh (Cột sóng / Ăng-ten Thấp - Vừa - Gấp) */}
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
                className="h-9 px-2.5 rounded-xl lg-btn-action flex items-center gap-1 text-[11px] font-medium shrink-0 cursor-pointer"
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
              <button
                type="submit"
                aria-label="Thêm việc"
                className="h-9 px-3.5 rounded-xl lg-btn-action text-white text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 shrink-0 cursor-pointer"
              >
                <PlusIcon className="w-4 h-4 relative z-10" weight="bold" />
                <span className="relative z-10">Thêm</span>
              </button>
            </form>
          </div>
        }
      >
        <div className="flex-1 min-h-0 flex flex-col space-y-2.5 pt-1 select-none">
          {/* Thanh tìm kiếm mở rộng khi cần */}
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

          {/* Danh sách các công việc cuộn dọc */}
          <div className="flex-1 min-h-0 px-3 space-y-2 overflow-y-auto custom-study-scroll pb-16 overscroll-contain touch-pan-y no-scrollbar">
            {displayedCards.length > 0 ? (
              displayedCards.map(({ card, colId, colTitle }, idx) => {
                const deadline = getDeadlineStatus(card.dueDate);
                const isDoneColumn = /xong|done|hoàn thành/i.test(colTitle);
                const isCompleted = Boolean(card.completed) || isDoneColumn;
                const checklistTotal = card.checklist?.length || 0;
                const checklistDone =
                  card.checklist?.filter((i) => i.completed).length || 0;
                const isMenuOpen = activeMenuCardId === card.id;

                const focusSeconds = focusSecondsByTask.get(card.id) ?? 0;
                const hasFocusTime = focusSeconds > 0 || (card.pomodoros !== undefined && card.pomodoros > 0);
                const formattedFocusTime = focusSeconds > 0
                  ? formatFocusDuration(focusSeconds)
                  : `${card.pomodoros} phiên`;

                return (
                  <div
                    key={card.id}
                    onTouchStart={() => startLongPress(card.id)}
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
                        onClick={() => handleToggleCardComplete(card.id)}
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
                        onClick={() => setSelectedCard(card)}
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

                          {/* Mức độ ưu tiên (Cột sóng / Ăng-ten Thấp - Vừa - Gấp) */}
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
                        onToggle={() =>
                          setActiveMenuCardId((prev) =>
                            prev === card.id ? null : card.id
                          )
                        }
                        onClose={() => setActiveMenuCardId(null)}
                        onStartFocus={() => {
                          startFocusTask({ id: card.id, title: card.title });
                        }}
                        onSelectDetail={() => setSelectedCard(card)}
                        onMoveCard={(targetColId) => handleMoveCard(card.id, targetColId)}
                        onDeleteCard={() => promptDeleteCard(card)}
                        hasFocusTime={hasFocusTime}
                        formattedFocusTime={formattedFocusTime}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-16 flex flex-col items-center justify-center text-center px-4">
                {selectedColumnFilter !== "all" &&
                columns.find((c) => c.id === selectedColumnFilter)?.title.toLowerCase().includes("xong") ? (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-3">
                      <CheckCircleIcon className="w-6 h-6 text-emerald-400/50" />
                    </div>
                    <p className="text-sm font-semibold text-white/80">Chưa có việc nào hoàn thành</p>
                    <p className="text-xs text-white/40 mt-1 max-w-[240px]">
                      Chạm vào vòng tròn trên mỗi việc khi làm xong để lưu vào đây nhé!
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-3">
                      <CheckSquareIcon className="w-6 h-6 text-white/30" />
                    </div>
                    <p className="text-sm font-semibold text-white/80">
                      {searchQuery ? "Không tìm thấy việc phù hợp" : "Chưa có việc trong mục này"}
                    </p>
                    <p className="text-xs text-white/40 mt-1">
                      {searchQuery ? "Thử tìm kiếm với từ khóa khác" : "Nhập việc mới ở thanh bên dưới để thêm ngay"}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </MobileSheetShell>

      {/* Modal sửa chi tiết thẻ (khi bấm vào thẻ) */}
      {selectedCard && (
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
      )}

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

      {/* Thanh hoàn tác sau khi xóa thẻ */}
      {lastDeletedCard && (
        <MobileUndoSnackbar
          key={lastDeletedCard.deletedAt}
          message={`Đã xóa "${lastDeletedCard.card.title}"`}
          onUndo={undoDeleteCard}
          onTimeout={clearDeletedCard}
        />
      )}
    </>
  );
});
