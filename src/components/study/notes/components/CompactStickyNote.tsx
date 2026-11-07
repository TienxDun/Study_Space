"use client";

import React from "react";
import {
  ListIcon,
  CaretDownIcon,
  PlusIcon,
  PushPinIcon,
  MoonIcon,
  SunIcon,
  TrashIcon,
  XIcon,
  DotsThreeIcon,
  TextBIcon,
  TextItalicIcon,
  TextUnderlineIcon,
  TextStrikethroughIcon,
  CheckSquareIcon,
  HighlighterIcon,
  ArrowUUpLeftIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import { motion, AnimatePresence, DragControls } from "framer-motion";
import { StudyNote, ActiveFormats } from "../types";
import { NoteChatPromptMenu } from "./NoteChatPromptMenu";
import { SyncStatusBadge } from "@/components/study/sync/SyncStatusBadge";

interface CompactStickyNoteProps {
  width?: number;
  notes: StudyNote[];
  activeNote: StudyNote | null;
  isLight: boolean;
  activeFormats: ActiveFormats;
  wordCount: number;
  checklistStats: { total: number; completed: number; percent: number };
  lastSavedTime: string;
  noteDragControls: DragControls;
  editorRef: React.RefObject<HTMLDivElement | null>;
  showQuickNoteList: boolean;
  quickNoteListRef: React.RefObject<HTMLDivElement | null>;
  setShowQuickNoteList: (show: boolean) => void;
  setActiveNoteId: (id: string) => void;
  handleCreateNote: () => void;
  handleTogglePin: (id: string) => void;
  toggleTheme: () => void;
  onPromptDelete: (note: StudyNote) => void;
  onClose: () => void;
  handleResizePointerDown: (e: React.PointerEvent) => void;
  execFormat: (command: string, value?: string) => void;
  insertChecklist: () => void;
  toggleHighlight: () => void;
  handleUndo: () => void;
  handleUpdateTitle: (title: string) => void;
  handleEditorInput: () => void;
  handleEditorClick: (e: React.MouseEvent) => void;
  handleEditorKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  handleEditorPaste: (e: React.ClipboardEvent<HTMLDivElement>) => void;
  handleSelectionOrFormatChange: () => void;
  isDragging?: boolean;
}

export const CompactStickyNote = React.memo(function CompactStickyNote({
  width,
  notes,
  activeNote,
  isLight,
  activeFormats,
  wordCount,
  checklistStats,
  lastSavedTime,
  noteDragControls,
  editorRef,
  showQuickNoteList,
  quickNoteListRef,
  setShowQuickNoteList,
  setActiveNoteId,
  handleCreateNote,
  handleTogglePin,
  toggleTheme,
  onPromptDelete,
  onClose,
  handleResizePointerDown,
  execFormat,
  insertChecklist,
  toggleHighlight,
  handleUndo,
  handleUpdateTitle,
  handleEditorInput,
  handleEditorClick,
  handleEditorKeyDown,
  handleEditorPaste,
  handleSelectionOrFormatChange,
  isDragging = false,
}: CompactStickyNoteProps) {
  const [showMoreMenu, setShowMoreMenu] = React.useState(false);
  const [showAiPromptMenu, setShowAiPromptMenu] = React.useState(false);
  const moreMenuRef = React.useRef<HTMLDivElement>(null);
  const aiPromptTriggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!showMoreMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMoreMenu]);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
      {/* Top Edge Reflection */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none z-10" />

      {/* 1. Header Bar: Drag Zone */}
      <div
        onPointerDown={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest("button") || target.closest("input") || target.closest("[role='button']")) {
            return;
          }
          noteDragControls.start(e, { snapToCursor: false });
        }}
        className={`relative px-3 py-2 border-b grid grid-cols-[minmax(96px,1fr)_auto_minmax(96px,1fr)] items-center gap-2 shrink-0 select-none touch-none cursor-grab active:cursor-grabbing group/compact ${
          isLight ? "border-slate-200/60 bg-white/40" : "border-white/10 bg-white/[0.03]"
        }`}
        title="Nhấn giữ & kéo thả để di chuyển Sticky Note"
      >
        {/* Left: Quick Note Selector Dropdown & Quick Create Button */}
        <div className="flex items-center gap-1.5 min-w-0 max-w-full justify-self-start">
          <div className="relative min-w-0" ref={quickNoteListRef}>
          <button
            type="button"
            onClick={() => setShowQuickNoteList(!showQuickNoteList)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer border min-w-0 max-w-full ${
              isLight
                ? "bg-white/80 hover:bg-white border-slate-200/90 text-slate-700 shadow-2xs"
                : "bg-white/10 hover:bg-white/15 border-white/10 text-slate-200"
            }`}
            title="Xem danh sách ghi chú"
          >
            <ListIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            {(width ?? 380) >= 400 && (
              <span className="min-w-0 font-semibold truncate">Danh sách ({notes.length})</span>
            )}
            <CaretDownIcon className="w-3 h-3 opacity-60 shrink-0 ml-0.5" />
          </button>

          <AnimatePresence>
            {showQuickNoteList && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 4 }}
                className={`absolute left-0 top-full mt-1.5 w-72 max-h-72 overflow-y-auto custom-study-scroll p-1.5 rounded-2xl border z-50 ${
                  isLight
                    ? "bg-white/85 border-slate-200/90 text-slate-800 shadow-[0_16px_40px_rgba(0,0,0,0.12)] backdrop-blur-2xl"
                    : "bg-black/75 border-white/15 text-white shadow-[0_20px_50px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
                }`}
              >
                <div className="flex items-center justify-between px-2 py-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <span>Danh sách ({notes.length})</span>
                  <button
                    onClick={() => {
                      handleCreateNote();
                      setShowQuickNoteList(false);
                    }}
                    className="text-emerald-500 hover:text-emerald-400 flex items-center gap-1 cursor-pointer font-bold"
                  >
                    <PlusIcon weight="bold" className="w-3 h-3" />
                    <span>Tạo mới</span>
                  </button>
                </div>
                <div className="space-y-0.5 mt-1">
                  {notes.map((n) => (
                    <div
                      key={n.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setActiveNoteId(n.id);
                        setShowQuickNoteList(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setActiveNoteId(n.id);
                          setShowQuickNoteList(false);
                        }
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs text-left truncate transition-colors cursor-pointer group ${
                        n.id === activeNote?.id
                          ? "bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 font-bold"
                          : isLight
                          ? "hover:bg-slate-100 text-slate-700"
                          : "hover:bg-white/10 text-slate-200"
                      }`}
                    >
                      <span className="truncate flex-1 mr-1">{n.title || "Ghi chú không tên"}</span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {/* Nút Ghim */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePin(n.id);
                          }}
                          className={`p-1 rounded-md transition-all cursor-pointer ${
                            n.isPinned
                              ? "text-amber-400 hover:text-amber-300"
                              : "opacity-0 group-hover:opacity-100 text-slate-400 hover:text-amber-400"
                          }`}
                          title={n.isPinned ? "Bỏ ghim khỏi đầu danh sách" : "Ghim lên đầu danh sách"}
                        >
                          <PushPinIcon weight={n.isPinned ? "fill" : "regular"} className={`w-3 h-3 ${n.isPinned ? "text-amber-400" : ""}`} />
                        </button>

                        {/* Nút Xóa ghi chú */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowQuickNoteList(false);
                            onPromptDelete(n);
                          }}
                          className="p-1 rounded-md transition-all cursor-pointer opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                          title="Xóa ghi chú này"
                        >
                          <TrashIcon className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          </div>

          {/* Nút Tạo nhanh ghi chú mới 1-Click */}
          <button
            onClick={() => {
              handleCreateNote();
              setShowQuickNoteList(false);
            }}
            className={`w-7 h-7 rounded-xl border transition-all cursor-pointer flex items-center justify-center active:scale-90 ${
              isLight
                ? "bg-white/80 hover:bg-emerald-50 border-slate-200 text-slate-700 hover:text-emerald-600 hover:border-emerald-300 shadow-2xs"
                : "bg-white/5 hover:bg-emerald-500/20 border-white/10 text-emerald-400 hover:border-emerald-500/30"
            }`}
            title="Tạo nhanh ghi chú mới (1-Click)"
          >
            <PlusIcon weight="bold" className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: Drag Indicator - luôn hiện, căn giữa tuyệt đối nhờ 2 cột bìa đối xứng */}
        <div
          className="flex items-center justify-center h-full px-2 min-w-0 pointer-events-none select-none transition-all duration-200 justify-self-center col-start-2"
        >
          <div
            className={`h-1 rounded-full transition-all duration-200 ${
              isDragging
                ? "w-9 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]"
                : isLight
                ? "w-7 bg-slate-300 group-hover/compact:bg-slate-400 group-hover/compact:w-9"
                : "w-7 bg-white/20 group-hover/compact:bg-white/40 group-hover/compact:w-9"
            }`}
          />
        </div>

        {/* Right: Window Actions (Pinned, More Menu, Close) */}
        <div className="flex items-center gap-1.5 shrink-0 justify-self-end col-start-3">
          {/* Nút Ghim */}
          <button
            onClick={() => handleTogglePin(activeNote?.id || "")}
            className={`w-7 h-7 rounded-xl border transition-colors flex items-center justify-center cursor-pointer ${
              activeNote?.isPinned
                ? "bg-amber-400/20 border-amber-400/40 text-amber-400"
                : isLight
                ? "hover:bg-slate-200/80 border-slate-200 text-slate-400 hover:text-slate-700"
                : "hover:bg-white/10 border-white/10 text-slate-400 hover:text-white"
            }`}
            title={activeNote?.isPinned ? "Bỏ ghim khỏi đầu danh sách" : "Ghim lên đầu danh sách"}
          >
            <PushPinIcon weight={activeNote?.isPinned ? "fill" : "regular"} className="w-3.5 h-3.5" />
          </button>

          {/* Nút Tùy chọn khác ⋯ */}
          <div className="relative" ref={moreMenuRef}>
            <button
              type="button"
              onClick={() => setShowMoreMenu((prev) => !prev)}
              className={`w-7 h-7 rounded-xl border transition-colors flex items-center justify-center cursor-pointer ${
                showMoreMenu
                  ? isLight
                    ? "bg-slate-200 border-slate-300 text-slate-900"
                    : "bg-white/15 border-white/20 text-white"
                  : isLight
                  ? "hover:bg-slate-200/80 border-slate-200 text-slate-400 hover:text-slate-700"
                  : "hover:bg-white/10 border-white/10 text-slate-400 hover:text-white"
              }`}
              title="Tùy chọn khác"
            >
              <DotsThreeIcon className="w-3.5 h-3.5" />
            </button>

            <AnimatePresence>
              {showMoreMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 4 }}
                  className={`absolute right-0 top-full mt-1.5 w-44 p-1.5 rounded-2xl border z-50 ${
                    isLight
                      ? "bg-white/85 border-slate-200/90 text-slate-800 shadow-[0_16px_40px_rgba(0,0,0,0.12)] backdrop-blur-2xl"
                      : "bg-black/75 border-white/15 text-white shadow-[0_20px_50px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
                  }`}
                >
                  {/* Hỏi Trợ lý AI */}
                  {activeNote && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        setShowAiPromptMenu(true);
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                        isLight ? "hover:bg-slate-100 text-slate-700" : "hover:bg-white/10 text-slate-200"
                      }`}
                    >
                      <SparkleIcon weight="fill" className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Hỏi Trợ lý AI</span>
                    </button>
                  )}

                  {/* Đổi giao diện Sáng / Tối */}
                  <button
                    type="button"
                    onClick={() => {
                      toggleTheme();
                      setShowMoreMenu(false);
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      isLight ? "hover:bg-slate-100 text-slate-700" : "hover:bg-white/10 text-slate-200"
                    }`}
                  >
                    {isLight ? (
                      <>
                        <MoonIcon className="w-3.5 h-3.5 text-amber-500" />
                        <span>Giao diện tối</span>
                      </>
                    ) : (
                      <>
                        <SunIcon className="w-3.5 h-3.5 text-amber-300" />
                        <span>Giao diện sáng</span>
                      </>
                    )}
                  </button>

                  {/* Xóa ghi chú (Chỉ hiển thị khi có activeNote) */}
                  {activeNote && (
                    <>
                      <div className={`my-1 border-t ${isLight ? "border-slate-100" : "border-white/10"}`} />
                      <button
                        type="button"
                        onClick={() => {
                          setShowMoreMenu(false);
                          onPromptDelete(activeNote);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-500/15 transition-colors cursor-pointer"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                        <span>Xóa ghi chú này</span>
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Nút Đóng */}
          <button
            onClick={onClose}
            className={`w-7 h-7 rounded-xl border transition-colors flex items-center justify-center cursor-pointer ${
              isLight
                ? "hover:bg-rose-500/10 border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300"
                : "hover:bg-rose-500/10 border-white/10 text-slate-400 hover:text-rose-400 hover:border-rose-500/30"
            }`}
            title="Đóng ghi chú"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {activeNote ? (
        <>
          {/* 2. Compact Formatting Toolbar */}
          <div
            className={`px-3 py-1.5 border-b flex items-center justify-between gap-1 shrink-0 ${
              isLight ? "border-slate-200/60 bg-white/40" : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <div className="flex items-center gap-1">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => execFormat("bold")}
                className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  activeFormats.bold
                    ? isLight
                      ? "bg-slate-900 text-white font-bold"
                      : "bg-white text-slate-950 font-bold shadow-xs"
                    : isLight
                    ? "hover:bg-slate-200/80 text-slate-700 hover:text-slate-950"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
                title="In đậm (Ctrl+B)"
              >
                <TextBIcon className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => execFormat("italic")}
                className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  activeFormats.italic
                    ? isLight
                      ? "bg-slate-900 text-white font-bold"
                      : "bg-white text-slate-950 font-bold shadow-xs"
                    : isLight
                    ? "hover:bg-slate-200/80 text-slate-700 hover:text-slate-950"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
                title="In nghiêng (Ctrl+I)"
                aria-label="In nghiêng (Ctrl+I)"
              >
                <TextItalicIcon className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => execFormat("underline")}
                className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  activeFormats.underline
                    ? isLight
                      ? "bg-slate-900 text-white font-bold"
                      : "bg-white text-slate-950 font-bold shadow-xs"
                    : isLight
                    ? "hover:bg-slate-200/80 text-slate-700 hover:text-slate-950"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
                title="Gạch chân (Ctrl+U)"
                aria-label="Gạch chân (Ctrl+U)"
              >
                <TextUnderlineIcon className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => execFormat("strikeThrough")}
                className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  activeFormats.strikethrough
                    ? isLight
                      ? "bg-slate-900 text-white font-bold"
                      : "bg-white text-slate-950 font-bold shadow-xs"
                    : isLight
                    ? "hover:bg-slate-200/80 text-slate-700 hover:text-slate-950"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
                title="Gạch ngang"
                aria-label="Gạch ngang"
              >
                <TextStrikethroughIcon className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={insertChecklist}
                className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  activeFormats.todo
                    ? isLight
                      ? "bg-emerald-600 text-white font-bold"
                      : "bg-emerald-400 text-slate-950 font-bold shadow-xs"
                    : isLight
                    ? "hover:bg-slate-200/80 text-slate-700 hover:text-slate-950"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
                title="Việc cần làm (Checklist)"
              >
                <CheckSquareIcon className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={toggleHighlight}
                className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  activeFormats.highlight
                    ? "bg-amber-400 text-slate-950 font-bold shadow-xs"
                    : isLight
                    ? "hover:bg-slate-200/80 text-slate-700 hover:text-slate-950"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
                title="Tô sáng dạ quang"
              >
                <HighlighterIcon className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleUndo}
                className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  isLight
                    ? "hover:bg-slate-200/80 text-slate-700 hover:text-slate-950"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
                title="Hoàn tác (Ctrl+Z)"
              >
                <ArrowUUpLeftIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Nút Hỏi AI về ghi chú kèm Menu lựa chọn Prompt */}
            <div className="relative">
              <button
                ref={aiPromptTriggerRef}
                type="button"
                onClick={() => setShowAiPromptMenu((prev) => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                  showAiPromptMenu
                    ? "bg-emerald-500/25 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.3)]"
                    : isLight
                    ? "bg-emerald-50 hover:bg-emerald-100 border-emerald-200/90 text-emerald-700 shadow-2xs"
                    : "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400"
                }`}
                title="Gửi nội dung ghi chú này vào Chatbot để hỏi"
              >
                <SparkleIcon weight="fill" className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Hỏi AI</span>
                <CaretDownIcon
                  className={`w-3 h-3 opacity-70 transition-transform duration-200 ${
                    showAiPromptMenu ? "rotate-180" : ""
                  }`}
                />
              </button>

              <NoteChatPromptMenu
                activeNote={activeNote}
                isLight={isLight}
                isOpen={showAiPromptMenu}
                onClose={() => setShowAiPromptMenu(false)}
                triggerRef={aiPromptTriggerRef}
              />
            </div>
          </div>

          {/* 3. Document Surface */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-study-scroll flex flex-col">
            <div className="px-4 pt-3 pb-1 shrink-0 bg-transparent">
              <input
                type="text"
                value={activeNote.title}
                onChange={(e) => handleUpdateTitle(e.target.value)}
                placeholder="Tiêu đề ghi chú..."
                className={`w-full font-bold text-lg bg-transparent border-0 outline-none transition-colors tracking-tight ${
                  isLight
                    ? "text-slate-900 placeholder:text-slate-400"
                    : "text-white placeholder:text-slate-500"
                }`}
              />
            </div>

            <div
              className={`flex-1 px-4 pt-1 pb-4 text-xs leading-relaxed transition-colors duration-200 bg-transparent ${
                isLight ? "text-slate-800" : "text-slate-100"
              }`}
            >
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                onInput={handleEditorInput}
                onClick={handleEditorClick}
                onKeyDown={handleEditorKeyDown}
                onPaste={handleEditorPaste}
                onKeyUp={handleSelectionOrFormatChange}
                onMouseUp={handleSelectionOrFormatChange}
                onSelect={handleSelectionOrFormatChange}
                data-placeholder="Bắt đầu ghi chép nội dung..."
                className={`${
                  isLight
                    ? "study-editor-content-light text-slate-800 selection:bg-emerald-200 selection:text-slate-950"
                    : "study-editor-content text-slate-100 selection:bg-emerald-500/30 selection:text-white"
                } w-full min-h-[160px] text-xs sm:text-sm leading-relaxed outline-none font-sans cursor-text space-y-1`}
              />
            </div>
          </div>

          {/* 4. Minimal Compact Footer */}
          <div
            className={`px-3 py-1.5 border-t flex items-center justify-between text-xs select-none shrink-0 ${
              isLight
                ? "border-slate-200/60 bg-white/40 text-slate-500"
                : "border-white/10 bg-white/[0.02] text-slate-400"
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              {checklistStats.total > 0 && (
                <>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {checklistStats.completed}/{checklistStats.total} việc
                  </span>
                </>
              )}
              <span className="flex items-center gap-1 opacity-75">
                <span>{wordCount} từ</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <SyncStatusBadge
                variant="text"
                light={isLight}
                savedTime={lastSavedTime}
                className="opacity-80 text-[11px] font-medium"
              />

              {/* Resize Handle */}
              <div
                onPointerDown={handleResizePointerDown}
                className="p-1 cursor-nwse-resize opacity-40 hover:opacity-100 text-slate-400 hover:text-white transition-opacity select-none touch-none -mr-1"
                title="Nhấn giữ & kéo để thay đổi kích thước Sticky Note"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <circle cx="8" cy="8" r="1.1" />
                  <circle cx="4" cy="8" r="1.1" />
                  <circle cx="8" cy="4" r="1.1" />
                </svg>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
          <p className="text-xs mb-3">Chưa có ghi chú nào được chọn</p>
          <button
            onClick={handleCreateNote}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all"
          >
            + Tạo ghi chú
          </button>
        </div>
      )}
    </div>
  );
});
