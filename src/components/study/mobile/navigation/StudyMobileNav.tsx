"use client";

import { TimerIcon, CheckSquareIcon, ImageIcon, MusicNoteIcon, DotsThreeIcon } from "@phosphor-icons/react";
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
    id: "scenes",
    label: "Cảnh",
    icon: (a) => (
      <ImageIcon
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
export function StudyMobileNav({ active, onSelect }: StudyMobileNavProps) {
  // Đốm sáng đi theo ngón tay (học từ mẫu 001 Lucianlabs): chạm đâu sáng đó
  const handleSpot = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - rect.left) / rect.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - rect.top) / rect.height) * 100}%`);
  };

  return (
    <nav
      aria-label="Điều hướng mobile"
      className="fixed inset-x-0 bottom-0 z-[60] sm:hidden bottom-nav-safe pointer-events-none"
    >
      <div className="relative mx-3 pointer-events-auto">
        {/* Thanh capsule kính lỏng: mờ + đậm màu nền, viền sáng trên, bóng trung tính */}
        <div
          className="lg-bar p-1 flex items-stretch h-[58px]"
          onPointerMove={handleSpot}
          onPointerDown={(e) => {
            handleSpot(e);
            e.currentTarget.classList.add("is-touching");
          }}
          onPointerUp={(e) => e.currentTarget.classList.remove("is-touching")}
          onPointerLeave={(e) => e.currentTarget.classList.remove("is-touching")}
          onPointerCancel={(e) => e.currentTarget.classList.remove("is-touching")}
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
}
