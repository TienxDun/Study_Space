"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  FlagIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { formatStopwatch } from "../utils/timer-formatters";

interface StopwatchLapsDrawerProps {
  isOpen: boolean;
  laps: number[];
  onClose: () => void;
  onClearLaps: () => void;
  showStopwatchMilliseconds?: boolean;
}

export function StopwatchLapsDrawer({
  isOpen,
  laps,
  onClose,
  onClearLaps,
  showStopwatchMilliseconds = false,
}: StopwatchLapsDrawerProps) {
  // Nút xóa hết phải bấm 2 lần mới xóa, tránh bấm nhầm mất hết
  const [confirmingClear, setConfirmingClear] = useState(false);
  const confirmTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    };
  }, []);

  // Thêm/xóa vòng hoặc đóng bảng thì tắt hỏi lại
  useEffect(() => {
    setConfirmingClear(false);
  }, [laps.length, isOpen]);

  const handleClearPress = () => {
    if (!confirmingClear) {
      setConfirmingClear(true);
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
      confirmTimer.current = window.setTimeout(() => setConfirmingClear(false), 2500);
      return;
    }
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    setConfirmingClear(false);
    onClearLaps();
  };

  return (
    <AnimatePresence>
      {isOpen && laps.length > 0 && (
        <React.Fragment key="stopwatch-laps-drawer-fragment">
          {/* Backdrop to close Laps Drawer when clicking outside */}
          <div
            key="stopwatch-laps-backdrop"
            className="fixed inset-0 z-30 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          />
          <motion.div
            key="stopwatch-laps-panel"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-80 sm:w-88 glass-panel hover:bg-black/45 p-3.5 z-40 space-y-2.5"
          >
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none z-10" />
            {/* Header gọn 1 hàng: tên + số vòng, bên phải chỉ còn nút thu gọn */}
            <div className="flex items-center justify-between gap-2 px-1 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2 min-w-0">
                <span className="p-1.5 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-400/30 shrink-0">
                  <FlagIcon className="w-3.5 h-3.5" />
                </span>
                <h4 className="text-sm font-bold text-slate-100 leading-none truncate">
                  Vòng bấm giờ
                </h4>
                <span className="px-1.5 py-0.5 rounded-lg bg-sky-400/20 border border-sky-400/30 text-[11px] font-bold text-sky-200 shrink-0">
                  {laps.length}
                </span>
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                title="Thu gọn"
                aria-label="Thu gọn bảng vòng bấm giờ"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Laps List with custom sleek scrollbar */}
            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1.5 custom-study-scroll">
              {laps.map((lap, idx) => {
                const lapNumber = laps.length - idx;
                const isLatest = idx === 0;
                return (
                  <div
                    key={`lap-${lapNumber}-${idx}`}
                    className={`flex items-center justify-between px-3 py-1.5 rounded-2xl transition-all ${
                      isLatest
                        ? "bg-sky-500/20 border border-sky-400/30 text-white shadow-sm"
                        : "bg-white/5 hover:bg-white/10 text-slate-200 border border-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold px-1.5 py-0.5 rounded-lg ${
                          isLatest
                            ? "bg-sky-400/30 text-sky-200"
                            : "bg-white/10 text-slate-400"
                        }`}
                      >
                        #{lapNumber}
                      </span>
                      {isLatest && (
                        <span className="text-xs text-sky-300 font-semibold">
                          Gần nhất
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs font-bold tracking-wider text-sky-200">
                      {formatStopwatch(lap, showStopwatchMilliseconds)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Xóa hết nằm cuối bảng, bấm 2 lần mới xóa để khỏi mất oan */}
            <button
              onClick={handleClearPress}
              className={`w-full py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                confirmingClear
                  ? "bg-rose-500/20 text-rose-200 border border-rose-400/40"
                  : "text-slate-500 hover:text-rose-300 hover:bg-rose-500/10"
              }`}
              title="Xoá tất cả vòng"
            >
              <TrashIcon className="w-3.5 h-3.5" />
              <span>{confirmingClear ? "Bấm lại để xóa hết" : "Xóa tất cả"}</span>
            </button>
          </motion.div>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
}
