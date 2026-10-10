"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { STORAGE_KEYS } from "@/lib/storage-keys";

export interface TourStep {
  targetId: string | null;
  title: string;
  emoji: string;
  description: string;
  placement?: "center" | "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    targetId: null,
    title: "Chào bạn tới ZenStudy Space",
    emoji: "🌿",
    description:
      "Chỗ này để nghe nhạc, học bài, làm việc – hoặc chỉ ngồi thở một chút. Hãy dạo một vòng nhỏ để làm quen các tính năng nhé!",
    placement: "center",
  },
  {
    targetId: "tour-dock-scenes",
    title: "50+ Bối cảnh 4K sống động",
    emoji: "🎬",
    description:
      "Khám phá các không gian quán cafe mưa, thư viện cổ điển, anime chill, vũ trụ và thiên nhiên. Dễ dàng đổi qua lại giữa video 4K và ảnh tĩnh.",
    placement: "right",
  },
  {
    targetId: "tour-music-mixer-btn",
    title: "Bộ trộn 20 âm thanh thiên nhiên",
    emoji: "🌧️",
    description:
      "Tùy chỉnh và hòa trộn tiếng mưa rơi, sóng biển, gió thổi, bếp lửa tí tách, tiếng lật sách và tiếng ồn trắng (white noise) chặn tạp âm xung quanh.",
    placement: "top",
  },
  {
    targetId: "tour-music-player",
    title: "Nhạc Lo-fi & Nhúng YouTube / Spotify",
    emoji: "🎵",
    description:
      "Thưởng thức danh sách nhạc Lo-fi, Piano & Jazz thư giãn. Hoặc bấm mở Embed Player để nhúng video nhạc YouTube và playlist Spotify yêu thích.",
    placement: "top",
  },
  {
    targetId: "tour-pomodoro-widget",
    title: "Đồng hồ Pomodoro & Bấm giờ",
    emoji: "⏱️",
    description:
      "Duy trì kỷ luật học tập với phương pháp quả cà chua 25-5-15, chuông báo thiền Zen du dương và đồng hồ lớn toàn màn hình (phím C).",
    placement: "bottom",
  },
  {
    targetId: "tour-dock-tasks",
    title: "Kế hoạch công việc & Ghi chú",
    emoji: "📋",
    description:
      "Lập danh sách việc cần làm với bảng Kanban kéo thả trực quan và sổ ghi chép nhanh hỗ trợ Markdown, lưu trữ cục bộ bảo mật.",
    placement: "right",
  },
  {
    targetId: "tour-topbar-actions",
    title: "Chế độ Zen Mode & Phím tắt",
    emoji: "🧘",
    description:
      "Nhấn phím Z bất cứ lúc nào để ẩn toàn bộ giao diện giúp tập trung cao độ, hoặc bấm dấu hỏi (?) để xem phím tắt. Bắt đầu ngay nhé!",
    placement: "bottom",
  },
];

interface StudyOnboardingTourProps {
  isOpen?: boolean;
  onClose?: () => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function StudyOnboardingTour({
  isOpen: externalIsOpen,
  onClose: externalOnClose,
}: StudyOnboardingTourProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [, startTransition] = useTransition();

  const isTourActive =
    externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  // Tự động kích hoạt tour khi người dùng truy cập web lần đầu
  useEffect(() => {
    if (externalIsOpen !== undefined) return;
    try {
      const completed = localStorage.getItem(STORAGE_KEYS.tourCompleted);
      if (!completed) {
        // Đợi 750ms sau khi trang mount xong để các widget ổn định vị trí
        const timer = setTimeout(() => {
          setInternalIsOpen(true);
        }, 750);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, [externalIsOpen]);

  // Đồng bộ khi prop đóng mở từ bên ngoài thay đổi
  useEffect(() => {
    if (externalIsOpen === false) {
      setInternalIsOpen(false);
    }
  }, [externalIsOpen]);

  // Luôn reset về bước đầu tiên (index 0) mỗi khi tour được mở hoặc mở lại
  useEffect(() => {
    if (isTourActive) {
      setCurrentStepIndex(0);
    }
  }, [isTourActive]);

  // Đóng tour và ghi nhớ vào LocalStorage
  const handleCloseTour = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.tourCompleted, "true");
    } catch {}

    setCurrentStepIndex(0);
    setInternalIsOpen(false);

    if (externalOnClose) {
      externalOnClose();
    }
  }, [externalOnClose]);

  const currentStep = TOUR_STEPS[currentStepIndex] || TOUR_STEPS[0];

  // Tính toán vị trí phần tử mục tiêu
  const updateTargetRect = useCallback(() => {
    if (!isTourActive) return;

    if (!currentStep.targetId) {
      setTargetRect(null);
      return;
    }

    let element = document.getElementById(currentStep.targetId);

    // Fallback bảo vệ: Nếu ở bước bộ trộn âm thanh thiên nhiên mà nút chưa mount hoặc tạm ẩn,
    // fallback bắt vào khung thanh phát nhạc để spotlight luôn sáng đúng vị trí
    if (!element && currentStep.targetId === "tour-music-mixer-btn") {
      element = document.getElementById("tour-music-player");
    }

    if (element) {
      const rect = element.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    } else {
      setTargetRect(null);
    }
  }, [isTourActive, currentStep.targetId]);

  useEffect(() => {
    updateTargetRect();
    const handleResize = () => updateTargetRect();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize);
    };
  }, [updateTargetRect, currentStepIndex]);

  // Điều hướng bằng bàn phím
  useEffect(() => {
    if (!isTourActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCloseTour();
      } else if (e.key === "ArrowRight") {
        if (currentStepIndex < TOUR_STEPS.length - 1) {
          startTransition(() => setCurrentStepIndex((prev) => prev + 1));
        } else {
          handleCloseTour();
        }
      } else if (e.key === "ArrowLeft") {
        if (currentStepIndex > 0) {
          startTransition(() => setCurrentStepIndex((prev) => prev - 1));
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTourActive, currentStepIndex, handleCloseTour]);

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      startTransition(() => setCurrentStepIndex((prev) => prev + 1));
    } else {
      handleCloseTour();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      startTransition(() => setCurrentStepIndex((prev) => prev - 1));
    }
  };

  if (!isTourActive) return null;

  const isLastStep = currentStepIndex === TOUR_STEPS.length - 1;

  const isCentered = !targetRect || currentStep.placement === "center";

  // Tính toán vị trí hiển thị Card Tour tương đối với Target
  const getCardStyle = (): React.CSSProperties => {
    if (!targetRect) return {};

    const cardWidth = 420;
    const cardHeight = 220;
    const padding = 16;
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;

    let top = targetRect.top;
    let left = targetRect.left;

    if (currentStep.placement === "top") {
      top = targetRect.top - cardHeight - 16;
      left = targetRect.left + targetRect.width / 2 - cardWidth / 2;
    } else if (currentStep.placement === "bottom") {
      top = targetRect.top + targetRect.height + 16;
      left = targetRect.left + targetRect.width / 2 - cardWidth / 2;
    } else if (currentStep.placement === "right") {
      left = targetRect.left + targetRect.width + 16;
      top = targetRect.top + targetRect.height / 2 - cardHeight / 2;
    } else if (currentStep.placement === "left") {
      left = targetRect.left - cardWidth - 16;
      top = targetRect.top + targetRect.height / 2 - cardHeight / 2;
    }

    // Clamp vào bên trong màn hình
    const clampedLeft = Math.max(padding, Math.min(viewportWidth - cardWidth - padding, left));
    const clampedTop = Math.max(padding, Math.min(viewportHeight - cardHeight - padding, top));

    return {
      position: "fixed",
      top: `${clampedTop}px`,
      left: `${clampedLeft}px`,
    };
  };

  const cardContent = (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="w-9 h-9 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-xl shrink-0 shadow-inner select-none">
            {currentStep.emoji}
          </span>
          <h3 className="font-bold text-base sm:text-[17px] text-white leading-snug">
            {currentStep.title}
          </h3>
        </div>

        <button
          onClick={handleCloseTour}
          className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0 mt-0.5"
          title="Đóng / Bỏ qua hướng dẫn (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body Description */}
      <p className="text-slate-300 text-sm leading-relaxed mt-2.5 min-h-[56px]">
        {currentStep.description}
      </p>

      {/* Footer Controls */}
      <div className="flex items-center justify-between mt-5 pt-3 border-t border-white/10">
        {/* Step Counter Badge */}
        <span className="font-mono text-xs font-semibold text-slate-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
          {`${currentStepIndex + 1} / ${TOUR_STEPS.length}`}
        </span>

        {/* Buttons Group */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              currentStepIndex === 0
                ? "opacity-30 cursor-not-allowed text-slate-500"
                : "text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer active:scale-95"
            }`}
          >
            <span className="flex items-center gap-1">
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Quay lại</span>
            </span>
          </button>

          <button
            onClick={handleNext}
            className="px-4 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-accent-music to-accent-music-bright hover:from-accent-music-glow hover:to-accent-music-pale text-panel shadow-[0_0_16px_rgba(52,211,153,0.4)] transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
          >
            {isLastStep ? (
              <>
                <span>Bắt đầu ngay</span>
                <Sparkles className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <span>Tiếp tục</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99990] select-none">
        {/* Spotlight SVG Mask Overlay */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-auto transition-all duration-300"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <mask id="tour-spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              {targetRect && (
                <rect
                  x={targetRect.left - 8}
                  y={targetRect.top - 8}
                  width={targetRect.width + 16}
                  height={targetRect.height + 16}
                  rx="18"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(5, 8, 16, 0.78)"
            mask="url(#tour-spotlight-mask)"
          />
        </svg>

        {/* Glowing Spotlight Ring quanh Target Element */}
        {targetRect && (
          <motion.div
            layout
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{
              position: "fixed",
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
            }}
            className="rounded-2xl border-2 border-accent-music-glow shadow-[0_0_30px_rgba(52,211,153,0.5)] pointer-events-none z-[99995]"
          />
        )}

        {/* Tour Dialog Card - Centered via Flexbox or Fixed at Target */}
        {isCentered ? (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              key={currentStepIndex}
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="pointer-events-auto w-[92vw] max-w-[420px] bg-[#121622]/95 backdrop-blur-2xl border border-white/15 rounded-3xl p-5 sm:p-6 shadow-[0_24px_60px_rgba(0,0,0,0.85)] text-white"
            >
              {cardContent}
            </motion.div>
          </div>
        ) : (
          <motion.div
            key={currentStepIndex}
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            style={getCardStyle()}
            className="z-[99999] w-[92vw] max-w-[420px] bg-[#121622]/95 backdrop-blur-2xl border border-white/15 rounded-3xl p-5 sm:p-6 shadow-[0_24px_60px_rgba(0,0,0,0.85)] text-white"
          >
            {cardContent}
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
}
