"use client";

import { useState, useRef, type ReactNode } from "react";
import { XIcon, ArrowsInSimpleIcon, ArrowsOutSimpleIcon } from "@phosphor-icons/react";
import { ModalShell } from "@/components/ui/ModalShell";

interface MobileSheetShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  headerRight?: ReactNode;
  maxHeightClassName?: string;
  heightClassName?: string;
  defaultZenMode?: boolean;
  footer?: ReactNode;
  panelRef?: React.Ref<HTMLDivElement>;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  children: ReactNode;
}

// Khung bảng đáy Liquid Glass & Full-Screen Zen Overlay cho mobile
export function MobileSheetShell({
  isOpen,
  onClose,
  title,
  headerRight,
  maxHeightClassName,
  heightClassName,
  defaultZenMode = true,
  footer,
  panelRef,
  onSwipeLeft,
  onSwipeRight,
  children,
}: MobileSheetShellProps) {
  const [isZenMode, setIsZenMode] = useState(defaultZenMode);
  const touchStartY = useRef<number | null>(null);

  // Kéo xuống trên thanh nắm tay để đóng bảng
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const diff = e.changedTouches[0].clientY - touchStartY.current;
    // Nếu vuốt xuống hơn 50px thì kích hoạt đóng bảng
    if (diff > 50) {
      onClose();
    }
    touchStartY.current = null;
  };

  // Cử chỉ vuốt ngang trái / phải bao phủ 100% diện tích nội dung & khoảng trống
  const contentTouchStartX = useRef<number | null>(null);
  const contentTouchStartY = useRef<number | null>(null);

  const handleContentTouchStart = (e: React.TouchEvent) => {
    if (!onSwipeLeft && !onSwipeRight) return;
    contentTouchStartX.current = e.touches[0].clientX;
    contentTouchStartY.current = e.touches[0].clientY;
  };

  const handleContentTouchEnd = (e: React.TouchEvent) => {
    if (contentTouchStartX.current === null || contentTouchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - contentTouchStartX.current;
    const deltaY = e.changedTouches[0].clientY - contentTouchStartY.current;

    // Ngưỡng vuốt ngang dứt khoát: khoảng cách ngang > 35px và góc ngang trội hơn dọc
    if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      if (deltaX < 0) {
        onSwipeLeft?.();
      } else {
        onSwipeRight?.();
      }
    }
    contentTouchStartX.current = null;
    contentTouchStartY.current = null;
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      panelKey={`mobile-sheet-${title}`}
      panelRef={panelRef}
      ariaLabel={title}
      initial={{ opacity: 0, y: 40, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 40, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      backdropClassName="sm:hidden"
      panelClassName={
        isZenMode
          ? "fixed inset-x-2 top-2.5 bottom-[calc(var(--mobile-nav-height)+var(--app-safe-bottom)+var(--mobile-nav-safe-gap)+0.75rem)] z-50 flex flex-col rounded-[32px] bg-neutral-950/92 backdrop-blur-3xl backdrop-saturate-150 border border-white/[0.18] shadow-[0_32px_80px_rgba(0,0,0,0.85),inset_0_1px_2px_rgba(255,255,255,0.3)] text-white overflow-hidden sm:hidden transition-all duration-300"
          : `fixed inset-x-3 bottom-[calc(var(--mobile-nav-height)+var(--app-safe-bottom)+var(--mobile-nav-safe-gap)+0.75rem)] z-50 flex flex-col rounded-[28px] bg-neutral-950/85 backdrop-blur-2xl backdrop-saturate-150 border border-white/[0.16] shadow-[0_24px_60px_rgba(0,0,0,0.75),inset_0_1px_1.5px_rgba(255,255,255,0.25)] text-white overflow-hidden sm:hidden transition-all duration-300 ${
              heightClassName || maxHeightClassName || "max-h-[72dvh]"
            }`
      }
    >
      {/* Mép kính bắt sáng trên đỉnh tấm kính mẹ */}
      <div
        aria-hidden="true"
        className="absolute inset-x-12 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none"
      />

      {/* Vùng kéo gạt trên đỉnh: hỗ trợ vuốt ngón tay xuống để đóng bảng */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="pt-2 pb-1 flex flex-col items-center justify-center shrink-0 cursor-grab active:cursor-grabbing select-none"
      >
        <span
          aria-hidden="true"
          className="w-12 h-1.5 rounded-full bg-white/30 hover:bg-white/50 active:bg-white/60 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
        />
      </div>

      {/* Tiêu đề & Nút thao tác dạng kính */}
      <div className="flex items-center justify-between px-4 pb-2.5 pt-0.5 border-b border-white/[0.12] shrink-0">
        <h3 className="text-sm font-semibold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] truncate">
          {title}
        </h3>
        <div className="flex items-center gap-1.5">
          {headerRight}

          {/* Nút chuyển chế độ Full-Screen Zen Overlay / Khay đáy */}
          <button
            type="button"
            onClick={() => setIsZenMode((prev) => !prev)}
            title={isZenMode ? "Thu gọn về dạng khay đáy" : "Mở rộng không gian Zen (Toàn màn hình)"}
            aria-label="Chuyển chế độ xem"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 border border-white/15 flex items-center justify-center text-white/80 hover:text-white transition-all shadow-sm"
          >
            {isZenMode ? (
              <ArrowsInSimpleIcon className="w-3.5 h-3.5" weight="bold" />
            ) : (
              <ArrowsOutSimpleIcon className="w-3.5 h-3.5" weight="bold" />
            )}
          </button>

          {/* Nút Đóng */}
          <button
            type="button"
            onClick={onClose}
            aria-label={`Đóng ${title}`}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 border border-white/15 flex items-center justify-center text-white/80 hover:text-white transition-all shadow-sm"
          >
            <XIcon className="w-4 h-4" weight="bold" />
          </button>
        </div>
      </div>

      {/* Nội dung cuộn bên trong - nhận diện vuốt ở toàn bộ 100% diện tích gồm cả khoảng trống */}
      <div
        onTouchStart={handleContentTouchStart}
        onTouchEnd={handleContentTouchEnd}
        className="flex-1 min-h-0 overflow-y-auto flex flex-col custom-study-scroll pb-2 touch-pan-y"
      >
        {children}
      </div>

      {/* Cụm điều khiển cố định ở đáy (Thumb-Zone) */}
      {footer && (
        <div className="shrink-0 border-t border-white/[0.12] bg-neutral-950/70 backdrop-blur-xl">
          {footer}
        </div>
      )}
    </ModalShell>
  );
}

