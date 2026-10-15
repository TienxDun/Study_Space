"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PushPinIcon,
  TrashIcon,
  CaretLeftIcon,
  CheckSquareIcon,
  FileTextIcon,
  DotsThreeVerticalIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useStudyNotes } from "../../notes/hooks/useStudyNotes";
import { StudyNote } from "../../notes/types";
import { MobileSheetShell } from "./MobileSheetShell";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { MobileUndoSnackbar } from "../feedback/MobileUndoSnackbar";

interface MobileNotesSheetProps {
  isOpen: boolean;
  onClose: () => void;
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

export function MobileNotesSheet({ isOpen, onClose }: MobileNotesSheetProps) {
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

  // Undo delete snackbar
  const [lastDeletedNote, setLastDeletedNote] = useState<StudyNote | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

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

  // Khi mở note để sửa, đồng bộ nội dung HTML vào editorRef
  useEffect(() => {
    if (editingNoteId && currentEditingNote && editorRef.current) {
      if (editorRef.current.innerHTML !== currentEditingNote.content) {
        editorRef.current.innerHTML = currentEditingNote.content || "<p><br></p>";
      }
    }
  }, [editingNoteId, currentEditingNote]);

  // Tạo ghi chú mới và mở ngay chế độ chỉnh sửa
  const handleAddNewNote = () => {
    handleCreateNote();
    // Tạo note xong activeNoteId sẽ chuyển sang note mới
  };

  // Tự động mở chế độ sửa khi có note mới tạo
  useEffect(() => {
    if (activeNoteId && !editingNoteId) {
      // Chỉ mở nếu người dùng vừa mới bấm tạo note
    }
  }, [activeNoteId, editingNoteId]);

  // Lưu nội dung từ editor
  const handleContentInput = () => {
    if (!currentEditingNote || !editorRef.current) return;
    const newHtml = editorRef.current.innerHTML;
    updateNoteContent(currentEditingNote.id, newHtml);
  };

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
        onClose={() => {
          setEditingNoteId(null);
          onClose();
        }}
        title={
          currentEditingNote
            ? "Chi tiết ghi chú"
            : `Ghi chú (${sortedNotes.length})`
        }
        heightClassName="h-[82dvh] max-h-[85dvh]"
        headerRight={
          currentEditingNote ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleTogglePin(currentEditingNote.id)}
                aria-label={currentEditingNote.isPinned ? "Bỏ ghim" : "Ghim ghi chú"}
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all active:scale-90 ${
                  currentEditingNote.isPinned
                    ? "bg-amber-400/20 border-amber-400/40 text-amber-300"
                    : "bg-white/10 hover:bg-white/15 border-white/15 text-white/70 hover:text-white"
                }`}
              >
                <PushPinIcon weight={currentEditingNote.isPinned ? "fill" : "regular"} className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => promptDeleteNote(currentEditingNote)}
                aria-label="Xóa ghi chú"
                className="w-8 h-8 rounded-full bg-rose-500/15 border border-rose-400/30 text-rose-300 flex items-center justify-center active:scale-90 transition-all hover:bg-rose-500/25"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
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
            <div className="flex-1 min-h-0 flex flex-col p-4 space-y-3 overflow-y-auto custom-study-scroll">
              {/* Thanh điều hướng quay lại danh sách */}
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingNoteId(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 active:scale-95 transition-all"
                >
                  <CaretLeftIcon className="w-4 h-4" />
                  <span>Danh sách ghi chú</span>
                </button>
                <span className="text-[11px] text-white/40">
                  Lưu lúc: {lastSavedTime}
                </span>
              </div>

              {/* Ô sửa tiêu đề */}
              <input
                ref={titleInputRef}
                type="text"
                value={currentEditingNote.title}
                onChange={(e) => handleUpdateTitle(e.target.value)}
                placeholder="Tiêu đề ghi chú..."
                className="w-full bg-transparent text-lg font-bold text-white placeholder:text-white/30 focus:outline-none border-b border-white/10 pb-2 transition-colors focus:border-emerald-400/50"
              />

              {/* Vùng soạn thảo Rich Content */}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleContentInput}
                data-placeholder="Chạm vào đây để ghi chú bài học, ý tưởng, công thức..."
                className="flex-1 min-h-[220px] focus:outline-none text-sm text-white/90 leading-relaxed space-y-2 select-text"
              />
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
                      className="w-full h-9 pl-9 pr-8 rounded-xl bg-white/[0.06] border border-white/[0.12] text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 transition-all"
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
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-study-scroll">
                {filteredNotes.length > 0 ? (
                  filteredNotes.map((note) => {
                    const snippet = extractPlainText(note.content);
                    const stats = parseChecklistStats(note.content);
                    const isMenuOpen = activeMenuNoteId === note.id;

                    return (
                      <div
                        key={note.id}
                        onClick={() => {
                          setActiveNoteId(note.id);
                          setEditingNoteId(note.id);
                        }}
                        className={`group relative p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] select-none ${
                          note.isPinned
                            ? "bg-amber-500/[0.08] hover:bg-amber-500/[0.12] border-amber-400/25 shadow-[0_4px_20px_rgba(245,158,11,0.06)]"
                            : "bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] shadow-sm"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1 space-y-1">
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

                          {/* Nút 3 chấm menu */}
                          <div
                            className="relative shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setActiveMenuNoteId((prev) =>
                                  prev === note.id ? null : note.id
                                )
                              }
                              aria-label="Tùy chọn ghi chú"
                              className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 text-white/40 hover:text-white active:scale-90 transition-all cursor-pointer"
                            >
                              <DotsThreeVerticalIcon className="w-4 h-4" />
                            </button>

                            {/* Dropdown menu */}
                            {isMenuOpen && (
                              <div className="absolute right-0 top-full mt-1 z-30 w-36 rounded-xl bg-neutral-900/95 backdrop-blur-xl border border-white/15 shadow-xl p-1 text-left space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleTogglePin(note.id);
                                    setActiveMenuNoteId(null);
                                  }}
                                  className="w-full px-2 py-1.5 rounded-lg text-xs text-white/80 hover:text-white hover:bg-white/10 text-left flex items-center gap-2"
                                >
                                  <PushPinIcon className="w-3.5 h-3.5" />
                                  <span>{note.isPinned ? "Bỏ ghim" : "Ghim lên đầu"}</span>
                                </button>
                                <div className="pt-1 border-t border-white/10">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      promptDeleteNote(note);
                                      setActiveMenuNoteId(null);
                                    }}
                                    className="w-full px-2 py-1.5 rounded-lg text-xs text-rose-300 hover:text-rose-200 hover:bg-rose-500/15 text-left flex items-center gap-2"
                                  >
                                    <TrashIcon className="w-3.5 h-3.5" />
                                    <span>Xóa ghi chú</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
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
}
