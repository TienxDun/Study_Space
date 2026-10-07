"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Sliders,
  HelpCircle,
} from "lucide-react";
import type { TimerTab } from "./pomodoro/types";

export interface StudyTopBarProps {
  isZenMode: boolean;
  isPomodoroVisible: boolean;
  centerTab: TimerTab;
  isGlobalMuted: boolean;
  isSettingsOpen: boolean;
  isFullscreen: boolean;
  onToggleClock: () => void;
  onToggleShortcuts: () => void;
  onEnterZen: () => void;
  onExitZen: () => void;
  onToggleMute: () => void;
  onToggleSettings: () => void;
  onToggleFullscreen: () => void;
}

/** Thanh điều hướng trên phong cách Spatial Glass & Dynamic Island Capsule */
export const StudyTopBar = ({
  isZenMode,
  isPomodoroVisible,
  centerTab,
  isGlobalMuted,
  isSettingsOpen,
  isFullscreen,
  onToggleClock,
  onToggleShortcuts,
  onEnterZen,
  onExitZen,
  onToggleMute,
  onToggleSettings,
  onToggleFullscreen,
}: StudyTopBarProps) => {
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <AnimatePresence>
        {!isZenMode && (
          <motion.header
            key="study-top-nav-bar"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between pointer-events-none select-none will-change-transform"
          >
            {/* Left Spacer */}
            <div className="w-8 hidden sm:block" />

            {/* Dynamic Island Center Capsule (Framer Motion spring layout không bị xung đột CSS transition) */}
            <motion.button
              layout
              transition={{ layout: { type: "spring", stiffness: 400, damping: 30 } }}
              onClick={onToggleClock}
              className={`hidden sm:inline-flex absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 items-center gap-3 px-4 py-1.5 rounded-full backdrop-blur-2xl border pointer-events-auto shadow-[0_20px_50px_rgba(0,0,0,0.6)] group cursor-pointer active:scale-95 will-change-transform ${
                isPomodoroVisible && centerTab === "clock"
                  ? "bg-black/75 border-accent-music-glow/40 ring-1 ring-accent-music-glow/30 shadow-[0_0_24px_rgba(52,211,153,0.25)] text-white"
                  : "bg-black/60 hover:bg-black/65 border-white/15 hover:border-white/25 text-slate-200"
              }`}
              title={
                isPomodoroVisible && centerTab === "clock"
                  ? "Bấm để ẩn Đồng hồ lớn"
                  : "Bấm để mở Đồng hồ lớn (C)"
              }
            >
              {/* Brand Typography */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-bold tracking-wide text-white group-hover:text-accent-music-bright transition-colors">
                  HUFLIT
                </span>
                <span className="font-normal text-slate-300 group-hover:text-white transition-colors">
                  StudySpace
                </span>
              </div>

              {/* Hairline Divider */}
              <span className="h-3.5 w-px bg-white/20" />

              {/* Realtime Monospace Clock */}
              <span className="font-mono text-xs font-semibold text-slate-200 tracking-wider tabular-nums group-hover:text-white transition-colors">
                {currentTime || "00:00:00"}
              </span>

              {/* Subtle Status Hint without layout-thrashing reflows */}
              <span className="max-w-0 group-hover:max-w-20 overflow-hidden whitespace-nowrap text-[10px] text-accent-music-bright font-medium opacity-0 group-hover:opacity-100 transition-all duration-200 ease-out">
                • {isPomodoroVisible && centerTab === "clock" ? "Ẩn giờ" : "Hiện giờ"}
              </span>
            </motion.button>

            {/* Right Action Icons (Unified Spatial Toolbar) */}
            <div className="flex items-center gap-1 p-1 rounded-full bg-black/60 hover:bg-black/65 backdrop-blur-2xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.6)] pointer-events-auto transition-colors">
              {/* Keyboard Shortcuts Cheat Sheet Button */}
              <button
                onClick={onToggleShortcuts}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors active:scale-90 cursor-pointer"
                title="Bảng tra cứu phím tắt (?)"
              >
                <HelpCircle className="w-4 h-4" />
              </button>

              {/* Zen Mode Toggle (Ẩn thanh công cụ để tập trung) */}
              <button
                onClick={onEnterZen}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors active:scale-90 cursor-pointer"
                title="Chế độ Zen: Ẩn toàn bộ UI (Z)"
              >
                <EyeOff className="w-4 h-4" />
              </button>

              {/* Global Mute Toggle */}
              <button
                onClick={onToggleMute}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors active:scale-90 cursor-pointer"
                title={isGlobalMuted ? "Bật âm thanh không gian (M)" : "Tắt toàn bộ âm thanh (M)"}
              >
                {isGlobalMuted ? (
                  <VolumeX className="w-4 h-4 text-accent-stream-rose-bright" />
                ) : (
                  <Volume2 className="w-4 h-4 text-accent-music-glow" />
                )}
              </button>

              {/* Settings Toggle */}
              <button
                onClick={onToggleSettings}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors active:scale-90 cursor-pointer ${
                  isSettingsOpen
                    ? "bg-white text-panel shadow-md font-bold"
                    : "text-slate-300 hover:text-white hover:bg-white/10"
                }`}
                title="Cài đặt không gian học tập"
              >
                <Sliders className="w-4 h-4" />
              </button>

              {/* Fullscreen Toggle */}
              <button
                onClick={onToggleFullscreen}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors active:scale-90 cursor-pointer"
                title={isFullscreen ? "Thoát toàn màn hình (F)" : "Toàn màn hình (F)"}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Floating Zen Mode Restore Button */}
      {isZenMode && (
        <motion.button
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          onClick={onExitZen}
          className="absolute top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 hover:bg-black/65 backdrop-blur-2xl border border-white/15 text-white text-xs font-semibold shadow-[0_20px_50px_rgba(0,0,0,0.6)] transition-colors active:scale-95 cursor-pointer group"
          title="Bấm để hiện lại giao diện điều khiển (Z)"
        >
          <Eye className="w-3.5 h-3.5 text-accent-music-bright group-hover:scale-110 transition-transform" />
          <span className="tracking-tight">Hiện lại giao diện</span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-slate-300 font-mono">
            Z
          </kbd>
        </motion.button>
      )}
    </>
  );
};
