"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface MobileSplashScreenProps {
  /** Thời lượng tối thiểu hiển thị hiệu ứng thị giác (ms), mặc định 1600ms */
  duration?: number;
  /** Tín hiệu báo dữ liệu/bối cảnh ngầm đã nạp xong (mặc định: true) */
  isReady?: boolean;
  /** Thời lượng tối đa (ms) trước khi cưỡng chế đóng Splash để tránh người dùng bị kẹt (mặc định 5000ms) */
  maxDuration?: number;
  /** Callback kích hoạt khi splash screen đã chạy xong và mờ dần */
  onFinish?: () => void;
  /** Buộc hiển thị (dùng khi kiểm thử hoặc mở thủ công) */
  forceShow?: boolean;
  /** Chế độ xem thử trong lúc code: luôn hiện, không tự đóng, có nút chạy lại */
  preview?: boolean;
}

const STORAGE_KEY = "zenstudy_mobile_splash_completed";

/**
 * MobileSplashScreen - Màn hình khởi động (Splash Screen / Launch Screen) chuyên nghiệp cho Mobile:
 * - Chuẩn Cinematic Dark Glassmorphism theo docs/mobile-style-guide.md.
 * - Hiển thị biểu tượng Logo thương hiệu ZenStudy với hiệu ứng phát sáng Ambient Aura breathing.
 * - Tự động đồng bộ chuẩn đôi: Chờ hiệu ứng mắt chớp + logo đủ thời gian tối thiểu (duration) VÀ chờ dữ liệu nền sẵn sàng (isReady).
 * - Tự động thoát với hiệu ứng Dissolve & Zoom-out điện ảnh sau khi nạp xong.
 * - Hỗ trợ chế độ xem thử tiện lợi (Preview Mode) khi truy cập ?splash=preview trên trình duyệt.
 */
export const MobileSplashScreen: React.FC<MobileSplashScreenProps> = ({
  duration = 1600,
  isReady = true,
  maxDuration = 5000,
  onFinish,
  forceShow = false,
  preview = false,
}) => {
  const [hasMounted, setHasMounted] = useState(false);
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    if (forceShow || preview) return true;
    try {
      const params = new URLSearchParams(window.location.search);
      const splash = params.get("splash");
      const p = params.get("preview");
      if (splash === "preview" || splash === "true" || splash === "1" || p === "splash") {
        return true;
      }
      return !sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return true;
    }
  });
  const [progress, setProgress] = useState(0);
  const [isUrlPreview, setIsUrlPreview] = useState(false);
  const [replayCount, setReplayCount] = useState(0);
  const onFinishRef = useRef(onFinish);
  const isReadyRef = useRef(isReady);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    isReadyRef.current = isReady;
  }, [isReady]);

  // Kiểm tra tham số preview trên URL (?splash=preview, ?splash=true, ?preview=splash)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const splash = params.get("splash");
      const p = params.get("preview");
      if (splash === "preview" || splash === "true" || splash === "1" || p === "splash") {
        setIsUrlPreview(true);
      }
    }
  }, []);

  const isPreviewMode = preview || isUrlPreview;

  useEffect(() => {
    setHasMounted(true);
    if (forceShow || isPreviewMode) {
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
  }, [forceShow, isPreviewMode]);

  // Điều khiển thanh tiến trình và đồng bộ kép (Thời gian hiệu ứng tối thiểu VÀ Dữ liệu đã sẵn sàng)
  useEffect(() => {
    if (!isVisible) return;

    const startTime = Date.now();
    let isTerminating = false;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const readyNow = isReadyRef.current;
      const reachedMinDuration = elapsed >= duration;
      const reachedMaxTimeout = elapsed >= maxDuration;

      // 1. Giai đoạn chưa đủ thời gian tối thiểu (elapsed < duration):
      //    Tiến trình chạy mượt mà từ 0% tới 100% nếu đã ready, hoặc tới 90% nếu đang chờ dữ liệu
      if (!reachedMinDuration) {
        const visualProgress = readyNow
          ? Math.min(100, Math.round((elapsed / duration) * 100))
          : Math.min(90, Math.round((elapsed / duration) * 90));
        setProgress(visualProgress);
        return;
      }

      // 2. Giai đoạn đã đủ thời gian tối thiểu nhưng dữ liệu ngầm chưa sẵn sàng (và chưa chạm trần timeout):
      //    Tiến trình giữ nhích nhẹ từ 90% đến 96% để hiệu ứng tiếp tục sống động
      if (!readyNow && !reachedMaxTimeout) {
        const extraElapsed = elapsed - duration;
        const extraRange = Math.max(1, maxDuration - duration);
        const extraProgress = 90 + Math.min(6, Math.round((extraElapsed / extraRange) * 6));
        setProgress(extraProgress);
        return;
      }

      // 3. Hoàn tất khi ĐÃ ĐỦ thời gian tối thiểu VÀ (Dữ liệu đã sẵn sàng HOẶC quá thời gian chờ tối đa):
      if (!isTerminating) {
        isTerminating = true;
        setProgress(100);
        clearInterval(interval);

        // Ở chế độ xem thử (preview mode), dừng lại ở 100% để người lập trình soi giao diện, không tự đóng
        if (isPreviewMode) {
          return;
        }

        try {
          sessionStorage.setItem(STORAGE_KEY, "true");
        } catch {}

        // Đợi 250ms ở trạng thái 100% trước khi fade out
        setTimeout(() => {
          setIsVisible(false);
          setTimeout(() => {
            onFinishRef.current?.();
          }, 450); // Khớp với thời gian exit animation
        }, 250);
      }
    }, 25);

    return () => clearInterval(interval);
  }, [isVisible, duration, maxDuration, isPreviewMode, replayCount]);

  // Nút chạy lại hiệu ứng trong chế độ xem thử
  const handleReplay = useCallback(() => {
    setProgress(0);
    setIsVisible(true);
    setReplayCount((c) => c + 1);
  }, []);

  // Nút đóng màn hình trong chế độ xem thử
  const handleClose = useCallback(() => {
    setIsVisible(false);
    onFinishRef.current?.();
  }, []);

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
          className={cn(
            "fixed inset-0 z-[99999] flex items-center justify-center bg-[#05070D] text-white select-none pointer-events-auto touch-none overflow-hidden",
            !isPreviewMode && "sm:hidden"
          )}
          role="dialog"
          aria-label="Màn hình khởi động ứng dụng"
          aria-modal="true"
        >
          {/* Thanh công cụ xem thử dành cho Developer */}
          {isPreviewMode && (
            <div className="fixed top-3 right-3 sm:top-4 sm:right-4 z-[100000] flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/95 border border-sky-400/40 text-xs shadow-2xl backdrop-blur-xl pointer-events-auto">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse shrink-0" />
              <span className="text-sky-200 font-medium text-[11px] select-none">
                Chế độ xem thử
              </span>
              <button
                type="button"
                onClick={handleReplay}
                className="ml-1 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white font-medium text-[11px] transition-all cursor-pointer"
                title="Chạy lại hiệu ứng Splash"
              >
                Chạy lại
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="px-2 py-1 rounded-full bg-white/10 hover:bg-rose-500/30 active:scale-95 text-white/70 hover:text-white text-[11px] transition-all cursor-pointer"
                title="Đóng màn hình Splash"
              >
                Đóng
              </button>
            </div>
          )}

          {/* 1. LỚP NỀN: Hào quang băng tuyết tối giản (Frost Minimalist Glow) & Bụi sao */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
            {/* Vầng sáng cực quang xanh tuyết dịu mắt */}
            <motion.div
              animate={{
                scale: [1, 1.12, 1],
                opacity: [0.2, 0.4, 0.2],
              }}
              transition={{
                duration: 3.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="w-[420px] h-[420px] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.18)_0%,rgba(148,163,184,0.06)_45%,transparent_70%)] blur-3xl pointer-events-none"
            />

            {/* Các vòng sóng đồng tâm hữu cơ tỏa nhẹ theo nhịp thở (Organic Frost Ripples) */}
            {[1, 2, 3].map((ringIdx) => (
              <motion.div
                key={`ripple-ring-${ringIdx}`}
                animate={{
                  scale: progress < 65 ? [0.65 + ringIdx * 0.22, 1.05 + ringIdx * 0.25, 0.65 + ringIdx * 0.22] : 0.85,
                  opacity: progress < 60 ? [0.12, 0.38, 0.12] : 0.05,
                  rotate: [0, ringIdx % 2 === 0 ? 10 : -10, 0],
                }}
                transition={{
                  duration: 3 + ringIdx * 0.45,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{
                  width: 140 + ringIdx * 80,
                  height: 140 + ringIdx * 80,
                  borderRadius: "44% 56% 62% 38% / 42% 48% 52% 58%",
                }}
                className="absolute border border-sky-400/20 shadow-[0_0_25px_rgba(56,189,248,0.12)] pointer-events-none"
              />
            ))}

            {/* Đốm hạt bụi sao băng tuyết trôi nhẹ lơ lửng */}
            {[
              { x: -100, y: -75, size: 2.5, delay: 0 },
              { x: 120, y: -55, size: 3, delay: 0.35 },
              { x: -110, y: 70, size: 2, delay: 0.7 },
              { x: 85, y: 85, size: 2.5, delay: 0.2 },
              { x: -35, y: 125, size: 3, delay: 0.85 },
              { x: 45, y: -135, size: 2, delay: 0.5 },
            ].map((p, i) => (
              <motion.div
                key={`particle-${i}`}
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: progress < 70 ? [0.25, 0.85, 0.3] : [0.1, 0.35, 0.1],
                  scale: [0.8, 1.25, 0.8],
                  y: [p.y, p.y - 12, p.y],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  delay: p.delay,
                  ease: "easeInOut",
                }}
                style={{
                  width: p.size,
                  height: p.size,
                  left: `calc(50% + ${p.x}px)`,
                  top: `calc(50% + ${p.y}px)`,
                }}
                className="absolute rounded-full bg-white shadow-[0_0_8px_#38bdf8] pointer-events-none"
              />
            ))}
          </div>

          {/* 2. KHU VỰC TRUNG TÂM: Hạt nhân, Mắt linh vật thức giấc & Trượt mở thương hiệu */}
          <div className="relative z-10 flex items-center justify-center px-6">
            {/* Khu vực Biểu tượng Icon đứng một mình (không đựng trong khối vuông) */}
            <motion.div
              animate={{
                x: progress >= 65 ? -12 : 0,
                scale: progress >= 60 ? 1 : [0.94, 1.04, 0.94],
              }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="relative shrink-0 flex items-center justify-center w-14 h-14"
            >
              {/* Gợi ý A: Hai mắt linh vật chớp mắt thức giấc (xuất hiện khi progress < 60) */}
              <motion.div
                animate={{
                  opacity: progress < 60 ? 1 : 0,
                  scale: progress < 60 ? 1 : 0.3,
                }}
                transition={{ duration: 0.35 }}
                className="absolute inset-0 flex items-center justify-center gap-2.5 pointer-events-none"
              >
                {/* Mắt trái */}
                <motion.div
                  animate={{
                    scaleY: [1, 1, 0.12, 1, 1, 0.12, 1],
                    scaleX: [1, 1, 1.25, 1, 1, 1.25, 1],
                  }}
                  transition={{
                    duration: 1.6,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_12px_#ffffff]"
                />
                {/* Mắt phải */}
                <motion.div
                  animate={{
                    scaleY: [1, 1, 0.12, 1, 1, 0.12, 1],
                    scaleX: [1, 1, 1.25, 1, 1, 1.25, 1],
                  }}
                  transition={{
                    duration: 1.6,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_12px_#ffffff]"
                />
              </motion.div>

              {/* Biểu tượng ZenStudy Logo Icon đứng độc lập (Biến hình bừng sáng khi progress >= 60) */}
              <motion.div
                animate={{
                  opacity: progress >= 60 ? 1 : 0,
                  scale: progress >= 60 ? 1 : 0.45,
                }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="relative flex items-center justify-center"
              >
                <Image
                  src="/brand/zenstudy-logo-icon.svg"
                  alt="ZenStudy Logo Icon"
                  width={52}
                  height={52}
                  priority
                  className="object-contain drop-shadow-[0_0_20px_rgba(56,189,248,0.45)] select-none pointer-events-none"
                />
              </motion.div>
            </motion.div>

            {/* Dòng chữ thương hiệu trượt mở sang bên phải (Slide & Brand Reveal) */}
            <motion.div
              animate={{
                opacity: progress >= 65 ? 1 : 0,
                x: progress >= 65 ? 14 : -10,
                maxWidth: progress >= 65 ? "360px" : "0px",
              }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden whitespace-nowrap text-left flex flex-col justify-center"
            >
              <h1 className="text-xl sm:text-2xl font-bold tracking-[0.18em] uppercase flex items-center gap-1.5">
                <span className="text-white drop-shadow-sm">ZEN</span>
                <span className="text-sky-400 drop-shadow-[0_0_14px_rgba(56,189,248,0.5)]">STUDY</span>
              </h1>
              <p className="text-[10px] sm:text-[11px] font-medium tracking-[0.16em] uppercase text-slate-400 mt-1">
                Không gian học tập & làm việc sâu
              </p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
};
