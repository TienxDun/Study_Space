"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CornersOutIcon, CornersInIcon } from "@phosphor-icons/react";
import { ZenStudyLogo } from "@/components/study/brand/ZenStudyLogo";

interface MobileTopBarProps {
  isZenMode: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

// Thanh trên mobile: logo, giờ, toàn màn hình. Tài khoản nằm trong bảng Thêm cho thoáng.
export function MobileTopBar({ isZenMode, isFullscreen, onToggleFullscreen }: MobileTopBarProps) {
  const [time, setTime] = useState("");

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

  if (isZenMode) return null;

  return (
    <header className="absolute top-0 inset-x-0 z-40 sm:hidden pt-safe">
      <div className="relative flex items-center justify-between px-4 h-14">
        <Link href="/" aria-label="ZenStudy" className="w-11 h-11 grid place-items-center shrink-0 active:scale-95">
          <ZenStudyLogo variant="icon" className="h-9 w-9" priority />
        </Link>
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-sm font-semibold tracking-wider tabular-nums text-slate-100 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
          {time}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-slate-200 active:scale-95"
          >
            {isFullscreen ? (
              <CornersInIcon className="w-5 h-5" />
            ) : (
              <CornersOutIcon className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
