"use client";

import React from "react";
import {
  List,
  ChevronDown,
  Plus,
  Pin,
  Moon,
  Sun,
  Trash2,
  X,
  Bold,
  Italic,
  CheckSquare,
  Highlighter,
  Undo2,
} from "lucide-react";
import { motion, AnimatePresence, DragControls } from "framer-motion";
import { StudyNote, ActiveFormats } from "../types";

interface CompactStickyNoteProps {
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
  handleSelectionOrFormatChange: () => void;
}

export const CompactStickyNote = React.memo(function CompactStickyNote({
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
  handleSelectionOrFormatChange,
}: CompactStickyNoteProps) {
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
        className={`relative px-3.5 py-2 border-b flex items-center justify-between gap-2 shrink-0 select-none touch-none cursor-grab active:cursor-grabbing ${
          isLight ? "border-slate-200/60 bg-white/40" : "border-white/10 bg-white/[0.03]"
        }`}
      >
        {/* Left: Quick Note Selector Dropdown */}
        <div className="relative min-w-0" ref={quickNoteListRef}>
          <button
            onClick={() => setShowQuickNoteList(!showQuickNoteList)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
              isLight
                ? "bg-white/80 hover:bg-white border-slate-200/90 text-slate-700 shadow-2xs"
                : "bg-white/10 hover:bg-white/15 border-white/10 text-slate-200"
            }`}
            title="Đổi ghi chú hoặc tạo mới"
          >
            <List className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="font-semibold text-[11px] truncate">Danh sách ({notes.length})</span>
            <ChevronDown className="w-3 h-3 opacity-60 shrink-0 ml-0.5" />
          </button>

          <AnimatePresence>
            {showQuickNoteList && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 4 }}
                className={`absolute left-0 top-full mt-1.5 w-64 max-h-72 overflow-y-auto custom-study-scroll p-1.5 rounded-2xl border shadow-2xl z-50 ${
                  isLight
                    ? "bg-white/95 border-slate-200 text-slate-800 shadow-slate-400/40 backdrop-blur-xl"
                    : "bg-slate-900/95 border-white/20 text-white shadow-black/90 backdrop-blur-xl"
                }`}
              >
                <div className="flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Danh sách ({notes.length})</span>
                  <button
                    onClick={() => {
                      handleCreateNote();
                      setShowQuickNoteList(false);
                    }}
                    className="text-emerald-500 hover:text-emerald-400 flex items-center gap-1 cursor-pointer font-bold"
                  >
                    <Plus className="w-3 h-3 stroke-[2.5]" />
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
                      <span className="truncate flex-1 mr-2">{n.title || "Ghi chú không tên"}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTogglePin(n.id);
                        }}
                        className={`p-1 rounded-md transition-all shrink-0 cursor-pointer ${
                          n.isPinned
                            ? "text-amber-400 hover:text-amber-300"
                            : "opacity-0 group-hover:opacity-100 text-slate-400 hover:text-amber-400"
                        }`}
                        title={n.isPinned ? "Bỏ ghim khỏi đầu danh sách" : "Ghim lên đầu danh sách"}
                      >
                        <Pin className={`w-3 h-3 ${n.isPinned ? "fill-current text-amber-400" : ""}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Center: Apple-style Grab Bar */}
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            noteDragControls.start(e, { snapToCursor: false });
          }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 py-2 px-3 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none group/grab pointer-events-auto"
          title="Nhấn giữ & kéo thả để di chuyển Sticky Note"
        >
          <div
            className={`w-7 h-1 rounded-full transition-all duration-200 ${
              isLight
                ? "bg-slate-300 group-hover/grab:bg-slate-500 group-hover/grab:w-9"
                : "bg-white/20 group-hover/grab:bg-white/50 group-hover/grab:w-9"
            }`}
          />
        </div>

        {/* Right: Window Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => handleTogglePin(activeNote?.id || "")}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              activeNote?.isPinned
                ? "bg-amber-400/20 border-amber-400/40 text-amber-400"
                : isLight
                ? "hover:bg-slate-200/80 border-slate-200 text-slate-400"
                : "hover:bg-white/10 border-white/10 text-slate-400 hover:text-white"
            }`}
            title={activeNote?.isPinned ? "Bỏ ghim khỏi đầu danh sách" : "Ghim lên đầu danh sách"}
          >
            <Pin className={`w-3.5 h-3.5 ${activeNote?.isPinned ? "fill-current" : ""}`} />
          </button>

          <button
            onClick={toggleTheme}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isLight
                ? "hover:bg-slate-200/80 border-slate-200 text-amber-600"
                : "hover:bg-white/10 border-white/10 text-amber-300"
            }`}
            title={isLight ? "Giao diện tối" : "Giao diện sáng"}
          >
            {isLight ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>

          {activeNote && (
            <button
              onClick={() => onPromptDelete(activeNote)}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isLight
                  ? "hover:bg-red-50 border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200"
                  : "hover:bg-red-500/15 border-white/10 text-slate-400 hover:text-red-400 hover:border-red-500/30"
              }`}
              title="Xóa ghi chú này"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isLight
                ? "hover:bg-slate-200/80 border-slate-200 text-slate-500 hover:text-slate-900"
                : "hover:bg-white/10 border-white/10 text-slate-400 hover:text-white"
            }`}
            title="Đóng ghi chú"
          >
            <X className="w-3.5 h-3.5" />
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
                <Bold className="w-3.5 h-3.5" />
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
              >
                <Italic className="w-3.5 h-3.5" />
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
                <CheckSquare className="w-3.5 h-3.5" />
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
                <Highlighter className="w-3.5 h-3.5" />
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
                <Undo2 className="w-3.5 h-3.5" />
              </button>
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
            className={`px-3 py-1.5 border-t flex items-center justify-between text-[10px] select-none shrink-0 ${
              isLight
                ? "border-slate-200/60 bg-white/40 text-slate-500"
                : "border-white/10 bg-white/[0.02] text-slate-400"
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              <span className="px-2 py-0.5 rounded-md bg-black/10 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center gap-1 font-mono">
                <span>{wordCount} từ</span>
              </span>
              {checklistStats.total > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                  {checklistStats.completed}/{checklistStats.total} việc
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-[10px] opacity-75">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Đã lưu {lastSavedTime}</span>
              </div>

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
