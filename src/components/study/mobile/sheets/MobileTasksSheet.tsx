"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  CheckCircleIcon,
  CircleIcon,
  PlusIcon,
  CheckSquareIcon,
  DotsThreeVerticalIcon,
  MagnifyingGlassIcon,
  XIcon,
  TrashIcon,
  ArrowRightIcon,
} from "@phosphor-icons/react";
import { useKanbanBoards } from "../../tasks/hooks/useKanbanBoards";
import { getDeadlineStatus } from "../../tasks/utils/task-deadline";
import { CardDetailModal } from "../../tasks/components/CardDetailModal";
import { PrioritySignalIcon } from "../../tasks/components/PrioritySignalIcon";
import { MobileSheetShell } from "./MobileSheetShell";
import { KanbanCard, CardPriority } from "../../tasks/types";

interface MobileTasksSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileTasksSheet({ isOpen, onClose }: MobileTasksSheetProps) {
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
    if (!title) return;

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
        title={`Việc cần làm (${allCardsWithColumn.length})`}
        heightClassName="h-[80dvh] max-h-[85dvh]"
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
            <div className="overflow-x-auto no-scrollbar flex items-center gap-1.5 pb-0.5">
              <button
                ref={(el) => {
                  if (el) pillRefs.current.set("all", el);
                  else pillRefs.current.delete("all");
                }}
                type="button"
                onClick={() => setSelectedColumnFilter("all")}
                className={`h-7 px-3 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all active:scale-95 shrink-0 ${
                  selectedColumnFilter === "all"
                    ? "bg-white text-black font-semibold shadow-md"
                    : "bg-white/[0.06] hover:bg-white/[0.12] text-white/75 border border-white/[0.08]"
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
                    className={`h-7 px-3 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all active:scale-95 shrink-0 ${
                      isActive
                        ? "bg-white text-black font-semibold shadow-md"
                        : "bg-white/[0.06] hover:bg-white/[0.12] text-white/75 border border-white/[0.08]"
                    }`}
                  >
                    <span className="truncate max-w-[120px]">{col.title}</span>
                    <span className="text-[10px] opacity-75">({count})</span>
                  </button>
                );
              })}
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
                className="h-9 px-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] flex items-center gap-1 text-[11px] font-medium text-white/80 active:scale-95 transition-all shrink-0"
              >
                <PrioritySignalIcon priority={quickPriority} className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[10px] text-white/70">
                  {quickPriority === "high" ? "Gấp" : quickPriority === "low" ? "Thấp" : "Vừa"}
                </span>
              </button>

              <input
                ref={inputRef}
                type="text"
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                placeholder="Nhập việc cần làm..."
                className="flex-1 h-9 px-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-xs text-white placeholder-white/40 focus:outline-none focus:border-white/30 transition-colors min-w-0"
              />
              <button
                type="submit"
                disabled={!quickTitle.trim()}
                aria-label="Thêm việc"
                className="h-9 px-3 rounded-xl bg-white/20 hover:bg-white/30 disabled:opacity-30 disabled:pointer-events-none text-white text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 shrink-0 shadow-sm"
              >
                <PlusIcon className="w-4 h-4" weight="bold" />
                <span>Thêm</span>
              </button>
            </form>
          </div>
        }
      >
        <div className="flex-1 flex flex-col space-y-2.5 pt-1 select-none">
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
                  className="w-full h-9 pl-9 pr-8 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-white/40 focus:outline-none focus:border-white/20 transition-colors"
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
          <div className="flex-1 px-3 space-y-2 overflow-y-auto custom-study-scroll pb-2">
            {displayedCards.length > 0 ? (
              displayedCards.map(({ card, colId, colTitle }) => {
                const deadline = getDeadlineStatus(card.dueDate);
                const isDoneColumn = /xong|done|hoàn thành/i.test(colTitle);
                const isCompleted = Boolean(card.completed) || isDoneColumn;
                const checklistTotal = card.checklist?.length || 0;
                const checklistDone =
                  card.checklist?.filter((i) => i.completed).length || 0;
                const isMenuOpen = activeMenuCardId === card.id;

                return (
                  <div
                    key={card.id}
                    className={`group relative rounded-2xl border transition-all select-none p-3 ${
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

                        {/* Thông tin phụ: Nhãn cột, Mức độ ưu tiên, Deadline, Checklist */}
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

                      {/* Menu chuyển cột nhanh */}
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveMenuCardId((prev) =>
                              prev === card.id ? null : card.id
                            )
                          }
                          aria-label="Tùy chọn thẻ"
                          className="w-8.5 h-8.5 -mr-1.5 -mt-1 rounded-xl flex items-center justify-center hover:bg-white/10 text-white/40 hover:text-white active:scale-90 transition-all cursor-pointer"
                        >
                          <DotsThreeVerticalIcon className="w-4 h-4" />
                        </button>

                        {/* Dropdown chuyển cột nhanh */}
                        {isMenuOpen && (
                          <div className="absolute right-0 top-full mt-1 z-30 w-36 rounded-xl bg-neutral-900/95 backdrop-blur-xl border border-white/15 shadow-xl p-1 text-left space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                            <p className="px-2 py-1 text-[10px] font-semibold text-white/40 uppercase">
                              Chuyển sang:
                            </p>
                            {columns
                              .filter((c) => c.id !== colId)
                              .map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    handleMoveCard(card.id, c.id);
                                    setActiveMenuCardId(null);
                                  }}
                                  className="w-full px-2 py-1.5 rounded-lg text-xs text-white/80 hover:text-white hover:bg-white/10 text-left flex items-center justify-between"
                                >
                                  <span className="truncate">{c.title}</span>
                                  <ArrowRightIcon className="w-3 h-3 text-white/40" />
                                </button>
                              ))}
                            <div className="pt-1 border-t border-white/10">
                              <button
                                type="button"
                                onClick={() => {
                                  promptDeleteCard(card);
                                  setActiveMenuCardId(null);
                                }}
                                className="w-full px-2 py-1.5 rounded-lg text-xs text-rose-300 hover:text-rose-200 hover:bg-rose-500/15 text-left flex items-center gap-1.5"
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                                <span>Xóa việc này</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
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
    </>
  );
}
