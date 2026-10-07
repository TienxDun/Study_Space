"use client";

import React, { useState } from "react";
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

  if (!selectedCard) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={`card-details-modal-${selectedCard.id}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-60 bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
        onClick={() => {
          setSelectedCard(null);
          setIsStatusDropdownOpen(false);
        }}
      >
        <motion.div
          initial={{ scale: 0.95, y: 16 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 16 }}
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg rounded-3xl bg-[#14161b]/98 backdrop-blur-2xl border border-white/12 shadow-[0_30px_70px_rgba(0,0,0,0.85),0_0_1px_1px_rgba(255,255,255,0.08)] p-6 space-y-5 text-white"
        >
          {/* Header: Title Input & Close */}
          <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-white/10">
            <div className="space-y-1 flex-1 min-w-0">
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
                className="w-full text-base sm:text-lg font-bold bg-transparent border-0 focus:ring-0 focus:outline-none placeholder-white/30 text-white focus:text-sky-100 transition-colors"
                placeholder="Tiêu đề nhiệm vụ..."
              />
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                <span>
                  Bảng: <strong className="text-slate-300">{currentBoard.title}</strong>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedCard(null);
                setIsStatusDropdownOpen(false);
              }}
              className="p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer flex-shrink-0"
              title="Đóng (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 1. Status & Priority: Elegant Balanced Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Status: Custom Dropdown Menu */}
            <div className="space-y-1.5 relative">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Danh sách / Cột
              </label>

              {/* Trigger Button */}
              <button
                type="button"
                onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                className="w-full h-10 px-3.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.09] focus:border-sky-400/60 border border-white/[0.12] text-xs font-bold text-white flex items-center justify-between transition-all cursor-pointer shadow-sm"
              >
                <span className="truncate mr-2 font-bold text-slate-100">
                  {currentBoard.columns.find((c) => c.id === selectedCard.columnId)?.title ||
                    "Chọn danh sách"}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-white/50 transition-transform ${
                    isStatusDropdownOpen ? "rotate-180 text-sky-400" : ""
                  }`}
                />
              </button>

              {/* Dropdown Options */}
              <AnimatePresence>
                {isStatusDropdownOpen && (
                  <React.Fragment key="card-status-dropdown-fragment">
                    <div
                      key="card-status-backdrop"
                      className="fixed inset-0 z-40"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsStatusDropdownOpen(false);
                      }}
                    />
                    <motion.div
                      key="card-status-panel"
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full mt-1.5 left-0 w-full p-1.5 rounded-2xl bg-slate-900/98 backdrop-blur-2xl border border-white/20 shadow-2xl z-50 max-h-48 overflow-y-auto custom-study-scroll space-y-1"
                    >
                      {currentBoard.columns.map((col, colIdx) => {
                        const isActive = selectedCard.columnId === col.id;
                        const count = currentBoard.cards.filter((c) => c.columnId === col.id).length;
                        return (
                          <button
                            key={col.id || `col-opt-${colIdx}`}
                            type="button"
                            onClick={() => {
                              handleMoveCard(selectedCard.id, col.id);
                              setIsStatusDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2 rounded-xl text-xs font-bold text-left transition-all flex items-center justify-between cursor-pointer ${
                              isActive
                                ? "bg-sky-500/20 text-sky-300 border border-sky-400/30 font-extrabold shadow-sm"
                                : "text-slate-300 hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate mr-2">
                              {isActive && <Check className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />}
                              <span className="truncate">{col.title}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">
                              {count} thẻ
                            </span>
                          </button>
                        );
                      })}
                    </motion.div>
                  </React.Fragment>
                )}
              </AnimatePresence>
            </div>

            {/* Priority: Segmented Control */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Mức độ ưu tiên
              </label>
              <div className="h-10 grid grid-cols-3 gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.08] items-center">
                {[
                  {
                    value: "low",
                    label: "Thấp",
                    activeClass:
                      "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/30",
                    idleClass: "text-slate-400 hover:text-slate-200 hover:bg-white/5",
                  },
                  {
                    value: "medium",
                    label: "Vừa",
                    activeClass:
                      "bg-amber-500/20 text-amber-300 font-bold border border-amber-400/30",
                    idleClass: "text-slate-400 hover:text-slate-200 hover:bg-white/5",
                  },
                  {
                    value: "high",
                    label: "Cao",
                    activeClass:
                      "bg-rose-500/20 text-rose-300 font-bold border border-rose-400/30",
                    idleClass: "text-slate-400 hover:text-rose-200 hover:bg-white/5",
                  },
                ].map((p) => {
                  const isSelected = selectedCard.priority === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => {
                        const updatedPriority = p.value as CardPriority;
                        setSelectedCard({ ...selectedCard, priority: updatedPriority });
                        updateCurrentBoard((b) => ({
                          ...b,
                          cards: b.cards.map((c) =>
                            c.id === selectedCard.id ? { ...c, priority: updatedPriority } : c
                          ),
                        }));
                      }}
                      className={`h-full rounded-xl text-xs font-bold text-center transition-all cursor-pointer truncate px-1 flex items-center justify-center border border-transparent ${
                        isSelected ? p.activeClass : p.idleClass
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 2. Deadline & Quick Presets Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Left Column: Date Picker Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Hạn chót (Deadline)</span>
                </label>
                {selectedCard.dueDate && (
                  <button
                    type="button"
                    onClick={() => handleUpdateCardDueDate(undefined)}
                    className="text-[10px] text-slate-400 hover:text-slate-200 font-medium transition-colors cursor-pointer"
                    title="Gỡ bỏ hạn chót"
                  >
                    Xóa hạn
                  </button>
                )}
              </div>

              <input
                type="date"
                value={selectedCard.dueDate || ""}
                onChange={(e) => handleUpdateCardDueDate(e.target.value || undefined)}
                className="w-full h-10 px-3.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.09] focus:bg-black/50 border border-white/[0.12] focus:border-white/30 text-xs font-bold text-white focus:outline-none cursor-pointer [color-scheme:dark] shadow-sm transition-all"
              />
            </div>

            {/* Right Column: Quick Presets */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Chọn nhanh
                </label>
                {selectedCard.dueDate &&
                  (() => {
                    const dStatus = getDeadlineStatus(selectedCard.dueDate);
                    if (!dStatus) return null;
                    return (
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[9px] font-bold border ${dStatus.badgeClass}`}
                      >
                        <span>{dStatus.shortLabel}</span>
                      </span>
                    );
                  })()}
              </div>

              <div className="h-10 grid grid-cols-3 gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.08] items-center">
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
                  const isSelected = selectedCard.dueDate === dateStr;

                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleUpdateCardDueDate(isSelected ? undefined : dateStr)}
                      className={`h-full rounded-xl text-xs font-bold text-center transition-all cursor-pointer truncate px-1 flex items-center justify-center border border-transparent ${
                        isSelected
                          ? "bg-white/20 text-white font-bold border border-white/30 shadow-sm"
                          : "text-slate-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. Description Section */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block flex items-center gap-1.5">
              <AlignLeft className="w-3.5 h-3.5 text-slate-400" />
              <span>Mô tả chi tiết</span>
            </label>
            <textarea
              placeholder="Thêm mô tả hoặc ghi chú thêm cho nhiệm vụ..."
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
              className="w-full p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.06] focus:bg-black/40 border border-white/[0.08] focus:border-white/30 text-xs text-white placeholder-white/30 focus:outline-none resize-none h-20 transition-all font-normal leading-relaxed"
            />
          </div>

          {/* 4. Checklist Section */}
          <div className="space-y-2.5 pt-1">
            {(() => {
              const totalCheck = selectedCard.checklist.length;
              const doneCheck = selectedCard.checklist.filter((i) => i.completed).length;
              const progressPercent = totalCheck > 0 ? Math.round((doneCheck / totalCheck) * 100) : 0;

              return (
                <>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5 text-slate-300" />
                      <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
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

                  {totalCheck > 0 && (
                    <div className="w-full h-1.5 rounded-full bg-black/40 border border-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-400/90 transition-all duration-300 shadow-[0_0_6px_rgba(52,211,153,0.4)]"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  )}

                  {totalCheck > 0 && (
                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 custom-study-scroll">
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
                              className="p-0.5 text-white/40 hover:text-emerald-400 cursor-pointer flex-shrink-0 transition-colors"
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
                                <Edit3 className="w-3 h-3 text-slate-500 group-hover/text:text-slate-300 opacity-0 group-hover/text:opacity-100 flex-shrink-0 ml-1.5 transition-opacity" />
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteChecklistItem(selectedCard.id, item.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 transition-opacity cursor-pointer flex-shrink-0"
                              title="Xóa mục"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}

            {/* Add Checklist Input Bar */}
            <div className="flex items-center gap-2 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.08] focus-within:border-white/30 transition-all">
              <input
                type="text"
                placeholder="Thêm mục việc cần làm..."
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddChecklistItem(selectedCard.id, newChecklistText);
                    setNewChecklistText("");
                  }
                }}
                className="flex-1 px-3 py-1.5 bg-transparent border-0 text-xs text-white placeholder-white/30 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  handleAddChecklistItem(selectedCard.id, newChecklistText);
                  setNewChecklistText("");
                }}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white text-white hover:text-black text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm</span>
              </button>
            </div>
          </div>

          {/* Actions Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => promptDeleteCard(selectedCard)}
              className="px-3.5 py-2 rounded-2xl text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/15 border border-rose-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa thẻ</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedCard(null);
                setIsStatusDropdownOpen(false);
              }}
              className="px-6 py-2 rounded-2xl bg-white text-slate-950 hover:bg-slate-200 text-xs font-black shadow-[0_4px_16px_rgba(255,255,255,0.2)] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Xong</span>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});
