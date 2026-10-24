"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface MobileSplashScreenProps {
  /** Thời lượng tối thiểu hiển thị hiệu ứng thị giác (ms), mặc định 2050ms */
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

type SplashStage = "A" | "B" | "C";

const STORAGE_KEY = "zenstudy_mobile_splash_completed";

const checkPrefersReducedMotion = (): boolean => {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

/**
 * MobileSplashScreen - Màn hình khởi động (Splash Screen / Launch Screen) chuyên nghiệp cho Mobile:
 * - Kiến trúc 3 chặng tuần tự độc lập (Stage A -> Stage B -> Stage C), không phụ thuộc vào chu kỳ % đo đếm:
 *   + Chặng A (0 - 0.7s): Mắt linh vật chớp 2 lần -> mờ dần, tắt hẳn.
 *   + Chặng B (0.7 - 1.25s): Logo hiện ra (phóng to từ 0.6 -> 1).
 *   + Chặng C (1.25 - 1.8s): Chữ "ZEN STUDY" trượt mở mượt mà bằng GPU transform/opacity.
 *   + Giữ nguyên C (1.8 - 2.05s) và chờ bối cảnh ngầm nạp xong (isReady).
 * - Nếu nền chưa tải xong: Đứng yên ở C (kèm nhịp sáng nhẹ), tuyệt đối không quay lại A/B.
 * - Hỗ trợ prefers-reduced-motion (vào thẳng C) và xem thử qua ?splash=preview.
 */
export const MobileSplashScreen: React.FC<MobileSplashScreenProps> = ({
  duration = 2050,
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

  const [stage, setStage] = useState<SplashStage>(() => {
    return checkPrefersReducedMotion() ? "C" : "A";
  });
  const [timelineDone, setTimelineDone] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const [isUrlPreview, setIsUrlPreview] = useState(false);

  const onFinishRef = useRef(onFinish);
  const isReadyRef = useRef(isReady);
  const hasExitedRef = useRef(false);
  const timelineDoneRef = useRef(false);

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

  // Tính toán thời gian các chặng theo duration thực tế (scale tỉ lệ chính xác)
  const totalDuration = duration ?? 2050;
  const timeScale = totalDuration / 2050;
  const stageADuration = Math.round(700 * timeScale);
  const stageBDuration = Math.round(550 * timeScale);
  const stageCDuration = Math.round(550 * timeScale);
  const holdCDuration = Math.round(250 * timeScale);

  // Xử lý đóng màn hình khi đủ điều kiện
  const performExit = useCallback(() => {
    if (hasExitedRef.current) return;
    hasExitedRef.current = true;

    if (!isPreviewMode) {
      try {
        sessionStorage.setItem(STORAGE_KEY, "true");
      } catch {}
    }

    // Ở chế độ xem thử (preview mode), dừng lại ở C để soi giao diện, không tự đóng
    if (isPreviewMode) return;

    setIsVisible(false);
    setTimeout(() => {
      onFinishRef.current?.();
    }, 450); // Khớp với transition duration của exit animation
  }, [isPreviewMode]);

  // Điều khiển 3 chặng nối tiếp cố định bằng timer độc lập
  useEffect(() => {
    if (!isVisible) return;

    const isReducedMotion = checkPrefersReducedMotion();
    if (isReducedMotion) {
      setStage("C");
      const timer = setTimeout(() => {
        timelineDoneRef.current = true;
        setTimelineDone(true);
        if (isReadyRef.current) {
          performExit();
        }
      }, totalDuration);
      return () => clearTimeout(timer);
    }

    // Reset về chặng A khi bắt đầu
    setStage("A");
    timelineDoneRef.current = false;
    setTimelineDone(false);

    // Chặng A kết thúc lúc tA -> bắt đầu chặng B
    const timerB = setTimeout(() => {
      setStage("B");
    }, stageADuration);

    // Chặng B kết thúc lúc (tA + tB) -> bắt đầu chặng C
    const timerC = setTimeout(() => {
      setStage("C");
    }, stageADuration + stageBDuration);

    // Toàn bộ timeline hoàn tất (sau khi giữ C đủ thời gian)
    const timerDone = setTimeout(() => {
      timelineDoneRef.current = true;
      setTimelineDone(true);
      // Nếu dữ liệu ngầm đã sẵn sàng, thoát ngay
      if (isReadyRef.current) {
        performExit();
      }
    }, stageADuration + stageBDuration + stageCDuration + holdCDuration);

    return () => {
      clearTimeout(timerB);
      clearTimeout(timerC);
      clearTimeout(timerDone);
    };
  }, [
    isVisible,
    totalDuration,
    stageADuration,
    stageBDuration,
    stageCDuration,
    holdCDuration,
    replayKey,
    performExit,
  ]);

  // Đồng bộ khi dữ liệu nạp xong trễ hơn timeline hiệu ứng
  useEffect(() => {
    if (!isVisible) return;

    if (isReady && timelineDoneRef.current) {
      performExit();
    }
  }, [isVisible, isReady, performExit]);

  // Bộ định thời an toàn: cưỡng chế đóng nếu vượt quá maxDuration tránh kẹt người dùng
  useEffect(() => {
    if (!isVisible) return;

    const maxTimer = setTimeout(() => {
      performExit();
    }, maxDuration);

    return () => clearTimeout(maxTimer);
  }, [isVisible, maxDuration, performExit]);

  // Nút chạy lại hiệu ứng trong chế độ xem thử
  const handleReplay = useCallback(() => {
    hasExitedRef.current = false;
    timelineDoneRef.current = false;
    setTimelineDone(false);
    setStage(checkPrefersReducedMotion() ? "C" : "A");
    setReplayKey((k) => k + 1);
    setIsVisible(true);
  }, []);

  // Nút đóng màn hình trong chế độ xem thử
  const handleClose = useCallback(() => {
    hasExitedRef.current = true;
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

          {/* 1. LỚP NỀN: Hào quang băng tuyết tối giản & Bụi sao chạy lặp độc lập bằng GPU */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
            {/* Vầng sáng cực quang xanh tuyết dịu mắt */}
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.2, 0.35, 0.2],
              }}
              transition={{
                duration: 3.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="w-[420px] h-[420px] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.18)_0%,rgba(148,163,184,0.06)_45%,transparent_70%)] blur-3xl pointer-events-none"
            />

            {/* Các vòng sóng đồng tâm hữu cơ tỏa nhẹ theo nhịp thở độc lập */}
            {[1, 2].map((ringIdx) => (
              <motion.div
                key={`ripple-ring-${ringIdx}`}
                animate={{
                  scale: [0.95, 1.05, 0.95],
                  opacity: [0.12, 0.24, 0.12],
                  rotate: [0, ringIdx % 2 === 0 ? 8 : -8, 0],
                }}
                transition={{
                  duration: 3.5 + ringIdx * 0.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{
                  width: 160 + ringIdx * 80,
                  height: 160 + ringIdx * 80,
                  borderRadius: "44% 56% 62% 38% / 42% 48% 52% 58%",
                }}
                className="absolute border border-sky-400/20 shadow-[0_0_25px_rgba(56,189,248,0.1)] pointer-events-none"
              />
            ))}

            {/* Đốm hạt bụi sao băng tuyết trôi nhẹ lơ lửng độc lập */}
            {[
              { x: -90, y: -70, size: 2.5, delay: 0 },
              { x: 110, y: -50, size: 3, delay: 0.4 },
              { x: -95, y: 65, size: 2, delay: 0.8 },
              { x: 80, y: 80, size: 2.5, delay: 0.2 },
            ].map((p, i) => (
              <motion.div
                key={`particle-${i}`}
                animate={{
                  opacity: [0.2, 0.75, 0.2],
                  scale: [0.85, 1.2, 0.85],
                  y: [p.y, p.y - 10, p.y],
                }}
                transition={{
                  duration: 2.8,
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

          {/* 2. KHU VỰC TRUNG TÂM: Biểu tượng Logo & Dòng chữ thương hiệu trượt mở */}
          <div className="relative z-10 flex items-center justify-center w-full px-4 sm:px-6 pointer-events-none">
            <motion.div
              animate={{
                x: stage === "C" ? 0 : 106,
              }}
              transition={{
                duration: stageCDuration / 1000,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="relative flex items-center gap-2.5 sm:gap-3 max-w-full"
            >
              {/* Khu vực Logo / Mắt linh vật */}
              <div className="relative shrink-0 flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14">
                {/* Chặng A: Hai mắt linh vật chớp mắt 2 lần -> mờ dần, tắt hẳn (0 - 0.7s) */}
                {stage === "A" && (
                  <motion.div
                    initial={{ opacity: 1, scale: 1 }}
                    animate={{
                      opacity: [1, 1, 0],
                      scale: [1, 1, 0.4],
                    }}
                    transition={{
                      duration: stageADuration / 1000,
                      times: [0, 0.72, 1],
                      ease: "easeOut",
                    }}
                    className="absolute inset-0 flex items-center justify-center gap-2 pointer-events-none select-none"
                  >
                    {/* Mắt trái */}
                    <motion.div
                      animate={{
                        scaleY: [1, 1, 0.12, 1, 1, 0.12, 1],
                        scaleX: [1, 1, 1.25, 1, 1, 1.25, 1],
                      }}
                      transition={{
                        duration: (stageADuration * 0.72) / 1000,
                        times: [0, 0.2, 0.35, 0.5, 0.7, 0.85, 1],
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
                        duration: (stageADuration * 0.72) / 1000,
                        times: [0, 0.2, 0.35, 0.5, 0.7, 0.85, 1],
                        ease: "easeInOut",
                      }}
                      className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_12px_#ffffff]"
                    />
                  </motion.div>
                )}

                {/* Chặng B & C: Biểu tượng ZenStudy Logo Icon (Phóng to từ 0.6 -> 1 ở chặng B) */}
                <motion.div
                  initial={stage === "A" ? { opacity: 0, scale: 0.6 } : false}
                  animate={{
                    opacity: stage === "A" ? 0 : 1,
                    scale:
                      stage === "A"
                        ? 0.6
                        : stage === "C" && timelineDone && !isReady
                        ? [1, 1.04, 1]
                        : 1,
                  }}
                  transition={{
                    opacity: {
                      duration: stageBDuration / 1000,
                      ease: [0.16, 1, 0.3, 1],
                    },
                    scale:
                      stage === "C" && timelineDone && !isReady
                        ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
                        : {
                            duration: stageBDuration / 1000,
                            ease: [0.16, 1, 0.3, 1],
                          },
                  }}
                  className={cn(
                    "relative flex items-center justify-center",
                    stage === "A" && "pointer-events-none"
                  )}
                >
                  <Image
                    src="/brand/zenstudy-logo-icon.svg"
                    alt="ZenStudy Logo Icon"
                    width={48}
                    height={48}
                    priority
                    className="object-contain drop-shadow-[0_0_20px_rgba(56,189,248,0.45)] select-none pointer-events-none"
                  />
                </motion.div>
              </div>

              {/* Chặng C: Dòng chữ thương hiệu trượt mở sang bên phải (Slide reveal qua transform + opacity) */}
              <motion.div
                initial={false}
                animate={{
                  opacity: stage === "C" ? 1 : 0,
                  x: stage === "C" ? 0 : -8,
                }}
                transition={{
                  duration: stageCDuration / 1000,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className={cn(
                  "whitespace-nowrap text-left flex flex-col justify-center pointer-events-none select-none",
                  stage !== "C" && "pointer-events-none"
                )}
              >
                <h1 className="text-xl sm:text-2xl font-bold tracking-[0.14em] uppercase flex items-center gap-1.5 leading-none">
                  <span className="text-white drop-shadow-sm">ZEN</span>
                  <span className="text-sky-400 drop-shadow-[0_0_14px_rgba(56,189,248,0.5)]">STUDY</span>
                </h1>
                <p className="text-[10px] sm:text-[11px] font-medium tracking-[0.05em] sm:tracking-[0.08em] uppercase text-slate-400 mt-1 leading-none">
                  Không gian học tập & làm việc sâu
                </p>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
};

