"use client";

import { motion } from "framer-motion";
import type { TimerTab } from "@/components/study/pomodoro/types";
import { cn } from "@/lib/utils";

interface MobileTimerTabBarProps {
  currentTab: TimerTab;
  onSelectTab: (tab: TimerTab) => void;
  visible: boolean;
}

const TABS: { id: TimerTab; label: string }[] = [
  { id: "clock", label: "Đồng hồ" },
  { id: "pomodoro", label: "Pomodoro" },
  { id: "stopwatch", label: "Stopwatch" },
];

// Hàng nút chuyển chế độ RIÊNG cho mobile, kiểu nút kính mẫu 001 Lucianlabs:
// viên kính trượt lò xo, đốm sáng theo tay, bấm lún như giọt nước.
// Mỏng nhẹ và tự ẩn khi không dùng tới (cha điều khiển qua visible).
export function MobileTimerTabBar({ currentTab, onSelectTab, visible }: MobileTimerTabBarProps) {
  // Đốm sáng đi theo ngón tay: chạm đâu sáng đó
  const handleSpot = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - rect.left) / rect.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - rect.top) / rect.height) * 100}%`);
  };

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "mb-1 z-20 items-center gap-2.5 transition-all duration-300 flex sm:hidden",
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 -translate-y-1.5 pointer-events-none"
      )}
    >
      <div
        className="lg-bar flex items-center gap-0.5 p-0.5"
        onPointerMove={handleSpot}
        onPointerDown={(e) => {
          handleSpot(e);
          e.currentTarget.classList.add("is-touching");
        }}
        onPointerUp={(e) => e.currentTarget.classList.remove("is-touching")}
        onPointerLeave={(e) => e.currentTarget.classList.remove("is-touching")}
        onPointerCancel={(e) => e.currentTarget.classList.remove("is-touching")}
      >
        {TABS.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              aria-pressed={isActive}
              tabIndex={visible ? 0 : -1}
              className={cn(
                "lg-seg relative w-24 inline-flex items-center justify-center rounded-full py-1 min-h-[38px] text-[11px] font-black uppercase tracking-wider text-center cursor-pointer",
                isActive ? "text-white" : "text-white/80 hover:text-white font-bold"
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="mobile-timer-seg-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  className="absolute inset-0 lg-seg-active"
                />
              )}
              <span className="relative z-10 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
                {tab.label}
              </span>
            </button>
          );
        })}
        {/* Đốm sáng theo tay */}
        <span aria-hidden="true" className="lg-spot" />
      </div>
    </div>
  );
}
