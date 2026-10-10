"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { ZenStudyLogo } from "./brand/ZenStudyLogo";
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
            {/* Left Brand Capsule */}
            {/* Left Brand Logo - Đứng tự do không viền, to rõ theo phong cách Beeziee */}
            <Link
              href="/"
              onClick={(e) => {
                if (typeof window !== "undefined" && window.location.pathname === "/") {
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              className="flex items-center pointer-events-auto transition-transform group cursor-pointer hover:opacity-95 active:scale-95 shrink-0 select-none drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]"
              title="ZenStudy - Không gian học tập tương tác & tập trung"
            >
              {/* Mobile (< 640px): Hiển thị mascot icon to rõ */}
              <span className="sm:hidden flex items-center justify-center">
                <ZenStudyLogo variant="icon" className="h-9 w-9 transition-transform duration-200 group-hover:scale-105" priority />
              </span>
              {/* Desktop & Tablet: Hiển thị full mascot & brand text to đẹp */}
              <span className="hidden sm:flex items-center">
                <ZenStudyLogo variant="full" className="h-10 sm:h-11 w-auto transition-transform duration-200 group-hover:scale-[1.03]" priority />
              </span>
            </Link>

            {/* Dynamic Island Center Capsule - Realtime Clock (Thuần túy không viền không hộp, hiển thị thẳng lên bg) */}
            <motion.button
              layout
              transition={{ layout: { type: "spring", stiffness: 400, damping: 30 } }}
              onClick={onToggleClock}
              className={`absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 h-9 inline-flex items-center justify-center px-2.5 sm:px-3 rounded-xl pointer-events-auto group cursor-pointer active:scale-95 will-change-transform transition-all duration-200 select-none ${
                isPomodoroVisible && centerTab === "clock"
                  ? "text-accent-music-bright drop-shadow-[0_0_14px_rgba(52,211,153,0.7)] hover:bg-white/10"
                  : "text-slate-100 hover:text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] hover:bg-white/10"
              }`}
              title={
                isPomodoroVisible && centerTab === "clock"
                  ? "Bấm để ẩn Đồng hồ lớn"
                  : "Bấm để mở Đồng hồ lớn (C)"
              }
            >
              {/* Realtime Monospace Clock */}
              <span className="font-mono text-xs sm:text-sm font-semibold tracking-wider tabular-nums transition-colors">
                {currentTime || "00:00:00"}
              </span>

              {/* Subtle Status Hint without layout-thrashing reflows (chỉ mở rộng trên desktop/hover) */}
              <span className="hidden sm:inline max-w-0 group-hover:max-w-20 overflow-hidden whitespace-nowrap text-[10px] text-accent-music-bright font-medium opacity-0 group-hover:opacity-100 transition-all duration-200 ease-out pl-0 group-hover:pl-1.5">
                • {isPomodoroVisible && centerTab === "clock" ? "Ẩn giờ" : "Hiện giờ"}
              </span>
            </motion.button>

            {/* Right Action Icons (Chuẩn hóa h-10) */}
            <div
              id="tour-topbar-actions"
              className="flex items-center h-10 gap-1 px-1.5 rounded-full bg-black/60 hover:bg-black/65 backdrop-blur-2xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.6)] pointer-events-auto transition-colors shrink-0"
            >
              {/* Keyboard Shortcuts Cheat Sheet Button (Ẩn trên mobile không có bàn phím cứng) */}
              <button
                onClick={onToggleShortcuts}
                className="hidden sm:flex w-8 h-8 rounded-full items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors active:scale-90 cursor-pointer"
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
          className="absolute top-4 right-4 z-50 flex items-center gap-2 h-10 px-4 rounded-full bg-black/60 hover:bg-black/65 backdrop-blur-2xl border border-white/15 text-white text-xs font-semibold shadow-[0_20px_50px_rgba(0,0,0,0.6)] transition-colors active:scale-95 cursor-pointer group"
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
