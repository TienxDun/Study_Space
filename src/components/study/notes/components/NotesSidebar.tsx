"use client";

import React from "react";
import { Plus, Search, X, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { StudyNote, NOTE_CATEGORIES } from "../types";
import { NoteCardItem } from "./NoteCardItem";
import { handleHorizontalWheel } from "@/lib/use-horizontal-scroll";

interface NotesSidebarProps {
  isOpen: boolean;
  isLight: boolean;
  notes: StudyNote[];
  filteredNotes: StudyNote[];
  activeNoteId: string;
  searchQuery: string;
  selectedCategory: string;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onSearchChange: (val: string) => void;
  onClearSearch: () => void;
  onSelectCategory: (cat: string) => void;
  onCreateNote: () => void;
  onSelectNote: (id: string) => void;
  onTogglePin: (id: string, e: React.MouseEvent) => void;
  onPromptDelete: (note: StudyNote, e: React.MouseEvent) => void;
}

export const NotesSidebar = React.memo(function NotesSidebar({
  isOpen,
  isLight,
  notes,
  filteredNotes,
  activeNoteId,
  searchQuery,
  selectedCategory,
  searchInputRef,
  onSearchChange,
  onClearSearch,
  onSelectCategory,
  onCreateNote,
  onSelectNote,
  onTogglePin,
  onPromptDelete,
}: NotesSidebarProps) {
  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className={`flex flex-col border-r shrink-0 h-full overflow-hidden transition-colors duration-200 ${
            isLight ? "border-slate-200/80 bg-slate-50/80" : "border-white/10 bg-white/[0.02]"
          }`}
        >
          {/* Header Sidebar */}
          <div
            className={`p-3.5 px-4 border-b flex items-center justify-between gap-2 shrink-0 ${
              isLight ? "border-slate-200/80" : "border-white/10"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`font-bold text-sm tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}>
                Ghi chú
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  isLight ? "bg-slate-200 text-slate-700" : "bg-white/10 text-slate-300"
                }`}
              >
                {notes.length}
              </span>
            </div>

            <button
              onClick={onCreateNote}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl active:scale-95 text-xs font-bold transition-all cursor-pointer ${
                isLight
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs shadow-emerald-600/20"
                  : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_14px_rgba(16,185,129,0.3)]"
              }`}
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Tạo mới</span>
            </button>
          </div>

          {/* Search & Category Pills */}
          <div
            className={`p-3 border-b space-y-2 shrink-0 ${
              isLight ? "border-slate-200/80" : "border-white/10"
            }`}
          >
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-3 pointer-events-none text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Tìm ghi chú..."
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                className={`w-full pl-8.5 pr-12 py-1.5 rounded-xl border text-xs transition-all ${
                  isLight
                    ? "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                    : "bg-white/[0.04] border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400/70 focus:bg-white/[0.07]"
                }`}
              />
              <div className="absolute right-2.5 flex items-center">
                {Boolean(searchQuery) ? (
                  <button
                    onClick={onClearSearch}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-medium rounded-md bg-slate-100 text-slate-500 border border-slate-200/80 dark:bg-white/10 dark:text-slate-400 dark:border-white/10 select-none">
                    ⌘K
                  </kbd>
                )}
              </div>
            </div>

            {/* Filter Pills */}
            <div
              onWheel={handleHorizontalWheel}
              className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 pr-2"
            >
              {NOTE_CATEGORIES.map((cat, idx) => (
                <button
                  key={cat || `cat-filter-${idx}`}
                  onClick={() => onSelectCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold shrink-0 transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? isLight
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-white text-slate-950 shadow-md"
                      : isLight
                      ? "bg-slate-100 text-slate-600 hover:bg-slate-200/80 border border-slate-200/60"
                      : "bg-white/[0.04] text-slate-400 hover:bg-white/10 hover:text-white border border-white/5"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Note Items List */}
          <div className="flex-1 overflow-y-auto custom-study-scroll p-2.5 space-y-1.5">
            {filteredNotes.length === 0 ? (
              <div
                className={`py-12 text-center text-xs italic space-y-1 ${
                  isLight ? "text-slate-400" : "text-slate-500"
                }`}
              >
                <FileText className="w-6 h-6 mx-auto opacity-30" />
                <p>Không tìm thấy ghi chú nào</p>
              </div>
            ) : (
              filteredNotes.map((note) => (
                <NoteCardItem
                  key={note.id}
                  note={note}
                  isActive={note.id === activeNoteId}
                  isLight={isLight}
                  onSelect={() => onSelectNote(note.id)}
                  onTogglePin={(e) => onTogglePin(note.id, e)}
                  onDelete={(e) => onPromptDelete(note, e)}
                />
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
