"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Keyboard, Music2, CheckSquare, X } from "lucide-react";
import { IconBtn } from "../ui/IconBtn";

export interface StudyShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTour?: () => void;
}

/** Modal tra cuu phim tat. */
export const StudyShortcutsModal = ({
  isOpen,
  onClose,
  onOpenTour,
}: StudyShortcutsModalProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  // Mở lên tự vào bảng, Tab xoay vòng bên trong, tắt đi trả về chỗ cũ
  useEffect(() => {
    if (!isOpen) return;
    prevFocusRef.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => panelRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = panelRef.current;
      if (!root) return;
      const list = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);
      if (list.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey, true);
      prevFocusRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  return (
  <AnimatePresence>
    {isOpen && (
    <motion.div
      key="study-shortcuts-modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
      onClick={() => onClose()}
      aria-hidden="true"
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Bảng phím tắt"
        tabIndex={-1}
        initial={{ scale: 0.95, y: 15 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 15 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl rounded-3xl bg-black/40 hover:bg-black/45 backdrop-blur-2xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-6 space-y-5 text-white overflow-hidden focus:outline-none"
      >
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none z-10" />
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Phím Tắt Không Gian Học Tập</h3>
              <p className="text-xs text-slate-400">Điều khiển toàn bộ âm nhạc và công cụ nhanh chóng bằng bàn phím</p>
            </div>
          </div>
                <IconBtn
                  onClick={onClose}
                  title="Đóng (Esc)"
                  icon={<X className="w-5 h-5" />}
                  className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                />
        </div>

        {/* Shortcuts Groups Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Music Group */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
            <h4 className="font-bold text-emerald-400 text-xs flex items-center gap-1.5 uppercase tracking-wider">
              <Music2 className="w-3.5 h-3.5" />
              <span>Điều Khiển Âm Nhạc</span>
            </h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Phát / Tạm dừng</span>
                <kbd className="px-2 py-1 rounded-lg bg-black/50 border border-white/20 font-mono text-[11px] font-bold text-slate-200">Space</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Bài tiếp theo</span>
                <kbd className="px-2 py-1 rounded-lg bg-black/50 border border-white/20 font-mono text-[11px] font-bold text-slate-200">→</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Bài trước đó</span>
                <kbd className="px-2 py-1 rounded-lg bg-black/50 border border-white/20 font-mono text-[11px] font-bold text-slate-200">←</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Tăng / Giảm âm lượng</span>
                <div className="flex gap-1">
                  <kbd className="px-1.5 py-1 rounded-lg bg-black/50 border border-white/20 font-mono text-[11px] font-bold text-slate-200">↑</kbd>
                  <kbd className="px-1.5 py-1 rounded-lg bg-black/50 border border-white/20 font-mono text-[11px] font-bold text-slate-200">↓</kbd>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Bật / Tắt tiếng (Mute)</span>
                <kbd className="px-2 py-1 rounded-lg bg-black/50 border border-white/20 font-mono text-[11px] font-bold text-slate-200">M</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Xáo trộn (Shuffle)</span>
                <kbd className="px-2 py-1 rounded-lg bg-black/50 border border-white/20 font-mono text-[11px] font-bold text-slate-200">S</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Lặp lại (Loop)</span>
                <kbd className="px-2 py-1 rounded-lg bg-black/50 border border-white/20 font-mono text-[11px] font-bold text-slate-200">L</kbd>
              </div>
            </div>
          </div>

          {/* Workspace & Tools Group */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
            <h4 className="font-bold text-sky-400 text-xs flex items-center gap-1.5 uppercase tracking-wider">
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Công Cụ & Không Gian</span>
            </h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Bộ trộn âm thanh (Mixer)</span>
                <kbd className="px-2 py-1 rounded-lg bg-black/50 border border-white/20 font-mono text-[11px] font-bold text-slate-200">P</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Bật/Tắt Toàn màn hình</span>
                <kbd className="px-2 py-1 rounded-lg bg-black/50 border border-white/20 font-mono text-[11px] font-bold text-slate-200">F</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Chế độ Zen (Ẩn/Hiện UI)</span>
                <kbd className="px-2 py-1 rounded-lg bg-black/50 border border-white/20 font-mono text-[11px] font-bold text-slate-200">Z</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Đồng hồ Pomodoro</span>
                <kbd className="px-2 py-1 rounded-lg bg-black/50 border border-white/20 font-mono text-[11px] font-bold text-slate-200">T</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Kế hoạch học tập</span>
                <kbd className="px-2 py-1 rounded-lg bg-black/50 border border-white/20 font-mono text-[11px] font-bold text-slate-200">K</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Ghi chép nhanh (Notes)</span>
                <kbd className="px-2 py-1 rounded-lg bg-black/50 border border-white/20 font-mono text-[11px] font-bold text-slate-200">N</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Đổi không gian hình nền</span>
                <kbd className="px-2 py-1 rounded-lg bg-black/50 border border-white/20 font-mono text-[11px] font-bold text-slate-200">B</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Đài phát (YouTube/Spotify)</span>
                <kbd className="px-2 py-1 rounded-lg bg-black/50 border border-white/20 font-mono text-[11px] font-bold text-slate-200">E</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Phòng học nhóm</span>
                <kbd className="px-2 py-1 rounded-lg bg-black/50 border border-white/20 font-mono text-[11px] font-bold text-slate-200">G</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Mở nhanh lệnh</span>
                <kbd className="px-2 py-1 rounded-lg bg-black/50 border border-white/20 font-mono text-[11px] font-bold text-slate-200">⌘K</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Bảng phím tắt này</span>
                <kbd className="px-2 py-1 rounded-lg bg-black/50 border border-white/20 font-mono text-[11px] font-bold text-slate-200">?</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Đóng mọi cửa sổ</span>
                <kbd className="px-2 py-1 rounded-lg bg-black/50 border border-white/20 font-mono text-[11px] font-bold text-slate-200">Esc</kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Tip footer & Tour re-trigger */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 pt-2 border-t border-white/10">
          <span>💡 <span className="text-slate-300">Mẹo:</span> Phím tắt sẽ tạm ngưng khi bạn nhập nội dung.</span>
          {onOpenTour && (
            <button
              onClick={() => {
                onClose();
                onOpenTour();
              }}
              className="text-accent-music-glow hover:underline cursor-pointer flex items-center gap-1 font-medium shrink-0"
              title="Xem lại tour hướng dẫn sử dụng"
            >
              <span>🧭 Xem lại tour hướng dẫn</span>
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
  );
};
