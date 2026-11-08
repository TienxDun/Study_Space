"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { useFloatingSize } from "@/lib/use-floating-size";
import { clamp } from "@/lib/utils";
import { StudyNotesWidgetProps } from "./types";
import { useStudyNotes } from "./hooks/useStudyNotes";
import { useRichTextEditor, flattenNestedTodos } from "./hooks/useRichTextEditor";
import { CompactStickyNote } from "./components/CompactStickyNote";

const STORAGE_THEME_KEY = STORAGE_KEYS.notesTheme;
const STORAGE_COMPACT_POS_KEY = STORAGE_KEYS.notesCompactPos;
const STORAGE_COMPACT_SIZE_KEY = STORAGE_KEYS.notesCompactSize;

const NOTE_MARGIN = 16;
const DEFAULT_NOTE_W = 380;
const DEFAULT_NOTE_H = 420;

// Giữ thẻ luôn nằm trong màn hình, dùng chung cho mọi chỗ để khỏi bị lệch
const clampNotePos = (x: number, y: number, w: number, h: number) => {
  if (typeof window === "undefined") return { x: Math.round(x), y: Math.round(y) };
  const maxX = Math.max(NOTE_MARGIN, window.innerWidth - w - NOTE_MARGIN);
  const maxY = Math.max(NOTE_MARGIN, window.innerHeight - h - NOTE_MARGIN);
  return {
    x: Math.round(clamp(x, NOTE_MARGIN, maxX)),
    y: Math.round(clamp(y, NOTE_MARGIN, maxY)),
  };
};

// Lần đầu chưa có chỗ lưu thì cho ra giữa màn hình
const getCenterPos = (w: number, h: number) => {
  if (typeof window === "undefined") return { x: 100, y: 100 };
  return clampNotePos((window.innerWidth - w) / 2, (window.innerHeight - h) / 2, w, h);
};

export const StudyNotesWidget = ({
  isOpen,
  onClose,
  zIndex = 45,
  onFocus,
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
  // Cỡ khung do hook chung lo (nhớ + kẹp + kéo góc); chỗ đứng tự lo ở dưới
  const {
    size: compactSize,
    beginResize: beginNoteResize,
  } = useFloatingSize({
    minWidth: 320,
    minHeight: 240,
    defaultWidth: DEFAULT_NOTE_W,
    defaultHeight: DEFAULT_NOTE_H,
    storageKey: STORAGE_COMPACT_SIZE_KEY,
  });
  // Lần đầu: nếu có chỗ cũ thì dùng, chưa có thì cho ra giữa màn hình
  const [compactPos, setCompactPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_COMPACT_POS_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
            return clampNotePos(parsed.x, parsed.y, DEFAULT_NOTE_W, DEFAULT_NOTE_H);
          }
        }
      } catch {}
      return getCenterPos(DEFAULT_NOTE_W, DEFAULT_NOTE_H);
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


  // Load preferences from localStorage on mount (cỡ do hook đọc, đây chỉ đọc chỗ)
  useEffect(() => {
    setIsMounted(true);
    try {
      const savedTheme = localStorage.getItem(STORAGE_THEME_KEY);
      if (savedTheme === "light" || savedTheme === "dark") {
        setTheme(savedTheme);
      }
      const savedPos = localStorage.getItem(STORAGE_COMPACT_POS_KEY);
      if (savedPos) {
        const parsed = JSON.parse(savedPos);
        if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
          setCompactPos(clampNotePos(parsed.x, parsed.y, compactSize.width, compactSize.height));
        } else {
          setCompactPos(getCenterPos(compactSize.width, compactSize.height));
        }
      } else {
        // Chưa từng mở/kéo thẻ thì luôn ở giữa
        setCompactPos(getCenterPos(compactSize.width, compactSize.height));
      }
    } catch {}
  }, []);

  // Mỗi lần mở lại: lấy đúng chỗ cũ đã lưu, kéo vào trong màn hình nếu bị tràn
  useEffect(() => {
    if (isOpen) {
      try {
        const savedPos = localStorage.getItem(STORAGE_COMPACT_POS_KEY);
        if (savedPos) {
          const parsed = JSON.parse(savedPos);
          if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
            const next = clampNotePos(parsed.x, parsed.y, compactSize.width, compactSize.height);
            setCompactPos((prev) => {
              if (prev.x === next.x && prev.y === next.y) return prev;
              return next;
            });
          }
        }
      } catch {}
    }
  }, [isOpen]);

  // Khi đổi cỡ màn hình (xoay điện thoại, thu nhỏ web): tự kéo thẻ vào trong
  // (co cỡ do hook lo). Deps giữ nguyên để luôn kẹp bằng cỡ mới nhất.
  useEffect(() => {
    const handleWindowResize = () => {
      setCompactPos((prev) => clampNotePos(prev.x, prev.y, compactSize.width, compactSize.height));
    };
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, [compactSize.width, compactSize.height]);

  // Kéo góc đổi cỡ (logic gom trong hook chung, đây chỉ kẹp lại chỗ đứng)
  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    beginNoteResize(e, { x: compactPos.x, y: compactPos.y }, (latestSize) => {
      // Sau khi đổi cỡ thì kéo lại thẻ vào trong màn hình nếu bị lòi ra
      const fixedPos = clampNotePos(compactPos.x, compactPos.y, latestSize.width, latestSize.height);
      setCompactPos(fixedPos);
      try {
        localStorage.setItem(STORAGE_COMPACT_POS_KEY, JSON.stringify(fixedPos));
      } catch {}
    });
  }, [beginNoteResize, compactPos.x, compactPos.y]);

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
    handleEditorPaste,
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
            const initialHtml = activeNote.content || "";
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
            style={{ zIndex }}
            className="hidden sm:block fixed inset-0 pointer-events-none overflow-hidden"
          >
            {/* Window Container */}
            <motion.div
              ref={compactPanelRef}
              key="notes-compact-panel"
              drag
              dragControls={noteDragControls}
              dragListener={false}
              dragMomentum={false}
              dragElastic={0}
              onDragStart={() => setIsDragging(true)}
              onPointerDownCapture={onFocus}
              onDragEnd={(_, info) => {
                setIsDragging(false);
                // Chỗ mới = chỗ cũ + đoạn vừa kéo, rồi kéo vào trong màn hình
                setCompactPos((prev) => {
                  const next = clampNotePos(
                    prev.x + info.offset.x,
                    prev.y + info.offset.y,
                    compactSize.width,
                    compactSize.height
                  );
                  try {
                    localStorage.setItem(STORAGE_COMPACT_POS_KEY, JSON.stringify(next));
                  } catch {}
                  return next;
                });
              }}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{
                opacity: { duration: 0.16, ease: "easeOut" },
                scale: { duration: 0.16, ease: "easeOut" },
              }}
              style={{
                top: 0,
                left: 0,
                x: compactPos.x,
                y: compactPos.y,
                width: compactSize.width,
                height: compactSize.height,
                zIndex,
              }}
              className={`hidden sm:flex pointer-events-auto fixed min-w-[300px] min-h-[240px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-120px)] flex-col rounded-3xl backdrop-blur-2xl border overflow-hidden select-none transform-gpu will-change-transform group/compact ${
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
                isDragging={isDragging}
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
                handleEditorPaste={handleEditorPaste}
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
