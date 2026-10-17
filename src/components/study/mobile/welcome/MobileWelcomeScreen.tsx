"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SparkleIcon, ArrowRightIcon } from "@phosphor-icons/react";
import { ZenStudyLogo } from "@/components/study/brand/ZenStudyLogo";

interface MobileWelcomeScreenProps {
  /** Tên bối cảnh hiện tại (nếu có) để hiển thị thân thiện */
  sceneName?: string;
  /** Callback kích hoạt khi bắt đầu vào app */
  onStart?: () => void;
}

function getWelcomeGreeting(): { greeting: string; subtitle: string; emoji: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return {
      greeting: "Chào buổi sáng!",
      subtitle: "Chúc bạn một ngày học tập ngập tràn cảm hứng và năng lượng.",
      emoji: "☀️",
    };
  }
  if (hour >= 12 && hour < 18) {
    return {
      greeting: "Chào buổi chiều!",
      subtitle: "Cùng giữ nhịp tập trung và hoàn thành các mục tiêu hôm nay nhé.",
      emoji: "🌿",
    };
  }
  if (hour >= 18 && hour < 23) {
    return {
      greeting: "Chào buổi tối!",
      subtitle: "Thả lỏng tâm trí và bắt đầu phiên học tập thật hiệu quả nào.",
      emoji: "✨",
    };
  }
  return {
    greeting: "Chào cú đêm!",
    subtitle: "Đêm đã khuya rồi, bạn nhớ chú ý sức khỏe và nghỉ ngơi điều độ nhé.",
    emoji: "🌙",
  };
}

export const MobileWelcomeScreen = React.memo(function MobileWelcomeScreen({
  sceneName,
  onStart,
}: MobileWelcomeScreenProps) {
  const [isOpen, setIsOpen] = useState(true);
  const greetingData = useMemo(() => getWelcomeGreeting(), []);

  const handleDismiss = useCallback(() => {
    setIsOpen(false);
    onStart?.();
  }, [onStart]);

  // Tự động vào app sau 3.2 giây nếu người dùng không chạm vào màn hình
  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss();
    }, 3200);

    return () => clearTimeout(timer);
  }, [handleDismiss]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="mobile-welcome-screen"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{
            opacity: 0,
            scale: 1.05,
            filter: "blur(12px)",
            transition: { duration: 0.45, ease: [0.32, 0.72, 0, 1] },
          }}
          onClick={handleDismiss}
          className="fixed inset-0 z-[100] flex flex-col justify-between bg-slate-950/95 backdrop-blur-2xl text-white select-none overflow-hidden pt-safe pb-safe cursor-pointer"
          aria-label="Màn hình chào mừng ZenStudy"
        >
          {/* Vùng phát sáng môi trường nhẹ ở trung tâm */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(56,189,248,0.14)_0%,rgba(16,185,129,0.06)_40%,transparent_70%)] pointer-events-none" />

          {/* Vùng trên cùng: Huy hiệu trạng thái */}
          <div className="relative z-10 w-full px-6 pt-6 flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.07] border border-white/10 text-[11px] font-medium text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Không gian tập trung</span>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          {/* Vùng trung tâm: Logo, lời chào và thông điệp truyền cảm hứng */}
          <div className="relative z-10 w-full px-6 flex flex-col items-center text-center -mt-4">
            {/* Logo Squircle phát sáng nhẹ nhàng */}
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative mb-5"
            >
              <div className="absolute inset-0 rounded-3xl bg-cyan-400/20 blur-xl animate-pulse" />
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-b from-white/15 to-white/5 border border-white/20 shadow-[0_12px_32px_rgba(0,0,0,0.6)] flex items-center justify-center backdrop-blur-md">
                <ZenStudyLogo variant="icon" className="w-12 h-12" priority />
              </div>
            </motion.div>

            {/* Tên thương hiệu */}
            <motion.h1
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="text-2xl font-bold tracking-tight text-white flex items-center gap-1.5"
            >
              ZenStudy Space
            </motion.h1>

            <motion.p
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="text-xs text-cyan-300/80 font-medium tracking-wide uppercase mt-0.5"
            >
              Học bài tập trung & Nhạc Lo-fi
            </motion.p>

            {/* Lời chào theo buổi */}
            <motion.div
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.22, duration: 0.45 }}
              className="mt-6 px-4 py-3 rounded-2xl bg-white/[0.05] border border-white/10 max-w-xs shadow-inner"
            >
              <p className="text-sm font-semibold text-slate-100 flex items-center justify-center gap-1.5">
                <span>{greetingData.emoji}</span>
                <span>{greetingData.greeting}</span>
              </p>
              <p className="text-xs text-slate-300/90 mt-1 leading-relaxed">
                {greetingData.subtitle}
              </p>
              {sceneName && (
                <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-center gap-1 text-[11px] text-slate-400">
                  <SparkleIcon className="w-3 h-3 text-cyan-400" />
                  <span>Bối cảnh: <strong className="text-slate-200">{sceneName}</strong></span>
                </div>
              )}
            </motion.div>
          </div>

          {/* Vùng đáy: Nút bắt đầu & thanh tự động đếm ngược */}
          <div className="relative z-10 w-full px-6 pb-8 flex flex-col items-center">
            {/* Nút Bắt đầu học ngay */}
            <motion.button
              type="button"
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss();
              }}
              className="w-full max-w-xs h-13 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-emerald-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-[0_8px_28px_rgba(56,189,248,0.35)] active:scale-95 transition-transform"
            >
              <span>BẮT ĐẦU HỌC NGAY</span>
              <ArrowRightIcon className="w-4 h-4" weight="bold" />
            </motion.button>

            {/* Dòng ghi chú tự động vào */}
            <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1">
              <span>Chạm bất kỳ đâu để vào</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-500">Tự động sau 3s</span>
            </p>

            {/* Thanh tiến trình tự động vào */}
            <div className="w-36 h-1 rounded-full bg-white/10 overflow-hidden mt-2">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 3.2, ease: "linear" }}
                className="h-full bg-cyan-400/80 rounded-full"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

MobileWelcomeScreen.displayName = "MobileWelcomeScreen";
