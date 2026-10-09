"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  X,
  ChevronDown,
  Check,
  Calendar,
  AlignLeft,
  CheckSquare,
  CheckCircle2,
  Circle,
  Edit3,
  Trash2,
  Plus,
  Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { KanbanBoard, KanbanCard, CardPriority } from "../types";
import { getDeadlineStatus } from "../utils/task-deadline";

interface CardDetailModalProps {
  selectedCard: KanbanCard | null;
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

export const CardDetailModal = React.memo(function CardDetailModal({
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
  promptDeleteCard,
}: CardDetailModalProps) {
  const [newChecklistText, setNewChecklistText] = useState("");
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [editingChecklistText, setEditingChecklistText] = useState("");
  const [isPriorityPopoverOpen, setIsPriorityPopoverOpen] = useState(false);
  const [isDueDatePopoverOpen, setIsDueDatePopoverOpen] = useState(false);

  const closeAllPopovers = useCallback(() => {
    setIsStatusDropdownOpen(false);
    setIsPriorityPopoverOpen(false);
    setIsDueDatePopoverOpen(false);
  }, [setIsStatusDropdownOpen]);

  // Intercept Escape key to close popover or detail modal without closing parent tasks widget
  useEffect(() => {
    if (!selectedCard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (isPriorityPopoverOpen || isDueDatePopoverOpen || isStatusDropdownOpen) {
          closeAllPopovers();
        } else {
          setSelectedCard(null);
          closeAllPopovers();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [
    selectedCard,
    isPriorityPopoverOpen,
    isDueDatePopoverOpen,
    isStatusDropdownOpen,
    closeAllPopovers,
    setSelectedCard,
  ]);

  if (!selectedCard) return null;

  const currentColumn = currentBoard.columns.find((c) => c.id === selectedCard.columnId);
  const totalCheck = selectedCard.checklist.length;
  const doneCheck = selectedCard.checklist.filter((i) => i.completed).length;
  const progressPercent = totalCheck > 0 ? Math.round((doneCheck / totalCheck) * 100) : 0;
  const deadlineInfo = selectedCard.dueDate ? getDeadlineStatus(selectedCard.dueDate) : null;

  return (
    <AnimatePresence>
      <motion.div
        key={`card-details-modal-${selectedCard.id}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-60 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4"
        onClick={() => {
          setSelectedCard(null);
          closeAllPopovers();
        }}
      >
        <motion.div
          initial={{ scale: 0.96, y: 12, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.96, y: 12, opacity: 0 }}
          transition={{ type: "spring", stiffness: 360, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xl max-h-[88vh] flex flex-col rounded-3xl bg-[#14161b]/98 backdrop-blur-2xl border border-white/12 shadow-[0_30px_70px_rgba(0,0,0,0.85),0_0_1px_1px_rgba(255,255,255,0.08)] text-white overflow-hidden"
        >
          {/* Header: Title, Board Info & Action Bar */}
          <div className="px-5 sm:px-6 pt-5 pb-3.5 border-b border-white/10 space-y-3 bg-white/[0.01]">
            <div className="flex items-start justify-between gap-3">
              {/* Task Title */}
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={selectedCard.title}
                  onChange={(e) => {
                    const updatedTitle = e.target.value;
                    setSelectedCard({ ...selectedCard, title: updatedTitle });
                    updateCurrentBoard((b) => ({
                      ...b,
                      cards: b.cards.map((c) =>
                        c.id === selectedCard.id ? { ...c, title: updatedTitle } : c
                      ),
                    }));
                  }}
                  className="w-full text-base sm:text-lg font-bold bg-transparent border-0 focus:ring-0 focus:outline-none placeholder-white/30 text-white focus:text-emerald-100 transition-colors"
                  placeholder="Tiêu đề nhiệm vụ..."
                />
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <span>
                    Bảng: <strong className="text-slate-300 font-medium">{currentBoard.title}</strong>
                  </span>
                </div>
              </div>

              {/* Quick Actions (Delete & Close) */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => promptDeleteCard(selectedCard)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Xóa thẻ này"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCard(null);
                    closeAllPopovers();
                  }}
                  className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Đóng (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Compact Property Chips Bar (Linear / Notion Style) */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {/* 1. Status Chip */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsPriorityPopoverOpen(false);
                    setIsDueDatePopoverOpen(false);
                    setIsStatusDropdownOpen(!isStatusDropdownOpen);
                  }}
                  className="h-7 px-2.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 hover:border-white/20 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                  <span className="text-slate-400 text-[11px]">Cột:</span>
                  <span className="font-semibold text-slate-100 max-w-[120px] truncate">
                    {currentColumn?.title || "Chọn cột"}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 text-slate-400 transition-transform ${
                      isStatusDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Status Dropdown Menu */}
                <AnimatePresence>
                  {isStatusDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsStatusDropdownOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.97 }}
                        transition={{ duration: 0.12 }}
                        className="absolute top-full mt-1.5 left-0 w-48 p-1.5 rounded-2xl bg-[#181b22] backdrop-blur-2xl border border-white/15 shadow-2xl z-50 max-h-48 overflow-y-auto custom-study-scroll space-y-0.5"
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
                              className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-medium text-left transition-all flex items-center justify-between cursor-pointer ${
                                isActive
                                  ? "bg-sky-500/20 text-sky-300 font-bold border border-sky-400/30"
                                  : "text-slate-300 hover:bg-white/10 hover:text-white"
                              }`}
                            >
                              <span className="truncate">{col.title}</span>
                              {isActive && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                            </button>
                          );
                        })}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* 2. Priority Chip */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsStatusDropdownOpen(false);
                    setIsDueDatePopoverOpen(false);
                    setIsPriorityPopoverOpen(!isPriorityPopoverOpen);
                  }}
                  className={`h-7 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                    selectedCard.priority === "high"
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20"
                      : selectedCard.priority === "medium"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                      : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      selectedCard.priority === "high"
                        ? "bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.8)]"
                        : selectedCard.priority === "medium"
                        ? "bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.7)]"
                        : "bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.7)]"
                    }`}
                  />
                  <span className="text-[11px] opacity-75">Ưu tiên:</span>
                  <span className="font-semibold">
                    {selectedCard.priority === "high"
                      ? "Cao"
                      : selectedCard.priority === "medium"
                      ? "Vừa"
                      : "Thấp"}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 opacity-60 transition-transform ${
                      isPriorityPopoverOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Priority Popover */}
                <AnimatePresence>
                  {isPriorityPopoverOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsPriorityPopoverOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.97 }}
                        transition={{ duration: 0.12 }}
                        className="absolute top-full mt-1.5 left-0 w-36 p-1.5 rounded-2xl bg-[#181b22] backdrop-blur-2xl border border-white/15 shadow-2xl z-50 space-y-0.5"
                      >
                        {[
                          { value: "low", label: "Thấp", color: "bg-emerald-400" },
                          { value: "medium", label: "Vừa", color: "bg-amber-400" },
                          { value: "high", label: "Cao", color: "bg-rose-400" },
                        ].map((item) => {
                          const isSelected = selectedCard.priority === item.value;
                          return (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => {
                                const updatedPriority = item.value as CardPriority;
                                setSelectedCard({ ...selectedCard, priority: updatedPriority });
                                updateCurrentBoard((b) => ({
                                  ...b,
                                  cards: b.cards.map((c) =>
                                    c.id === selectedCard.id ? { ...c, priority: updatedPriority } : c
                                  ),
                                }));
                                setIsPriorityPopoverOpen(false);
                              }}
                              className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-medium text-left transition-all flex items-center justify-between cursor-pointer ${
                                isSelected
                                  ? "bg-white/15 text-white font-bold"
                                  : "text-slate-300 hover:bg-white/10 hover:text-white"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                                <span>{item.label}</span>
                              </div>
                              {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                            </button>
                          );
                        })}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* 3. Due Date Chip */}
              <div className="relative">
                {selectedCard.dueDate && deadlineInfo ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsStatusDropdownOpen(false);
                      setIsPriorityPopoverOpen(false);
                      setIsDueDatePopoverOpen(!isDueDatePopoverOpen);
                    }}
                    className={`h-7 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${deadlineInfo.badgeClass}`}
                  >
                    <Calendar className="w-3 h-3 shrink-0" />
                    <span className="font-semibold">{deadlineInfo.shortLabel}</span>
                    <ChevronDown
                      className={`w-3 h-3 opacity-60 transition-transform ${
                        isDueDatePopoverOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsStatusDropdownOpen(false);
                      setIsPriorityPopoverOpen(false);
                      setIsDueDatePopoverOpen(!isDueDatePopoverOpen);
                    }}
                    className="h-7 px-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-dashed border-white/20 hover:border-white/40 text-xs font-medium text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>+ Hạn chót</span>
                  </button>
                )}

                {/* Due Date Popover */}
                <AnimatePresence>
                  {isDueDatePopoverOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsDueDatePopoverOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.97 }}
                        transition={{ duration: 0.12 }}
                        className="absolute top-full mt-1.5 left-0 sm:left-auto sm:right-0 w-80 p-3.5 rounded-2xl bg-[#181b22] backdrop-blur-2xl border border-white/15 shadow-2xl z-50 space-y-3"
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
                              className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold transition-colors cursor-pointer"
                            >
                              Gỡ hạn chót
                            </button>
                          )}
                        </div>

                        {/* Date and Optional Time Row */}
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
                                      type="time"
                                      value={timeVal}
                                      onChange={(e) => {
                                        const newTime = e.target.value;
                                        if (dateVal) {
                                          handleUpdateCardDueDate(newTime ? `${dateVal}T${newTime}` : dateVal);
                                        }
                                      }}
                                      className="w-28 h-8 px-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/15 focus:border-white/30 text-xs text-white focus:outline-none cursor-pointer [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (dateVal) handleUpdateCardDueDate(dateVal);
                                      }}
                                      className="p-1 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-white/10 transition-colors cursor-pointer"
                                      title="Gỡ giờ"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const baseDate = dateVal || new Date().toISOString().split("T")[0];
                                      handleUpdateCardDueDate(`${baseDate}T23:59`);
                                    }}
                                    className="h-8 px-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-dashed border-white/20 text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer shrink-0"
                                    title="Thêm mốc giờ cụ thể"
                                  >
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    <span>+ Giờ</span>
                                  </button>
                                )}
                              </div>

                              {/* Quick Time Presets if date exists */}
                              {dateVal && (
                                <div className="flex items-center justify-between gap-1 pt-0.5">
                                  <span className="text-[10px] text-slate-400 shrink-0">Giờ:</span>
                                  <div className="flex items-center gap-1 flex-1 justify-end">
                                    {[
                                      { label: "09:00", val: "09:00" },
                                      { label: "12:00", val: "12:00" },
                                      { label: "17:00", val: "17:00" },
                                      { label: "23:59", val: "23:59" },
                                    ].map((tp) => (
                                      <button
                                        key={tp.val}
                                        type="button"
                                        onClick={() => {
                                          handleUpdateCardDueDate(`${dateVal}T${tp.val}`);
                                        }}
                                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-colors cursor-pointer ${
                                          timeVal === tp.val
                                            ? "bg-white/20 text-white font-bold border border-white/30"
                                            : "bg-white/[0.04] text-slate-400 hover:bg-white/10 hover:text-white"
                                        }`}
                                      >
                                        {tp.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
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
                                className={`py-1 rounded-lg text-[11px] font-medium text-center transition-all cursor-pointer ${
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
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-5 custom-study-scroll">
            {/* 1. Description Section */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlignLeft className="w-3.5 h-3.5 text-slate-400" />
                <span>Mô tả chi tiết</span>
              </label>
              <textarea
                placeholder="Nhấp để thêm mô tả, ghi chú chi tiết cho nhiệm vụ..."
                value={selectedCard.description || ""}
                spellCheck={false}
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
                rows={3}
                className="w-full p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] focus:bg-white/[0.07] border border-white/[0.07] focus:border-white/20 text-xs sm:text-sm text-slate-200 placeholder-white/30 focus:outline-none resize-none min-h-[76px] transition-all font-normal leading-relaxed"
              />
            </div>

            {/* 2. Checklist Section */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Danh sách công việc con
                  </span>
                </span>
                {totalCheck > 0 && (
                  <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-white/10 text-slate-200 border border-white/15 flex items-center gap-1">
                    <span>
                      {doneCheck}/{totalCheck}
                    </span>
                    <span className="text-white/40">({progressPercent}%)</span>
                  </span>
                )}
              </div>

              {/* Progress bar */}
              {totalCheck > 0 && (
                <div className="w-full h-1.5 rounded-full bg-black/40 border border-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-400/90 transition-all duration-300 shadow-[0_0_6px_rgba(52,211,153,0.4)]"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}

              {/* Checklist Items */}
              {totalCheck > 0 && (
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 custom-study-scroll">
                  {selectedCard.checklist.map((item, itemIdx) => {
                    const isEditing = editingChecklistId === item.id;
                    return (
                      <div
                        key={item.id || `chk-${itemIdx}`}
                        className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] group transition-all gap-2"
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleChecklist(selectedCard.id, item.id)}
                          className="p-0.5 text-white/40 hover:text-emerald-400 cursor-pointer shrink-0 transition-colors"
                          title={item.completed ? "Đánh dấu chưa xong" : "Đánh dấu đã xong"}
                        >
                          {item.completed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />
                          ) : (
                            <Circle className="w-4 h-4 text-white/40 group-hover:text-emerald-300 transition-colors" />
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
                            className="flex-1 min-w-0 flex items-center justify-between cursor-text py-0.5 px-2 -mx-1 rounded-lg hover:bg-white/5 transition-colors group/text"
                            title="Bấm vào nội dung để chỉnh sửa trực tiếp"
                          >
                            <span
                              className={`text-xs break-words [overflow-wrap:anywhere] min-w-0 flex-1 leading-snug ${
                                item.completed
                                  ? "line-through text-slate-500"
                                  : "text-slate-200 group-hover/text:text-white"
                              }`}
                            >
                              {item.text}
                            </span>
                            <Edit3 className="w-3 h-3 text-slate-500 group-hover/text:text-slate-300 opacity-0 group-hover/text:opacity-100 shrink-0 ml-1.5 transition-opacity" />
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteChecklistItem(selectedCard.id, item.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 transition-opacity cursor-pointer shrink-0"
                          title="Xóa mục"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Checklist Input */}
              <div className="flex items-center gap-2 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.08] focus-within:border-white/30 transition-all">
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
                  className="flex-1 px-3 py-1.5 bg-transparent border-0 text-xs text-white placeholder-white/30 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newChecklistText.trim()) {
                      handleAddChecklistItem(selectedCard.id, newChecklistText);
                      setNewChecklistText("");
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white text-white hover:text-black text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm</span>
                </button>
              </div>
            </div>
          </div>

          {/* Minimalist Footer */}
          <div className="px-5 sm:px-6 py-3 border-t border-white/10 flex items-center justify-between bg-black/20">
            <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
              Nhấn <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 text-[10px]">Esc</kbd> để đóng
            </span>
            <div className="sm:hidden" />
            <button
              type="button"
              onClick={() => {
                setSelectedCard(null);
                closeAllPopovers();
              }}
              className="px-5 py-1.5 rounded-xl bg-white text-slate-950 hover:bg-slate-200 text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Xong</span>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});
