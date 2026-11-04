"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface MobileSplashScreenProps {
  /** Thời tối thiểu giữ màn hình tĩnh trước khi chạy hiệu ứng (ms), mặc định 1600ms */
  duration?: number;
  /** Tín hiệu báo dữ liệu/bối cảnh ngầm đã nạp xong (mặc định: true) */
  isReady?: boolean;
  /** Thời tối đa (ms) trước khi cưỡng chế đóng Splash để tránh người bị kẹt (mặc định 5000ms) */
  maxDuration?: number;
  /** Callback kích hoạt khi splash screen đã mờ dần */
  onFinish?: () => void;
  /** Buộc hiển thị (dùng khi kiểm thử hoặc mở thủ công) */
  forceShow?: boolean;
  /** Chế độ xem thử trong lúc code: luôn hiện, không tự đóng, có nút chạy lại */
  preview?: boolean;
}

type SplashPhase = "loading" | "reveal";

const STORAGE_KEY = "zenstudy_mobile_splash_completed";
const REVEAL_DURATION = 800;

const checkPrefersReducedMotion = (): boolean => {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

/**
 * MobileSplashScreen - Màn hình khởi động cho Mobile:
 * - Giai đoạn "loading": logo + chữ hiện TĨNH ngay lập tức, không chạy animation,
 *   vì điện thoại đang bận tải code của cả ứng dụng nên animation lúc này sẽ bị giật.
 * - Khi app tải xong (isReady) và đã đủ thời gian tối thiểu: chạy hiệu ứng "reveal"
 *   MỘT LẦN (logo phóng nhẹ + vầng sáng bừng lên), rồi mờ dần biến mất.
 * - Không dùng filter drop-shadow trên logo (rất nặng trên WebView), thay bằng lớp glow mờ phía sau.
 * - Hỗ trợ prefers-reduced-motion (bỏ qua reveal, thoát ngay) và xem thử qua ?splash=preview.
 */
export const MobileSplashScreen = React.memo(function MobileSplashScreen({
  duration = 1600,
  isReady = true,
  maxDuration = 5000,
  onFinish,
  forceShow = false,
  preview = false,
}: MobileSplashScreenProps) {
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

  const [phase, setPhase] = useState<SplashPhase>("loading");
  const [replayKey, setReplayKey] = useState(0);
  const [isUrlPreview, setIsUrlPreview] = useState(false);
  // Nội dung chỉ hiện khi lớp pre-splash báo khung nhìn đã ổn định (tránh logo bị đẩy
  // xuống khi WebView cao thêm một dải thanh trạng thái ngay sau khung hình đầu).
  // Đọc cờ ngay lúc khởi tạo để khung hình React đầu tiên đã trùng khớp lớp tĩnh.
  const [contentReady, setContentReady] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const w = window as Window & { __zenSplashStable?: boolean };
    return w.__zenSplashStable === true;
  });
  // Ảnh logo của lớp React có thể mất vài khung hình để giải mã và vẽ; nếu bàn giao
  // sớm hơn, logo biến mất khoảng 2 khung hình ngay giữa hai lớp.
  const [logoReady, setLogoReady] = useState(false);
  const logoRef = useRef<HTMLImageElement | null>(null);

  const onFinishRef = useRef(onFinish);
  const isReadyRef = useRef(isReady);
  const hasExitedRef = useRef(false);
  const minTimeDoneRef = useRef(false);
  const phaseRef = useRef<SplashPhase>("loading");
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    isReadyRef.current = isReady;
  }, [isReady]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

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

  const performExit = useCallback(() => {
    if (hasExitedRef.current) return;
    hasExitedRef.current = true;

    if (!isPreviewMode) {
      try {
        sessionStorage.setItem(STORAGE_KEY, "true");
      } catch {}
    }

    // Xem thử: không đóng màn hình, trả về trạng thái tĩnh để soi giao diện
    if (isPreviewMode) {
      setPhase("loading");
      return;
    }

    setIsVisible(false);
    setTimeout(() => {
      onFinishRef.current?.();
    }, 400);
  }, [isPreviewMode]);

  // Chạy hiệu ứng reveal một lần rồi thoát (máy đã rảnh nên không giật)
  const startReveal = useCallback(() => {
    if (phaseRef.current !== "loading") return;

    if (checkPrefersReducedMotion()) {
      performExit();
      return;
    }

    setPhase("reveal");
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => {
      performExit();
    }, REVEAL_DURATION + 120);
  }, [performExit]);

  const tryStartReveal = useCallback(() => {
    if (!isVisible) return;
    if (isReadyRef.current && minTimeDoneRef.current) {
      startReveal();
    }
  }, [isVisible, startReveal]);

  // Đếm đủ thời gian tối thiểu giữ màn hình tĩnh (chế độ xem thử dùng maxDuration để không tự chạy)
  useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(
      () => {
        minTimeDoneRef.current = true;
        if (!isPreviewMode) {
          tryStartReveal();
        }
      },
      isPreviewMode ? maxDuration : duration
    );
    return () => clearTimeout(timer);
  }, [isVisible, duration, maxDuration, isPreviewMode, replayKey, tryStartReveal]);

  // Đồng bộ khi dữ liệu nạp xong trễ hơn mốc thời gian tối thiểu
  useEffect(() => {
    tryStartReveal();
  }, [isReady, tryStartReveal]);

  // Chờ khung nhìn ổn định rồi mới hiện nội dung splash (cờ do pre-splash-gate.js đặt).
  // Nếu cờ chưa có, tự đo chiều cao khung nhìn; quá 1500ms vẫn hiện để không treo giao diện.
  useEffect(() => {
    if (!isVisible || contentReady) return;
    const w = window as Window & { __zenSplashStable?: boolean };
    if (w.__zenSplashStable === true) {
      setContentReady(true);
      return;
    }
    let raf = 0;
    let lastH = -1;
    let stableSince = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      if (window.innerHeight !== lastH) {
        lastH = window.innerHeight;
        stableSince = now;
      }
      if (now - stableSince > 120 || now - startedAt > 1500) {
        setContentReady(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isVisible, contentReady]);

  // Ảnh có thể đã nằm sẵn trong cache (complete) trước khi gắn onLoad.
  useEffect(() => {
    if (!isVisible || logoReady) return;
    const img = logoRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setLogoReady(true);
      return;
    }
    const timer = setTimeout(() => setLogoReady(true), 800);
    return () => clearTimeout(timer);
  }, [isVisible, logoReady]);

  // Bộ định thời an toàn: cưỡng chế đóng nếu quá maxDuration tránh kẹt người dùng
  useEffect(() => {
    if (!isVisible) return;
    const maxTimer = setTimeout(() => {
      performExit();
    }, maxDuration);
    return () => clearTimeout(maxTimer);
  }, [isVisible, maxDuration, performExit]);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, []);

  // Gỡ lớp Splash tĩnh trong HTML: ngay nếu không cần hiện Splash,
  // ngược lại chờ tới khi nội dung Splash React thực sự hiện rồi mới gỡ (không để lộ khoảng trống)
  useEffect(() => {
    const removePreSplash = () => {
      const el = document.getElementById("pre-splash");
      if (el) el.remove();
    };

    if (!isVisible) {
      removePreSplash();
      return;
    }
    if (!contentReady || !logoReady) return;

    let raf = 0;
    const handOff = () => {
      if (document.getElementById("mobile-splash-screen")) {
        raf = requestAnimationFrame(() => {
          raf = requestAnimationFrame(removePreSplash);
        });
        return;
      }
      raf = requestAnimationFrame(handOff);
    };
    raf = requestAnimationFrame(handOff);

    return () => cancelAnimationFrame(raf);
  }, [isVisible, contentReady, logoReady]);

  // Nút chạy lại hiệu ứng trong chế độ xem thử: mô phỏng đúng flow thật
  const handleReplay = useCallback(() => {
    hasExitedRef.current = false;
    minTimeDoneRef.current = false;
    phaseRef.current = "loading";
    setPhase("loading");
    setReplayKey((k) => k + 1);
    setIsVisible(true);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => {
      startReveal();
    }, 500);
  }, [startReveal]);

  // Nút đóng màn hình trong chế độ xem thử
  const handleClose = useCallback(() => {
    hasExitedRef.current = true;
    setIsVisible(false);
    onFinishRef.current?.();
  }, []);

  if (!hasMounted) return null;

  const ready = contentReady && logoReady;

  const content = (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="mobile-splash-screen"
          id="mobile-splash-screen"
          initial={{ opacity: 1 }}
          // Chỉ mờ dần, không scale: phóng to lớp phủ kín màn hình sẽ hở mép dưới,
          // lộ dải sáng của app phía sau ngay khi splash biến mất.
          exit={{
            opacity: 0,
            transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
          }}
          className={cn(
            // Trong lúc nội dung React chưa sẵn sàng, để nền trong suốt cho lớp Splash tĩnh
            // phía dưới lộ ra; nếu phủ nền đen ngay sẽ thành một khoảng trống tối.
            "fixed inset-0 z-[99999] flex items-center justify-center text-white select-none pointer-events-auto touch-none overflow-hidden",
            ready ? "bg-[#05070D]" : "bg-transparent",
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

          {/* Lớp nền: hào quang băng tuyết chuyển động nhẹ bằng GPU */}
          <div
            className={cn(
              "absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center",
              ready ? "opacity-100" : "opacity-0"
            )}
          >
            <motion.div
              animate={{ scale: [1, 1.08, 1], opacity: [0.22, 0.32, 0.22] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="w-[360px] h-[360px] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.14)_0%,rgba(148,163,184,0.05)_45%,transparent_70%)] blur-3xl pointer-events-none"
            />
          </div>

          {/* Khu vực trung tâm: logo + chữ thương hiệu (hiện tĩnh khi đang tải) */}
          <div
            className={cn(
              "relative z-10 flex flex-col items-center gap-5 px-6 pointer-events-none",
              ready ? "opacity-100" : "opacity-0"
            )}
          >
            <div className="relative flex items-center justify-center w-20 h-20">
              {/* Vầng sáng mờ phía sau logo (thay cho drop-shadow nặng trên ảnh) */}
              <motion.div
                initial={false}
                animate={
                  phase === "reveal"
                    ? { opacity: [0.4, 0.75, 0.4], scale: [1, 1.18, 1] }
                    : { opacity: 0.4, scale: 1 }
                }
                transition={{ duration: 0.8, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full bg-sky-400/30 blur-2xl pointer-events-none"
              />
              {/* Logo: tĩnh lúc đang tải, phóng nhẹ một lần ở giai đoạn reveal */}
              <motion.div
                initial={false}
                animate={phase === "reveal" ? { scale: [1, 1.07, 1] } : { scale: 1 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="relative flex items-center justify-center"
              >
                <Image
                  ref={logoRef}
                  onLoad={() => setLogoReady(true)}
                  src="/brand/zenstudy-logo-icon.svg"
                  alt="ZenStudy Logo Icon"
                  width={72}
                  height={72}
                  priority
                  className="object-contain select-none pointer-events-none"
                />
              </motion.div>
            </div>

            {/* Dòng chữ thương hiệu: luôn hiện tĩnh */}
            <div className="text-center pointer-events-none select-none">
              <h1 className="text-2xl font-bold tracking-[0.16em] uppercase leading-none">
                <span className="text-white">ZEN</span>
                <span className="text-sky-400">STUDY</span>
              </h1>
              <p className="text-[11px] font-medium tracking-[0.08em] uppercase text-slate-400 mt-2 leading-none">
                Không gian học tập & làm việc sâu
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
});
