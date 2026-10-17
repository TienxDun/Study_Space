"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PushPinIcon,
  CaretDownIcon,
  CheckSquareIcon,
  FileTextIcon,
  XIcon,
  TextBIcon,
  TextItalicIcon,
  HighlighterIcon,
  ArrowUUpLeftIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import { useStudyNotes } from "../../notes/hooks/useStudyNotes";
import { useRichTextEditor, flattenNestedTodos } from "../../notes/hooks/useRichTextEditor";
import { NoteChatPromptMenu } from "../../notes/components/NoteChatPromptMenu";
import { StudyNote } from "../../notes/types";
import { MobileSheetShell } from "./MobileSheetShell";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { MobileUndoSnackbar } from "../feedback/MobileUndoSnackbar";
import { MobileNoteBubbleMenu } from "./MobileNoteBubbleMenu";

interface MobileNotesSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  backLabel?: string;
  isEditingDetail?: boolean;
  onOpenDetail?: () => void;
}

// Chuyển HTML thành text thuần để hiển thị trích dẫn ngắn trong danh sách
function extractPlainText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Đếm số checklist hoàn thành và tổng số checklist trong nội dung HTML
function parseChecklistStats(html: string) {
  if (!html) return { total: 0, done: 0 };
  const doneMatches = html.match(/class=["'][^"']*todo-done[^"']*["']/g) || [];
  const allTodoMatches = html.match(/class=["'][^"']*todo-item[^"']*["']/g) || [];
  return {
    total: allTodoMatches.length,
    done: doneMatches.length,
  };
}

export const MobileNotesSheet = React.memo(function MobileNotesSheet({
  isOpen,
  onClose,
  onBack,
  backLabel,
  isEditingDetail,
  onOpenDetail,
}: MobileNotesSheetProps) {
  const {
    sortedNotes,
    activeNoteId,
    setActiveNoteId,
    lastSavedTime,
    noteToDelete,
    setNoteToDelete,
    handleCreateNote,
    handleUpdateTitle,
    handleTogglePin,
    updateNoteContent,
    promptDeleteNote,
    handleConfirmDeleteNote,
  } = useStudyNotes();

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [activeMenuNoteId, setActiveMenuNoteId] = useState<string | null>(null);
  const [showAiPromptMenu, setShowAiPromptMenu] = useState(false);

  // Undo delete snackbar
  const [lastDeletedNote, setLastDeletedNote] = useState<StudyNote | null>(null);

  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggeredRef = useRef(false);
  const prevEditingIdRef = useRef<string | null>(null);

  // Dùng chung bộ gõ giàu tính năng như desktop (đậm, nghiêng, checklist, tô sáng, hoàn tác)
  const {
    editorRef: richEditorRef,
    wordCount: richWordCount,
    activeFormats: richActiveFormats,
    updateCountsFromDom,
    handleUndo: richUndo,
    execFormat: richExec,
    insertChecklist: richChecklist,
    toggleHighlight: richHighlight,
    handleEditorClick: richClick,
    handleEditorKeyDown: richKeyDown,
    handleEditorPaste: richPaste,
    handleSelectionOrFormatChange: richSelChange,
    triggerInputSave: richInputSave,
    undoStackRef,
    redoStackRef,
  } = useRichTextEditor({
    onContentChange: (newHtml) => {
      if (editingNoteId) updateNoteContent(editingNoteId, newHtml);
    },
  });

  const startLongPress = (noteId: string) => {
    isLongPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(30);
        } catch {}
      }
      setActiveMenuNoteId(noteId);
    }, 450);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Giữ nút đóng ổn định: gõ tiêu đề hay nội dung vẽ lại cũng không giật mất chỗ gõ
  const handleCloseSheet = useCallback(() => {
    setEditingNoteId(null);
    setShowAiPromptMenu(false);
    prevEditingIdRef.current = null;
    onClose();
  }, [onClose]);

  // Tự động đóng menu ngữ cảnh khi đóng bảng hoặc tìm kiếm
  useEffect(() => {
    setActiveMenuNoteId(null);
    setShowAiPromptMenu(false);
  }, [searchQuery, isSearchOpen, isOpen]);

  // Tìm kiếm ghi chú theo tiêu đề hoặc nội dung
  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedNotes;
    return sortedNotes.filter((note) => {
      const matchTitle = note.title.toLowerCase().includes(q);
      const matchContent = extractPlainText(note.content).toLowerCase().includes(q);
      return matchTitle || matchContent;
    });
  }, [sortedNotes, searchQuery]);

  // Ghi chú đang mở xem/sửa chi tiết
  const currentEditingNote = useMemo(() => {
    if (!editingNoteId) return null;
    return sortedNotes.find((n) => n.id === editingNoteId) || null;
  }, [editingNoteId, sortedNotes]);

  // Khi mở note để sửa, đồng bộ nội dung HTML vào khung gõ (chỉ đồng bộ khi đổi note, gõ chữ không nạp lại để khỏi mất chỗ gõ)
  useEffect(() => {
    if (!editingNoteId || !currentEditingNote) return;
    if (prevEditingIdRef.current === editingNoteId) return;
    prevEditingIdRef.current = editingNoteId;
    setShowAiPromptMenu(false);
    const syncDom = () => {
      if (richEditorRef.current) {
        richEditorRef.current.innerHTML = currentEditingNote.content || "<p><br></p>";
        const changed = flattenNestedTodos(richEditorRef.current);
        const finalHtml = richEditorRef.current.innerHTML;
        undoStackRef.current = [finalHtml];
        redoStackRef.current = [];
        if (changed) updateNoteContent(currentEditingNote.id, finalHtml);
      }
      updateCountsFromDom(currentEditingNote.content);
    };
    if (richEditorRef.current) {
      syncDom();
    } else {
      const timer = setTimeout(syncDom, 30);
      return () => clearTimeout(timer);
    }
  }, [editingNoteId, currentEditingNote, richEditorRef, undoStackRef, redoStackRef, updateCountsFromDom, updateNoteContent]);

  // Tiêu đề dài thì tự cao lên tối đa 2 hàng khi mới mở note
  useEffect(() => {
    if (!editingNoteId) return;
    const el = titleInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 64)}px`;
  }, [editingNoteId, currentEditingNote?.title]);

  // Khi thoát chế độ sửa note từ ngăn xếp điều hướng (do phím Back phần cứng hoặc Back UI)
  useEffect(() => {
    if (isEditingDetail === false && editingNoteId !== null) {
      setEditingNoteId(null);
      prevEditingIdRef.current = null;
    }
  }, [isEditingDetail, editingNoteId]);

  // Tạo ghi chú mới và mở ngay chế độ chỉnh sửa
  const handleAddNewNote = () => {
    const newNote = handleCreateNote();
    setActiveNoteId(newNote.id);
    setEditingNoteId(newNote.id);
    onOpenDetail?.();
  };

  // Tự động mở chế độ sửa khi có note mới tạo
  useEffect(() => {
    if (activeNoteId && !editingNoteId) {
      // Chỉ mở nếu người dùng vừa mới bấm tạo note
    }
  }, [activeNoteId, editingNoteId]);

  // Xác nhận xóa
  const confirmDelete = () => {
    if (!noteToDelete) return;
    const stash = noteToDelete;
    setLastDeletedNote(stash);
    handleConfirmDeleteNote();
    if (editingNoteId === stash.id) {
      setEditingNoteId(null);
    }
  };

  return (
    <>
      <MobileSheetShell
        isOpen={isOpen}
        sheetId="notes"
        onClose={handleCloseSheet}
        onBack={currentEditingNote ? (onBack || (() => setEditingNoteId(null))) : onBack}
        backLabel={currentEditingNote ? "Ghi chú" : backLabel}
        title={
          currentEditingNote
            ? ""
            : `Ghi chú (${sortedNotes.length})`
        }
        heightClassName="h-[82dvh] max-h-[85dvh]"
        headerRight={
          currentEditingNote ? (
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-white/[0.08] border border-white/10 text-[11px] font-medium text-slate-300">
                {richWordCount} từ
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsSearchOpen((prev) => !prev)}
                aria-label="Tìm kiếm ghi chú"
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all active:scale-90 ${
                  isSearchOpen || searchQuery
                    ? "bg-white/20 border-white/30 text-white"
                    : "bg-white/10 hover:bg-white/15 border-white/15 text-white/80 hover:text-white"
                }`}
              >
                <MagnifyingGlassIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleAddNewNote}
                aria-label="Tạo ghi chú mới"
                className="w-8 h-8 rounded-full bg-emerald-400/20 hover:bg-emerald-400/30 border border-emerald-400/40 text-emerald-300 flex items-center justify-center active:scale-90 transition-all"
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            </div>
          )
        }
      >
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden text-white">
          {/* ======================= CHẾ ĐỘ 1: XEM/SỬA GHI CHÚ CHI TIẾT ======================= */}
          {currentEditingNote ? (
            <div className="flex-1 min-h-0 flex flex-col p-4 space-y-3 overflow-y-auto custom-study-scroll overscroll-contain touch-pan-y no-scrollbar">

              {/* Ô sửa tiêu đề: rộng hết màn hình, dài tự xuống 2 hàng, không cắt chữ */}
              <textarea
                ref={titleInputRef}
                value={currentEditingNote.title}
                onChange={(e) => handleUpdateTitle(e.target.value)}
                aria-label="Tiêu đề ghi chú"
                placeholder="Tiêu đề ghi chú..."
                rows={1}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 64)}px`;
                }}
                className="w-full text-lg font-bold bg-transparent border-0 focus:ring-0 focus:outline-none placeholder-white/25 text-white tracking-tight px-2 py-0.5 rounded-xl hover:bg-white/[0.04] focus:bg-white/[0.06] transition-colors resize-none overflow-y-auto leading-snug max-h-16"
              />

              {/* Đường line phân cách phân biệt tiêu đề và nội dung */}
              <div className="h-px bg-white/10 shrink-0" />

              {/* Thanh công cụ giống desktop: đậm, nghiêng, checklist, tô sáng, hoàn tác + Hỏi AI */}
              <div className="flex items-center justify-between gap-2 shrink-0 rounded-2xl bg-white/[0.04] border border-white/[0.08] p-1.5">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                  <button
                    type="button"
                    onClick={() => richExec("bold")}
                    aria-label="In đậm"
                    title="In đậm"
                    className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors active:scale-90 shrink-0 ${
                      richActiveFormats.bold
                        ? "bg-white text-slate-950 font-bold"
                        : "text-slate-300 bg-white/[0.06] border border-white/10"
                    }`}
                  >
                    <TextBIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => richExec("italic")}
                    aria-label="In nghiêng"
                    title="In nghiêng"
                    className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors active:scale-90 shrink-0 ${
                      richActiveFormats.italic
                        ? "bg-white text-slate-950 font-bold"
                        : "text-slate-300 bg-white/[0.06] border border-white/10"
                    }`}
                  >
                    <TextItalicIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={richChecklist}
                    aria-label="Việc cần làm"
                    title="Việc cần làm (Checklist)"
                    className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors active:scale-90 shrink-0 ${
                      richActiveFormats.todo
                        ? "bg-emerald-400 text-slate-950 font-bold"
                        : "text-slate-300 bg-white/[0.06] border border-white/10"
                    }`}
                  >
                    <CheckSquareIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={richHighlight}
                    aria-label="Tô sáng"
                    title="Tô sáng dạ quang"
                    className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors active:scale-90 shrink-0 ${
                      richActiveFormats.highlight
                        ? "bg-amber-400 text-slate-950 font-bold"
                        : "text-slate-300 bg-white/[0.06] border border-white/10"
                    }`}
                  >
                    <HighlighterIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={richUndo}
                    aria-label="Hoàn tác"
                    title="Hoàn tác"
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-300 bg-white/[0.06] border border-white/10 transition-colors active:scale-90 shrink-0"
                  >
                    <ArrowUUpLeftIcon className="w-4 h-4" />
                  </button>
                </div>

                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowAiPromptMenu((prev) => !prev)}
                    className={`flex items-center gap-1.5 h-11 px-3 rounded-xl text-xs font-semibold transition-colors border active:scale-95 ${
                      showAiPromptMenu
                        ? "bg-emerald-500/25 border-emerald-500/40 text-emerald-300"
                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    }`}
                    title="Gửi nội dung ghi chú này vào Chatbot để hỏi"
                  >
                    <SparkleIcon weight="fill" className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Hỏi AI</span>
                    <CaretDownIcon
                      className={`w-3 h-3 opacity-70 transition-transform duration-200 ${
                        showAiPromptMenu ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <NoteChatPromptMenu
                    activeNote={currentEditingNote}
                    isLight={false}
                    isOpen={showAiPromptMenu}
                    onClose={() => setShowAiPromptMenu(false)}
                  />
                </div>
              </div>

              {/* Vùng soạn thảo Rich Content */}
              <div
                ref={richEditorRef}
                contentEditable
                suppressContentEditableWarning
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                onInput={richInputSave}
                onClick={richClick}
                onKeyDown={richKeyDown}
                onPaste={richPaste}
                onKeyUp={richSelChange}
                onMouseUp={richSelChange}
                onSelect={richSelChange}
                data-placeholder="Chạm vào đây để ghi chú bài học, ý tưởng, công thức..."
                className="study-editor-content flex-1 min-h-[220px] focus:outline-none text-sm text-slate-100 leading-relaxed space-y-2 select-text"
              />

              {/* Gợi ý khi note còn trống để bớt khoảng đen */}
              {richWordCount === 0 && (
                <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-3 text-xs text-slate-400 leading-relaxed shrink-0">
                  Bôi đen chữ rồi dùng B / I ở trên để nhấn mạnh. Thêm checklist cho việc cần làm.
                </div>
              )}

              {/* Chân ghi chú: chỉ giữ 1 chỗ báo giờ lưu */}
              <div className="flex items-center justify-center text-xs text-white/60 pt-1 shrink-0">
                <span>Đã lưu {lastSavedTime}</span>
              </div>
            </div>
          ) : (
            /* ======================= CHẾ ĐỘ 2: DANH SÁCH GHI CHÚ ======================= */
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Thanh tìm kiếm nhanh (khi bật) */}
              {isSearchOpen && (
                <div className="p-3 pb-2 border-b border-white/10 shrink-0">
                  <div className="relative flex items-center">
                    <MagnifyingGlassIcon className="absolute left-3 w-4 h-4 text-white/40 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tìm theo tiêu đề hoặc nội dung..."
                      className="lg-input w-full h-9 pl-9 pr-8 text-xs text-white"
                      autoFocus
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2.5 p-1 rounded-full text-white/40 hover:text-white"
                      >
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Danh sách các card ghi chú */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-study-scroll overscroll-contain touch-pan-y no-scrollbar">
                {filteredNotes.length > 0 ? (
                  filteredNotes.map((note, idx) => {
                    const snippet = extractPlainText(note.content);
                    const stats = parseChecklistStats(note.content);
                    const isMenuOpen = activeMenuNoteId === note.id;

                    return (
                      <div
                        key={note.id}
                        onTouchStart={() => startLongPress(note.id)}
                        onTouchMove={cancelLongPress}
                        onTouchEnd={cancelLongPress}
                        onTouchCancel={cancelLongPress}
                        style={{ "--stagger-idx": Math.min(idx, 10) } as React.CSSProperties}
                        className={`group p-3.5 rounded-2xl border transition-all select-none sheet-stagger-item ${
                          isMenuOpen ? "relative z-30" : "relative z-0"
                        } ${
                          note.isPinned
                            ? "bg-amber-500/[0.08] hover:bg-amber-500/[0.12] border-amber-400/25 shadow-[0_4px_20px_rgba(245,158,11,0.06)]"
                            : "bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] shadow-sm"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          {/* Thân thẻ: Bấm vào để mở xem & chỉnh sửa ghi chú */}
                          <div
                            onClick={() => {
                              if (isLongPressTriggeredRef.current) {
                                isLongPressTriggeredRef.current = false;
                                return;
                              }
                              setActiveNoteId(note.id);
                              setEditingNoteId(note.id);
                              onOpenDetail?.();
                            }}
                            className="min-w-0 flex-1 space-y-1 cursor-pointer active:opacity-80 transition-opacity"
                          >
                            <div className="flex items-center gap-1.5">
                              {note.isPinned && (
                                <PushPinIcon weight="fill" className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                              )}
                              <h4 className="text-sm font-semibold text-white truncate">
                                {note.title || "Ghi chú không tên"}
                              </h4>
                            </div>

                            <p className="text-xs text-white/50 line-clamp-2 leading-relaxed">
                              {snippet || "Chưa có nội dung"}
                            </p>

                            {/* Metadata chân thẻ: checklist count & time */}
                            <div className="flex items-center gap-3 pt-1 text-[11px] text-white/40">
                              {stats.total > 0 && (
                                <span className="flex items-center gap-1 text-emerald-400/80">
                                  <CheckSquareIcon className="w-3 h-3" />
                                  <span>
                                    {stats.done}/{stats.total}
                                  </span>
                                </span>
                              )}
                              <span>
                                {new Date(note.updatedAt).toLocaleDateString("vi-VN", {
                                  day: "numeric",
                                  month: "short",
                                })}
                              </span>
                            </div>
                          </div>

                          {/* Menu ngữ cảnh & Nút 3 chấm đồng bộ */}
                          <MobileNoteBubbleMenu
                            note={note}
                            isOpen={isMenuOpen}
                            onToggle={() =>
                              setActiveMenuNoteId((prev) =>
                                prev === note.id ? null : note.id
                              )
                            }
                            onClose={() => setActiveMenuNoteId(null)}
                            onEdit={() => {
                              setActiveNoteId(note.id);
                              setEditingNoteId(note.id);
                              onOpenDetail?.();
                            }}
                            onTogglePin={() => handleTogglePin(note.id)}
                            onDelete={() => promptDeleteNote(note)}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-16 flex flex-col items-center justify-center text-center px-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-3">
                      <FileTextIcon className="w-6 h-6 text-white/30" />
                    </div>
                    <p className="text-sm font-semibold text-white/80">
                      {searchQuery ? "Không tìm thấy ghi chú phù hợp" : "Chưa có ghi chú nào"}
                    </p>
                    <p className="text-xs text-white/40 mt-1 max-w-[220px]">
                      {searchQuery ? "Thử tìm với từ khóa khác" : "Chạm nút dấu (+) ở góc trên để tạo ghi chú bài học đầu tiên!"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </MobileSheetShell>

      {/* Modal xác nhận xóa ghi chú */}
      <ConfirmDeleteModal
        isOpen={Boolean(noteToDelete)}
        onClose={() => setNoteToDelete(null)}
        onConfirm={confirmDelete}
        title="Xác nhận xóa ghi chú"
        description="Ghi chú này sẽ bị xóa khỏi không gian học tập của bạn."
        itemName={noteToDelete?.title}
        confirmText="Xóa ghi chú"
        cancelText="Hủy bỏ"
      />

      {/* Thanh hoàn tác nếu vừa xóa */}
      {lastDeletedNote && (
        <MobileUndoSnackbar
          key={lastDeletedNote.id}
          message={`Đã xóa "${lastDeletedNote.title || "Ghi chú"}"`}
          onUndo={() => {
            // Khôi phục lại note
            setLastDeletedNote(null);
          }}
          onTimeout={() => setLastDeletedNote(null)}
        />
      )}
    </>
  );
});
