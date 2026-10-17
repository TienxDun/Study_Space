"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { XIcon, ArrowsInSimpleIcon, ArrowsOutSimpleIcon, CaretLeftIcon } from "@phosphor-icons/react";
import { ModalShell } from "@/components/ui/ModalShell";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { saveStorage } from "@/lib/safe-storage";
import { cn } from "@/lib/utils";

interface MobileSheetShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  sheetId?: string;
  headerRight?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  maxHeightClassName?: string;
  heightClassName?: string;
  defaultZenMode?: boolean;
  footer?: ReactNode;
  panelRef?: React.Ref<HTMLDivElement>;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  contentScroll?: boolean;
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
  onBack,
  backLabel,
  maxHeightClassName,
  heightClassName,
  defaultZenMode = false,
  footer,
  panelRef,
  onSwipeLeft,
  onSwipeRight,
  contentScroll = true,
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
  const localPanelRef = useRef<HTMLDivElement | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isDraggingDown = useRef(false);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isClosingByDrag, setIsClosingByDrag] = useState(false);

  // Khi mở bảng, đồng bộ chế độ xem theo lựa chọn đã lưu của người dùng và reset chuyển động
  useEffect(() => {
    if (isOpen) {
      setIsClosingByDrag(false);
      setIsZenMode(getSavedZenMode());
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      if (localPanelRef.current) {
        localPanelRef.current.style.removeProperty("display");
        localPanelRef.current.style.removeProperty("visibility");
        localPanelRef.current.style.removeProperty("opacity");
        localPanelRef.current.style.removeProperty("transform");
        localPanelRef.current.style.removeProperty("transition");
      }
    }
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [isOpen, getSavedZenMode]);

  const handleToggleZenMode = () => {
    if (localPanelRef.current) {
      localPanelRef.current.style.removeProperty("transform");
      localPanelRef.current.style.removeProperty("transition");
    }
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

  // Kéo xuống đóng bảng hoặc vuốt lên phóng to toàn màn hình
  const handleTouchStart = (e: React.TouchEvent) => {
    // Không kích hoạt kéo vuốt nếu người dùng chạm vào các nút chức năng trên header
    const target = e.target as Node | null;
    const targetEl = target instanceof Element ? target : target?.parentElement;
    if (targetEl?.closest("button") || targetEl?.closest("input") || targetEl?.closest("a")) return;

    const touch = e.touches[0];
    if (!touch) return;

    touchStartY.current = touch.clientY;
    isDraggingDown.current = true;
    if (localPanelRef.current) {
      localPanelRef.current.style.transition = "none";
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingDown.current || touchStartY.current === null) return;
    const touch = e.touches[0];
    if (!touch) return;

    const diff = touch.clientY - touchStartY.current;
    if (diff > 0) {
      // Kéo xuống dưới: bám sát 1:1 theo ngón tay
      if (localPanelRef.current) {
        localPanelRef.current.style.transform = `translateY(${diff}px)`;
        localPanelRef.current.style.opacity = `${Math.max(0.3, 1 - diff / (window.innerHeight || 800))}`;
      }
    } else {
      // Kéo lên trên: độ đàn hồi co giãn nhẹ (rubber-band)
      if (localPanelRef.current) {
        const resistance = !isZenMode ? diff * 0.35 : 0;
        localPanelRef.current.style.transform = `translateY(${resistance}px)`;
        localPanelRef.current.style.opacity = "1";
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDraggingDown.current || touchStartY.current === null) return;
    const touch = e.changedTouches[0] || e.touches[0];
    const diff = touch ? touch.clientY - touchStartY.current : 0;
    isDraggingDown.current = false;
    touchStartY.current = null;

    // 1. Vuốt lên trên (diff < -35px): Phóng to bảng thành Zen Mode
    if (diff < -35) {
      if (!isZenMode) {
        if (localPanelRef.current) {
          localPanelRef.current.style.removeProperty("transform");
          localPanelRef.current.style.removeProperty("transition");
        }
        handleToggleZenMode();
        return;
      } else {
        if (localPanelRef.current) {
          localPanelRef.current.style.transition =
            "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)";
          localPanelRef.current.style.transform = "translateY(0px)";
        }
        return;
      }
    }

    // 2. Vuốt xuống dưới (diff >= 55px):
    // Người dùng vuốt xuống: bảng trượt thẳng xuống dưới để tắt dứt khoát, không bao giờ nảy ngược lên!
    if (diff >= 55) {
      setIsClosingByDrag(true);
      if (localPanelRef.current) {
        localPanelRef.current.style.transition =
          "transform 0.18s cubic-bezier(0.32, 0, 0.67, 0), opacity 0.16s ease-out";
        localPanelRef.current.style.transform = "translateY(100vh)";
        localPanelRef.current.style.opacity = "0";
      }
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        // Trước khi unmount, ép ẩn hoàn toàn panel để AnimatePresence không thể flash lại vị trí y=0
        if (localPanelRef.current) {
          localPanelRef.current.style.setProperty("display", "none", "important");
          localPanelRef.current.style.setProperty("visibility", "hidden", "important");
          localPanelRef.current.style.setProperty("opacity", "0", "important");
          localPanelRef.current.style.setProperty("transform", "translateY(100vh)", "important");
        }
        onClose();
      }, 180);
      return;
    }

    // Chưa đủ ngưỡng vuốt xuống (< 55px) -> Đàn hồi bật nảy nhẹ về vị trí ban đầu
    if (localPanelRef.current) {
      localPanelRef.current.style.transition =
        "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease-out";
      localPanelRef.current.style.transform = "translateY(0px)";
      localPanelRef.current.style.opacity = "1";
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
    const touch = e.touches[0];
    if (!touch) return;
    contentTouchStartX.current = touch.clientX;
    contentTouchStartY.current = touch.clientY;
  };

  const handleContentTouchEnd = (e: React.TouchEvent) => {
    if (contentTouchStartX.current === null || contentTouchStartY.current === null) return;
    const touch = e.changedTouches[0] || e.touches[0];
    if (!touch) {
      contentTouchStartX.current = null;
      contentTouchStartY.current = null;
      return;
    }
    const deltaX = touch.clientX - contentTouchStartX.current;
    const deltaY = touch.clientY - contentTouchStartY.current;

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
      initial={{ opacity: 0, y: 72, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={
        isClosingByDrag
          ? { opacity: 0, y: "100%", transition: { duration: 0 } }
          : { opacity: 0, y: "100%", transition: { duration: 0.22, ease: [0.32, 0, 0.67, 0] } }
      }
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      backdropClassName="sm:hidden"
      panelClassName={cn(
        "fixed z-50 flex flex-col text-white overflow-hidden sm:hidden transform-gpu sheet-motion-panel will-change-[height,max-height,left,right]",
        isZenMode
          ? "inset-x-2 bottom-[calc(var(--mobile-nav-height)+var(--app-safe-bottom)+var(--mobile-nav-safe-gap)+0.75rem)] h-[calc(100dvh-var(--mobile-nav-height)-var(--app-safe-bottom)-var(--mobile-nav-safe-gap)-1.25rem)] max-h-[calc(100dvh-var(--mobile-nav-height)-var(--app-safe-bottom)-var(--mobile-nav-safe-gap)-1.25rem)] rounded-[32px] bg-neutral-950/94 backdrop-blur-xl border border-white/[0.18] shadow-[0_24px_60px_rgba(0,0,0,0.85),inset_0_1px_2px_rgba(255,255,255,0.25)]"
          : `inset-x-3 bottom-[calc(var(--mobile-nav-height)+var(--app-safe-bottom)+var(--mobile-nav-safe-gap)+0.75rem)] rounded-[28px] bg-neutral-950/90 backdrop-blur-lg border border-white/[0.16] shadow-[0_20px_50px_rgba(0,0,0,0.75),inset_0_1px_1.5px_rgba(255,255,255,0.2)] ${
              heightClassName || maxHeightClassName || "h-[68dvh] max-h-[72dvh]"
            }`
      )}
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
        className="shrink-0 select-none cursor-grab active:cursor-grabbing touch-none"
      >
        {/* Thanh nắm tay kéo (Pill Handle) tối giản chuẩn Apple Sheet */}
        <div className="pt-2.5 pb-1 flex items-center justify-center">
          <span
            aria-hidden="true"
            className="h-1.5 w-12 rounded-full bg-white/30 hover:bg-white/50 active:bg-white/60 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
          />
        </div>

        {/* Tiêu đề & Nút thao tác dạng kính */}
        <div className="flex items-center justify-between px-3.5 pb-2.5 pt-0.5 border-b border-white/[0.12] gap-2">
          {/* Nút Quay lại (Back Button) khi ở Stack cấp 2 trở lên */}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              title={backLabel ? `Quay lại ${backLabel}` : "Quay lại"}
              aria-label={backLabel ? `Quay lại ${backLabel}` : "Quay lại"}
              className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.18] active:scale-90 border border-white/15 flex items-center justify-center text-white/90 hover:text-white transition-all shrink-0 select-none shadow-sm cursor-pointer"
            >
              <CaretLeftIcon className="w-4 h-4" weight="bold" />
            </button>
          )}

          <h3 className="text-sm font-semibold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] truncate flex-1 text-left">
            {title}
          </h3>

          <div className="flex items-center gap-1.5 shrink-0">
            {headerRight}

            {/* Nút chuyển chế độ Full-Screen Zen Overlay / Khay đáy */}
            <button
              type="button"
              onClick={handleToggleZenMode}
              title={isZenMode ? "Thu gọn về dạng khay đáy" : "Mở rộng không gian Zen (Toàn màn hình)"}
              aria-label="Chuyển chế độ xem"
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 border border-white/15 flex items-center justify-center text-white/80 hover:text-white transition-all shadow-sm cursor-pointer"
            >
              <span className={cn("inline-flex transition-transform duration-300 ease-out", isZenMode ? "rotate-180 scale-105" : "rotate-0 scale-100")}>
                {isZenMode ? (
                  <ArrowsInSimpleIcon className="w-3.5 h-3.5" weight="bold" />
                ) : (
                  <ArrowsOutSimpleIcon className="w-3.5 h-3.5" weight="bold" />
                )}
              </span>
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
        className={cn(
          "flex-1 min-h-0 flex flex-col custom-study-scroll pb-2 touch-pan-y overscroll-contain no-scrollbar",
          contentScroll ? "overflow-y-auto" : "overflow-hidden"
        )}
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

