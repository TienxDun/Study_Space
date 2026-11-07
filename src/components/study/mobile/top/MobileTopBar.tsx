"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CornersOutIcon,
  CornersInIcon,
  ImageIcon,
  CircleNotchIcon,
} from "@phosphor-icons/react";
import { ZenStudyLogo } from "@/components/study/brand/ZenStudyLogo";
import { isNativeApp } from "@/lib/google-sign-in";
import { yieldToPaint } from "@/components/study/mobile/perf/yieldToPaint";
import { cn } from "@/lib/utils";
import { isAnySheetExpanded } from "@/components/study/mobile/sheets/sheet-zen-tracker";

interface MobileTopBarProps {
  isZenMode: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  hasEntered?: boolean;
  onChangeScene?: () => void;
  onOpenScenes?: () => void;
  isPreloadingScene?: boolean;
}

// Thanh trên mobile: logo, giờ, đổi cảnh nhanh, toàn màn hình. Tài khoản nằm trong bảng Thêm cho thoáng.
export const MobileTopBar = React.memo(function MobileTopBar({
  isZenMode,
  isFullscreen,
  onToggleFullscreen,
  hasEntered = true,
  onChangeScene,
  onOpenScenes,
  isPreloadingScene = false,
}: MobileTopBarProps) {
  const [time, setTime] = useState("");
  const [canShowFullscreen, setCanShowFullscreen] = useState(true);
  const [isSheetExpanded, setIsSheetExpanded] = useState(() => isAnySheetExpanded());
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);

  // Lắng nghe sự kiện mở rộng toàn màn hình (Zen Mode) của các Sheet để ẩn thanh Top Bar
  useEffect(() => {
    const handleExpanded = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setIsSheetExpanded(Boolean(detail?.isExpanded));
    };
    window.addEventListener("zenstudy:mobile-sheet-expanded", handleExpanded);
    return () => window.removeEventListener("zenstudy:mobile-sheet-expanded", handleExpanded);
  }, []);

  useEffect(() => {
    if (isNativeApp()) {
      setCanShowFullscreen(false);
    }
  }, []);

  const handlePointerDown = useCallback(() => {
    if (!onOpenScenes) return;
    didLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      try {
        if (typeof window !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate(30);
        }
      } catch {}
      yieldToPaint(onOpenScenes);
    }, 550);
  }, [onOpenScenes]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const update = () => {
      setTime(
        new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      );
    };
    update();
    const id = setInterval(update, 10000);
    return () => clearInterval(id);
  }, []);

  const isHidden = isZenMode || isSheetExpanded;

  if (isZenMode) return null;

  return (
    <motion.header
      initial={{ opacity: 0, y: 25 }}
      animate={{
        opacity: hasEntered && !isHidden ? 1 : 0,
        y: hasEntered && !isHidden ? 0 : 25,
      }}
      transition={{
        duration: 0.25,
        delay: hasEntered && !isHidden ? 0.08 : 0,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={cn(
        "fixed top-0 inset-x-0 z-40 sm:hidden pt-safe pointer-events-none transition-opacity",
        isHidden && "pointer-events-none opacity-0"
      )}
    >
      <div
        className={cn(
          "relative flex items-center justify-between px-4 h-14 pointer-events-auto",
          isHidden && "pointer-events-none"
        )}
      >
        <Link
          href="/"
          aria-label="ZenStudy"
          onClick={(e) => {
            if (typeof window !== "undefined" && window.location.pathname === "/") {
              e.preventDefault();
            }
          }}
          className="w-11 h-11 grid place-items-center shrink-0 active:scale-95"
        >
          <ZenStudyLogo variant="icon" className="h-9 w-9" priority />
        </Link>
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-sm font-semibold tracking-wider tabular-nums text-slate-100 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
          {time}
        </span>

        {/* Nút tác vụ góc phải: Đổi cảnh nhanh + Toàn màn hình */}
        <div className="flex items-center gap-2 shrink-0">
          {onChangeScene && (
            <button
              type="button"
              onClick={() => {
                if (didLongPressRef.current) {
                  didLongPressRef.current = false;
                  return;
                }
                yieldToPaint(onChangeScene);
              }}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              aria-label="Đổi cảnh nền"
              title="Đổi cảnh nền (Chạm để đổi ngay, nhấn giữ để mở danh sách)"
              className="glass-round-btn w-9 h-9 rounded-full flex items-center justify-center text-white/90 hover:text-white transition-transform duration-75 active:scale-90 cursor-pointer touch-manipulation drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
            >
              {isPreloadingScene ? (
                <CircleNotchIcon className="w-4.5 h-4.5 animate-spin text-white/80 pointer-events-none" />
              ) : (
                <ImageIcon className="w-4.5 h-4.5 pointer-events-none" weight="duotone" />
              )}
            </button>
          )}

          {/* Nút toàn màn hình chỉ có ích khi xem bằng trình duyệt; trong app thì ẩn */}
          {canShowFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              aria-label={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
              className="glass-round-btn w-9 h-9 rounded-full flex items-center justify-center text-slate-200 hover:text-white transition-transform duration-75 active:scale-90 cursor-pointer touch-manipulation drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
            >
              {isFullscreen ? (
                <CornersInIcon className="w-4.5 h-4.5 pointer-events-none" />
              ) : (
                <CornersOutIcon className="w-4.5 h-4.5 pointer-events-none" />
              )}
            </button>
          )}
        </div>
      </div>
    </motion.header>
  );
});

MobileTopBar.displayName = "MobileTopBar";
