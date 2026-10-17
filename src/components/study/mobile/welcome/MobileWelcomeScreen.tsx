"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SparkleIcon, ArrowRightIcon } from "@phosphor-icons/react";
import { ZenStudyLogo } from "@/components/study/brand/ZenStudyLogo";
import { getGreeting } from "@/components/study/pomodoro/utils/timer-formatters";

interface MobileWelcomeScreenProps {
  isMobile: boolean;
  currentSceneName?: string;
  onEnter?: () => void;
}

/**
 * Màn hình chào mừng (Welcome / Splash Screen) chuyên nghiệp dành riêng cho điện thoại.
 * Xuất hiện khi mở app hoặc khi ứng dụng bị tải lại (reload) trên điện thoại,
 * giúp che đi thời gian tải tài nguyên và tạo cảm giác như một ứng dụng cài đặt chính thống.
 */
export const MobileWelcomeScreen: React.FC<MobileWelcomeScreenProps> = ({
  isMobile,
  currentSceneName,
  onEnter,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [greeting, setGreeting] = useState("");

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    onEnter?.();
  }, [onEnter]);

  useEffect(() => {
    setGreeting(getGreeting());

    // Tự động chuyển vào không gian học sau 2.4 giây nếu người dùng không bấm
    const autoDismissTimer = setTimeout(() => {
      handleDismiss();
    }, 2400);

    return () => clearTimeout(autoDismissTimer);
  }, [handleDismiss]);

  if (!isMobile) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="mobile-welcome-splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
          className="fixed inset-0 z-[100] flex flex-col justify-between items-center bg-slate-950 text-white select-none overflow-hidden px-6 pt-safe pb-safe touch-none"
        >
          {/* Nền hiệu ứng hào quang ánh sáng tinh tế */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(56,189,248,0.12),transparent_65%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_75%,rgba(16,185,129,0.08),transparent_60%)] pointer-events-none" />

          {/* Góc trên: Nhãn phiên bản & trạng thái */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="w-full flex items-center justify-between pt-6 text-[11px] text-slate-400 font-medium"
          >
            <span className="flex items-center gap-1.5 text-sky-400/90 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Sẵn sàng học tập
            </span>
            <span className="text-slate-500 font-mono">ZenStudy v1.0</span>
          </motion.div>

          {/* Trung tâm: Logo & Lời chào thân thiện */}
          <div className="flex flex-col items-center text-center my-auto w-full max-w-xs">
            {/* Logo linh vật với hiệu ứng nhịp thở nhẹ nhàng */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="relative mb-6"
            >
              <div className="absolute inset-0 rounded-3xl bg-sky-500/20 blur-xl scale-125 animate-pulse" />
              <div className="relative w-20 h-20 rounded-3xl bg-white/[0.08] backdrop-blur-xl border border-white/20 shadow-[0_16px_36px_rgba(0,0,0,0.8)] flex items-center justify-center p-3.5">
                <ZenStudyLogo variant="icon" className="w-full h-full" priority />
              </div>
            </motion.div>

            {/* Tên thương hiệu */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.35 }}
              className="mb-2"
            >
              <ZenStudyLogo variant="full" className="h-8 w-auto mx-auto" priority />
            </motion.div>

            {/* Lời chào theo thời gian trong ngày */}
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.35 }}
              className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed px-2"
            >
              {greeting || "Chúc bạn một ngày học tập thật tập trung và hiệu quả"}
            </motion.p>

            {currentSceneName && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35, duration: 0.35 }}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-[11px] text-slate-400"
              >
                <SparkleIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>Không gian: <strong className="text-slate-200 font-semibold">{currentSceneName}</strong></span>
              </motion.div>
            )}
          </div>

          {/* Dưới cùng: Thanh tiến trình chuẩn bị & Nút vào bàn học */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="w-full max-w-xs flex flex-col items-center gap-3 pb-6"
          >
            {/* Thanh tiến trình tự chạy thể hiện app đã sẵn sàng */}
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2.2, ease: "easeInOut" }}
                className="h-full bg-gradient-to-r from-sky-400 to-emerald-400"
              />
            </div>

            {/* Nút bấm Vào học ngay */}
            <button
              onClick={handleDismiss}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(56,189,248,0.35)] active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>Vào bàn học ngay</span>
              <ArrowRightIcon className="w-4 h-4" weight="bold" />
            </button>
            <span className="text-[10px] text-slate-500">Tự động vào sau giây lát...</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
