"use client";

import React from "react";
import { Flag, Trash2, X } from "lucide-react";
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
            className="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-80 sm:w-88 rounded-3xl bg-slate-900/90 hover:bg-slate-900/95 backdrop-blur-2xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.7)] p-3.5 z-40 space-y-2.5"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-1 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-400/30">
                  <Flag className="w-3.5 h-3.5" />
                </span>
                <div>
                  <h4 className="text-xs font-bold text-slate-100 leading-none">
                    Vòng bấm giờ
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {laps.length} mốc thời gian
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={onClearLaps}
                  className="px-2 py-1 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Xoá tất cả vòng"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Xóa</span>
                </button>
                <button
                  onClick={onClose}
                  className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Thu gọn"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
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
          </motion.div>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
}
