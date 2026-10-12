"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { FlameIcon, CoffeeIcon, MoonStarsIcon } from "@phosphor-icons/react";
import { TimerTab, PomodoroMode } from "../types";

interface SubmodeBarProps {
  currentTab: TimerTab;
  pomoMode: PomodoroMode;
  clockFullDate: string;
  lapsCount: number;
  isLapsOpen: boolean;
  onToggleLaps: () => void;
  /** true khi đồng hồ focus đang chạy — chấm trạng thái nhịp theo. */
  isRunning?: boolean;
}

const MODE_STATUS: Record<
  PomodoroMode,
  {
    label: string;
    text: string;
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
  }
> = {
  focus: {
    label: "Đang tập trung",
    text: "text-emerald-300",
    icon: FlameIcon,
    iconColor: "text-orange-400",
  },
  short_break: {
    label: "Nghỉ ngắn",
    text: "text-sky-300",
    icon: CoffeeIcon,
    iconColor: "text-amber-200",
  },
  long_break: {
    label: "Nghỉ dài",
    text: "text-violet-300",
    icon: MoonStarsIcon,
    iconColor: "text-violet-200",
  },
};

export function SubmodeBar({
  currentTab,
  pomoMode,
  clockFullDate,
  lapsCount,
  isLapsOpen,
  onToggleLaps,
  isRunning = false,
}: SubmodeBarProps) {
  // Tab pomodoro chỉ hiển thị 1 trạng thái hiện tại (chuyển phase tự động
  // khi hết giờ, muốn qua nhanh thì pause rồi bấm Bỏ qua).
  const status = MODE_STATUS[pomoMode];
  const reduceMotion = useReducedMotion();
  // Icon mini động bên trái chữ: lửa bập bùng lúc học, cà phê lắc nhẹ
  // lúc nghỉ ngắn, trăng sao nhấp nháy lúc nghỉ dài. Tạm dừng thì đứng yên.
  // Không dot, không nền, không viền.
  const playful = isRunning && !reduceMotion;
  const StatusIcon = status.icon;
  const iconDance =
    pomoMode === "focus"
      ? { scale: [1, 1.18, 0.94, 1.1, 1], rotate: [0, -7, 6, -3, 0], opacity: [1, 0.85, 1, 0.9, 1] }
      : pomoMode === "short_break"
        ? { rotate: [0, -9, 0], y: [0, -2, 0] }
        : { rotate: [0, 8, 0], opacity: [1, 0.6, 1] };
  const iconTempo = pomoMode === "focus" ? 1.6 : 2.4;
  return (
    <div className="h-8 flex items-center justify-center mb-2">
      {currentTab === "pomodoro" ? (
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={status.label}
            role="status"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`flex items-center gap-2 text-sm font-bold drop-shadow-md h-8 ${status.text}`}
          >
            <motion.span
              aria-hidden="true"
              className={`flex ${status.iconColor} ${playful ? "" : "opacity-70"}`}
              animate={playful ? iconDance : { scale: 1, rotate: 0, opacity: 1, y: 0 }}
              transition={
                playful
                  ? { duration: iconTempo, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 0.15 }
              }
            >
              <StatusIcon className="w-4 h-4" />
            </motion.span>
            <span>{status.label}</span>
          </motion.p>
        </AnimatePresence>
      ) : currentTab === "clock" ? (
        <div className="text-xs sm:text-sm font-semibold text-white/90 tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
          {clockFullDate}
        </div>
      ) : lapsCount > 0 ? (
        <button
          onClick={onToggleLaps}
          className={`px-3 py-0.5 rounded-full text-xs font-bold transition-all cursor-pointer border backdrop-blur-md shadow-[0_2px_12px_rgba(0,0,0,0.6)] ${
            isLapsOpen
              ? "bg-white text-black border-white font-extrabold shadow-sm"
              : "bg-black/40 text-white border-white/25 hover:bg-black/55 hover:border-white/40"
          }`}
        >
          {lapsCount} vòng đã ghi
        </button>
      ) : null}
    </div>
  );
}
