"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChartBarIcon,
  ChatCircleDotsIcon,
  CornersInIcon,
  CornersOutIcon,
  DotsThreeIcon,
  InfoIcon,
  KeyboardIcon,
} from "@phosphor-icons/react";

export interface TopBarMoreMenuProps {
  isFullscreen: boolean;
  onToggleStats: () => void;
  onToggleShortcuts: () => void;
  onToggleFullscreen: () => void;
  onOpenAbout: () => void;
  onOpenFeedback?: () => void;
}

const itemClass =
  "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-[7px] text-left text-xs font-medium text-slate-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30";

const kbdClass =
  "ml-auto rounded-md border border-line/10 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-300";

/** Menu gom mọi lối vào "đọc một lần" (thống kê, phím tắt, góp ý, giới thiệu,
 *  toàn màn hình) để thanh chính chỉ còn các nút có trạng thái trong phiên. */
export const TopBarMoreMenu = ({
  isFullscreen,
  onToggleStats,
  onToggleShortcuts,
  onToggleFullscreen,
  onOpenAbout,
  onOpenFeedback,
}: TopBarMoreMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const runAndClose = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
          isOpen
            ? "bg-white/20 text-white backdrop-blur-md shadow-[0_0_14px_rgba(255,255,255,0.3)] font-bold"
            : "text-slate-200 hover:text-white glass-hover drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
        }`}
        title="Thông tin & trợ giúp"
        aria-label="Mở menu thông tin và trợ giúp"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <DotsThreeIcon className="w-5 h-5" weight="bold" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            role="menu"
            aria-label="Thông tin và trợ giúp"
            className="absolute right-0 top-full mt-2 z-50 w-60 glass-panel p-1.5 text-left text-white select-none"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => runAndClose(onToggleStats)}
              className={itemClass}
              aria-label="Thống kê thời gian tập trung"
            >
              <ChartBarIcon className="w-4 h-4 text-slate-400" />
              <span>Thống kê tập trung</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => runAndClose(onToggleShortcuts)}
              className={itemClass}
              aria-label="Bảng tra cứu phím tắt"
            >
              <KeyboardIcon className="w-4 h-4 text-slate-400" />
              <span>Bảng phím tắt</span>
              <kbd className={kbdClass}>?</kbd>
            </button>

            {onOpenFeedback && (
              <button
                type="button"
                role="menuitem"
                onClick={() => runAndClose(onOpenFeedback)}
                className={itemClass}
                aria-label="Mở hộp gửi góp ý hoặc báo lỗi"
              >
                <ChatCircleDotsIcon className="w-4 h-4 text-slate-400" />
                <span>Gửi góp ý / báo lỗi</span>
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => runAndClose(onOpenAbout)}
              className={itemClass}
              aria-label="Mở giới thiệu website"
            >
              <InfoIcon className="w-4 h-4 text-slate-400" />
              <span>Giới thiệu ZenStudy</span>
            </button>

            <div className="my-1 mx-1 h-px bg-white/10" />

            <button
              type="button"
              role="menuitem"
              onClick={() => runAndClose(onToggleFullscreen)}
              className={itemClass}
              aria-label={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
            >
              {isFullscreen ? (
                <CornersInIcon className="w-4 h-4 text-slate-400" />
              ) : (
                <CornersOutIcon className="w-4 h-4 text-slate-400" />
              )}
              <span>{isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}</span>
              <kbd className={kbdClass}>F</kbd>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
