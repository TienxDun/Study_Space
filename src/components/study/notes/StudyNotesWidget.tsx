"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { StudyNotesWidgetProps } from "./types";
import { useStudyNotes } from "./hooks/useStudyNotes";
import { useRichTextEditor, flattenNestedTodos } from "./hooks/useRichTextEditor";
import { CompactStickyNote } from "./components/CompactStickyNote";

const STORAGE_THEME_KEY = STORAGE_KEYS.notesTheme;
const STORAGE_COMPACT_POS_KEY = STORAGE_KEYS.notesCompactPos;
const STORAGE_COMPACT_SIZE_KEY = STORAGE_KEYS.notesCompactSize;

export const StudyNotesWidget = ({
  isOpen,
  onClose,
}: StudyNotesWidgetProps) => {
  const {
    sortedNotes,
    activeNoteId,
    setActiveNoteId,
    activeNote,
    lastSavedTime,
    noteToDelete,
    setNoteToDelete,
    checklistStats,
    handleCreateNote,
    handleUpdateTitle,
    handleTogglePin,
    updateNoteContent,
    promptDeleteNote,
    handleConfirmDeleteNote,
  } = useStudyNotes();

  // Theme state
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [isMounted, setIsMounted] = useState(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showQuickNoteList, setShowQuickNoteList] = useState<boolean>(false);
  const [compactSize, setCompactSize] = useState<{ width: number; height: number }>({
    width: 380,
    height: 420,
  });
  const [compactPos, setCompactPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_COMPACT_POS_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
            const clampedX = Math.max(16, Math.min(window.innerWidth - 320, parsed.x));
            const clampedY = Math.max(16, Math.min(window.innerHeight - 240, parsed.y));
            return { x: clampedX, y: clampedY };
          }
        }
      } catch {}
      return {
        x: Math.max(16, window.innerWidth - 380 - 24),
        y: Math.max(16, window.innerHeight - 420 - 96),
      };
    }
    return { x: 100, y: 100 };
  });

  const compactPanelRef = useRef<HTMLDivElement>(null);
  const noteDragControls = useDragControls();
  const dragContainerRef = useRef<HTMLDivElement>(null);
  const quickNoteListRef = useRef<HTMLDivElement>(null);
  const prevActiveNoteIdRef = useRef<string>("");

  const isLight = theme === "light";

  const toggleTheme = useCallback(() => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    try {
      localStorage.setItem(STORAGE_THEME_KEY, nextTheme);
    } catch {}
  }, [theme]);


  // Load preferences from localStorage on mount
  useEffect(() => {
    setIsMounted(true);
    try {
      const savedTheme = localStorage.getItem(STORAGE_THEME_KEY);
      if (savedTheme === "light" || savedTheme === "dark") {
        setTheme(savedTheme);
      }
      const savedSize = localStorage.getItem(STORAGE_COMPACT_SIZE_KEY);
      if (savedSize) {
        const parsed = JSON.parse(savedSize);
        if (parsed?.width && parsed?.height) {
          const maxAllowedW = typeof window !== "undefined" ? Math.max(320, window.innerWidth - 48) : 500;
          const maxAllowedH = typeof window !== "undefined" ? Math.max(260, window.innerHeight - 130) : 550;
          const nextW = Math.max(320, Math.min(parsed.width, maxAllowedW));
          const nextH = Math.max(240, Math.min(parsed.height, maxAllowedH));
          setCompactSize({
            width: nextW,
            height: nextH,
          });
        }
      }
      const savedPos = localStorage.getItem(STORAGE_COMPACT_POS_KEY);
      if (savedPos) {
        const parsed = JSON.parse(savedPos);
        if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
          const clampedX = Math.max(16, Math.min(window.innerWidth - 300, parsed.x));
          const clampedY = Math.max(16, Math.min(window.innerHeight - 240, parsed.y));
          setCompactPos({ x: clampedX, y: clampedY });
        }
      }
    } catch {}
  }, []);

  // Update position on mount/re-open if stored
  useEffect(() => {
    if (isOpen) {
      try {
        const savedPos = localStorage.getItem(STORAGE_COMPACT_POS_KEY);
        if (savedPos) {
          const parsed = JSON.parse(savedPos);
          if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
          const clampedX = Math.max(16, Math.min(window.innerWidth - 320, parsed.x));
            const clampedY = Math.max(16, Math.min(window.innerHeight - 240, parsed.y));
            setCompactPos((prev) => {
              if (prev.x === clampedX && prev.y === clampedY) return prev;
              return { x: clampedX, y: clampedY };
            });
          }
        }
      } catch {}
    }
  }, [isOpen]);

  // Resize handler for Compact Sticky Note with requestAnimationFrame
  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = compactSize.width;
    const startH = compactSize.height;

    // Đo tọa độ hiển thị góc trên-trái thực tế của card trên viewport
    const cardEl = compactPanelRef.current;
    const rect = cardEl?.getBoundingClientRect();
    const cardScreenLeft = rect ? rect.left : compactPos.x;
    const cardScreenTop = rect ? rect.top : compactPos.y;

    let latestSize = { width: startW, height: startH };
    let rafId: number | null = null;

    const onPointerMove = (moveEv: PointerEvent) => {
      const maxW = typeof window !== "undefined" ? Math.max(320, window.innerWidth - cardScreenLeft - 16) : 700;
      const maxH = typeof window !== "undefined" ? Math.max(240, window.innerHeight - cardScreenTop - 16) : 700;

      const nextW = Math.round(Math.max(320, Math.min(maxW, startW + (moveEv.clientX - startX))));
      const nextH = Math.round(Math.max(240, Math.min(maxH, startH + (moveEv.clientY - startY))));
      latestSize = { width: nextW, height: nextH };

      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          setCompactSize(latestSize);
          rafId = null;
        });
      }
    };

    const onPointerUp = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setCompactSize(latestSize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      try {
        localStorage.setItem(STORAGE_COMPACT_SIZE_KEY, JSON.stringify(latestSize));
        localStorage.setItem(
          STORAGE_COMPACT_POS_KEY,
          JSON.stringify({ x: Math.round(cardScreenLeft), y: Math.round(cardScreenTop) })
        );
      } catch {}
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }, [compactSize.width, compactSize.height, compactPos.x, compactPos.y]);

  // Close quick note list on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
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
    insertChecklist,
    toggleHighlight,
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
      const isNoteChanged = prevActiveNoteIdRef.current !== activeNote.id;

      if (isNoteChanged) {
        prevActiveNoteIdRef.current = activeNote.id;

        const syncDom = () => {
          if (editorRef.current) {
            const initialHtml = activeNote.content || "<p><br></p>";
            editorRef.current.innerHTML = initialHtml;
            const changed = flattenNestedTodos(editorRef.current);
            const finalHtml = editorRef.current.innerHTML;
            undoStackRef.current = [finalHtml];
            redoStackRef.current = [];
            if (changed) {
              updateNoteContent(activeNote.id, finalHtml);
            }
          }
          updateCountsFromDom(activeNote.content);
        };

        if (editorRef.current) {
          syncDom();
        } else {
          const timer = setTimeout(syncDom, 25);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [isOpen, activeNoteId, activeNote, editorRef, undoStackRef, redoStackRef, updateCountsFromDom, updateNoteContent]);

  // Global Escape key listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const widgetContent = (
    <>
      <AnimatePresence>
        {isOpen && (
          <div
            ref={dragContainerRef}
            className="fixed inset-0 z-[60] pointer-events-none overflow-hidden"
          >
            {/* Window Container */}
            <motion.div
              ref={compactPanelRef}
              key="notes-compact-panel"
              drag
              dragConstraints={dragContainerRef}
              dragControls={noteDragControls}
              dragListener={false}
              dragMomentum={false}
              dragElastic={0}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={() => {
                setIsDragging(false);
                const cardEl = compactPanelRef.current;
                if (cardEl && typeof window !== "undefined") {
                  const rect = cardEl.getBoundingClientRect();
                  const clampedX = Math.round(
                    Math.max(16, Math.min(window.innerWidth - compactSize.width - 16, rect.left))
                  );
                  const clampedY = Math.round(
                    Math.max(16, Math.min(window.innerHeight - compactSize.height - 16, rect.top))
                  );
                  try {
                    localStorage.setItem(
                      STORAGE_COMPACT_POS_KEY,
                      JSON.stringify({ x: clampedX, y: clampedY })
                    );
                  } catch {}
                }
              }}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{
                opacity: { duration: 0.16, ease: "easeOut" },
                scale: { duration: 0.16, ease: "easeOut" },
              }}
              style={{
                top: compactPos.y,
                left: compactPos.x,
                width: compactSize.width,
                height: compactSize.height,
              }}
              className={`pointer-events-auto fixed min-w-[300px] min-h-[240px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-120px)] flex flex-col rounded-3xl backdrop-blur-2xl border overflow-hidden select-none transform-gpu will-change-transform z-[60] group/compact ${
                isDragging
                  ? "shadow-[0_30px_80px_rgba(0,0,0,0.65)] ring-2 ring-emerald-500/40 cursor-grabbing"
                  : "transition-colors duration-150"
              } ${
                isLight
                  ? "bg-white/80 hover:bg-white/85 border-white/60 text-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.12)] ring-1 ring-black/5"
                  : "bg-black/60 hover:bg-black/65 border-white/15 text-white shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
              }`}
            >
              <CompactStickyNote
                width={compactSize.width}
                notes={sortedNotes}
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
                onPromptDelete={promptDeleteNote}
                onClose={onClose}
                handleResizePointerDown={handleResizePointerDown}
                execFormat={execFormat}
                insertChecklist={insertChecklist}
                toggleHighlight={toggleHighlight}
                handleUndo={handleUndo}
                handleUpdateTitle={handleUpdateTitle}
                handleEditorInput={triggerInputSave}
                handleEditorClick={handleEditorClick}
                handleEditorKeyDown={handleEditorKeyDown}
                handleSelectionOrFormatChange={handleSelectionOrFormatChange}
              />
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

  return isMounted ? createPortal(widgetContent, document.body) : widgetContent;
};
