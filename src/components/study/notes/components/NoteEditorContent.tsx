"use client";

import React from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  Pin,
  Moon,
  Sun,
  MoreHorizontal,
  Copy,
  Check,
  FileDown,
  Download,
  Sparkles,
  Trash2,
  Minimize2,
  X,
  FileText,
  Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { StudyNote, ActiveFormats, NOTE_CATEGORIES, CATEGORY_COLORS } from "../types";
import { NoteEditorToolbar } from "./NoteEditorToolbar";

interface NoteEditorContentProps {
  activeNote: StudyNote | null;
  isLight: boolean;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  lastSavedTime: string;
  categoryMenuRef: React.RefObject<HTMLDivElement | null>;
  showCategoryMenu: boolean;
  setShowCategoryMenu: (show: boolean) => void;
  handleUpdateCategory: (cat: string) => void;
  handleTogglePin: (id: string) => void;
  toggleTheme: () => void;
  moreMenuRef: React.RefObject<HTMLDivElement | null>;
  showMoreMenu: boolean;
  setShowMoreMenu: (show: boolean) => void;
  handleCopy: () => void;
  isCopied: boolean;
  handleDownloadMd: () => void;
  handleDownloadTxt: () => void;
  handleResetDefaultNotes: () => void;
  promptDeleteNote: (note: StudyNote) => void;
  toggleCompactMode: (compact: boolean) => void;
  onClose: () => void;
  activeFormats: ActiveFormats;
  toggleHeading: () => void;
  insertChecklist: () => void;
  execFormat: (command: string, value?: string) => void;
  toggleHighlight: () => void;
  toggleQuote: () => void;
  insertCodeSnippet: () => void;
  handleClearFormat: () => void;
  handleUpdateTitle: (title: string) => void;
  editorRef: React.RefObject<HTMLDivElement | null>;
  handleEditorInput: () => void;
  handleEditorClick: (e: React.MouseEvent) => void;
  handleEditorKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  handleSelectionOrFormatChange: () => void;
  wordCount: number;
  handleCreateNote: () => void;
}

export const NoteEditorContent = React.memo(function NoteEditorContent({
  activeNote,
  isLight,
  isSidebarOpen,
  setIsSidebarOpen,
  lastSavedTime,
  categoryMenuRef,
  showCategoryMenu,
  setShowCategoryMenu,
  handleUpdateCategory,
  handleTogglePin,
  toggleTheme,
  moreMenuRef,
  showMoreMenu,
  setShowMoreMenu,
  handleCopy,
  isCopied,
  handleDownloadMd,
  handleDownloadTxt,
  handleResetDefaultNotes,
  promptDeleteNote,
  toggleCompactMode,
  onClose,
  activeFormats,
  toggleHeading,
  insertChecklist,
  execFormat,
  toggleHighlight,
  toggleQuote,
  insertCodeSnippet,
  handleClearFormat,
  handleUpdateTitle,
  editorRef,
  handleEditorInput,
  handleEditorClick,
  handleEditorKeyDown,
  handleSelectionOrFormatChange,
  wordCount,
  handleCreateNote,
}: NoteEditorContentProps) {
  if (!activeNote) {
    return (
      <div
        className={`flex-1 flex flex-col items-center justify-center p-6 text-center select-none ${
          isLight ? "text-slate-400" : "text-slate-500"
        }`}
      >
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3.5 border ${
            isLight
              ? "bg-slate-100 border-slate-200 text-slate-400"
              : "bg-white/5 border-white/10 text-slate-500"
          }`}
        >
          <FileText className="w-7 h-7 stroke-[1.5]" />
        </div>
        <h3 className={`text-sm font-bold mb-1 ${isLight ? "text-slate-700" : "text-slate-300"}`}>
          Chưa có ghi chú nào
        </h3>
        <p className="text-xs max-w-xs mb-4 leading-relaxed">
          Hãy bấm nút bên dưới để tạo bản ghi chú mới và bắt đầu ghi chép.
        </p>
        <button
          onClick={handleCreateNote}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer ${
            isLight
              ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/25"
              : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_16px_rgba(16,185,129,0.35)]"
          }`}
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Tạo ghi chú mới</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      {/* Top Minimalist Header */}
      <div
        className={`h-12 px-4 border-b flex items-center justify-between gap-2 shrink-0 select-none transition-colors duration-200 ${
          isLight ? "border-slate-200/80 bg-white/70" : "border-white/10 bg-white/[0.015]"
        }`}
      >
        {/* Left: Sidebar Toggle + Category Badge + Pinned + Auto-save indicator */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-1.5 rounded-xl border transition-colors cursor-pointer active:scale-95 ${
              isLight
                ? "bg-slate-100 hover:bg-slate-200/80 border-slate-200 text-slate-600"
                : "bg-white/[0.04] hover:bg-white/10 border-white/10 text-slate-300"
            }`}
            title={isSidebarOpen ? "Thu gọn thanh bên" : "Mở rộng thanh bên"}
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="w-3.5 h-3.5" />
            ) : (
              <PanelLeftOpen className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Category Selector Popover */}
          <div className="relative" ref={categoryMenuRef}>
            <button
              onClick={() => setShowCategoryMenu(!showCategoryMenu)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isLight
                  ? "bg-slate-100 hover:bg-slate-200/80 border-slate-200 text-slate-700"
                  : "bg-white/[0.04] hover:bg-white/10 border-white/10 text-slate-300"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  CATEGORY_COLORS[activeNote.category]?.dot || "bg-emerald-500"
                }`}
              />
              <span>{activeNote.category}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            <AnimatePresence>
              {showCategoryMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 4 }}
                  transition={{ duration: 0.12 }}
                  className={`absolute left-0 top-full mt-1.5 w-36 p-1 rounded-xl border shadow-xl z-30 ${
                    isLight
                      ? "bg-white border-slate-200 text-slate-800 shadow-slate-300/40"
                      : "bg-[#181a20] border-white/15 text-white shadow-black/80"
                  }`}
                >
                  {NOTE_CATEGORIES.filter((c) => c !== "Tất cả").map((cat) => {
                    const style = CATEGORY_COLORS[cat];
                    return (
                      <button
                        key={cat}
                        onClick={() => handleUpdateCategory(cat)}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer ${
                          activeNote.category === cat
                            ? isLight
                              ? "bg-slate-100 font-bold text-slate-900"
                              : "bg-white/10 font-bold text-white"
                            : isLight
                            ? "hover:bg-slate-50 text-slate-600"
                            : "hover:bg-white/5 text-slate-300"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${style?.dot || "bg-emerald-500"}`} />
                        <span>{cat}</span>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Pin Toggle */}
          <button
            onClick={() => handleTogglePin(activeNote.id)}
            className={`p-1.5 rounded-xl border transition-all cursor-pointer active:scale-95 ${
              activeNote.isPinned
                ? isLight
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-600 shadow-2xs"
                  : "bg-amber-400/15 border-amber-400/30 text-amber-400"
                : isLight
                ? "bg-slate-100 hover:bg-slate-200/80 border-slate-200 text-slate-500 hover:text-slate-800"
                : "bg-white/[0.04] hover:bg-white/10 border-white/10 text-slate-400 hover:text-white"
            }`}
            title={activeNote.isPinned ? "Bỏ ghim" : "Ghim ghi chú lên đầu"}
          >
            <Pin className={`w-3.5 h-3.5 ${activeNote.isPinned ? "fill-current" : ""}`} />
          </button>

          {/* Auto-save status */}
          <span
            className={`hidden sm:flex items-center gap-1.5 text-[11px] font-medium ml-1.5 ${
              isLight ? "text-slate-500" : "text-slate-400"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Đã lưu {lastSavedTime}</span>
          </span>
        </div>

        {/* Right: Theme Toggle + More Actions Dropdown + Close */}
        <div className="flex items-center gap-1.5">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`p-1.5 rounded-xl border transition-all active:scale-95 cursor-pointer ${
              isLight
                ? "bg-slate-100 hover:bg-slate-200/80 border-slate-200 text-amber-600"
                : "bg-white/[0.04] hover:bg-white/10 border-white/10 text-amber-300"
            }`}
            title={isLight ? "Chuyển sang Giao diện Tối" : "Chuyển sang Giao diện Sáng"}
          >
            {isLight ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>

          {/* More Actions Dropdown */}
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className={`p-1.5 rounded-xl border transition-all active:scale-95 cursor-pointer ${
                isLight
                  ? "bg-slate-100 hover:bg-slate-200/80 border-slate-200 text-slate-700"
                  : "bg-white/[0.04] hover:bg-white/10 border-white/10 text-slate-300"
              }`}
              title="Thao tác khác"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            <AnimatePresence>
              {showMoreMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 4 }}
                  transition={{ duration: 0.12 }}
                  className={`absolute right-0 top-full mt-1.5 w-48 p-1.5 rounded-xl border shadow-xl z-30 ${
                    isLight
                      ? "bg-white border-slate-200 text-slate-800 shadow-slate-300/40"
                      : "bg-[#181a20] border-white/15 text-white shadow-black/80"
                  }`}
                >
                  <button
                    onClick={handleCopy}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer ${
                      isLight ? "hover:bg-slate-100 text-slate-700" : "hover:bg-white/10 text-slate-200"
                    }`}
                  >
                    {isCopied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{isCopied ? "Đã sao chép!" : "Sao chép toàn bộ"}</span>
                  </button>

                  <button
                    onClick={handleDownloadMd}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer ${
                      isLight ? "hover:bg-slate-100 text-slate-700" : "hover:bg-white/10 text-slate-200"
                    }`}
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Tải Markdown (.md)</span>
                  </button>

                  <button
                    onClick={handleDownloadTxt}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer ${
                      isLight ? "hover:bg-slate-100 text-slate-700" : "hover:bg-white/10 text-slate-200"
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải văn bản (.txt)</span>
                  </button>

                  <button
                    onClick={handleResetDefaultNotes}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer ${
                      isLight
                        ? "hover:bg-amber-50 text-amber-700"
                        : "hover:bg-amber-500/20 text-amber-300"
                    }`}
                    title="Tải lại 4 bản ghi chú mẫu chuyên nghiệp"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Ghi chú mẫu (Mặc định)</span>
                  </button>

                  <div className={`h-[1px] my-1 ${isLight ? "bg-slate-100" : "bg-white/10"}`} />

                  <button
                    onClick={() => promptDeleteNote(activeNote)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-left text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/20 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa ghi chú</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Minimize to Compact Sticky Note */}
          <button
            onClick={() => toggleCompactMode(true)}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              isLight
                ? "hover:bg-slate-200 text-slate-500 hover:text-slate-900"
                : "hover:bg-white/10 text-slate-400 hover:text-white"
            }`}
            title="Thu nhỏ thành Cửa sổ nổi (Sticky Note)"
          >
            <Minimize2 className="w-4 h-4" />
          </button>

          <div className={`w-[1px] h-4 mx-0.5 ${isLight ? "bg-slate-200" : "bg-white/10"}`} />

          <button
            onClick={onClose}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              isLight
                ? "hover:bg-slate-200 text-slate-500 hover:text-slate-900"
                : "hover:bg-white/10 text-slate-400 hover:text-white"
            }`}
            title="Đóng (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Slim Quick Format Bar */}
      <NoteEditorToolbar
        isLight={isLight}
        activeFormats={activeFormats}
        toggleHeading={toggleHeading}
        insertChecklist={insertChecklist}
        execFormat={execFormat}
        toggleHighlight={toggleHighlight}
        toggleQuote={toggleQuote}
        insertCodeSnippet={insertCodeSnippet}
        handleClearFormat={handleClearFormat}
      />

      {/* DOCUMENT CANVAS WITH INLINE TITLE & PROGRESS BAR */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 overflow-y-auto custom-study-scroll px-6 sm:px-12 pt-6 pb-24">
          {/* Notion-Style Document Inline Title */}
          <div className="mb-4">
            <textarea
              rows={1}
              value={activeNote.title}
              onChange={(e) => {
                handleUpdateTitle(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  editorRef.current?.focus();
                }
              }}
              ref={(el) => {
                if (el) {
                  el.style.height = "auto";
                  el.style.height = `${el.scrollHeight}px`;
                }
              }}
              placeholder="Tiêu đề ghi chú..."
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              className={`w-full bg-transparent font-bold text-2xl sm:text-[27px] tracking-tight focus:outline-none transition-colors border-none p-0 resize-none overflow-hidden leading-snug ${
                isLight
                  ? "text-slate-900 placeholder:text-slate-300"
                  : "text-white placeholder:text-slate-600"
              }`}
            />
          </div>

          {/* ContentEditable Writing Surface */}
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
            className={`${
              isLight
                ? "study-editor-content-light text-slate-800 selection:bg-emerald-200 selection:text-slate-950"
                : "study-editor-content text-slate-100 selection:bg-emerald-500/30 selection:text-white"
            } w-full min-h-[420px] text-sm sm:text-base leading-relaxed outline-none font-sans cursor-text space-y-1`}
          />
        </div>

        {/* Word & Reading Time Counter Chip */}
        <div className="absolute right-6 bottom-4 select-none pointer-events-none">
          <div
            className={`px-3 py-1 rounded-full text-[10.5px] font-mono border backdrop-blur-md transition-all shadow-xs flex items-center gap-1.5 ${
              isLight
                ? "bg-white/90 border-slate-200/90 text-slate-600 shadow-slate-200/50"
                : "bg-[#181a20]/90 border-white/10 text-slate-300 shadow-black/40"
            }`}
          >
            <span>{wordCount} từ</span>
            <span className="opacity-30">•</span>
            <span>{Math.max(1, Math.ceil(wordCount / 200))} phút đọc</span>
          </div>
        </div>
      </div>
    </div>
  );
});
