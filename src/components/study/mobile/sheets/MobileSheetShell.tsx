"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { XIcon, ArrowsInSimpleIcon, ArrowsOutSimpleIcon } from "@phosphor-icons/react";
import { ModalShell } from "@/components/ui/ModalShell";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { saveStorage } from "@/lib/safe-storage";

interface MobileSheetShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  sheetId?: string;
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

function assignRef<T>(ref: React.Ref<T> | undefined, el: T | null) {
  if (!ref) return;
  if (typeof ref === "function") ref(el);
  else (ref as React.MutableRefObject<T | null>).current = el;
}

// Khung bảng đáy Liquid Glass & Full-Screen Zen Overlay cho mobile
export function MobileSheetShell({
  isOpen,
  onClose,
  title,
  sheetId,
  headerRight,
  maxHeightClassName,
  heightClassName,
  defaultZenMode = false,
  footer,
  panelRef,
  onSwipeLeft,
  onSwipeRight,
  children,
}: MobileSheetShellProps) {
  const effectiveSheetId =
    sheetId ||
    title
      .replace(/\s*\([^)]*\)\s*/g, "")
      .trim()
      .toLowerCase();

  const getSavedZenMode = useCallback((): boolean => {
    if (typeof window === "undefined") return defaultZenMode;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.mobileSheetZenMap);
      if (raw) {
        const map = JSON.parse(raw);
        if (typeof map[effectiveSheetId] === "boolean") {
          return map[effectiveSheetId];
        }
      }
    } catch {}
    return defaultZenMode;
  }, [defaultZenMode, effectiveSheetId]);

  const [isZenMode, setIsZenMode] = useState<boolean>(defaultZenMode);
  const [isClosingByDrag, setIsClosingByDrag] = useState(false);
  const localPanelRef = useRef<HTMLDivElement | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isDraggingDown = useRef(false);

  // Khi mở bảng, đồng bộ chế độ xem theo lựa chọn đã lưu của người dùng và reset chuyển động
  useEffect(() => {
    if (isOpen) {
      setIsZenMode(getSavedZenMode());
      setIsClosingByDrag(false);
      if (localPanelRef.current) {
        localPanelRef.current.style.removeProperty("display");
        localPanelRef.current.style.transform = "";
        localPanelRef.current.style.opacity = "";
        localPanelRef.current.style.transition = "";
      }
    }
  }, [isOpen, getSavedZenMode]);

  const handleToggleZenMode = () => {
    setIsZenMode((prev) => {
      const next = !prev;
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.mobileSheetZenMap);
        const map = raw ? JSON.parse(raw) : {};
        map[effectiveSheetId] = next;
        saveStorage(STORAGE_KEYS.mobileSheetZenMap, JSON.stringify(map));
      } catch {}
      return next;
    });
  };

  // Hợp nhất ref bên ngoài và ref nội bộ để điều khiển trực tiếp chuyển động trượt
  const setCombinedRef = (el: HTMLDivElement | null) => {
    localPanelRef.current = el;
    assignRef(panelRef, el);
  };

  // Kéo xuống trên vùng đỉnh: bảng bám sát ngón tay 1:1 theo thời gian thực (tới đâu đóng tới đó)
  const handleTouchStart = (e: React.TouchEvent) => {
    // Không kích hoạt kéo vuốt nếu người dùng chạm vào các nút chức năng trên header
    if ((e.target as HTMLElement).closest("button")) return;
    touchStartY.current = e.touches[0].clientY;
    isDraggingDown.current = true;
    if (localPanelRef.current) {
      localPanelRef.current.style.transition = "none";
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingDown.current || touchStartY.current === null) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0) {
      // Bám sát 1:1 theo vị trí ngón tay của người dùng: ngón tay kéo tới đâu, thẻ hạ xuống tới đó
      if (localPanelRef.current) {
        localPanelRef.current.style.transform = `translateY(${diff}px)`;
        localPanelRef.current.style.opacity = `${Math.max(0.3, 1 - diff / (window.innerHeight || 800))}`;
      }
    } else {
      if (localPanelRef.current) {
        localPanelRef.current.style.transform = "translateY(0px)";
        localPanelRef.current.style.opacity = "1";
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDraggingDown.current || touchStartY.current === null) return;
    const diff = e.changedTouches[0].clientY - touchStartY.current;
    isDraggingDown.current = false;
    touchStartY.current = null;

    if (diff > 75) {
      // Đủ ngưỡng -> Đánh dấu đóng bằng cử chỉ vuốt để triệt tiêu hiệu ứng giật khung hình của Framer Motion
      setIsClosingByDrag(true);
      if (localPanelRef.current) {
        localPanelRef.current.style.transition =
          "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease-out";
        localPanelRef.current.style.transform = "translateY(100%)";
        localPanelRef.current.style.opacity = "0";
      }
      setTimeout(() => {
        // Ẩn tuyệt đối khỏi DOM ngay trước khi unmount để không bao giờ có layer bị nhảy giật lại
        if (localPanelRef.current) {
          localPanelRef.current.style.setProperty("display", "none", "important");
        }
        onClose();
      }, 200);
    } else {
      // Chưa đủ ngưỡng -> Đàn hồi bật nảy dội về vị trí ban đầu
      if (localPanelRef.current) {
        localPanelRef.current.style.transition =
          "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease-out";
        localPanelRef.current.style.transform = "translateY(0px)";
        localPanelRef.current.style.opacity = "1";
      }
    }
  };

  const handleTouchCancel = () => {
    isDraggingDown.current = false;
    touchStartY.current = null;
    if (localPanelRef.current) {
      localPanelRef.current.style.transition =
        "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease-out";
      localPanelRef.current.style.transform = "translateY(0px)";
      localPanelRef.current.style.opacity = "1";
    }
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
      panelRef={setCombinedRef}
      ariaLabel={title}
      initial={{ opacity: 0, y: 40, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={
        isClosingByDrag
          ? { opacity: 0, transition: { duration: 0 } }
          : { opacity: 0, y: 40, scale: 0.98 }
      }
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      backdropClassName="sm:hidden"
      panelClassName={
        isZenMode
          ? "fixed inset-x-2 top-2.5 bottom-[calc(var(--mobile-nav-height)+var(--app-safe-bottom)+var(--mobile-nav-safe-gap)+0.75rem)] z-50 flex flex-col rounded-[32px] bg-neutral-950/94 backdrop-blur-xl border border-white/[0.18] shadow-[0_24px_60px_rgba(0,0,0,0.85),inset_0_1px_2px_rgba(255,255,255,0.25)] text-white overflow-hidden sm:hidden transform-gpu"
          : `fixed inset-x-3 bottom-[calc(var(--mobile-nav-height)+var(--app-safe-bottom)+var(--mobile-nav-safe-gap)+0.75rem)] z-50 flex flex-col rounded-[28px] bg-neutral-950/90 backdrop-blur-lg border border-white/[0.16] shadow-[0_20px_50px_rgba(0,0,0,0.75),inset_0_1px_1.5px_rgba(255,255,255,0.2)] text-white overflow-hidden sm:hidden transform-gpu ${
              heightClassName || maxHeightClassName || "max-h-[72dvh]"
            }`
      }
    >
      {/* Mép kính bắt sáng trên đỉnh tấm kính mẹ */}
      <div
        aria-hidden="true"
        className="absolute inset-x-12 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none"
      />

      {/* Vùng kéo gạt trên đỉnh & Tiêu đề: hỗ trợ ngón tay kéo xuống 1:1 mượt mà để đóng bảng */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        className="shrink-0 select-none cursor-grab active:cursor-grabbing"
      >
        {/* Thanh nắm tay kéo (Pill Handle) tối giản chuẩn Apple Sheet */}
        <div className="pt-2.5 pb-1 flex items-center justify-center">
          <span
            aria-hidden="true"
            className="h-1.5 w-12 rounded-full bg-white/30 hover:bg-white/50 active:bg-white/60 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
          />
        </div>

        {/* Tiêu đề & Nút thao tác dạng kính */}
        <div className="flex items-center justify-between px-4 pb-2.5 pt-0.5 border-b border-white/[0.12]">
          <h3 className="text-sm font-semibold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] truncate">
            {title}
          </h3>
        <div className="flex items-center gap-1.5">
          {headerRight}

          {/* Nút chuyển chế độ Full-Screen Zen Overlay / Khay đáy */}
          <button
            type="button"
            onClick={handleToggleZenMode}
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
    </div>

      {/* Nội dung cuộn bên trong - nhận diện vuốt ở toàn bộ 100% diện tích gồm cả khoảng trống */}
      <div
        onTouchStart={handleContentTouchStart}
        onTouchEnd={handleContentTouchEnd}
        className="flex-1 min-h-0 overflow-y-auto flex flex-col custom-study-scroll pb-2 touch-pan-y overscroll-contain no-scrollbar"
      >
        {children}
      </div>

      {/* Cụm điều khiển cố định ở đáy (Thumb-Zone) */}
      {footer && (
        <div className="shrink-0 border-t border-white/[0.12] bg-neutral-950/85">
          {footer}
        </div>
      )}
    </ModalShell>
  );
}

