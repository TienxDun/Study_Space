"use client";

import React, { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { TimerIcon, CheckSquareIcon, NotePencilIcon, MusicNoteIcon, DotsThreeIcon } from "@phosphor-icons/react";
import type { MobileNavId } from "./types";
import { MobileNavItem } from "./MobileNavItem";
import { cn } from "@/lib/utils";

interface StudyMobileNavProps {
  active: string;
  onSelect: (id: MobileNavId) => void;
}

const ITEMS: { id: MobileNavId; label: string; icon: (active: boolean) => React.ReactNode }[] = [
  {
    id: "pomodoro",
    label: "Giờ",
    icon: (a) => (
      <TimerIcon
        className={cn("h-[22px] w-[22px] transition-all duration-200", a ? "text-white" : "text-slate-300/75")}
        weight={a ? "fill" : "duotone"}
      />
    ),
  },
  {
    id: "tasks",
    label: "Việc",
    icon: (a) => (
      <CheckSquareIcon
        className={cn("h-[22px] w-[22px] transition-all duration-200", a ? "text-white" : "text-slate-300/75")}
        weight={a ? "fill" : "duotone"}
      />
    ),
  },
  {
    id: "notes",
    label: "Ghi chú",
    icon: (a) => (
      <NotePencilIcon
        className={cn("h-[22px] w-[22px] transition-all duration-200", a ? "text-white" : "text-slate-300/75")}
        weight={a ? "fill" : "duotone"}
      />
    ),
  },
  {
    id: "music",
    label: "Nhạc",
    icon: (a) => (
      <MusicNoteIcon
        className={cn("h-[22px] w-[22px] transition-all duration-200", a ? "text-white" : "text-slate-300/75")}
        weight={a ? "fill" : "duotone"}
      />
    ),
  },
  {
    id: "more",
    label: "Thêm",
    icon: (a) => (
      <DotsThreeIcon
        className={cn("h-[22px] w-[22px] transition-all duration-200", a ? "text-white" : "text-slate-300/75")}
        weight="bold"
      />
    ),
  },
];

// Thanh điều hướng kính lỏng (bản web phỏng theo, không phải API chính thức của Apple)
export const StudyMobileNav = React.memo(function StudyMobileNav({
  active,
  onSelect,
}: StudyMobileNavProps) {
  const cachedRectRef = useRef<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);

  // Đốm sáng đi theo ngón tay: cache rect khi chạm để không gây layout reflow
  const updateSpot = (clientX: number, clientY: number, el: HTMLDivElement) => {
    if (!cachedRectRef.current) {
      cachedRectRef.current = el.getBoundingClientRect();
    }
    const rect = cachedRectRef.current;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      el.style.setProperty("--mx", `${((clientX - rect.left) / rect.width) * 100}%`);
      el.style.setProperty("--my", `${((clientY - rect.top) / rect.height) * 100}%`);
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    cachedRectRef.current = el.getBoundingClientRect();
    updateSpot(e.clientX, e.clientY, el);
    el.classList.add("is-touching");
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    updateSpot(e.clientX, e.clientY, e.currentTarget);
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    cachedRectRef.current = null;
    e.currentTarget.classList.remove("is-touching");
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const navContent = (
    <nav
      aria-label="Điều hướng mobile"
      className="fixed inset-x-0 bottom-0 z-[70] sm:hidden bottom-nav-safe pointer-events-none"
    >
      <div className="relative mx-3 pointer-events-auto">
        {/* Thanh capsule kính lỏng: mờ + đậm màu nền, viền sáng trên, bóng trung tính */}
        <div
          className="lg-bar p-1 flex items-stretch h-[58px]"
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerEnd}
          onPointerLeave={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          {/* Danh sách 5 nút điều hướng */}
          {ITEMS.map((item) => {
            const isActive = active === item.id;
            return (
              <MobileNavItem
                key={item.id}
                label={item.label}
                isActive={isActive}
                onClick={() => onSelect(item.id)}
                icon={item.icon(isActive)}
              />
            );
          })}
          {/* Đốm sáng theo tay */}
          <span aria-hidden="true" className="lg-spot" />
        </div>
      </div>
    </nav>
  );

  if (!mounted || typeof document === "undefined" || !document.body) {
    return null;
  }

  return createPortal(navContent, document.body);
});
