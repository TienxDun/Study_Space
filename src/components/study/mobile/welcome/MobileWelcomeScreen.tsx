"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRightIcon,
  HouseIcon,
  CloudRainIcon,
  CoffeeIcon,
  MountainsIcon,
  SparkleIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from "@phosphor-icons/react";
import { STUDY_SCENES, type Scene } from "@/components/study/study-types";
import { ZenStudyLogo } from "@/components/study/brand/ZenStudyLogo";
import { LiquidGlassButton } from "@/components/ui/LiquidGlassButton";
import { STORAGE_KEYS } from "@/lib/storage-keys";

export interface MobileWelcomeScreenProps {
  /** Tên bối cảnh hiện tại */
  sceneName?: string;
  /** Callback kích hoạt khi bắt đầu vào app */
  onStart?: () => void;
  /** Callback chọn scene khi người dùng bấm vào card trong deck */
  onSelectScene?: (scene: Scene) => void;
  /** Buộc hiển thị (dùng khi kiểm thử hoặc mở thủ công) */
  forceOpen?: boolean;
}

const STORAGE_KEY = STORAGE_KEYS.mobileWelcomeCompleted;

interface CuratedCard {
  scene: Scene;
  displayTitle: string;
  tag: string;
  glowColor: string;
  accentColor: string;
  icon: React.ReactNode;
}

/**
 * MobileWelcomeScreen - Tối ưu hóa hiệu năng cao (High-Performance 60FPS) cho Mobile:
 * - Flow 2 bước liền mạch:
 *   + Bước 1: Màn hình chào mừng Cinematic Splash (Welcome to StudySpace, typography thanh lịch, nút kính lỏng Get Started).
 *   + Bước 2: Giao diện chọn không gian "Pick your space." với Native 3D Card Stack (Hỗ trợ vuốt tay Swipe mượt mà, gia tốc phần cứng GPU, không giật lag).
 * - Loại bỏ các lớp filter blur nặng nề và vòng lặp RAF 240Hz ngầm gây drop FPS trên mobile.
 * - Tuân thủ docs/mobile-style-guide.md: kính mờ backdrop-blur-md, lề an toàn pt-safe / pb-safe, haptic feedback 10ms.
 */
export const MobileWelcomeScreen = React.memo(function MobileWelcomeScreen(
  props: MobileWelcomeScreenProps
) {
  const { onStart, onSelectScene, forceOpen = false } = props;

  const [hasMounted, setHasMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isEntering, setIsEntering] = useState(false);

  // Danh sách các không gian học tập chọn lọc tương ứng với Card Stack ở Bước 2
  const curatedCards: CuratedCard[] = useMemo(() => {
    const scenes = STUDY_SCENES || [];
    const findScene = (nameOrId: string, fallbackIdx: number): Scene => {
      return (
        scenes.find((s) => s.id === nameOrId || s.name.toLowerCase().includes(nameOrId.toLowerCase())) ||
        scenes[fallbackIdx] || {
          id: `fallback-${fallbackIdx}`,
          name: "Không gian học tập",
          category: "chill",
          type: "IMAGE",
          bgUrl: "",
          thumbnailUrl: "",
        }
      );
    };

    return [
      {
        scene: findScene("fantasy", 0),
        displayTitle: "THẾ GIỚI HUYỀN ẢO",
        tag: "Tập trung sâu",
        glowColor: "rgba(217, 119, 6, 0.28)",
        accentColor: "#F59E0B",
        icon: <MountainsIcon className="w-4 h-4 text-amber-300" weight="fill" />,
      },
      {
        scene: findScene("rainy", 1),
        displayTitle: "THUNG LŨNG MƯA",
        tag: "Mưa êm dịu",
        glowColor: "rgba(16, 185, 129, 0.28)",
        accentColor: "#10B981",
        icon: <CloudRainIcon className="w-4 h-4 text-emerald-300" weight="fill" />,
      },
      {
        scene: findScene("living room", 2),
        displayTitle: "CĂN NHÀ GỖ ẤM ÁP",
        tag: "Thư giãn & Chill",
        glowColor: "rgba(249, 115, 22, 0.28)",
        accentColor: "#F97316",
        icon: <CoffeeIcon className="w-4 h-4 text-orange-300" weight="fill" />,
      },
      {
        scene: findScene("tofu", 3),
        displayTitle: "TIỆM ĐẬU PHỤ FUJIWARA",
        tag: "Lofi đêm khuya",
        glowColor: "rgba(99, 102, 241, 0.28)",
        accentColor: "#818CF8",
        icon: <SparkleIcon className="w-4 h-4 text-indigo-300" weight="fill" />,
      },
    ];
  }, []);

  const totalCards = curatedCards.length;
  const activeCard = curatedCards[activeCardIndex] || curatedCards[0];

  // Khởi tạo từ localStorage (chỉ mở ở lần đầu tiên người dùng vào app)
  useEffect(() => {
    setHasMounted(true);
    if (forceOpen) {
      setIsOpen(true);
      return;
    }

    try {
      const seen = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
      if (!seen) {
        setIsOpen(true);
      }
    } catch {
      setIsOpen(true);
    }
  }, [forceOpen]);

  // Vibrate haptic nhẹ nhàng
  const triggerHaptic = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }
  }, []);

  // Chuyển sang bước 2 (Pick your space)
  const handleGoToStep2 = useCallback(() => {
    triggerHaptic();
    setStep(2);
  }, [triggerHaptic]);

  // Đóng màn hình chào mừng và kích hoạt callback vào trang chính
  const handleDismiss = useCallback(
    (chosenScene?: Scene) => {
      try {
        localStorage.setItem(STORAGE_KEY, "true");
        sessionStorage.setItem(STORAGE_KEY, "true");
      } catch {
        // Bỏ qua lỗi storage
      }
      setIsOpen(false);
      if (chosenScene && onSelectScene) {
        onSelectScene(chosenScene);
      }
      onStart?.();
    },
    [onSelectScene, onStart]
  );

  // Chọn scene từ card và bước vào không gian
  const handleSelectAndEnter = useCallback(
    (card: CuratedCard) => {
      if (isEntering) return;
      triggerHaptic();
      setIsEntering(true);
      setTimeout(() => {
        handleDismiss(card.scene);
      }, 250);
    },
    [isEntering, triggerHaptic, handleDismiss]
  );

  // Chuyển card tiếp theo (Next)
  const handleNextCard = useCallback(() => {
    triggerHaptic();
    setActiveCardIndex((prev) => (prev + 1) % totalCards);
  }, [triggerHaptic, totalCards]);

  // Chuyển card trước đó (Prev)
  const handlePrevCard = useCallback(() => {
    triggerHaptic();
    setActiveCardIndex((prev) => (prev - 1 + totalCards) % totalCards);
  }, [triggerHaptic, totalCards]);

  if (!hasMounted || !isOpen) {
    return null;
  }

  const welcomeContent = (
    <AnimatePresence mode="wait">
      <motion.div
        key="mobile-welcome-screen-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } }}
        className="fixed inset-0 z-[999] flex flex-col justify-between overflow-hidden bg-[#0B0F1A] text-white select-none font-sans"
        role="dialog"
        aria-modal="true"
        aria-label="Màn hình chào mừng ZenStudy"
      >
        {/* ============================================================== */}
        {/* NỀN AMBIENT DYNAMIC TỐI ƯU GPU: KHÔNG DÙNG BLUR NẶNG NỀ         */}
        {/* ============================================================== */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute -top-[10%] left-1/2 -translate-x-1/2 w-[110%] h-[50%] rounded-full opacity-25 blur-3xl transform-gpu pointer-events-none transition-colors duration-500"
            style={{
              background: `radial-gradient(circle, ${activeCard?.glowColor || "rgba(251, 191, 36, 0.25)"} 0%, transparent 70%)`,
            }}
          />
        </div>

        {/* ============================================================== */}
        {/* NỀN PHONG CẢNH ĐIỆN ẢNH TỐI ƯU TĨNH: TRÁNH REPAINT LIÊN TỤC    */}
        {/* ============================================================== */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          <img
            key={curatedCards[activeCardIndex]?.scene.id}
            src={curatedCards[activeCardIndex]?.scene.thumbnailUrl || "/thumbnails/journey-through-fantasy-world.webp"}
            alt="Hình nền không gian học tập"
            className="w-full h-full object-cover object-center filter brightness-[0.7] contrast-[1.05] transition-opacity duration-500 will-change-transform"
            loading="eager"
          />
          {/* Lớp gradient bóng đổ mượt mà từ đáy lên */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F1A] via-[#0B0F1A]/80 via-50% to-black/35 pointer-events-none" />
        </div>

        {/* ============================================================== */}
        {/* BƯỚC 1: MÀN HÌNH CHÀO MỪNG CINEMATIC SPLASH                    */}
        {/* ============================================================== */}
        {step === 1 && (
          <motion.div
            key="welcome-step-1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40, transition: { duration: 0.25 } }}
            className="relative z-20 flex-1 flex flex-col justify-between items-center px-6 pb-safe pt-safe max-w-md mx-auto w-full h-full"
          >
            {/* Khoảng đệm đỉnh */}
            <div className="w-full h-20 sm:h-28 pointer-events-none" aria-hidden="true" />

            {/* Typography Container ở trung tâm */}
            <div className="space-y-3 text-center flex flex-col items-center my-auto">
              <h1 className="text-[32px] sm:text-[36px] font-light tracking-tight text-white leading-[1.15] flex flex-col items-center gap-2.5">
                <span>Chào mừng bạn đến với</span>
                <span className="flex items-center justify-center pt-0.5">
                  <ZenStudyLogo
                    variant="full"
                    className="h-10 sm:h-11 w-auto object-contain select-none pointer-events-none drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
                    priority
                  />
                </span>
              </h1>
              <p className="text-[13px] font-normal leading-relaxed text-white/75 max-w-[28ch] mx-auto">
                Không gian tĩnh lặng, âm thanh sâu lắng & khơi nguồn cảm hứng học tập.
              </p>
            </div>

            {/* Nút bấm kính lỏng Liquid Glass Button ở đáy */}
            <div className="w-full pb-8 flex flex-col items-center">
              <LiquidGlassButton
                label="Bắt đầu ngay"
                successLabel="Sẵn sàng"
                onClick={handleGoToStep2}
              />
            </div>
          </motion.div>
        )}

        {/* ============================================================== */}
        {/* BƯỚC 2: GIAO DIỆN CHỌN KHÔNG GIAN NATIVE 3D CARD STACK (60FPS)  */}
        {/* ============================================================== */}
        {step === 2 && (
          <motion.div
            key="welcome-step-2"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30, transition: { duration: 0.25 } }}
            className="relative z-20 flex-1 flex flex-col justify-between px-5 pb-safe pt-safe max-w-md mx-auto w-full h-full"
          >
            {/* Header: "Chọn không gian học tập." */}
            <div className="pt-2 text-center">
              <span className="text-[13px] font-medium tracking-tight text-white/80 block leading-tight">
                Chọn không gian
              </span>
              <span className="text-[15px] font-bold tracking-tight text-white block leading-tight mt-0.5">
                học tập.
              </span>
            </div>

            {/* Khung chứa Card Stack 3D Native siêu nhẹ, vuốt tay cực nhạy */}
            <div className="relative w-full flex-1 my-auto flex items-center justify-center min-h-[350px] max-h-[420px] touch-pan-y">
              <div className="relative w-[280px] h-[360px] flex items-center justify-center">
                {curatedCards.map((card, idx) => {
                  // Khoảng cách theo vòng lặp so với activeCardIndex
                  const diff = (idx - activeCardIndex + totalCards) % totalCards;
                  const isFront = diff === 0;

                  // Chỉ render các thẻ nhìn thấy (diff <= 2) để tiết kiệm tối đa RAM và DOM
                  if (diff > 2) return null;

                  return (
                    <motion.div
                      key={card.scene.id}
                      drag={isFront ? "x" : false}
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.3}
                      onDragEnd={(_, info) => {
                        if (info.offset.x < -40 || info.velocity.x < -300) {
                          handleNextCard();
                        } else if (info.offset.x > 40 || info.velocity.x > 300) {
                          handlePrevCard();
                        }
                      }}
                      animate={{
                        scale: isFront ? 1 : diff === 1 ? 0.93 : 0.86,
                        y: isFront ? 0 : diff === 1 ? 16 : 30,
                        rotate: isFront ? 0 : diff === 1 ? 1.5 : -1.5,
                        opacity: isFront ? 1 : diff === 1 ? 0.75 : 0.45,
                        zIndex: 30 - diff * 10,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 350,
                        damping: 30,
                      }}
                      onClick={() => {
                        if (isFront) {
                          handleSelectAndEnter(card);
                        } else {
                          triggerHaptic();
                          setActiveCardIndex(idx);
                        }
                      }}
                      className="absolute inset-0 rounded-[24px] p-3.5 bg-slate-900/90 border border-white/20 backdrop-blur-md shadow-[0_20px_45px_rgba(0,0,0,0.65)] flex flex-col justify-between cursor-pointer select-none transform-gpu will-change-transform"
                      style={{
                        boxShadow: isFront
                          ? `0 24px 50px -10px rgba(0,0,0,0.7), 0 0 25px ${card.glowColor}`
                          : "0 15px 30px -10px rgba(0,0,0,0.5)",
                      }}
                    >
                      {/* Tiêu đề & Tag loại không gian */}
                      <div className="flex items-center justify-between gap-2 px-1 pt-0.5 pb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border border-white/10"
                            style={{ background: `${card.accentColor}25` }}
                          >
                            {card.icon}
                          </div>
                          <span className="text-[12px] font-bold tracking-wider uppercase text-white truncate">
                            {card.displayTitle}
                          </span>
                        </div>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/10 text-white/80 shrink-0">
                          {card.tag}
                        </span>
                      </div>

                      {/* Khung ảnh xem trước không gian học tập */}
                      <div className="relative flex-1 rounded-[18px] overflow-hidden bg-black/40 border border-white/10 mt-1 mb-2">
                        <img
                          src={card.scene.thumbnailUrl || "/thumbnails/journey-through-fantasy-world.webp"}
                          alt={card.displayTitle}
                          className="w-full h-full object-cover"
                          loading="eager"
                        />
                        {/* Nhãn click-to-enter trên thẻ trước */}
                        {isFront && (
                          <div className="absolute inset-x-0 bottom-0 py-2 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-1.5 text-white/90 text-[11px] font-medium">
                            <span>Chạm để vào không gian</span>
                            <ArrowRightIcon className="w-3 h-3" weight="bold" />
                          </div>
                        )}
                      </div>

                      {/* Vạch tiến độ nhỏ đáy thẻ */}
                      <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${((activeCardIndex + 1) / totalCards) * 100}%`,
                            background: card.accentColor,
                          }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Điều hướng Next/Prev & Dots indicator */}
            <div className="flex items-center justify-between px-3 pt-1 pb-3">
              <button
                type="button"
                onClick={handlePrevCard}
                className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/80 active:scale-95 transition-transform"
                aria-label="Không gian trước"
              >
                <CaretLeftIcon className="w-4 h-4" weight="bold" />
              </button>

              {/* Dots indicator */}
              <div className="flex items-center gap-2">
                {curatedCards.map((card, dotIdx) => (
                  <button
                    key={dotIdx}
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      setActiveCardIndex(dotIdx);
                    }}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      dotIdx === activeCardIndex ? "w-6 bg-white" : "w-2 bg-white/25"
                    }`}
                    aria-label={`Chọn ${card.displayTitle}`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={handleNextCard}
                className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/80 active:scale-95 transition-transform"
                aria-label="Không gian tiếp theo"
              >
                <CaretRightIcon className="w-4 h-4" weight="bold" />
              </button>
            </div>

            {/* Bottom Dock Navigation ở đáy */}
            <div className="pb-3 w-full max-w-[340px] mx-auto select-none">
              <div className="lg-bar h-[54px] p-1.5 flex items-center gap-2 shadow-2xl relative w-full overflow-hidden">
                {/* Nút phụ: Về trang giới thiệu */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    setStep(1);
                  }}
                  className="h-full px-3.5 rounded-full flex items-center gap-1.5 text-white/70 hover:text-white hover:bg-white/[0.08] active:scale-95 transition-all cursor-pointer group select-none relative z-10 shrink-0"
                  aria-label="Về trang giới thiệu"
                >
                  <HouseIcon className="w-4 h-4 transition-transform group-hover:scale-110" weight="regular" />
                  <span className="text-[12px] font-medium tracking-tight text-white/80 group-hover:text-white transition-colors">
                    Giới thiệu
                  </span>
                </button>

                {/* Vạch chia hairline */}
                <div className="h-4 w-[1px] bg-white/15 shrink-0" aria-hidden="true" />

                {/* Nút hành động chính: Vào không gian ngay */}
                <button
                  type="button"
                  onClick={() => handleSelectAndEnter(activeCard)}
                  disabled={isEntering}
                  className="lg-pill flex-1 h-full flex items-center justify-center gap-2 text-white font-semibold text-[13px] tracking-wide shadow-md active:scale-95 hover:bg-white/[0.22] hover:border-white/40 transition-all cursor-pointer group select-none relative z-10"
                >
                  <span>Vào không gian</span>
                  <ArrowRightIcon className="w-3.5 h-3.5 text-white/90 group-hover:translate-x-0.5 transition-transform" weight="bold" />
                </button>

                {/* Đốm sáng ngón tay quét qua thanh kính */}
                <span aria-hidden="true" className="lg-spot pointer-events-none" />
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );

  if (typeof document !== "undefined" && document.body) {
    return createPortal(welcomeContent, document.body);
  }

  return welcomeContent;
});

MobileWelcomeScreen.displayName = "MobileWelcomeScreen";
