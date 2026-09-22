"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Sliders,
} from "lucide-react";
import type { TimerTab } from "./StudyPomodoroWidget";

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

/** Thanh điều hướng trên + nút khôi phục Zen mode. */
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
          className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between pointer-events-none"
        >
          {/* Back Button */}
          <div className="pointer-events-auto">
            <Link
              href="/"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-950/70 hover:bg-slate-900/90 backdrop-blur-2xl border border-white/10 hover:border-white/20 text-slate-200 hover:text-white shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all active:scale-95 group cursor-pointer text-xs font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5 text-slate-400 group-hover:text-white" />
              <span className="tracking-tight">GPA Calculator</span>
            </Link>
          </div>

          {/* Brand Status Capsule (Bấm vào để bật/tắt Đồng hồ & Ngày tháng) */}
          <button
            onClick={onToggleClock}
            className={`hidden sm:inline-flex absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 items-center gap-3 px-4 py-1.5 rounded-full backdrop-blur-2xl border pointer-events-auto shadow-[0_8px_32px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.12)] transition-all duration-200 group select-none cursor-pointer active:scale-95 ${
              isPomodoroVisible && centerTab === "clock"
                ? "bg-slate-900/95 border-white/30 ring-1 ring-white/20 text-white"
                : "bg-slate-950/70 hover:bg-slate-900/90 border-white/10 hover:border-white/20"
            }`}
            title={isPomodoroVisible && centerTab === "clock" ? "Bấm để ẩn Đồng hồ" : "Bấm để hiển thị Đồng hồ"}
          >
            {/* Clean Brand Typography */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold tracking-wide text-white group-hover:text-white transition-colors">
                HUFLIT
              </span>
              <span className="font-normal text-slate-300 group-hover:text-slate-100 transition-colors">
                StudySpace
              </span>
            </div>

            {/* Elegant Hairline Divider */}
            <span className="h-3 w-px bg-white/15" />

            {/* Live Clock */}
            <span className="font-mono text-xs text-slate-300 font-medium tracking-wider tabular-nums group-hover:text-white transition-colors">
              {currentTime || "00:00:00"}
            </span>
          </button>

          {/* Right Action Icons */}
          <div className="flex items-center gap-2 pointer-events-auto">
            {/* Keyboard Shortcuts Cheat Sheet Button */}
            <button
              onClick={onToggleShortcuts}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/70 hover:bg-slate-900/90 backdrop-blur-2xl border border-white/10 hover:border-white/20 text-slate-200 hover:text-white shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all active:scale-95 text-xs font-medium cursor-pointer"
              title="Bảng tra cứu phím tắt (?)"
            >
              <span className="font-mono text-[10px] bg-white/10 px-1.5 py-0.5 rounded font-bold text-slate-300">?</span>
              <span className="hidden md:inline">Phím tắt</span>
            </button>

            {/* Zen Mode Toggle */}
            <button
              onClick={onEnterZen}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/70 hover:bg-slate-900/90 backdrop-blur-2xl border border-white/10 hover:border-white/20 text-slate-200 hover:text-white shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all active:scale-95 text-xs font-medium cursor-pointer"
              title="Ẩn thanh công cụ để tập trung (Zen Mode: Z)"
            >
              <EyeOff className="w-3.5 h-3.5 text-slate-300" />
              <span className="hidden sm:inline">Ẩn UI</span>
            </button>

            {/* Global Mute Toggle */}
            <button
              onClick={onToggleMute}
              className="p-1.5 rounded-full bg-slate-950/70 hover:bg-slate-900/90 backdrop-blur-2xl border border-white/10 hover:border-white/20 text-slate-200 hover:text-white shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all active:scale-95 cursor-pointer"
              title={isGlobalMuted ? "Bật âm thanh (M)" : "Tắt toàn bộ âm (M)"}
            >
              {isGlobalMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>

            {/* Settings Toggle (Cài đặt không gian học tập) */}
            <button
              onClick={onToggleSettings}
              className={`p-2 rounded-full backdrop-blur-xl border transition-all active:scale-95 cursor-pointer ${
                isSettingsOpen
                  ? "bg-white text-black font-bold shadow-lg border-white"
                  : "bg-slate-900/70 hover:bg-slate-900/95 border-white/15 text-white/80 hover:text-white"
              }`}
              title="Cài đặt không gian học tập"
            >
              <Sliders className="w-4 h-4" />
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={onToggleFullscreen}
              className="p-2 rounded-full bg-slate-900/70 hover:bg-slate-900/95 backdrop-blur-xl border border-white/15 text-white/80 hover:text-white transition-all active:scale-95 cursor-pointer"
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
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={onExitZen}
        className="absolute top-4 right-4 z-50 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-900 backdrop-blur-2xl border border-white/20 text-white/90 text-xs font-semibold shadow-2xl transition-all active:scale-95 cursor-pointer"
      >
        <Eye className="w-3.5 h-3.5 text-emerald-400" />
        <span>Hiện lại giao diện</span>
      </motion.button>
    )}
  </>
  );
};
