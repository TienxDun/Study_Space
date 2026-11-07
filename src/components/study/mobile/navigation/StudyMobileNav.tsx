"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { TimerIcon, CheckSquareIcon, NotePencilIcon, MusicNoteIcon, DotsThreeIcon } from "@phosphor-icons/react";
import type { MobileNavId } from "./types";
import { MobileNavItem } from "./MobileNavItem";
import { useRenderTrace } from "../perf/useRenderTrace";
import { yieldToPaint } from "../perf/yieldToPaint";
import { preloadCriticalSheets } from "../sheets/core/sheet-preloader";
import { cn } from "@/lib/utils";

interface StudyMobileNavProps {
  active: string | null;
  onSelect: (id: MobileNavId) => void;
  hasEntered?: boolean;
}

const ITEMS: { id: MobileNavId; label: string; icon: (active: boolean) => React.ReactNode }[] = [
  {
    id: "pomodoro",
    label: "Giờ",
    icon: (a) => (
      <TimerIcon
        className={cn("h-[22px] w-[22px] transition-colors duration-200", a ? "text-white" : "text-slate-300/75")}
        weight={a ? "fill" : "duotone"}
      />
    ),
  },
  {
    id: "tasks",
    label: "Việc",
    icon: (a) => (
      <CheckSquareIcon
        className={cn("h-[22px] w-[22px] transition-colors duration-200", a ? "text-white" : "text-slate-300/75")}
        weight={a ? "fill" : "duotone"}
      />
    ),
  },
  {
    id: "notes",
    label: "Ghi chú",
    icon: (a) => (
      <NotePencilIcon
        className={cn("h-[22px] w-[22px] transition-colors duration-200", a ? "text-white" : "text-slate-300/75")}
        weight={a ? "fill" : "duotone"}
      />
    ),
  },
  {
    id: "music",
    label: "Nhạc",
    icon: (a) => (
      <MusicNoteIcon
        className={cn("h-[22px] w-[22px] transition-colors duration-200", a ? "text-white" : "text-slate-300/75")}
        weight={a ? "fill" : "duotone"}
      />
    ),
  },
  {
    id: "more",
    label: "Thêm",
    icon: (a) => (
      <DotsThreeIcon
        className={cn("h-[22px] w-[22px] transition-colors duration-200", a ? "text-white" : "text-slate-300/75")}
        weight="bold"
      />
    ),
  },
];

// Thanh điều hướng kính lỏng (bản web phỏng theo, không phải API chính thức của Apple)
export const StudyMobileNav = React.memo(function StudyMobileNav({
  active,
  onSelect,
  hasEntered = true,
}: StudyMobileNavProps) {
  useRenderTrace("nav props", { active, onSelect, hasEntered });

  const [mounted, setMounted] = useState(false);
  const [localActive, setLocalActive] = useState<string | null>(active);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setLocalActive(active);
  }, [active]);

  const handleSelect = useCallback(
    (id: MobileNavId) => {
      // 1. Phản hồi thị giác nút bấm tức thì trong frame hiện tại (< 2ms)
      setLocalActive(id);

      // 2. Nhường quyền vẽ (Next Paint) cho trình duyệt ngay lập tức (< 16ms -> INP Xanh tuyệt đối).
      // Ngay frame tiếp theo, onSelect mới mount/mở bảng để người dùng không cảm thấy độ trễ.
      yieldToPaint(() => {
        onSelect(id);
      });
    },
    [onSelect]
  );

  const navContent = (
    <motion.nav
      aria-label="Điều hướng mobile"
      initial={{ opacity: 0, y: 45 }}
      animate={{
        opacity: hasEntered ? 1 : 0,
        y: hasEntered ? 0 : 45,
      }}
      transition={{
        duration: 0.55,
        delay: hasEntered ? 0.48 : 0,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="fixed inset-x-0 bottom-0 z-[70] sm:hidden bottom-nav-safe pointer-events-none"
    >
      <div className="relative mx-3 pointer-events-auto">
        {/* Thanh capsule kính lỏng: mờ + đậm màu nền, viền sáng trên, bóng trung tính */}
        <div
          onPointerDown={() => preloadCriticalSheets()}
          onPointerEnter={() => preloadCriticalSheets()}
          className="lg-bar p-1 flex items-stretch h-[58px] rounded-full overflow-hidden transition-all"
        >
          {/* Danh sách 5 nút điều hướng */}
          {ITEMS.map((item) => {
            const currentActive = localActive ?? active;
            const isActive = currentActive === item.id;
            return (
              <MobileNavItem
                key={item.id}
                label={item.label}
                isActive={isActive}
                onClick={() => handleSelect(item.id)}
                icon={item.icon(isActive)}
              />
            );
          })}
        </div>
      </div>
    </motion.nav>
  );

  if (!mounted || typeof document === "undefined" || !document.body) {
    return null;
  }

  return createPortal(navContent, document.body);
});
