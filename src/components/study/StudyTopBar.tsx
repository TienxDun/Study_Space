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
  BarChart3,
} from "lucide-react";
import { ZenStudyLogo } from "./brand/ZenStudyLogo";
import { FocusStatsModal } from "./stats/FocusStatsModal";
import type { TimerTab } from "./pomodoro/types";

export interface StudyTopBarProps {
  isZenMode: boolean;
  isPomodoroVisible: boolean;
  centerTab: TimerTab;
  isGlobalMuted: boolean;
  isSettingsOpen: boolean;
  isFullscreen: boolean;
  showClockSeconds?: boolean;
  isClock12Hour?: boolean;
  onToggleClock: () => void;
  onToggleShortcuts: () => void;
  onEnterZen: () => void;
  onExitZen: () => void;
  onToggleMute: () => void;
  onToggleSettings: () => void;
  onToggleFullscreen: () => void;
}

/** Nút đồng hồ giữa: tự tick mỗi giây, tách riêng để khỏi vẽ lại cả thanh */
const TopBarClockButton = ({
  isPomodoroVisible,
  centerTab,
  onToggleClock,
  showClockSeconds = true,
  isClock12Hour = false,
}: {
  isPomodoroVisible: boolean;
  centerTab: TimerTab;
  onToggleClock: () => void;
  showClockSeconds?: boolean;
  isClock12Hour?: boolean;
}) => {
  const [currentTime, setCurrentTime] = useState("");

  // Định dạng theo đúng nút gạt trong Cài đặt (giây + 12/24h)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          ...(showClockSeconds ? { second: "2-digit" as const } : {}),
          hour12: isClock12Hour,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [showClockSeconds, isClock12Hour]);

  return (
    <motion.button
      layout
      transition={{ layout: { type: "spring", stiffness: 400, damping: 30 } }}
      onClick={onToggleClock}
      className={`absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 h-9 inline-flex items-center justify-center px-2.5 sm:px-3 rounded-xl pointer-events-auto group cursor-pointer active:scale-95 will-change-transform transition-all duration-200 select-none ${
        isPomodoroVisible && centerTab === "clock"
          ? "text-accent-music-bright drop-shadow-[0_0_14px_rgba(52,211,153,0.7)] glass-hover"
          : "text-slate-100 hover:text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] glass-hover"
      }`}
      title={
        isPomodoroVisible && centerTab === "clock"
          ? "Bấm để ẩn Đồng hồ lớn"
          : "Bấm để mở Đồng hồ lớn (C)"
      }
    >
      {/* Realtime Monospace Clock */}
      <span className="font-mono text-xs sm:text-sm font-semibold tracking-wider tabular-nums transition-colors">
        {currentTime || (showClockSeconds ? "00:00:00" : "00:00")}
      </span>

      {/* Subtle Status Hint without layout-thrashing reflows (chỉ mở rộng trên desktop/hover) */}
      <span className="hidden sm:inline max-w-0 group-hover:max-w-20 overflow-hidden whitespace-nowrap text-[10px] text-accent-music-bright font-medium opacity-0 group-hover:opacity-100 transition-all duration-200 ease-out pl-0 group-hover:pl-1.5">
        • {isPomodoroVisible && centerTab === "clock" ? "Ẩn giờ" : "Hiện giờ"}
      </span>
    </motion.button>
  );
};

/** Thanh điều hướng trên phong cách Spatial Glass & Dynamic Island Capsule */
export const StudyTopBar = ({
  isZenMode,
  isPomodoroVisible,
  centerTab,
  isGlobalMuted,
  isSettingsOpen,
  isFullscreen,
  showClockSeconds = true,
  isClock12Hour = false,
  onToggleClock,
  onToggleShortcuts,
  onEnterZen,
  onExitZen,
  onToggleMute,
  onToggleSettings,
  onToggleFullscreen,
}: StudyTopBarProps) => {
  const [isStatsOpen, setIsStatsOpen] = useState(false);

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
            <TopBarClockButton
              isPomodoroVisible={isPomodoroVisible}
              centerTab={centerTab}
              onToggleClock={onToggleClock}
              showClockSeconds={showClockSeconds}
              isClock12Hour={isClock12Hour}
            />

            {/* Right Action Icons - Floating Ghost HUD (Hoàn toàn không background, không viền) */}
            <div
              id="tour-topbar-actions"
              aria-label="Thanh công cụ nhanh Study Space"
              className="flex items-center h-9 sm:h-10 gap-0.5 sm:gap-1 pointer-events-auto select-none transition-all shrink-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]"
            >
              {/* Keyboard Shortcuts Cheat Sheet Button (Ẩn trên mobile không có bàn phím cứng) */}
              <button
                onClick={onToggleShortcuts}
                className="hidden sm:flex w-8 h-8 rounded-xl items-center justify-center text-slate-200 hover:text-white glass-hover transition-all active:scale-90 cursor-pointer drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
                title="Bảng tra cứu phím tắt (?)"
              >
                <HelpCircle className="w-4 h-4" />
              </button>

              {/* Focus Stats Button */}
              <button
                onClick={() => setIsStatsOpen(true)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-200 hover:text-white glass-hover transition-all active:scale-90 cursor-pointer drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
                title="Thống kê thời gian tập trung"
                aria-label="Mở thống kê thời gian tập trung"
              >
                <BarChart3 className="w-4 h-4" />
              </button>

              {/* Zen Mode Toggle (Ẩn thanh công cụ để tập trung) */}
              <button
                onClick={onEnterZen}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-200 hover:text-white glass-hover transition-all active:scale-90 cursor-pointer drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
                title="Chế độ Zen: Ẩn toàn bộ UI (Z)"
              >
                <EyeOff className="w-4 h-4" />
              </button>

              {/* Global Mute Toggle */}
              <button
                onClick={onToggleMute}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-200 hover:text-white glass-hover transition-all active:scale-90 cursor-pointer drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
                title={isGlobalMuted ? "Bật âm thanh không gian (M)" : "Tắt toàn bộ âm thanh (M)"}
              >
                {isGlobalMuted ? (
                  <VolumeX className="w-4 h-4 text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
                ) : (
                  <Volume2 className="w-4 h-4 text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                )}
              </button>

              {/* Settings Toggle */}
              <button
                onClick={onToggleSettings}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
                  isSettingsOpen
                    ? "bg-white/20 text-white backdrop-blur-md shadow-[0_0_14px_rgba(255,255,255,0.3)] font-bold"
                    : "text-slate-200 hover:text-white glass-hover drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
                }`}
                title="Cài đặt không gian học tập"
              >
                <Sliders className="w-4 h-4" />
              </button>

              {/* Fullscreen Toggle */}
              <button
                onClick={onToggleFullscreen}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-200 hover:text-white glass-hover transition-all active:scale-90 cursor-pointer drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
                title={isFullscreen ? "Thoát toàn màn hình (F)" : "Toàn màn hình (F)"}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Floating Zen Mode Restore Button - Minimal icon-only for true zen */}
      {isZenMode && (
        <motion.button
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          onClick={onExitZen}
          className="absolute top-4 right-4 z-50 flex items-center justify-center w-8 h-8 rounded-xl text-slate-200 hover:text-white glass-hover drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] transition-all active:scale-90 cursor-pointer select-none"
          title="Thoát Zen (Z)"
        >
          <Eye className="w-4 h-4 text-accent-music-bright drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
        </motion.button>
      )}

      {/* Focus Stats Modal (portal ra body, tự quản lý state) */}
      <FocusStatsModal isOpen={isStatsOpen} onClose={() => setIsStatsOpen(false)} />
    </>
  );
};
