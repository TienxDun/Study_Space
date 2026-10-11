"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, CornerDownLeft } from "lucide-react";

export interface CommandAction {
  id: string;
  group: string;
  label: string;
  hint?: string;
  run: () => void;
}

interface StudyCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  actions: CommandAction[];
}

const MAX_VISIBLE = 8;

/** Lọc action theo query (không dấu hoa/thường, khớp label/nhóm/hint). */
export function filterCommandActions(
  actions: CommandAction[],
  query: string
): CommandAction[] {
  const q = query.trim().toLowerCase();
  if (!q) return actions;
  return actions.filter((a) =>
    `${a.label} ${a.group} ${a.hint ?? ""}`.toLowerCase().includes(q)
  );
}

/** Palette mở nhanh Cmd+K (pattern command-menu 21st.dev, tự triển khai). */
export function StudyCommandPalette({
  isOpen,
  onClose,
  actions,
}: StudyCommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelected(0);
    }
  }, [isOpen]);

  const filtered = useMemo(
    () => filterCommandActions(actions, query).slice(0, 60),
    [actions, query]
  );
  const visible = filtered.slice(0, MAX_VISIBLE);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((prev) => (prev + 1) % Math.max(1, visible.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((prev) =>
          (prev - 1 + Math.max(1, visible.length)) % Math.max(1, visible.length)
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        const action = visible[selected];
        if (action) {
          action.run();
          onClose();
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, visible, selected, onClose]);

  if (!isOpen) return null;

  let lastGroup = "";
  return (
    <div
      className="fixed inset-0 z-[99990] flex items-start justify-center p-4 pt-[18vh]"
      role="dialog"
      aria-label="Mở nhanh"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-2xl bg-[#0b0f17]/95 backdrop-blur-2xl border border-white/15 shadow-[0_30px_80px_rgba(0,0,0,0.8)] overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 border-b border-white/10">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Gõ để mở nhanh: cảnh, đài, công cụ..."
            className="w-full py-3.5 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded-md bg-white/10 text-[10px] font-mono text-slate-300 border border-white/10 shrink-0">
            ESC
          </kbd>
        </div>

        <div className="max-h-[320px] overflow-y-auto custom-study-scroll p-2">
          {visible.length === 0 && (
            <p className="px-3 py-8 text-center text-xs text-slate-400">
              Không tìm thấy lệnh nào cho “{query}”
            </p>
          )}
          {visible.map((action) => {
            const showGroup = action.group !== lastGroup;
            lastGroup = action.group;
            const idx = visible.indexOf(action);
            const isActive = idx === selected;
            return (
              <div key={action.id}>
                {showGroup && (
                  <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {action.group}
                  </p>
                )}
                <button
                  type="button"
                  onMouseMove={() => setSelected(idx)}
                  onClick={() => {
                    action.run();
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? "bg-emerald-500/20 text-white"
                      : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <span className="truncate">{action.label}</span>
                  {action.hint && (
                    <kbd className="px-1.5 py-0.5 rounded-md bg-white/10 text-[10px] font-mono text-slate-400 border border-white/10 shrink-0">
                      {action.hint}
                    </kbd>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 px-4 py-2.5 border-t border-white/10 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <kbd className="px-1 rounded bg-white/10 border border-white/10 font-mono">↑↓</kbd> chọn
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="w-3 h-3" /> chạy
          </span>
          <span className="ml-auto">{filtered.length} kết quả</span>
        </div>
      </div>
    </div>
  );
}
