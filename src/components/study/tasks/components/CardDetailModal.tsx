"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ModalShell } from "@/components/ui/ModalShell";
import {
  XIcon,
  CaretDownIcon,
  CaretLeftIcon,
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
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { KanbanBoard, KanbanCard, CardPriority } from "../types";
import { getDeadlineStatus } from "../utils/task-deadline";
import { startFocusTask } from "@/lib/use-focus-task";
import { PrioritySignalIcon } from "./PrioritySignalIcon";
import { SyncStatusBadge } from "@/components/study/sync/SyncStatusBadge";

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
  onBack?: () => void;
  backLabel?: string;
  embedded?: boolean;
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
  onBack,
  backLabel,
  embedded = false,
}: CardDetailModalProps) {
  const [newChecklistText, setNewChecklistText] = useState("");
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [editingChecklistText, setEditingChecklistText] = useState("");
  const [isDueDatePopoverOpen, setIsDueDatePopoverOpen] = useState(false);
  const statusButtonRef = useRef<HTMLButtonElement>(null);
  const [statusCoords, setStatusCoords] = useState<{ top: number; left: number } | null>(null);
  const dueDateButtonRef = useRef<HTMLButtonElement>(null);
  const [dueDateCoords, setDueDateCoords] = useState<{ top: number; right: number } | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Đồng bộ vị trí hiển thị dropdown trạng thái
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
        top: rect.bottom + 6,
        left: Math.max(12, rect.left),
      });
    };
    updateCoords();
    window.addEventListener("resize", updateCoords);
    return () => window.removeEventListener("resize", updateCoords);
  }, [isStatusDropdownOpen]);

  // Đồng bộ vị trí hiển thị popover hạn chót
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
        top: rect.bottom + 6,
        right: Math.max(12, window.innerWidth - rect.right),
      });
    };
    updateCoords();
    window.addEventListener("resize", updateCoords);
    return () => window.removeEventListener("resize", updateCoords);
  }, [isDueDatePopoverOpen]);

  // Tự động co giãn ô mô tả chi tiết theo độ dài nội dung
  const autoResizeDescription = useCallback(() => {
    const el = descriptionTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 68)}px`;
  }, []);

  useEffect(() => {
    autoResizeDescription();
  }, [selectedCard?.id, selectedCard?.description, autoResizeDescription]);

  // Chuyển đổi nhanh độ ưu tiên trực tiếp (Thấp -> Vừa -> Cao -> Thấp) khi chạm vào chip
  const cyclePriority = useCallback(() => {
    if (!selectedCard) return;
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

  // Giữ nút đóng ổn định: khung ngoài chỉ chạy lại khi mở/tắt, gõ chữ không bị giật mất chỗ gõ
  const handleCloseDetail = useCallback(() => {
    setSelectedCard(null);
    closeAllPopovers();
  }, [setSelectedCard, closeAllPopovers]);

  // Bấm + Giờ xong tự mở bảng chọn giờ luôn, khỏi bấm lần 2
  const timeInputRef = useRef<HTMLInputElement>(null);
  const autoOpenTimePickerRef = useRef(false);
  const selectedDueDate = selectedCard?.dueDate;
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

  // Esc và bấm nền: đóng popover trước, chưa đóng cả hộp chi tiết
  const handleRequestClose = useCallback(() => {
    if (isDueDatePopoverOpen || isStatusDropdownOpen) {
      closeAllPopovers();
      return;
    }
    handleCloseDetail();
  }, [
    isDueDatePopoverOpen,
    isStatusDropdownOpen,
    closeAllPopovers,
    handleCloseDetail,
  ]);

  if (!selectedCard) return null;

  const currentColumn = currentBoard.columns.find((c) => c.id === selectedCard.columnId);
  const totalCheck = selectedCard.checklist.length;
  const doneCheck = selectedCard.checklist.filter((i) => i.completed).length;
  const progressPercent = totalCheck > 0 ? Math.round((doneCheck / totalCheck) * 100) : 0;
  const deadlineInfo = selectedCard.dueDate ? getDeadlineStatus(selectedCard.dueDate) : null;

  // Thanh 3 chip thuộc tính (Trạng thái, Độ ưu tiên, Hạn chót)
  const propertyChipsBar = (
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
              top: rect.bottom + 6,
              left: Math.max(12, rect.left),
            });
            setIsStatusDropdownOpen(!isStatusDropdownOpen);
          }}
          className={`w-full h-8 px-2 sm:px-2.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-1 transition-all cursor-pointer shadow-xs ${
            isStatusDropdownOpen
              ? "bg-white/15 border-white/30 text-white"
              : "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 hover:border-white/20 text-slate-200"
          }`}
          title="Cột trạng thái"
        >
          <span className="truncate flex items-center gap-1">
            <span className="font-semibold text-slate-100 truncate">
              {currentColumn?.title || "Chọn cột"}
            </span>
          </span>
          <CaretDownIcon
            className={`w-3 h-3 text-slate-400 shrink-0 transition-transform ${
              isStatusDropdownOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Status Dropdown Menu (Portal ra document.body để mờ toàn màn hình) */}
        {typeof document !== "undefined" &&
          document.body &&
          createPortal(
            <AnimatePresence>
              {isStatusDropdownOpen && statusCoords && (
                <div className="select-none">
                  {/* Lớp nền mờ tối phủ toàn màn hình bắt chạm để đóng */}
                  <motion.div
                    key="status-dropdown-backdrop"
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
                    key="status-dropdown-menu"
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    style={{ top: statusCoords.top, left: statusCoords.left }}
                    className="fixed z-[71] w-48 p-1.5 rounded-2xl surface-frost border shadow-[0_16px_40px_rgba(0,0,0,0.85)] max-h-48 overflow-y-auto custom-study-scroll space-y-0.5 select-none"
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
                          className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-medium text-left transition-all flex items-center justify-between cursor-pointer ${
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

      {/* 2. Priority Chip - Chạm để chuyển đổi trực tiếp giữa Thấp -> Vừa -> Cao */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setIsStatusDropdownOpen(false);
            setIsDueDatePopoverOpen(false);
            cyclePriority();
          }}
          className={`w-full h-8 px-2 sm:px-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 select-none ${
            selectedCard.priority === "high"
              ? "bg-rose-500/[0.08] border-rose-500/25 text-rose-300 hover:bg-rose-500/15"
              : selectedCard.priority === "medium"
              ? "bg-amber-500/[0.08] border-amber-500/25 text-amber-300 hover:bg-amber-500/15"
              : "bg-emerald-500/[0.08] border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/15"
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
                top: rect.bottom + 6,
                right: Math.max(12, window.innerWidth - rect.right),
              });
              setIsDueDatePopoverOpen(!isDueDatePopoverOpen);
            }}
            className={`w-full h-8 px-2 sm:px-2.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-1 transition-all cursor-pointer shadow-xs ${
              isDueDatePopoverOpen ? "border-white/30 bg-white/15 text-white" : deadlineInfo.badgeClass
            }`}
            title="Hạn chót"
          >
            <div className="flex items-center gap-1.5 min-w-0 truncate">
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
                top: rect.bottom + 6,
                right: Math.max(12, window.innerWidth - rect.right),
              });
              setIsDueDatePopoverOpen(!isDueDatePopoverOpen);
            }}
            className={`w-full h-8 px-2 sm:px-2.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-1 transition-all cursor-pointer shadow-xs ${
              isDueDatePopoverOpen
                ? "bg-white/15 border-white/30 text-white"
                : "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 hover:border-white/20 text-slate-300 hover:text-white"
            }`}
            title="Thêm hạn chót"
          >
            <div className="flex items-center gap-1.5 min-w-0 truncate">
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

        {/* Due Date Popover (Portal ra document.body để mờ toàn màn hình) */}
        {typeof document !== "undefined" &&
          document.body &&
          createPortal(
            <AnimatePresence>
              {isDueDatePopoverOpen && dueDateCoords && (
                <div className="select-none">
                  {/* Lớp nền mờ tối phủ toàn màn hình bắt chạm để đóng */}
                  <motion.div
                    key="duedate-popover-backdrop"
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
                    key="duedate-popover-menu"
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    style={{ top: dueDateCoords.top, right: dueDateCoords.right }}
                    className="fixed z-[71] w-[min(20rem,calc(100vw-24px))] sm:w-80 p-3.5 rounded-2xl surface-frost border shadow-[0_16px_40px_rgba(0,0,0,0.85)] space-y-3 select-none"
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
                              ref={timeInputRef}
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

                      {/* Quick Time Presets if date exists (desktop only, mobile dùng nút + Giờ cho gọn) */}
                      {dateVal && (
                        <div className="hidden sm:flex items-center justify-between gap-1 pt-0.5">
                          <span className="text-xs text-slate-400 shrink-0">Giờ:</span>
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
                                className={`px-2 py-0.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
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
                        className={`py-1 rounded-lg text-xs font-medium text-center transition-all cursor-pointer ${
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
  );

  // Nút hành động chính: Bắt đầu phiên Pomodoro
  const pomodoroButton = (
    <button
      type="button"
      onClick={() => {
        startFocusTask({ id: selectedCard.id, title: selectedCard.title });
        setSelectedCard(null);
        closeAllPopovers();
      }}
      className="w-full min-h-9 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-amber-400/20 to-amber-500/20 hover:from-amber-500/30 hover:to-amber-500/30 active:scale-[0.99] text-amber-200 font-semibold text-xs flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center transition-all cursor-pointer border border-amber-400/35 shadow-sm"
      title="Bắt đầu phiên tập trung Pomodoro cho nhiệm vụ này"
    >
      <PlayIcon className="w-3.5 h-3.5 fill-amber-300 text-amber-300 shrink-0" />
      <span>Bắt đầu phiên Pomodoro</span>
      {typeof selectedCard.pomodoros === "number" && selectedCard.pomodoros > 0 && (
        <span className="text-[10px] text-amber-300/80 font-mono bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20 ml-1">
          Đã hoàn thành {selectedCard.pomodoros} phiên
        </span>
      )}
    </button>
  );

  // Vùng nhập mô tả chi tiết tự động co giãn
  const descriptionSection = (
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
        className="w-full p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/[0.1] focus:border-white/25 text-xs sm:text-sm text-slate-200 placeholder-white/30 focus:outline-none resize-none overflow-hidden transition-[background-color,border-color] font-normal leading-relaxed"
      />
    </div>
  );

  // Danh sách công việc con (Checklist)
  const checklistSection = (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-xs font-bold text-slate-300">
        <span className="flex items-center gap-1.5">
          <CheckSquareIcon className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-300">
            Danh sách công việc con
          </span>
        </span>
        {totalCheck > 0 && (
          <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-white/10 text-slate-200 border border-white/15 flex items-center gap-1">
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
        <div className="space-y-1.5 sm:max-h-52 sm:overflow-y-auto pr-1 custom-study-scroll">
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
                    <CheckCircleIcon className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />
                  ) : (
                    <CircleIcon className="w-4 h-4 text-white/40 group-hover:text-emerald-300 transition-colors" />
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
                    <PencilLineIcon className="w-3.5 h-3.5 text-slate-500 group-hover/text:text-slate-300 opacity-0 group-hover/text:opacity-100 shrink-0 ml-1.5 transition-opacity" />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleDeleteChecklistItem(selectedCard.id, item.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 transition-opacity cursor-pointer shrink-0"
                  title="Xóa mục"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Thêm việc con nhanh */}
      <div className="flex items-center gap-2 p-1 pl-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] focus-within:border-white/25 focus-within:bg-white/[0.05] transition-all">
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
          className="flex-1 py-1.5 bg-transparent border-0 text-xs text-white placeholder-white/30 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => {
            if (newChecklistText.trim()) {
              handleAddChecklistItem(selectedCard.id, newChecklistText);
              setNewChecklistText("");
            }
          }}
          className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white text-white hover:text-black text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          <span>Thêm</span>
        </button>
      </div>
    </div>
  );

  // Khi được nhúng trực tiếp vào MobileSheetShell (như Sheet Ghi chú)
  if (embedded) {
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden text-white">
        {/* Controls: Property Chips & Pomodoro CTA */}
        <div className="px-3.5 sm:px-6 pt-2 pb-2.5 space-y-2.5 border-b border-white/[0.08] shrink-0 bg-white/[0.01]">
          {propertyChipsBar}
          {pomodoroButton}
        </div>

        {/* Scrollable Content: Description & Sub-tasks */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pt-3 pb-6 space-y-4 custom-study-scroll">
          {descriptionSection}
          {checklistSection}
        </div>
      </div>
    );
  }

  return (
    <ModalShell
      isOpen={Boolean(selectedCard)}
      onClose={handleRequestClose}
      panelKey={`card-details-modal-${selectedCard.id}`}
      ariaLabel={selectedCard.title || "Chi tiết nhiệm vụ"}
      backdropClassName="sm:hidden"
      panelClassName="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative pointer-events-auto w-full sm:max-w-[660px] h-[68dvh] max-h-[72dvh] sm:h-auto sm:max-h-[88vh] mx-3 sm:mx-0 mb-[calc(var(--mobile-nav-height)+var(--app-safe-bottom)+var(--mobile-nav-safe-gap)+0.75rem)] sm:mb-0 flex flex-col rounded-[28px] sm:rounded-3xl surface-frost border shadow-[0_10px_24px_rgba(0,0,0,0.65),inset_0_1px_1.5px_rgba(255,255,255,0.2)] text-white overflow-hidden transform-gpu will-change-transform"
      >
        {/* Mép kính bắt sáng trên đỉnh tấm kính */}
        <div
          aria-hidden="true"
          className="absolute inset-x-12 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none z-10"
        />

        {/* Header: Title, Board Info & Action Bar */}
        <div className="px-3.5 sm:px-6 py-2.5 sm:pt-5 border-b border-white/[0.12] space-y-2.5 bg-white/[0.01]">
          <div className="flex items-center justify-between gap-2.5 sm:gap-3">
            {/* Nút Quay lại cho Mobile / Stack Navigation */}
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                title={backLabel ? `Quay lại ${backLabel}` : "Quay lại"}
                aria-label={backLabel ? `Quay lại ${backLabel}` : "Quay lại"}
                className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.18] active:scale-90 border border-white/15 flex items-center justify-center text-white/90 hover:text-white transition-all shrink-0 select-none shadow-sm cursor-pointer -ml-0.5"
              >
                <CaretLeftIcon className="w-4 h-4" weight="bold" />
              </button>
            )}

            {/* Task Title with intuitive inline editing affordance (Icon bám sát đuôi chữ) */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div
                onClick={() => titleInputRef.current?.focus()}
                className="group/title relative inline-flex items-center gap-1.5 max-w-full -ml-1.5 px-1.5 py-0.5 rounded-xl border border-transparent hover:border-white/15 hover:bg-white/[0.04] focus-within:border-white/25 focus-within:bg-white/[0.06] transition-all cursor-text leading-none"
                title="Nhấp để chỉnh sửa tiêu đề nhiệm vụ"
              >
                <div className="relative inline-flex items-center max-w-[320px] sm:max-w-[420px] min-w-[24px]">
                  {/* Thẻ đệm đo chính xác từng pixel chiều rộng của chữ */}
                  <span
                    aria-hidden="true"
                    className="invisible text-lg sm:text-xl font-bold tracking-tight whitespace-pre select-none pointer-events-none px-0.5 truncate max-w-full leading-snug"
                  >
                    {selectedCard.title || "Tiêu đề nhiệm vụ..."}
                  </span>
                  {/* Input phủ tuyệt đối 100% khớp chuẩn theo kích thước thẻ đệm */}
                  <input
                    ref={titleInputRef}
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
                    className="absolute inset-0 w-full h-full text-lg sm:text-xl font-bold bg-transparent border-0 focus:ring-0 focus:outline-none placeholder-white/25 text-white tracking-tight cursor-text px-0.5 leading-snug"
                    placeholder="Tiêu đề nhiệm vụ..."
                  />
                </div>
                <div
                  className="shrink-0 flex items-center text-slate-500 group-hover/title:text-amber-400 group-focus-within/title:text-sky-400 transition-colors pointer-events-none"
                  title="Chỉnh sửa nhanh"
                >
                  <PencilLineIcon className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* Quick Actions (Delete & Close) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => promptDeleteCard(selectedCard)}
                className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-rose-500/20 active:scale-90 border border-white/15 hover:border-rose-500/30 flex items-center justify-center text-slate-300 hover:text-rose-400 transition-all shadow-sm cursor-pointer"
                title="Xóa thẻ này"
                aria-label="Xóa thẻ này"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCard(null);
                  closeAllPopovers();
                }}
                className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.18] active:scale-90 border border-white/15 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-sm cursor-pointer"
                title="Đóng (Esc)"
                aria-label="Đóng chi tiết nhiệm vụ"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {propertyChipsBar}
          {pomodoroButton}
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 pt-4 pb-6 space-y-5 custom-study-scroll">
          {descriptionSection}
          {checklistSection}
        </div>

        {/* Footer Bar: Trạng thái đồng bộ mây đồng nhất với các thẻ khác */}
        <div className="shrink-0 px-3.5 sm:px-6 py-2 sm:py-2.5 border-t border-white/[0.12] bg-white/[0.02] flex items-center justify-between text-xs select-none">
          <div className="flex items-center gap-2 text-[11px] text-slate-400 truncate">
            <span className="font-medium text-slate-300 truncate">{currentBoard.title}</span>
          </div>
          <SyncStatusBadge variant="text" className="text-[11px] font-medium" />
        </div>
      </motion.div>
    </ModalShell>
  );
});
