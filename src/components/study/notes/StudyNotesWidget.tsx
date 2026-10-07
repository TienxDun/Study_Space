"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { StudyNotesWidgetProps } from "./types";
import { useStudyNotes } from "./hooks/useStudyNotes";
import { useRichTextEditor } from "./hooks/useRichTextEditor";
import { NotesSidebar } from "./components/NotesSidebar";
import { NoteEditorContent } from "./components/NoteEditorContent";
import { CompactStickyNote } from "./components/CompactStickyNote";
import {
  getCleanExportText,
  downloadNoteAsTxt,
  downloadNoteAsMd,
} from "./utils/note-export";

const STORAGE_THEME_KEY = STORAGE_KEYS.notesTheme;
const STORAGE_COMPACT_KEY = STORAGE_KEYS.notesCompactMode;

export const StudyNotesWidget = ({
  isOpen,
  onClose,
  onCompactModeChange,
}: StudyNotesWidgetProps) => {
  const {
    notes,
    activeNoteId,
    setActiveNoteId,
    activeNote,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    lastSavedTime,
    noteToDelete,
    setNoteToDelete,
    checklistStats,
    filteredNotes,
    handleCreateNote,
    handleResetDefaultNotes,
    handleUpdateTitle,
    handleTogglePin,
    handleUpdateCategory,
    updateNoteContent,
    promptDeleteNote,
    handleConfirmDeleteNote,
  } = useStudyNotes();

  // Theme & Compact state
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isCompactMode, setIsCompactMode] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState<boolean>(false);
  const [showMoreMenu, setShowMoreMenu] = useState<boolean>(false);
  const [showQuickNoteList, setShowQuickNoteList] = useState<boolean>(false);
  const [compactSize, setCompactSize] = useState<{ width: number; height: number }>({
    width: 380,
    height: 420,
  });

  const noteDragControls = useDragControls();
  const dragContainerRef = useRef<HTMLDivElement>(null);
  const quickNoteListRef = useRef<HTMLDivElement>(null);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const prevActiveNoteIdRef = useRef<string>("");

  const isLight = theme === "light";

  const toggleTheme = useCallback(() => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    try {
      localStorage.setItem(STORAGE_THEME_KEY, nextTheme);
    } catch {}
  }, [theme]);

  const toggleCompactMode = useCallback((compact: boolean) => {
    setIsCompactMode(compact);
    try {
      localStorage.setItem(STORAGE_COMPACT_KEY, String(compact));
    } catch {}
  }, []);

  // Inform parent page.tsx
  useEffect(() => {
    if (onCompactModeChange) {
      onCompactModeChange(isCompactMode);
    }
  }, [isCompactMode, onCompactModeChange]);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(STORAGE_THEME_KEY);
      if (savedTheme === "light" || savedTheme === "dark") {
        setTheme(savedTheme);
      }
      const savedCompact = localStorage.getItem(STORAGE_COMPACT_KEY);
      if (savedCompact === "true") {
        setIsCompactMode(true);
      }
      const savedSize = localStorage.getItem("study_space_notes_compact_size");
      if (savedSize) {
        const parsed = JSON.parse(savedSize);
        if (parsed?.width && parsed?.height) {
          const maxAllowedW = typeof window !== "undefined" ? Math.max(320, window.innerWidth - 48) : 500;
          const maxAllowedH = typeof window !== "undefined" ? Math.max(260, window.innerHeight - 130) : 550;
          setCompactSize({
            width: Math.max(300, Math.min(parsed.width, maxAllowedW)),
            height: Math.max(240, Math.min(parsed.height, maxAllowedH)),
          });
        }
      }
    } catch {}
  }, []);

  // Resize handler for Compact Sticky Note
  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = compactSize.width;
    const startH = compactSize.height;

    let latestSize = { width: startW, height: startH };

    const onPointerMove = (moveEv: PointerEvent) => {
      const maxW = typeof window !== "undefined" ? Math.max(300, window.innerWidth - 48) : 700;
      const maxH = typeof window !== "undefined" ? Math.max(240, window.innerHeight - 120) : 700;

      const nextW = Math.max(300, Math.min(maxW, startW + (moveEv.clientX - startX)));
      const nextH = Math.max(240, Math.min(maxH, startH + (moveEv.clientY - startY)));
      latestSize = { width: Math.round(nextW), height: Math.round(nextH) };
      setCompactSize(latestSize);
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      try {
        localStorage.setItem("study_space_notes_compact_size", JSON.stringify(latestSize));
      } catch {}
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(e.target as Node)) {
        setShowCategoryMenu(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
      if (quickNoteListRef.current && !quickNoteListRef.current.contains(e.target as Node)) {
        setShowQuickNoteList(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Rich text editor hook
  const {
    editorRef,
    undoStackRef,
    redoStackRef,
    wordCount,
    activeFormats,
    updateCountsFromDom,
    handleUndo,
    execFormat,
    toggleHeading,
    insertChecklist,
    insertCodeSnippet,
    toggleHighlight,
    toggleQuote,
    handleClearFormat,
    handleEditorClick,
    handleEditorKeyDown,
    handleSelectionOrFormatChange,
    triggerInputSave,
  } = useRichTextEditor({
    onContentChange: (newHtml) => {
      if (activeNote) {
        updateNoteContent(activeNote.id, newHtml);
      }
    },
  });

  // Sync editor content when switching active note or opening modal
  useEffect(() => {
    if (!isOpen) {
      prevActiveNoteIdRef.current = "";
      return;
    }

    if (activeNote) {
      const syncDom = () => {
        if (editorRef.current) {
          prevActiveNoteIdRef.current = activeNote.id;
          const initialHtml = activeNote.content || "<p><br></p>";
          editorRef.current.innerHTML = initialHtml;
          undoStackRef.current = [initialHtml];
          redoStackRef.current = [];
        }
        updateCountsFromDom(activeNote.content);
      };

      syncDom();
      const timer = setTimeout(syncDom, 25);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeNoteId, isCompactMode, activeNote, editorRef, undoStackRef, redoStackRef, updateCountsFromDom]);

  // Global Escape & Ctrl+K key listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setIsSidebarOpen(true);
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Export actions
  const handleCopy = useCallback(() => {
    if (!editorRef.current) return;
    const text = getCleanExportText(editorRef.current);
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setShowMoreMenu(false);
    setTimeout(() => setIsCopied(false), 2000);
  }, [editorRef]);

  const handleDownloadTxt = useCallback(() => {
    if (!activeNote || !editorRef.current) return;
    const rawText = getCleanExportText(editorRef.current);
    downloadNoteAsTxt(activeNote.title, rawText);
    setShowMoreMenu(false);
  }, [activeNote, editorRef]);

  const handleDownloadMd = useCallback(() => {
    if (!activeNote || !editorRef.current) return;
    const rawText = getCleanExportText(editorRef.current);
    downloadNoteAsMd(activeNote.title, rawText);
    setShowMoreMenu(false);
  }, [activeNote, editorRef]);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div
            ref={dragContainerRef}
            className={
              isCompactMode
                ? "fixed inset-0 z-50 pointer-events-none overflow-hidden"
                : "fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 pointer-events-none"
            }
          >
            {/* Backdrop: Only in Studio Mode */}
            {!isCompactMode && (
              <motion.div
                key="notes-modal-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="fixed inset-0 bg-black/40 backdrop-blur-xs pointer-events-auto cursor-pointer"
                onClick={onClose}
              />
            )}

            {/* Window Container */}
            <motion.div
              key={isCompactMode ? "notes-compact-panel" : "notes-studio-panel"}
              drag={isCompactMode}
              dragConstraints={isCompactMode ? dragContainerRef : undefined}
              dragControls={noteDragControls}
              dragListener={false}
              dragMomentum={false}
              dragElastic={0}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={() => setIsDragging(false)}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{
                opacity: { duration: 0.16, ease: "easeOut" },
                scale: { duration: 0.16, ease: "easeOut" },
              }}
              style={isCompactMode ? { width: compactSize.width, height: compactSize.height } : undefined}
              className={
                isCompactMode
                  ? `pointer-events-auto fixed bottom-24 right-6 min-w-[300px] min-h-[240px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-120px)] flex flex-col rounded-3xl backdrop-blur-2xl border overflow-hidden select-none transform-gpu will-change-transform z-50 group/compact ${
                      isDragging
                        ? "shadow-[0_30px_80px_rgba(0,0,0,0.65)] ring-2 ring-emerald-500/40 cursor-grabbing"
                        : "transition-colors duration-150"
                    } ${
                      isLight
                        ? "bg-white/80 hover:bg-white/85 border-white/60 text-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.12)] ring-1 ring-black/5"
                        : "bg-black/60 hover:bg-black/65 border-white/15 text-white shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
                    }`
                  : `relative z-10 w-[96vw] max-w-5xl h-[700px] max-h-[92vh] flex rounded-3xl backdrop-blur-2xl overflow-hidden select-none transition-colors duration-200 pointer-events-auto transform-gpu will-change-transform ${
                      isLight
                        ? "bg-[#fafafc] border border-slate-200/90 shadow-[0_25px_80px_rgba(0,0,0,0.18)] text-slate-800"
                        : "bg-black/40 hover:bg-black/45 border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-white"
                    }`
              }
            >
              {isCompactMode ? (
                <CompactStickyNote
                  notes={notes}
                  activeNote={activeNote}
                  isLight={isLight}
                  activeFormats={activeFormats}
                  wordCount={wordCount}
                  checklistStats={checklistStats}
                  lastSavedTime={lastSavedTime}
                  noteDragControls={noteDragControls}
                  editorRef={editorRef}
                  showQuickNoteList={showQuickNoteList}
                  quickNoteListRef={quickNoteListRef}
                  setShowQuickNoteList={setShowQuickNoteList}
                  setActiveNoteId={setActiveNoteId}
                  handleCreateNote={handleCreateNote}
                  handleTogglePin={(id) => handleTogglePin(id)}
                  toggleTheme={toggleTheme}
                  toggleCompactMode={toggleCompactMode}
                  onClose={onClose}
                  handleResizePointerDown={handleResizePointerDown}
                  execFormat={execFormat}
                  insertChecklist={insertChecklist}
                  toggleHighlight={toggleHighlight}
                  handleUndo={handleUndo}
                  handleClearFormat={handleClearFormat}
                  handleUpdateTitle={handleUpdateTitle}
                  handleEditorInput={triggerInputSave}
                  handleEditorClick={handleEditorClick}
                  handleEditorKeyDown={handleEditorKeyDown}
                  handleSelectionOrFormatChange={handleSelectionOrFormatChange}
                />
              ) : (
                <>
                  <NotesSidebar
                    isOpen={isSidebarOpen}
                    isLight={isLight}
                    notes={notes}
                    filteredNotes={filteredNotes}
                    activeNoteId={activeNoteId}
                    searchQuery={searchQuery}
                    selectedCategory={selectedCategory}
                    searchInputRef={searchInputRef}
                    onSearchChange={setSearchQuery}
                    onClearSearch={() => setSearchQuery("")}
                    onSelectCategory={setSelectedCategory}
                    onCreateNote={handleCreateNote}
                    onSelectNote={setActiveNoteId}
                    onTogglePin={handleTogglePin}
                    onPromptDelete={promptDeleteNote}
                  />

                  <NoteEditorContent
                    activeNote={activeNote}
                    isLight={isLight}
                    isSidebarOpen={isSidebarOpen}
                    setIsSidebarOpen={setIsSidebarOpen}
                    lastSavedTime={lastSavedTime}
                    categoryMenuRef={categoryMenuRef}
                    showCategoryMenu={showCategoryMenu}
                    setShowCategoryMenu={setShowCategoryMenu}
                    handleUpdateCategory={handleUpdateCategory}
                    handleTogglePin={(id) => handleTogglePin(id)}
                    toggleTheme={toggleTheme}
                    moreMenuRef={moreMenuRef}
                    showMoreMenu={showMoreMenu}
                    setShowMoreMenu={setShowMoreMenu}
                    handleCopy={handleCopy}
                    isCopied={isCopied}
                    handleDownloadMd={handleDownloadMd}
                    handleDownloadTxt={handleDownloadTxt}
                    handleResetDefaultNotes={handleResetDefaultNotes}
                    promptDeleteNote={promptDeleteNote}
                    toggleCompactMode={toggleCompactMode}
                    onClose={onClose}
                    activeFormats={activeFormats}
                    toggleHeading={toggleHeading}
                    insertChecklist={insertChecklist}
                    execFormat={execFormat}
                    toggleHighlight={toggleHighlight}
                    toggleQuote={toggleQuote}
                    insertCodeSnippet={insertCodeSnippet}
                    handleClearFormat={handleClearFormat}
                    handleUpdateTitle={handleUpdateTitle}
                    editorRef={editorRef}
                    handleEditorInput={triggerInputSave}
                    handleEditorClick={handleEditorClick}
                    handleEditorKeyDown={handleEditorKeyDown}
                    handleSelectionOrFormatChange={handleSelectionOrFormatChange}
                    wordCount={wordCount}
                    handleCreateNote={handleCreateNote}
                  />
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteModal
        isOpen={!!noteToDelete}
        onClose={() => setNoteToDelete(null)}
        onConfirm={handleConfirmDeleteNote}
        title="Xác nhận xóa ghi chú"
        description="Bạn có chắc chắn muốn xóa bản ghi chú này không? Thao tác này không thể hoàn tác."
        itemName={noteToDelete?.title}
        confirmText="Xóa ghi chú"
        cancelText="Hủy bỏ"
      />
    </>
  );
};
