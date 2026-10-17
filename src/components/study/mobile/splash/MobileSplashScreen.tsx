"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

export interface MobileSplashScreenProps {
  /** Thời lượng hiển thị splash screen (ms), mặc định 1600ms */
  duration?: number;
  /** Callback kích hoạt khi splash screen đã chạy xong và mờ dần */
  onFinish?: () => void;
  /** Buộc hiển thị (dùng khi kiểm thử hoặc mở thủ công) */
  forceShow?: boolean;
}

const STORAGE_KEY = "zenstudy_mobile_splash_completed";

/**
 * MobileSplashScreen - Màn hình khởi động (Splash Screen / Launch Screen) chuyên nghiệp cho Mobile:
 * - Chuẩn Cinematic Dark Glassmorphism theo docs/mobile-style-guide.md.
 * - Hiển thị biểu tượng Logo thương hiệu ZenStudy với hiệu ứng phát sáng Ambient Aura breathing.
 * - Thanh tiến trình nạp tài nguyên mượt mà với trạng thái "Đang chuẩn bị không gian tĩnh lặng...".
 * - Tự động thoát với hiệu ứng Dissolve & Zoom-out điện ảnh sau khi nạp xong.
 */
export const MobileSplashScreen: React.FC<MobileSplashScreenProps> = ({
  duration = 1600,
  onFinish,
  forceShow = false,
}) => {
  const [hasMounted, setHasMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Đang khởi tạo không gian...");
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    setHasMounted(true);
    if (forceShow) {
      setIsVisible(true);
      return;
    }

    try {
      const shown = sessionStorage.getItem(STORAGE_KEY);
      if (!shown) {
        setIsVisible(true);
      }
    } catch {
      setIsVisible(true);
    }
  }, [forceShow]);

  // Điều khiển thanh tiến trình và các trạng thái loading
  useEffect(() => {
    if (!isVisible) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const currentProgress = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(currentProgress);

      if (currentProgress >= 30 && currentProgress < 75) {
        setStatusText("Đang nạp âm thanh & bối cảnh...");
      } else if (currentProgress >= 75 && currentProgress < 100) {
        setStatusText("Sẵn sàng tập trung...");
      }

      if (elapsed >= duration) {
        clearInterval(interval);
        try {
          sessionStorage.setItem(STORAGE_KEY, "true");
        } catch {}

        // Đợi 200ms để người dùng cảm nhận được vạch 100% trước khi fade out
        setTimeout(() => {
          setIsVisible(false);
          setTimeout(() => {
            onFinishRef.current?.();
          }, 450); // Khớp với thời gian exit animation
        }, 200);
      }
    }, 25);

    return () => clearInterval(interval);
  }, [isVisible, duration]);

  if (!hasMounted) return null;

  const content = (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="mobile-splash-screen"
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            scale: 1.05,
            filter: "blur(8px)",
            transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
          }}
          className="fixed inset-0 z-[99999] flex flex-col justify-between items-center bg-[#0B0F1A] text-white select-none pointer-events-auto touch-none overflow-hidden sm:hidden"
          role="dialog"
          aria-label="Màn hình khởi động ứng dụng"
          aria-modal="true"
        >
          {/* Hào quang nền Ambient Breathing Glow */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
            <motion.div
              animate={{
                scale: [1, 1.15, 1],
                opacity: [0.35, 0.55, 0.35],
              }}
              transition={{
                duration: 2.8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="w-[340px] h-[340px] rounded-full bg-gradient-to-tr from-amber-500/20 via-emerald-500/15 to-transparent blur-3xl pointer-events-none"
            />
            {/* Lưới hạt ánh sáng tinh tế */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] opacity-40 pointer-events-none" />
          </div>

          {/* Khoảng đệm đỉnh an toàn tai thỏ */}
          <div className="w-full pt-safe" />

          {/* Khu vực Trung tâm: Icon Logo, Tên thương hiệu & Slogan */}
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: 0.6,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="relative z-10 flex flex-col items-center text-center px-6"
          >
            {/* Hộp biểu tượng kính nổi Squircle */}
            <div className="relative mb-5">
              <motion.div
                animate={{
                  boxShadow: [
                    "0 0 35px rgba(251,191,36,0.15)",
                    "0 0 55px rgba(16,185,129,0.25)",
                    "0 0 35px rgba(251,191,36,0.15)",
                  ],
                }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="w-20 h-20 rounded-[22px] bg-white/[0.06] border border-white/20 backdrop-blur-2xl p-4 flex items-center justify-center shadow-2xl relative"
              >
                <Image
                  src="/brand/zenstudy-logo-icon.svg"
                  alt="ZenStudy Logo Icon"
                  width={48}
                  height={48}
                  priority
                  className="object-contain drop-shadow-md select-none pointer-events-none"
                />
              </motion.div>

              {/* Vòng tia sáng trang trí xung quanh */}
              <div className="absolute -inset-1 rounded-[26px] border border-white/10 pointer-events-none" />
            </div>

            {/* Tên thương hiệu */}
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className="text-2xl font-bold tracking-[0.2em] text-white uppercase drop-shadow-sm flex items-center gap-1.5"
            >
              <span>ZEN</span>
              <span className="text-amber-400">STUDY</span>
            </motion.h1>

            {/* Slogan */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.5 }}
              className="text-[11px] font-medium tracking-[0.16em] uppercase text-white/50 mt-1.5"
            >
              Không gian học tập & làm việc sâu
            </motion.p>
          </motion.div>

          {/* Khu vực Đáy: Progress Bar, Status Text & Footer thương hiệu */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="relative z-10 w-full flex flex-col items-center px-8 pb-safe pb-8"
          >
            {/* Thanh tiến trình siêu mỏng chuẩn iOS Launch */}
            <div className="w-48 max-w-full h-1 rounded-full bg-white/10 overflow-hidden relative border border-white/5 shadow-inner">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-400 via-emerald-400 to-amber-300 rounded-full"
                style={{ width: `${progress}%` }}
                transition={{ ease: "easeOut", duration: 0.05 }}
              />
            </div>

            {/* Dòng trạng thái nạp dữ liệu */}
            <p className="text-[11px] font-medium text-white/60 mt-3 h-4 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{statusText}</span>
            </p>

            {/* Bản quyền / Nhà phát triển */}
            <div className="mt-6 flex items-center gap-2 text-[10px] tracking-widest text-white/30 uppercase font-mono">
              <span>ZENSTUDY SPACE</span>
              <span>•</span>
              <span>EST. 2026</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
};
