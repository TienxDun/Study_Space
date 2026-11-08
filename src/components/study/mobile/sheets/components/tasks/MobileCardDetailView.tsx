"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  CaretDownIcon,
  CheckIcon,
  CalendarIcon,
  TextAlignLeftIcon,
  CheckSquareIcon,
  CheckCircleIcon,
  CircleIcon,
  PencilLineIcon,
  TrashIcon,
  PlusIcon,
  ClockIcon,
  PlayIcon,
  XIcon,
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { KanbanBoard, KanbanCard, CardPriority } from "@/components/study/tasks/types";
import { getDeadlineStatus } from "@/components/study/tasks/utils/task-deadline";
import { startFocusTask } from "@/lib/use-focus-task";
import { PrioritySignalIcon } from "@/components/study/tasks/components/PrioritySignalIcon";

interface MobileCardDetailViewProps {
  selectedCard: KanbanCard;
  setSelectedCard: (card: KanbanCard | null) => void;
  currentBoard: KanbanBoard;
  updateCurrentBoard: (mutator: (board: KanbanBoard) => KanbanBoard) => void;
  isStatusDropdownOpen: boolean;
  setIsStatusDropdownOpen: (open: boolean) => void;
  handleMoveCard: (cardId: string, targetColId: string) => void;
  handleUpdateCardDueDate: (dueDate?: string) => void;
  handleToggleChecklist: (cardId: string, itemId: string) => void;
  handleAddChecklistItem: (cardId: string, text: string) => void;
  handleUpdateChecklistItemText: (cardId: string, itemId: string, text: string) => void;
  handleDeleteChecklistItem: (cardId: string, itemId: string) => void;
  promptDeleteCard: (card: KanbanCard) => void;
}

export const MobileCardDetailView = React.memo(function MobileCardDetailView({
  selectedCard,
  setSelectedCard,
  currentBoard,
  updateCurrentBoard,
  isStatusDropdownOpen,
  setIsStatusDropdownOpen,
  handleMoveCard,
  handleUpdateCardDueDate,
  handleToggleChecklist,
  handleAddChecklistItem,
  handleUpdateChecklistItemText,
  handleDeleteChecklistItem,
}: MobileCardDetailViewProps) {
  const [newChecklistText, setNewChecklistText] = useState("");
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [editingChecklistText, setEditingChecklistText] = useState("");
  const [isDueDatePopoverOpen, setIsDueDatePopoverOpen] = useState(false);
  const statusButtonRef = useRef<HTMLButtonElement>(null);
  const [statusCoords, setStatusCoords] = useState<{ top: number; left: number } | null>(null);
  const dueDateButtonRef = useRef<HTMLButtonElement>(null);
  const [dueDateCoords, setDueDateCoords] = useState<{ top: number; right: number } | null>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const autoOpenTimePickerRef = useRef(false);

  // Đồng bộ vị trí dropdown trạng thái trên mobile
  useEffect(() => {
    if (!isStatusDropdownOpen) {
      setStatusCoords(null);
      return;
    }
    const updateCoords = () => {
      const el = statusButtonRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setStatusCoords({
        top: Math.min(rect.bottom + 6, window.innerHeight - 220),
        left: Math.max(12, rect.left),
      });
    };
    updateCoords();
    window.addEventListener("resize", updateCoords);
    return () => window.removeEventListener("resize", updateCoords);
  }, [isStatusDropdownOpen]);

  // Đồng bộ vị trí popover hạn chót trên mobile
  useEffect(() => {
    if (!isDueDatePopoverOpen) {
      setDueDateCoords(null);
      return;
    }
    const updateCoords = () => {
      const el = dueDateButtonRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setDueDateCoords({
        top: Math.min(rect.bottom + 6, window.innerHeight - 340),
        right: Math.max(12, window.innerWidth - rect.right),
      });
    };
    updateCoords();
    window.addEventListener("resize", updateCoords);
    return () => window.removeEventListener("resize", updateCoords);
  }, [isDueDatePopoverOpen]);

  // Tự động co giãn ô mô tả
  const autoResizeDescription = useCallback(() => {
    const el = descriptionTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 68)}px`;
  }, []);

  useEffect(() => {
    autoResizeDescription();
  }, [selectedCard.id, selectedCard.description, autoResizeDescription]);

  // Đổi nhanh độ ưu tiên (Thấp -> Vừa -> Cao -> Thấp)
  const cyclePriority = useCallback(() => {
    const current = selectedCard.priority || "medium";
    const nextPriority: CardPriority =
      current === "low" ? "medium" : current === "medium" ? "high" : "low";
    setSelectedCard({ ...selectedCard, priority: nextPriority });
    updateCurrentBoard((b) => ({
      ...b,
      cards: b.cards.map((c) =>
        c.id === selectedCard.id ? { ...c, priority: nextPriority } : c
      ),
    }));
  }, [selectedCard, setSelectedCard, updateCurrentBoard]);

  const closeAllPopovers = useCallback(() => {
    setIsStatusDropdownOpen(false);
    setIsDueDatePopoverOpen(false);
  }, [setIsStatusDropdownOpen]);

  // Mở bộ chọn giờ sau khi chọn + Giờ
  const selectedDueDate = selectedCard.dueDate;
  useEffect(() => {
    if (!autoOpenTimePickerRef.current) return;
    const el = timeInputRef.current;
    if (!el) return;
    autoOpenTimePickerRef.current = false;
    try {
      if (typeof el.showPicker === "function") {
        el.showPicker();
      } else {
        el.focus();
      }
    } catch {
      try {
        el.focus();
      } catch {}
    }
  }, [selectedDueDate]);

  const currentColumn = currentBoard.columns.find((c) => c.id === selectedCard.columnId);
  const totalCheck = selectedCard.checklist.length;
  const doneCheck = selectedCard.checklist.filter((i) => i.completed).length;
  const progressPercent = totalCheck > 0 ? Math.round((doneCheck / totalCheck) * 100) : 0;
  const deadlineInfo = selectedCard.dueDate ? getDeadlineStatus(selectedCard.dueDate) : null;

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden text-white select-none">
      {/* Controls Bar: 3 Chip Thuộc Tính & Nút Pomodoro */}
      <div className="px-3.5 pt-2 pb-2.5 space-y-2.5 border-b border-white/[0.08] shrink-0 bg-white/[0.01]">
        {/* 3 Chip Thuộc Tính (Trạng thái, Độ ưu tiên, Hạn chót) */}
        <div className="grid grid-cols-3 gap-2 w-full pt-0.5">
          {/* 1. Status Chip */}
          <div className={`relative ${isStatusDropdownOpen ? "z-50" : "z-0"}`}>
            <button
              ref={statusButtonRef}
              type="button"
              onClick={(e) => {
                setIsDueDatePopoverOpen(false);
                const rect = e.currentTarget.getBoundingClientRect();
                setStatusCoords({
                  top: Math.min(rect.bottom + 6, window.innerHeight - 220),
                  left: Math.max(12, rect.left),
                });
                setIsStatusDropdownOpen(!isStatusDropdownOpen);
              }}
              className={`w-full h-8 px-2 rounded-xl border text-xs font-medium flex items-center justify-between gap-1 transition-all cursor-pointer shadow-xs active:scale-95 ${
                isStatusDropdownOpen
                  ? "bg-white/15 border-white/30 text-white"
                  : "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-slate-200"
              }`}
              title="Cột trạng thái"
            >
              <span className="truncate flex items-center gap-1 font-semibold text-slate-100">
                {currentColumn?.title || "Chọn cột"}
              </span>
              <CaretDownIcon
                className={`w-3 h-3 text-slate-400 shrink-0 transition-transform ${
                  isStatusDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Status Dropdown Menu Portal */}
            {typeof document !== "undefined" &&
              document.body &&
              createPortal(
                <AnimatePresence>
                  {isStatusDropdownOpen && statusCoords && (
                    <div className="select-none">
                      <motion.div
                        key="status-dropdown-backdrop-mobile"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.16 }}
                        className="fixed inset-0 z-[70] bg-black/45 cursor-pointer touch-none"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsStatusDropdownOpen(false);
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsStatusDropdownOpen(false);
                        }}
                        role="button"
                        tabIndex={-1}
                        aria-label="Đóng danh sách trạng thái"
                      />
                      <motion.div
                        key="status-dropdown-menu-mobile"
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                        style={{ top: statusCoords.top, left: statusCoords.left }}
                        className="fixed z-[71] w-48 p-1.5 rounded-2xl border border-white/15 bg-neutral-950/92 shadow-[0_20px_50px_rgba(0,0,0,0.75),inset_0_1px_1.5px_rgba(255,255,255,0.18)] max-h-48 overflow-y-auto custom-study-scroll space-y-0.5 select-none"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {currentBoard.columns.map((col) => {
                          const isActive = selectedCard.columnId === col.id;
                          return (
                            <button
                              key={col.id}
                              type="button"
                              onClick={() => {
                                handleMoveCard(selectedCard.id, col.id);
                                setIsStatusDropdownOpen(false);
                              }}
                              className={`w-full px-2.5 py-2 rounded-xl text-xs font-medium text-left transition-all flex items-center justify-between cursor-pointer active:scale-95 ${
                                isActive
                                  ? "bg-sky-500/20 text-sky-300 font-bold border border-sky-400/30"
                                  : "text-slate-300 hover:bg-white/10 hover:text-white"
                              }`}
                            >
                              <span className="truncate">{col.title}</span>
                              {isActive && <CheckIcon className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                            </button>
                          );
                        })}
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>,
                document.body
              )}
          </div>

          {/* 2. Priority Chip */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                closeAllPopovers();
                cyclePriority();
              }}
              className={`w-full h-8 px-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 select-none bg-white/[0.04] hover:bg-white/[0.08] border-white/10 ${
                selectedCard.priority === "high"
                  ? "text-rose-300"
                  : selectedCard.priority === "medium"
                  ? "text-amber-300"
                  : "text-emerald-300"
              }`}
              title="Mức độ ưu tiên"
            >
              <PrioritySignalIcon priority={selectedCard.priority || "medium"} className="w-3.5 h-3.5 shrink-0" />
              <span className="font-semibold text-xs whitespace-nowrap">
                {selectedCard.priority === "high"
                  ? "Cao"
                  : selectedCard.priority === "medium"
                  ? "Vừa"
                  : "Thấp"}
              </span>
            </button>
          </div>

          {/* 3. Due Date Chip */}
          <div className={`relative ${isDueDatePopoverOpen ? "z-50" : "z-0"}`}>
            {selectedCard.dueDate && deadlineInfo ? (
              <button
                ref={dueDateButtonRef}
                type="button"
                onClick={(e) => {
                  setIsStatusDropdownOpen(false);
                  const rect = e.currentTarget.getBoundingClientRect();
                  setDueDateCoords({
                    top: Math.min(rect.bottom + 6, window.innerHeight - 340),
                    right: Math.max(12, window.innerWidth - rect.right),
                  });
                  setIsDueDatePopoverOpen(!isDueDatePopoverOpen);
                }}
                className={`w-full h-8 px-2 rounded-xl border text-xs font-medium flex items-center justify-between gap-1 transition-all cursor-pointer shadow-xs active:scale-95 ${
                  isDueDatePopoverOpen ? "border-white/30 bg-white/15 text-white" : deadlineInfo.badgeClass
                }`}
                title="Hạn chót"
              >
                <div className="flex items-center gap-1 min-w-0 truncate">
                  <CalendarIcon className="w-3 h-3 shrink-0" />
                  <span className="font-semibold truncate">{deadlineInfo.shortLabel}</span>
                </div>
                <CaretDownIcon
                  className={`w-3 h-3 opacity-60 shrink-0 transition-transform ${
                    isDueDatePopoverOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            ) : (
              <button
                ref={dueDateButtonRef}
                type="button"
                onClick={(e) => {
                  setIsStatusDropdownOpen(false);
                  const rect = e.currentTarget.getBoundingClientRect();
                  setDueDateCoords({
                    top: Math.min(rect.bottom + 6, window.innerHeight - 340),
                    right: Math.max(12, window.innerWidth - rect.right),
                  });
                  setIsDueDatePopoverOpen(!isDueDatePopoverOpen);
                }}
                className={`w-full h-8 px-2 rounded-xl border text-xs font-medium flex items-center justify-between gap-1 transition-all cursor-pointer shadow-xs active:scale-95 ${
                  isDueDatePopoverOpen
                    ? "bg-white/15 border-white/30 text-white"
                    : "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-slate-300"
                }`}
                title="Thêm hạn chót"
              >
                <div className="flex items-center gap-1 min-w-0 truncate">
                  <CalendarIcon className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate">Hạn chót</span>
                </div>
                <CaretDownIcon
                  className={`w-3 h-3 opacity-60 shrink-0 transition-transform ${
                    isDueDatePopoverOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            )}

            {/* Due Date Popover Portal */}
            {typeof document !== "undefined" &&
              document.body &&
              createPortal(
                <AnimatePresence>
                  {isDueDatePopoverOpen && dueDateCoords && (
                    <div className="select-none">
                      <motion.div
                        key="duedate-popover-backdrop-mobile"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.16 }}
                        className="fixed inset-0 z-[70] bg-black/45 cursor-pointer touch-none"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDueDatePopoverOpen(false);
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDueDatePopoverOpen(false);
                        }}
                        role="button"
                        tabIndex={-1}
                        aria-label="Đóng chọn hạn chót"
                      />
                      <motion.div
                        key="duedate-popover-menu-mobile"
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                        style={{ top: dueDateCoords.top, right: dueDateCoords.right }}
                        className="fixed z-[71] w-[min(20rem,calc(100vw-24px))] p-3.5 rounded-2xl border border-white/15 bg-neutral-950/92 shadow-[0_20px_50px_rgba(0,0,0,0.75),inset_0_1px_1.5px_rgba(255,255,255,0.18)] space-y-3 select-none"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Hạn chót
                          </span>
                          {selectedCard.dueDate && (
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateCardDueDate(undefined);
                                setIsDueDatePopoverOpen(false);
                              }}
                              className="text-xs text-rose-400 hover:text-rose-300 font-semibold transition-colors cursor-pointer"
                            >
                              Gỡ hạn chót
                            </button>
                          )}
                        </div>

                        {(() => {
                          const rawDueDate = selectedCard.dueDate || "";
                          const [dateVal = "", timeVal = ""] = rawDueDate.includes("T")
                            ? rawDueDate.split("T")
                            : [rawDueDate, ""];

                          return (
                            <div className="space-y-2.5">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="date"
                                  value={dateVal}
                                  onChange={(e) => {
                                    const newDate = e.target.value;
                                    if (!newDate) {
                                      handleUpdateCardDueDate(undefined);
                                    } else {
                                      handleUpdateCardDueDate(timeVal ? `${newDate}T${timeVal}` : newDate);
                                    }
                                  }}
                                  className="flex-1 min-w-0 h-8 px-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/15 focus:border-white/30 text-xs text-white focus:outline-none cursor-pointer [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                />
                                {timeVal ? (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <input
                                      ref={timeInputRef}
                                      type="time"
                                      value={timeVal}
                                      onChange={(e) => {
                                        const newTime = e.target.value;
                                        if (dateVal) {
                                          handleUpdateCardDueDate(newTime ? `${dateVal}T${newTime}` : dateVal);
                                        }
                                      }}
                                      className="w-24 h-8 px-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/15 focus:border-white/30 text-xs text-white focus:outline-none cursor-pointer [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (dateVal) handleUpdateCardDueDate(dateVal);
                                      }}
                                      className="p-1 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-white/10 transition-colors cursor-pointer"
                                      title="Gỡ giờ"
                                    >
                                      <XIcon className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : dateVal ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      autoOpenTimePickerRef.current = true;
                                      handleUpdateCardDueDate(`${dateVal}T23:59`);
                                    }}
                                    className="h-8 px-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-dashed border-white/20 text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer shrink-0"
                                    title="Thêm mốc giờ cụ thể"
                                  >
                                    <ClockIcon className="w-3 h-3 text-slate-400" />
                                    <span>+ Giờ</span>
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Quick Day Presets */}
                        <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-white/10">
                          {[
                            { label: "Hôm nay", days: 0 },
                            { label: "Ngày mai", days: 1 },
                            { label: "+3 Ngày", days: 3 },
                          ].map((preset) => {
                            const target = new Date();
                            target.setDate(target.getDate() + preset.days);
                            const y = target.getFullYear();
                            const m = String(target.getMonth() + 1).padStart(2, "0");
                            const d = String(target.getDate()).padStart(2, "0");
                            const dateStr = `${y}-${m}-${d}`;
                            const rawDueDate = selectedCard.dueDate || "";
                            const [curD = "", curT = ""] = rawDueDate.includes("T") ? rawDueDate.split("T") : [rawDueDate, ""];
                            const isSelected = curD === dateStr;

                            return (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    handleUpdateCardDueDate(undefined);
                                  } else {
                                    handleUpdateCardDueDate(curT ? `${dateStr}T${curT}` : dateStr);
                                  }
                                  setIsDueDatePopoverOpen(false);
                                }}
                                className={`py-1.5 rounded-xl text-xs font-medium text-center transition-all cursor-pointer active:scale-95 ${
                                  isSelected
                                    ? "bg-white/20 text-white font-bold border border-white/30"
                                    : "bg-white/[0.04] text-slate-300 hover:bg-white/10 hover:text-white"
                                }`}
                              >
                                {preset.label}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>,
                document.body
              )}
          </div>
        </div>

        {/* Nút bắt đầu Pomodoro */}
        <button
          type="button"
          onClick={() => {
            startFocusTask({ id: selectedCard.id, title: selectedCard.title });
            setSelectedCard(null);
            closeAllPopovers();
          }}
          className="w-full min-h-9 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-amber-400/20 to-amber-500/20 active:from-amber-500/30 active:to-amber-500/30 active:scale-[0.99] text-amber-200 font-semibold text-xs flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center transition-all cursor-pointer border border-amber-400/35 shadow-sm"
          title="Bắt đầu phiên tập trung Pomodoro cho nhiệm vụ này"
        >
          <PlayIcon className="w-3.5 h-3.5 fill-amber-300 text-amber-300 shrink-0" />
          <span>Bắt đầu phiên Pomodoro</span>
          {typeof selectedCard.pomodoros === "number" && selectedCard.pomodoros > 0 && (
            <span className="text-[10px] text-amber-300/80 font-mono bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20 ml-1">
              Đã làm {selectedCard.pomodoros} phiên
            </span>
          )}
        </button>
      </div>

      {/* Scrollable Content: Mô tả & Công việc con */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-8 space-y-4 custom-study-scroll">
        {/* Mô tả chi tiết */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <TextAlignLeftIcon className="w-3.5 h-3.5 text-slate-400" />
            <span>Mô tả chi tiết</span>
          </label>
          <textarea
            ref={descriptionTextareaRef}
            placeholder="Thêm mô tả hoặc ghi chú cho nhiệm vụ này..."
            value={selectedCard.description || ""}
            spellCheck={false}
            rows={2}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.max(el.scrollHeight, 68)}px`;
            }}
            onChange={(e) => {
              const updatedDesc = e.target.value;
              setSelectedCard({ ...selectedCard, description: updatedDesc });
              updateCurrentBoard((b) => ({
                ...b,
                cards: b.cards.map((c) =>
                  c.id === selectedCard.id ? { ...c, description: updatedDesc } : c
                ),
              }));
            }}
            className="w-full p-3 rounded-xl bg-white/[0.04] active:bg-white/[0.06] focus:bg-white/[0.08] border border-white/[0.1] focus:border-white/25 text-xs text-slate-200 placeholder-white/30 focus:outline-none resize-none overflow-hidden transition-[background-color,border-color] font-normal leading-relaxed"
          />
        </div>

        {/* Danh sách việc con */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span className="flex items-center gap-1.5">
              <CheckSquareIcon className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-300">
                Danh sách công việc con
              </span>
            </span>
            {totalCheck > 0 && (
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-200 border border-white/15 flex items-center gap-1">
                <span>
                  {doneCheck}/{totalCheck}
                </span>
                <span className="text-white/40">({progressPercent}%)</span>
              </span>
            )}
          </div>

          {/* Thanh tiến độ */}
          {totalCheck > 0 && (
            <div className="w-full h-1.5 rounded-full bg-black/40 border border-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-400/90 transition-all duration-300 shadow-[0_0_6px_rgba(52,211,153,0.4)]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}

          {/* Danh sách các việc con */}
          {totalCheck > 0 && (
            <div className="space-y-1.5">
              {selectedCard.checklist.map((item, itemIdx) => {
                const isEditing = editingChecklistId === item.id;
                return (
                  <div
                    key={item.id || `chk-${itemIdx}`}
                    className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-white/[0.03] active:bg-white/[0.07] border border-white/[0.06] gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleChecklist(selectedCard.id, item.id)}
                      className="p-1 text-white/40 active:text-emerald-400 cursor-pointer shrink-0 transition-colors"
                      title={item.completed ? "Đánh dấu chưa xong" : "Đánh dấu đã xong"}
                    >
                      {item.completed ? (
                        <CheckCircleIcon className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />
                      ) : (
                        <CircleIcon className="w-4 h-4 text-white/40" />
                      )}
                    </button>

                    {isEditing ? (
                      <input
                        type="text"
                        value={editingChecklistText}
                        onChange={(e) => setEditingChecklistText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleUpdateChecklistItemText(
                              selectedCard.id,
                              item.id,
                              editingChecklistText
                            );
                            setEditingChecklistId(null);
                          } else if (e.key === "Escape") {
                            setEditingChecklistId(null);
                          }
                        }}
                        onBlur={() => {
                          handleUpdateChecklistItemText(
                            selectedCard.id,
                            item.id,
                            editingChecklistText
                          );
                          setEditingChecklistId(null);
                        }}
                        className="flex-1 px-2.5 py-1 rounded-lg bg-black/70 border border-emerald-400/80 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-400 shadow-inner"
                        autoFocus
                        onFocus={(e) => e.target.select()}
                        maxLength={120}
                      />
                    ) : (
                      <div
                        onClick={() => {
                          setEditingChecklistId(item.id);
                          setEditingChecklistText(item.text);
                        }}
                        className="flex-1 min-w-0 flex items-center justify-between cursor-text py-0.5 px-1 rounded-lg active:bg-white/5 transition-colors"
                      >
                        <span
                          className={`text-xs break-words [overflow-wrap:anywhere] min-w-0 flex-1 leading-snug ${
                            item.completed
                              ? "line-through text-slate-500"
                              : "text-slate-200"
                          }`}
                        >
                          {item.text}
                        </span>
                        <PencilLineIcon className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1.5" />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteChecklistItem(selectedCard.id, item.id)}
                      className="p-1.5 text-slate-400 active:text-rose-400 transition-colors cursor-pointer shrink-0"
                      title="Xóa mục"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Thêm việc con nhanh (Input và Button tách biệt độc lập) */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Thêm mục việc cần làm..."
              value={newChecklistText}
              onChange={(e) => setNewChecklistText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (newChecklistText.trim()) {
                    handleAddChecklistItem(selectedCard.id, newChecklistText);
                    setNewChecklistText("");
                  }
                }
              }}
              className="flex-1 min-w-0 h-9 px-3 rounded-xl bg-white/[0.04] active:bg-white/[0.06] focus:bg-white/[0.08] border border-white/10 focus:border-white/25 text-xs text-white placeholder-white/30 focus:outline-none transition-[background-color,border-color]"
            />
            <button
              type="button"
              onClick={() => {
                if (newChecklistText.trim()) {
                  handleAddChecklistItem(selectedCard.id, newChecklistText);
                  setNewChecklistText("");
                }
              }}
              className="h-9 px-3.5 rounded-xl bg-white/10 active:bg-white text-white active:text-black border border-white/15 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95 shadow-sm"
            >
              <PlusIcon className="w-3.5 h-3.5" weight="bold" />
              <span>Thêm</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
