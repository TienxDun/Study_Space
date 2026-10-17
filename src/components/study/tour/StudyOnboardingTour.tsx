"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  XIcon,
  CaretRightIcon,
  CaretLeftIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
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
      "Không gian học tập và làm việc tập trung tất-cả-trong-một. Cùng khám phá nhanh các công cụ chính nhé!",
    placement: "center",
  },
  {
    targetId: "tour-dock-scenes",
    title: "Đổi không gian bối cảnh",
    emoji: "🎬",
    description:
      "Chọn hơn 40 bối cảnh tĩnh và động (quán cafe, trời mưa, thư viện cổ, anime...) tạo cảm hứng học tập (Phím tắt: B).",
    placement: "right",
  },
  {
    targetId: "tour-music-player",
    title: "Cụm phát nhạc & Âm lượng",
    emoji: "🎵",
    description:
      "Dừng/phát nhạc, chuyển bài, chỉnh âm lượng hoặc kéo dải sóng âm để tua đến đoạn bạn yêu thích.",
    placement: "top",
  },
  {
    targetId: "tour-music-tab-btn",
    title: "Kho nhạc tập trung",
    emoji: "🎧",
    description:
      "Tuyển tập các danh sách phát Lofi Chill, Nhạc không lời Piano, Jazz giúp kích thích sóng não học bài.",
    placement: "top",
  },
  {
    targetId: "tour-music-mixer-btn",
    title: "Bộ trộn âm thanh thiên nhiên",
    emoji: "🌧️",
    description:
      "Trộn hơn 20 loại âm thanh tự nhiên như tiếng mưa rơi, sóng biển, tiếng chim hót, lửa bập bùng (Phím tắt: P).",
    placement: "top",
  },
  {
    targetId: "tour-dock-embed",
    title: "Đài phát YouTube & Spotify",
    emoji: "📻",
    description:
      "Dán liên kết hoặc chọn luồng phát nhạc bạn quen thuộc từ YouTube, Spotify và thu nhỏ góc màn hình (Phím tắt: E).",
    placement: "right",
  },
  {
    targetId: "tour-pomodoro-widget",
    title: "Đồng hồ hẹn giờ Pomodoro",
    emoji: "⏱️",
    description:
      "Rèn luyện tính kỷ luật với phương pháp 25 phút tập trung sâu, 5 phút nghỉ ngơi (Phím tắt: T).",
    placement: "bottom",
  },
  {
    targetId: "tour-dock-tasks",
    title: "Kế hoạch học tập Kanban",
    emoji: "📋",
    description:
      "Quản lý công việc cần làm, đang làm và hoàn thành dưới dạng bảng kéo thả trực quan (Phím tắt: K).",
    placement: "right",
  },
  {
    targetId: "tour-dock-notes",
    title: "Sổ ghi chép nhanh",
    emoji: "📝",
    description:
      "Ghi chú ý tưởng bài học với định dạng Markdown, hỗ trợ ghim cố định trên màn hình (Phím tắt: N).",
    placement: "right",
  },
  {
    targetId: "tour-dock-rooms",
    title: "Phòng học nhóm trực tuyến",
    emoji: "👥",
    description:
      "Tạo hoặc tham gia phòng học trực tuyến cùng bạn bè, cùng bật Pomodoro và trò chuyện giữ động lực (Phím tắt: G).",
    placement: "right",
  },
  {
    targetId: "tour-chat-fab",
    title: "Trợ lý học tập AI ZenBot",
    emoji: "🌱",
    description:
      "Người bạn đồng hành giải đáp thắc mắc, tóm tắt tài liệu và gợi ý phương pháp học tập hiệu quả (Phím tắt: C).",
    placement: "left",
  },
  {
    targetId: "tour-topbar-actions",
    title: "Chế độ Zen & Phím tắt",
    emoji: "🧘",
    description:
      "Bấm Z để ẩn sạch thanh công cụ bước vào chế độ siêu tập trung, bấm ? để xem toàn bộ danh mục phím tắt.",
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

// Tự động nhận diện và làm nổi bật các ký hiệu phím tắt (Z, ?, B, P, E, T, K, N, G, C) trong mô tả
function renderFormattedDescription(text: string) {
  const regex = /((?:Bấm|bấm)\s+[A-Z?]|Phím tắt:\s*[A-Z?])/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    const match = part.match(/^(Bấm|bấm|Phím tắt:)\s*([A-Z?])$/i);
    if (match) {
      return (
        <span key={index} className="inline-flex items-center gap-1">
          <span>{match[1]}</span>
          <kbd className="px-1.5 py-0.5 rounded-md bg-white/15 text-white font-mono text-[11px] font-semibold border border-white/25 shadow-xs">
            {match[2]}
          </kbd>
        </span>
      );
    }
    return part;
  });
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

    // Fallback chung: nút con chưa mount/tạm ẩn thì bắt vào neo gần nhất
    // để spotlight không rơi vào giữa màn hình vô nghĩa.
    if (!element) {
      const FALLBACK_ANCHOR: Record<string, string> = {
        "tour-music-tab-btn": "tour-music-player",
        "tour-music-mixer-btn": "tour-music-player",
      };
      const fallbackId = FALLBACK_ANCHOR[currentStep.targetId];
      if (fallbackId) {
        element = document.getElementById(fallbackId);
      }
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
    if (!isTourActive) return;
    updateTargetRect();
    // Cuộn/kéo cửa sổ bắn rất dày; gộp về 1 lần mỗi khung hình để khỏi
    // đo getBoundingClientRect + setState liên tục.
    let raf = 0;
    const handleUpdate = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(updateTargetRect);
    };
    window.addEventListener("resize", handleUpdate);
    window.addEventListener("scroll", handleUpdate);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleUpdate);
      window.removeEventListener("scroll", handleUpdate);
    };
  }, [updateTargetRect, currentStepIndex, isTourActive]);

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
          <XIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Body Description */}
      <p className="text-slate-300 text-sm leading-relaxed mt-2.5 min-h-[56px]">
        {renderFormattedDescription(currentStep.description)}
      </p>

      {/* Footer Controls */}
      <div className="flex items-center justify-between mt-5 pt-3.5 border-t border-white/10">
        {/* Step Counter Badge */}
        <span className="font-mono text-xs font-semibold text-slate-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full shadow-inner select-none">
          {`${currentStepIndex + 1} / ${TOUR_STEPS.length}`}
        </span>

        {/* Buttons Group */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
              currentStepIndex === 0
                ? "opacity-25 cursor-not-allowed text-slate-500 border border-transparent"
                : "text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer active:scale-95 shadow-xs"
            }`}
          >
            <CaretLeftIcon className="w-3.5 h-3.5" />
            <span>Quay lại</span>
          </button>

          <button
            onClick={handleNext}
            className="relative group overflow-hidden px-4.5 py-1.5 rounded-full text-xs font-bold text-emerald-950 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 bg-[length:200%_auto] hover:bg-right transition-[background-position,transform,box-shadow] duration-500 cursor-pointer active:scale-95 flex items-center gap-1.5 shadow-[0_0_18px_rgba(52,211,153,0.5),inset_0_1px_1px_rgba(255,255,255,0.7)] hover:shadow-[0_0_26px_rgba(52,211,153,0.75),inset_0_1px_1px_rgba(255,255,255,0.9)] border border-emerald-100/50 hover:scale-105"
          >
            {/* Vệt sáng lấp lánh (Shimmer glint) lướt qua định kỳ */}
            <span
              aria-hidden="true"
              className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none"
            />

            {/* Nội dung nút */}
            <span className="relative z-10 flex items-center gap-1.5">
              <span>{isLastStep ? "Bắt đầu ngay" : "Tiếp tục"}</span>
              {isLastStep ? (
                <SparkleIcon className="w-3.5 h-3.5 text-emerald-950 transition-transform duration-300 group-hover:scale-125 group-hover:rotate-12 animate-pulse" />
              ) : (
                <CaretRightIcon className="w-3.5 h-3.5 text-emerald-950 transition-transform duration-200 group-hover:translate-x-0.5" />
              )}
            </span>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <AnimatePresence>
      <div className="hidden sm:block fixed inset-0 z-[99990] select-none">
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
              className="pointer-events-auto w-[92vw] max-w-[420px] glass-panel hover:bg-black/45 p-5 sm:p-6 text-white"
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
            className="z-[99999] w-[92vw] max-w-[420px] glass-panel hover:bg-black/45 p-5 sm:p-6 text-white"
          >
            {cardContent}
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
}
