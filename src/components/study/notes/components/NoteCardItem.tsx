"use client";

import React from "react";
import { Pin, Trash2, Clock } from "lucide-react";
import { StudyNote, CATEGORY_COLORS } from "../types";
import { getNoteExcerpt } from "../utils/note-markdown";

interface NoteCardItemProps {
  note: StudyNote;
  isActive: boolean;
  isLight: boolean;
  onSelect: () => void;
  onTogglePin: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

export const NoteCardItem = React.memo(function NoteCardItem({
  note,
  isActive,
  isLight,
  onSelect,
  onTogglePin,
  onDelete,
}: NoteCardItemProps) {
  const preview = getNoteExcerpt(note.content, 65);
  const noteDate = new Date(note.updatedAt);
  const timeStr = `${noteDate.getHours().toString().padStart(2, "0")}:${noteDate
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
  const dateStr = `${timeStr} ${noteDate.getDate()}/${noteDate.getMonth() + 1}`;
  const catStyle = CATEGORY_COLORS[note.category] || {
    dot: "bg-slate-400",
    bgDark: "bg-white/10",
    textDark: "text-slate-300",
    borderDark: "border-white/10",
    bgLight: "bg-slate-100",
    textLight: "text-slate-700",
    borderLight: "border-slate-300",
  };

  return (
    <div
      onClick={onSelect}
      className={`group relative p-3 rounded-2xl transition-all cursor-pointer border text-left ${
        isActive
          ? isLight
            ? "bg-white border-emerald-500/70 shadow-xs ring-1 ring-emerald-500/20"
            : "bg-white/[0.08] border-emerald-400/50 shadow-md ring-1 ring-emerald-400/25"
          : isLight
          ? "bg-white/70 hover:bg-white border-slate-200/70 hover:border-slate-300/90"
          : "bg-white/[0.02] hover:bg-white/[0.05] border-white/5 hover:border-white/10"
      }`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {note.isPinned && <Pin className="w-3 h-3 text-amber-500 shrink-0 fill-current" />}
          <h4
            className={`text-xs font-semibold leading-snug line-clamp-1 tracking-tight ${
              isActive
                ? isLight
                  ? "text-emerald-800 font-bold"
                  : "text-emerald-300 font-bold"
                : isLight
                ? "text-slate-800 group-hover:text-slate-950"
                : "text-slate-200 group-hover:text-white"
            }`}
          >
            {note.title || "Ghi chú không tên"}
          </h4>
        </div>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onTogglePin}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              isLight ? "hover:bg-slate-200 text-slate-400" : "hover:bg-white/10 text-slate-400"
            }`}
            title={note.isPinned ? "Bỏ ghim" : "Ghim lên đầu"}
          >
            <Pin className={`w-3 h-3 ${note.isPinned ? "text-amber-500 fill-current" : ""}`} />
          </button>
          <button
            onClick={onDelete}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              isLight ? "hover:bg-rose-100 text-rose-500" : "hover:bg-rose-500/20 text-rose-400"
            }`}
            title="Xóa ghi chú"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <p
        className={`text-[11px] line-clamp-2 mt-1 font-normal leading-relaxed ${
          isLight ? "text-slate-600" : "text-slate-400"
        }`}
      >
        {preview}
      </p>

      <div className="flex items-center justify-between mt-2.5 pt-1.5 border-t border-slate-100 dark:border-white/5 text-[10px]">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-bold border ${
            isLight
              ? `${catStyle.bgLight} ${catStyle.textLight} ${catStyle.borderLight}`
              : `${catStyle.bgDark} ${catStyle.textDark} ${catStyle.borderDark}`
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${catStyle.dot}`} />
          <span>{note.category}</span>
        </span>

        <span className="font-mono text-[9.5px] flex items-center gap-1 text-slate-500 dark:text-slate-400">
          <Clock className="w-2.5 h-2.5" />
          {dateStr}
        </span>
      </div>
    </div>
  );
});
