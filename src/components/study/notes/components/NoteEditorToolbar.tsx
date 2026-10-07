"use client";

import React from "react";
import {
  CheckSquare,
  List,
  Bold,
  Italic,
  Highlighter,
  Quote,
  Code,
  RemoveFormatting,
} from "lucide-react";
import { ActiveFormats } from "../types";
import { handleHorizontalWheel } from "@/lib/use-horizontal-scroll";

interface NoteEditorToolbarProps {
  isLight: boolean;
  activeFormats: ActiveFormats;
  toggleHeading: () => void;
  insertChecklist: () => void;
  execFormat: (command: string, value?: string) => void;
  toggleHighlight: () => void;
  toggleQuote: () => void;
  insertCodeSnippet: () => void;
  handleClearFormat: () => void;
}

export const NoteEditorToolbar = React.memo(function NoteEditorToolbar({
  isLight,
  activeFormats,
  toggleHeading,
  insertChecklist,
  execFormat,
  toggleHighlight,
  toggleQuote,
  insertCodeSnippet,
  handleClearFormat,
}: NoteEditorToolbarProps) {
  return (
    <div
      onWheel={handleHorizontalWheel}
      className={`px-6 sm:px-10 py-1.5 border-b flex items-center gap-1 shrink-0 overflow-x-auto scrollbar-none text-xs transition-colors duration-200 ${
        isLight ? "border-slate-100 bg-slate-50/50" : "border-white/5 bg-white/[0.01]"
      }`}
    >
      {/* Block Structure Tools */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggleHeading}
        className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
          activeFormats.h1 || activeFormats.h2
            ? isLight
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-950"
            : isLight
            ? "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
            : "text-slate-400 hover:bg-white/10 hover:text-white"
        }`}
        title="Tiêu đề mục (Heading)"
      >
        <span className="font-bold text-xs tracking-wider">H</span>
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={insertChecklist}
        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
          activeFormats.todo
            ? isLight
              ? "bg-emerald-100 text-emerald-800 font-bold"
              : "bg-emerald-500/25 text-emerald-300 font-bold"
            : isLight
            ? "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
            : "text-slate-400 hover:bg-white/10 hover:text-white"
        }`}
        title="Chèn việc cần làm (Checklist)"
      >
        <CheckSquare className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => execFormat("insertUnorderedList")}
        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
          activeFormats.unorderedList
            ? isLight
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-950"
            : isLight
            ? "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
            : "text-slate-400 hover:bg-white/10 hover:text-white"
        }`}
        title="Danh sách gạch đầu dòng"
      >
        <List className="w-3.5 h-3.5" />
      </button>

      <div className={`w-[1px] h-3.5 mx-1 ${isLight ? "bg-slate-200" : "bg-white/10"}`} />

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => execFormat("bold")}
        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
          activeFormats.bold
            ? isLight
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-950"
            : isLight
            ? "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
            : "text-slate-400 hover:bg-white/10 hover:text-white"
        }`}
        title="In đậm (Ctrl+B)"
      >
        <Bold className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => execFormat("italic")}
        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
          activeFormats.italic
            ? isLight
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-950"
            : isLight
            ? "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
            : "text-slate-400 hover:bg-white/10 hover:text-white"
        }`}
        title="In nghiêng (Ctrl+I)"
      >
        <Italic className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggleHighlight}
        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
          activeFormats.highlight
            ? "bg-amber-300 text-amber-950 font-bold"
            : isLight
            ? "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
            : "text-slate-400 hover:bg-white/10 hover:text-white"
        }`}
        title="Đánh dấu nổi bật (Highlight)"
      >
        <Highlighter className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggleQuote}
        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
          activeFormats.quote
            ? isLight
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-950"
            : isLight
            ? "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
            : "text-slate-400 hover:bg-white/10 hover:text-white"
        }`}
        title="Trích dẫn (Quote)"
      >
        <Quote className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={insertCodeSnippet}
        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
          activeFormats.code
            ? isLight
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-950"
            : isLight
            ? "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
            : "text-slate-400 hover:bg-white/10 hover:text-white"
        }`}
        title="Khối mã (Code Snippet - Ctrl+Enter để thoát)"
      >
        <Code className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleClearFormat}
        className={`p-1.5 rounded-lg transition-all cursor-pointer ml-auto ${
          isLight ? "text-slate-400 hover:text-slate-700" : "text-slate-500 hover:text-white"
        }`}
        title="Xóa định dạng"
      >
        <RemoveFormatting className="w-3.5 h-3.5" />
      </button>
    </div>
  );
});
