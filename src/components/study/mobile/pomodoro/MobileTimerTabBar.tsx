"use client";

import { memo, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import type { TimerTab } from "@/components/study/pomodoro/types";
import { yieldToPaint } from "../perf/yieldToPaint";
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

// Hàng nút chuyển chế độ RIÊNG cho mobile, theo chất liệu kính lỏng:
// viên kính trượt lò xo, bấm lún như giọt nước.
// Tối ưu INP: phản hồi visual ngay frame 1 (< 16ms), nhường paint rồi mới cập nhật state nặng ở cha.
export const MobileTimerTabBar = memo(function MobileTimerTabBar({ currentTab, onSelectTab, visible }: MobileTimerTabBarProps) {
  const [localTab, setLocalTab] = useState<TimerTab>(currentTab);

  useEffect(() => {
    setLocalTab(currentTab);
  }, [currentTab]);

  const activeTab = localTab ?? currentTab;

  const handleTabClick = useCallback(
    (tabId: TimerTab) => {
      if (tabId === activeTab) return;
      // 1. Chuyển viên kính active ngay tức thì trong frame 1 (< 2ms)
      setLocalTab(tabId);
      // 2. Nhường main-thread để trình duyệt Paint ngay phản hồi bấm nút (< 16ms -> INP Xanh tuyệt đối)
      // Ngay frame tiếp theo, onSelectTab mới đổi chế độ đồng hồ/pomodoro/stopwatch nặng
      yieldToPaint(() => {
        onSelectTab(tabId);
      });
    },
    [activeTab, onSelectTab]
  );

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "w-full max-w-sm mx-auto mb-1 z-20 items-center gap-2.5 transition-all duration-300 flex sm:hidden",
        visible
          ? "opacity-100 visible translate-y-0 pointer-events-auto"
          : "opacity-0 invisible -translate-y-1.5 pointer-events-none"
      )}
    >
      <div className="timer-tab-bar w-full flex items-center gap-0.5 p-0.5">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              aria-pressed={isActive}
              tabIndex={visible ? 0 : -1}
              className={cn(
                "relative flex-1 min-w-0 inline-flex items-center justify-center rounded-full py-1 min-h-[38px] text-[11px] uppercase tracking-wider text-center cursor-pointer transition-colors duration-150 touch-manipulation",
                isActive ? "text-white font-black" : "text-white/65 hover:text-white/90 font-bold"
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="mobile-timer-seg-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  className="absolute inset-0 timer-seg-active pointer-events-none"
                />
              )}
              <span
                className={cn(
                  "pointer-events-none relative z-10 transition-colors duration-150",
                  isActive
                    ? "drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]"
                    : "drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                )}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
