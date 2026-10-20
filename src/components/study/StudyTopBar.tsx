"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  CornersOutIcon,
  CornersInIcon,
  SpeakerHighIcon,
  SpeakerXIcon,
  EyeIcon,
  EyeSlashIcon,
  SlidersIcon,
  QuestionIcon,
  ChartBarIcon,
  InfoIcon,
} from "@phosphor-icons/react";
import { ZenStudyLogo } from "./brand/ZenStudyLogo";
import { FocusStatsModal } from "./stats/FocusStatsModal";
import { StudyAboutModal } from "./StudyAboutModal";
import { TopBarUserProfile } from "./auth";
import { SyncStatusBadge } from "./sync/SyncStatusBadge";
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
  isStatsOpen?: boolean;
  onToggleStats?: () => void;
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
          ? "text-accent-music-bright bg-white/[0.08] border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_16px_rgba(0,0,0,0.4)]"
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
  isStatsOpen: controlledStatsOpen,
  onToggleStats,
}: StudyTopBarProps) => {
  const [internalStatsOpen, setInternalStatsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const isStatsOpen = controlledStatsOpen !== undefined ? controlledStatsOpen : internalStatsOpen;

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
              {/* Giới thiệu website (nằm bên trái nút Phím tắt) */}
              <button
                onClick={() => setIsAboutOpen(true)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-200 hover:text-white glass-hover transition-all active:scale-90 cursor-pointer drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
                title="Giới thiệu website"
                aria-label="Mở giới thiệu website"
              >
                <InfoIcon className="w-4 h-4" />
              </button>

              {/* Keyboard Shortcuts Cheat Sheet Button (Ẩn trên mobile không có bàn phím cứng) */}
              <button
                onClick={onToggleShortcuts}
                className="hidden sm:flex w-8 h-8 rounded-xl items-center justify-center text-slate-200 hover:text-white glass-hover transition-all active:scale-90 cursor-pointer drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
                title="Bảng tra cứu phím tắt (?)"
              >
                <QuestionIcon className="w-4 h-4" />
              </button>

              {/* Focus Stats Button */}
              <button
                onClick={() => (onToggleStats ? onToggleStats() : setInternalStatsOpen(true))}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-200 hover:text-white glass-hover transition-all active:scale-90 cursor-pointer drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
                title="Thống kê thời gian tập trung"
                aria-label="Mở thống kê thời gian tập trung"
              >
                <ChartBarIcon className="w-4 h-4" />
              </button>

              {/* Zen Mode Toggle (Ẩn thanh công cụ để tập trung) */}
              <button
                onClick={onEnterZen}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-200 hover:text-white glass-hover transition-all active:scale-90 cursor-pointer drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
                title="Chế độ Zen: Ẩn toàn bộ UI (Z)"
              >
                <EyeSlashIcon className="w-4 h-4" />
              </button>

              {/* Global Mute Toggle */}
              <button
                onClick={onToggleMute}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-200 hover:text-white glass-hover transition-all active:scale-90 cursor-pointer drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
                title={isGlobalMuted ? "Bật âm thanh không gian (M)" : "Tắt toàn bộ âm thanh (M)"}
              >
                {isGlobalMuted ? (
                  <SpeakerXIcon className="w-4 h-4 text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
                ) : (
                  <SpeakerHighIcon className="w-4 h-4 text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
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
                <SlidersIcon className="w-4 h-4" />
              </button>

              {/* Fullscreen Toggle */}
              <button
                onClick={onToggleFullscreen}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-200 hover:text-white glass-hover transition-all active:scale-90 cursor-pointer drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
                title={isFullscreen ? "Thoát toàn màn hình (F)" : "Toàn màn hình (F)"}
              >
                {isFullscreen ? <CornersInIcon className="w-4 h-4" /> : <CornersOutIcon className="w-4 h-4" />}
              </button>

              {/* Vạch chia ngăn cách */}
              <div className="w-[1px] h-4 bg-white/15 mx-0.5 sm:mx-1 shrink-0" />

              {/* Unified User Profile Pill / Button */}
              <span className="md:hidden">
                <TopBarUserProfile />
              </span>
              <div className="hidden md:flex items-center h-8 rounded-xl border border-white/15 bg-white/10 shadow-xs overflow-visible">
                <SyncStatusBadge variant="text" iconOnly className="px-2 h-full rounded-none hover:bg-white/5" />
                <div className="w-px h-4 bg-white/15 shrink-0" />
                <TopBarUserProfile bare />
              </div>
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
          <EyeIcon className="w-4 h-4 text-accent-music-bright drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
        </motion.button>
      )}

      {/* Focus Stats Modal (portal ra body, tự quản lý state nếu không có prop ngoài) */}
      {controlledStatsOpen === undefined && (
        <FocusStatsModal isOpen={isStatsOpen} onClose={() => setInternalStatsOpen(false)} />
      )}

      {/* Giới thiệu website (portal ra body, tự quản lý state) */}
      <StudyAboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </>
  );
};
