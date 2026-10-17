"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import CardSwap, { Card, type CardSwapHandle } from "@/components/ui/CardSwap";
import { ZenStudyLogo } from "@/components/study/brand/ZenStudyLogo";
import { LiquidGlassButton } from "@/components/ui/LiquidGlassButton";

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

const STORAGE_KEY = "zenstudy_mobile_welcome_completed";

interface CuratedCard {
  scene: Scene;
  displayTitle: string;
  tag: string;
  glowColor: string;
  accentColor: string;
  icon: React.ReactNode;
}

/**
 * MobileWelcomeScreen - Dựng 1:1 theo video concept chuẩn screenshot-to-code:
 * - Flow 2 bước liền mạch:
 *   + Bước 1: Màn hình chào mừng Cinematic Splash (Welcome to StudySpace, typography thanh lịch, nút kính lỏng Get Started).
 *   + Bước 2: Giao diện chọn không gian "Pick your space." với Card Deck xếp lớp 3D, đổi màu ambient nền theo cảnh, nút ↗ trực tiếp.
 * - Tuân thủ docs/mobile-style-guide.md: kính mờ backdrop-blur, lề an toàn pt-safe / pb-safe, haptic feedback 10ms.
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
  const cardSwapRef = useRef<CardSwapHandle>(null);

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
        glowColor: "rgba(217, 119, 6, 0.22)",
        accentColor: "#F59E0B",
        icon: <MountainsIcon className="w-4 h-4 text-amber-300" weight="fill" />,
      },
      {
        scene: findScene("rainy", 1),
        displayTitle: "THUNG LŨNG MƯA",
        tag: "Mưa êm dịu",
        glowColor: "rgba(16, 185, 129, 0.22)",
        accentColor: "#10B981",
        icon: <CloudRainIcon className="w-4 h-4 text-emerald-300" weight="fill" />,
      },
      {
        scene: findScene("living room", 2),
        displayTitle: "CĂN NHÀ GỖ ẤM ÁP",
        tag: "Thư giãn & Chill",
        glowColor: "rgba(249, 115, 22, 0.22)",
        accentColor: "#F97316",
        icon: <CoffeeIcon className="w-4 h-4 text-orange-300" weight="fill" />,
      },
      {
        scene: findScene("tofu", 3),
        displayTitle: "TIỆM ĐẬU PHỤ FUJIWARA",
        tag: "Lofi đêm khuya",
        glowColor: "rgba(99, 102, 241, 0.22)",
        accentColor: "#818CF8",
        icon: <SparkleIcon className="w-4 h-4 text-indigo-300" weight="fill" />,
      },
    ];
  }, []);

  const activeCard = curatedCards[activeCardIndex] || curatedCards[0];

  // Khởi tạo từ sessionStorage
  useEffect(() => {
    setHasMounted(true);
    if (forceOpen) {
      setIsOpen(true);
      return;
    }

    try {
      const seen = sessionStorage.getItem(STORAGE_KEY);
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

  // Chuyển card tiếp theo qua CardSwap
  const handleNextCard = useCallback(() => {
    triggerHaptic();
    cardSwapRef.current?.next();
  }, [triggerHaptic]);

  // Chuyển card trước đó qua CardSwap
  const handlePrevCard = useCallback(() => {
    triggerHaptic();
    cardSwapRef.current?.prev();
  }, [triggerHaptic]);

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
        {/* NỀN AMBIENT DYNAMIC: TỰ ĐỘNG CHUYỂN TÔNG MÀU THEO SCENE ĐANG CHỌN */}
        {/* ============================================================== */}
        <div className="absolute inset-0 pointer-events-none transition-colors duration-700">
          <div
            className="absolute -top-[15%] left-1/2 -translate-x-1/2 w-[140%] h-[60%] rounded-full opacity-35 blur-[120px] transition-all duration-700"
            style={{
              background: `radial-gradient(circle, ${activeCard?.glowColor || "rgba(56, 189, 248, 0.2)"} 0%, transparent 75%)`,
            }}
          />
          <div
            className="absolute -bottom-[20%] left-1/2 -translate-x-1/2 w-[130%] h-[50%] rounded-full opacity-25 blur-[130px] transition-all duration-700"
            style={{
              background: `radial-gradient(circle, ${activeCard?.glowColor || "rgba(16, 185, 129, 0.2)"} 0%, transparent 80%)`,
            }}
          />
        </div>

        {/* ============================================================== */}
        {/* NỀN PHONG CẢNH ĐIỆN ẢNH TRÀN TOÀN MÀN HÌNH (EDGE-TO-EDGE FULLSCREEN) */}
        {/* ============================================================== */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          <motion.img
            src={curatedCards[activeCardIndex]?.scene.thumbnailUrl || "/thumbnails/journey-through-fantasy-world.webp"}
            alt="Hình nền không gian học tập"
            className="w-full h-full object-cover object-center filter brightness-[0.78] contrast-[1.05]"
            initial={{ scale: 1 }}
            animate={{ scale: 1.05 }}
            transition={{ duration: 18, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
          />
          {/* Lớp gradient bóng đổ mượt mà từ đáy lên y hệt video mẫu tràn viền 100% */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F1A] via-[#0B0F1A]/75 via-45% to-black/30" />
        </div>

        {/* ============================================================== */}
        {/* BƯỚC 1: MÀN HÌNH CHÀO MỪNG CINEMATIC SPLASH (MÀN 1 TRONG VIDEO) */}
        {/* ============================================================== */}
        {step === 1 && (
          <motion.div
            key="welcome-step-1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40, transition: { duration: 0.3 } }}
            className="relative z-20 flex-1 flex flex-col justify-between items-center px-6 pb-safe pt-safe max-w-md mx-auto w-full h-full"
          >
            {/* Khoảng đệm đỉnh cân bằng để đưa khối Typography vào đúng trung tâm màn hình */}
            <div className="w-full h-20 sm:h-28 pointer-events-none" aria-hidden="true" />

            {/* Typography Container ở trung tâm màn hình (Center) */}
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

            {/* Nút bấm kính lỏng Liquid Glass Button (001, Buttons) ở đáy */}
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
        {/* BƯỚC 2: GIAO DIỆN CHỌN KHÔNG GIAN PICK YOUR SPACE (MÀN 2 TRONG VIDEO) */}
        {/* ============================================================== */}
        {step === 2 && (
          <motion.div
            key="welcome-step-2"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40, transition: { duration: 0.3 } }}
            className="relative z-20 flex-1 flex flex-col justify-between px-5 pb-safe pt-safe max-w-md mx-auto w-full"
          >
            {/* Header: "Chọn không gian học tập." căn giữa thanh lịch */}
            <div className="pt-2 text-center">
              <span className="text-[13px] font-medium tracking-tight text-white/80 block leading-tight">
                Chọn không gian
              </span>
              <span className="text-[14px] font-bold tracking-tight text-white block leading-tight mt-0.5">
                học tập.
              </span>
            </div>

            {/* 3D Card Stack với ReactBits CardSwap (vuốt, fling, đổi thẻ mượt mà) */}
            <div className="relative w-full flex-1 my-auto flex items-center justify-center min-h-[350px]">
              <CardSwap
                ref={cardSwapRef}
                width={275}
                height={350}
                cardDistance={32}
                verticalDistance={30}
                depth={55}
                skewAmount={3}
                cardRadius={24}
                delay={4500}
                draggable={true}
                autoplay={true}
                pauseOnHover={true}
                onChange={(index) => {
                  setActiveCardIndex(index);
                }}
                onCardClick={(index) => {
                  handleSelectAndEnter(curatedCards[index]);
                }}
              >
                {curatedCards.map((card) => (
                  <Card
                    key={card.scene.id}
                    className="p-3.5 border border-white/20 backdrop-blur-2xl shadow-[0_25px_50px_rgba(0,0,0,0.65)] flex flex-col justify-between"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.04) 50%, rgba(255, 255, 255, 0.01) 100%), rgba(11, 15, 26, 0.45)",
                      backdropFilter: "blur(24px) saturate(160%)",
                      WebkitBackdropFilter: "blur(24px) saturate(160%)",
                      boxShadow:
                        "0 25px 50px -12px rgba(0, 0, 0, 0.7), inset 0 1px 1.5px rgba(255, 255, 255, 0.35), inset 0 0 0 1px rgba(255, 255, 255, 0.18)",
                    }}
                  >
                    {/* Hàng tiêu đề trên cùng của thẻ */}
                    <div className="flex items-center gap-2 px-1 pt-1 pb-2.5">
                      <div className="w-7 h-7 rounded-full bg-white/10 border border-white/10 flex items-center justify-center">
                        {card.icon}
                      </div>
                      <span className="text-[12.5px] font-bold tracking-wider uppercase text-white">
                        {card.displayTitle}
                      </span>
                    </div>

                    {/* Khung ảnh xem trước không gian */}
                    <div className="relative flex-1 rounded-[18px] overflow-hidden bg-black/40 border border-white/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={card.scene.thumbnailUrl || "/thumbnails/journey-through-fantasy-world.webp"}
                        alt={card.displayTitle}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </Card>
                ))}
              </CardSwap>
            </div>

            {/* Điều hướng Next/Prev & Chỉ số trang */}
            <div className="flex items-center justify-between px-2 pt-1 pb-3">
              <button
                type="button"
                onClick={handlePrevCard}
                className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70 active:scale-95"
                aria-label="Không gian trước"
              >
                <CaretLeftIcon className="w-4 h-4" weight="bold" />
              </button>

              {/* Dots indicator */}
              <div className="flex items-center gap-1.5">
                {curatedCards.map((_, dotIdx) => (
                  <span
                    key={dotIdx}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      dotIdx === activeCardIndex ? "w-5 bg-white" : "w-1.5 bg-white/25"
                    }`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={handleNextCard}
                className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70 active:scale-95"
                aria-label="Không gian tiếp theo"
              >
                <CaretRightIcon className="w-4 h-4" weight="bold" />
              </button>
            </div>

            {/* Bottom Dock Navigation nổi ở đáy: Tái thiết kế chuẩn Linear & Apple Design Spec (awesome-design-md) */}
            <div className="pb-3 w-full max-w-[340px] mx-auto select-none">
              <div className="lg-bar h-[54px] p-1.5 flex items-center gap-2 shadow-2xl relative w-full overflow-hidden">
                {/* Nút phụ: Về trang giới thiệu - Nút pill kính mờ nằm ngang đồng trục */}
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

                {/* Vạch chia hairline quang học tinh tế chuẩn Linear */}
                <div className="h-4 w-[1px] bg-white/15 shrink-0" aria-hidden="true" />

                {/* Nút hành động chính: Vào không gian ngay dạng lg-pill kính lỏng nổi bật */}
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
