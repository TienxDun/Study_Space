"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
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
  glowColor: string;

}

/**
 * MobileWelcomeScreen - Tối ưu hóa hiệu năng cao (High-Performance 60FPS) cho Mobile:
 * - Flow 2 bước liền mạch:
 *   + Bước 1: Màn hình chào mừng Cinematic Splash (Welcome to StudySpace, typography thanh lịch, nút kính lỏng Get Started).
 *   + Bước 2: Giao diện chọn không gian "Pick your space." với Native 3D Card Stack (Hỗ trợ vuốt tay Swipe mượt mà, gia tốc phần cứng GPU, không giật lag).
 * - Loại bỏ các lớp filter blur nặng nề và vòng lặp RAF 240Hz ngầm gây drop FPS trên mobile.
 * - Tuân thủ docs/guides/mobile-style-guide.md: kính mờ backdrop-blur-md, lề an toàn pt-safe / pb-safe, haptic feedback 10ms.
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
        glowColor: "rgba(217, 119, 6, 0.28)",

      },
      {
        scene: findScene("rainy", 1),
        displayTitle: "THUNG LŨNG MƯA",
        glowColor: "rgba(16, 185, 129, 0.28)",

      },
      {
        scene: findScene("living room", 2),
        displayTitle: "CĂN NHÀ GỖ ẤM ÁP",
        glowColor: "rgba(249, 115, 22, 0.28)",

      },
      {
        scene: findScene("tofu", 3),
        displayTitle: "TIỆM ĐẬU PHỤ FUJIWARA",
        glowColor: "rgba(99, 102, 241, 0.28)",

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
          {/* Gradient tròn đã mềm sẵn: bỏ blur-3xl vì lớp blur 64px kích thước nửa
              màn hình bị raster lại mỗi lần đổi thẻ */}
          <div
            className="absolute -top-[10%] left-1/2 -translate-x-1/2 w-[110%] h-[50%] rounded-full opacity-25 transform-gpu pointer-events-none transition-colors duration-500"
            style={{
              background: `radial-gradient(circle, ${activeCard?.glowColor || "rgba(251, 191, 36, 0.25)"} 0%, transparent 70%)`,
            }}
          />
        </div>

        {/* ============================================================== */}
        {/* NỀN PHONG CẢNH ĐIỆN ẢNH TỐI ƯU TĨNH: CROSSFADE MƯỢT MÀ 60FPS   */}
        {/* ============================================================== */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          {curatedCards.map((card, idx) => {
            const isActive = idx === activeCardIndex;
            return (
              <img
                key={card.scene.id}
                src={card.scene.thumbnailUrl || "/thumbnails/journey-through-fantasy-world.webp"}
                alt="Hình nền không gian học tập"
                className={`absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.7] contrast-[1.05] transition-opacity duration-500 ease-out will-change-[opacity] ${
                  isActive ? "opacity-100" : "opacity-0"
                }`}
                loading="eager"
              />
            );
          })}
          {/* Lớp gradient bóng đổ mượt mà từ đáy lên */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F1A] via-[#0B0F1A]/80 via-50% to-black/35 pointer-events-none" />
        </div>

        {/* Nút lùi: neo vào góc màn hình chứ không theo cột nội dung max-w-md,
            để trên màn hình rộng vẫn dính góc trái; lề trái = lề trên = 20px
            (+ safe-area), canh tâm trùng tiêu đề bước 2 */}
        <AnimatePresence>
          {step === 2 && (
            <motion.button
              key="welcome-back"
              type="button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.18 }}
              onClick={() => {
                triggerHaptic();
                setStep(1);
              }}
              className="absolute left-5 top-[calc(env(safe-area-inset-top,0px)+20px)] z-30 w-9 h-9 rounded-full flex items-center justify-center text-white/90 bg-black/35 border border-white/25 active:scale-95 cursor-pointer"
              aria-label="Quay lại trang giới thiệu"
            >
              <CaretLeftIcon className="w-4 h-4" weight="bold" />
            </motion.button>
          )}
        </AnimatePresence>

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
            {/* Header: tiêu đề canh giữa toàn bề ngang để không bị bẻ đôi ở
                máy hẹp (320px); nút lùi neo ở góc màn hình (xem trên) */}
            <div className="relative mt-4 min-h-11 flex items-center justify-center">
              <h2 className="text-center text-[15px] min-[360px]:text-[16px] font-semibold tracking-tight text-white leading-tight">
                Chọn không gian học tập.
              </h2>
            </div>

            {/* Khung chứa Card Stack 3D Native siêu nhẹ, vuốt tay cực nhạy.
                Chevron đổi thẻ neo theo mép thẻ (cách 12px) chứ không theo cột
                nội dung, để màn hình rộng vẫn dính sát thẻ. */}
            <div className="relative w-full flex-1 my-auto flex items-center justify-center min-h-[350px] max-h-[420px] touch-pan-y">
              <div className="relative w-[280px] h-[360px] flex items-center justify-center">
                <button
                  type="button"
                  onClick={handlePrevCard}
                  className="absolute -left-11 max-[359px]:-left-1 min-[400px]:-left-14 top-1/2 -translate-y-1/2 z-40 w-10 h-10 flex items-center justify-center text-white/85 active:scale-90 transition-transform cursor-pointer"
                  aria-label="Không gian trước"
                >
                  <CaretLeftIcon className="w-6 h-6 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]" weight="bold" />
                </button>
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
                        // Quạt bài 3 lớp: thẻ sau lệch xuống + lệch ngang theo hai
                        // hướng + xoay nhẹ, để thấy rõ còn thẻ phía sau.
                        scale: isFront ? 1 : diff === 1 ? 0.95 : 0.9,
                        x: isFront ? 0 : diff === 1 ? 12 : -12,
                        y: isFront ? 0 : diff === 1 ? 24 : 40,
                        rotate: isFront ? 0 : diff === 1 ? 2.5 : -2.5,
                        opacity: isFront ? 1 : diff === 1 ? 0.94 : 0.85,
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
                      className="absolute inset-0 rounded-[24px] overflow-hidden surface-graphite border cursor-pointer select-none transform-gpu will-change-transform"
                      style={{
                        boxShadow: isFront
                          ? `0 24px 50px -10px rgba(0,0,0,0.7), 0 0 25px ${card.glowColor}`
                          : "0 15px 30px -10px rgba(0,0,0,0.5)",
                      }}
                    >
                      {/* Ảnh phủ kín thẻ (poster); card overflow-hidden cắt góc 24px */}
                      <img
                        src={card.scene.thumbnailUrl || "/thumbnails/journey-through-fantasy-world.webp"}
                        alt={card.displayTitle}
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="eager"
                      />

                      {/* Scrim đỉnh để tiêu đề luôn đọc được kể cả khi ảnh sáng */}
                      <div
                        className="absolute inset-x-0 top-0 h-[104px] bg-gradient-to-b from-black/75 via-black/30 to-transparent pointer-events-none"
                        aria-hidden="true"
                      />

                      {/* Tiêu đề: luôn hiện đủ chữ, không cắt */}
                      <div className="absolute inset-x-0 top-0 px-4 pt-3.5">
                        <h3 className="text-[13px] leading-snug font-bold tracking-wide uppercase text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.55)]">
                          {card.displayTitle}
                        </h3>
                      </div>
                    </motion.div>
                  );
                })}

                <button
                  type="button"
                  onClick={handleNextCard}
                  className="absolute -right-11 max-[359px]:-right-1 min-[400px]:-right-14 top-1/2 -translate-y-1/2 z-40 w-10 h-10 flex items-center justify-center text-white/85 active:scale-90 transition-transform cursor-pointer"
                  aria-label="Không gian tiếp theo"
                >
                  <CaretRightIcon className="w-6 h-6 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]" weight="bold" />
                </button>
              </div>
            </div>

            {/* Dots indicator — nút cao 24px, tâm cách nhau ≥24px để đạt
                WCAG 2.2 (2.5.8 Target Size); chấm vẽ bên trong giữ nguyên 8px */}
            <div className="flex items-center justify-center gap-4 pb-2">
              {curatedCards.map((card, dotIdx) => (
                <button
                  key={dotIdx}
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    setActiveCardIndex(dotIdx);
                  }}
                  className="flex h-6 items-center justify-center"
                  aria-label={`Chọn ${card.displayTitle}`}
                >
                  <span
                    className={`block h-2 rounded-full transition-all duration-300 ${
                      dotIdx === activeCardIndex ? "w-6 bg-white" : "w-2 bg-white/25"
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* CTA duy nhất ở đáy: dùng đúng LiquidGlassButton của bước 1 để
                đồng bộ nền kính và hiệu ứng (float, sheen, load → ok) */}
            <div className="w-full pb-4 flex flex-col items-center">
              <LiquidGlassButton
                label="Vào không gian"
                successLabel="Đang vào"
                disabled={isEntering}
                onClick={() => handleSelectAndEnter(activeCard)}
              />
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
