"use client";

import { useState, useRef, useEffect, useCallback, startTransition, type ReactNode } from "react";
import { XIcon, ArrowsInSimpleIcon, ArrowsOutSimpleIcon, CaretLeftIcon } from "@phosphor-icons/react";
import { ModalShell } from "@/components/ui/ModalShell";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { saveStorage } from "@/lib/safe-storage";
import { cn } from "@/lib/utils";
import { setSheetExpanded } from "./sheet-zen-tracker";

interface MobileSheetShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  sheetId?: string;
  headerRight?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  maxHeightClassName?: string;
  heightClassName?: string;
  defaultZenMode?: boolean;
  allowZenMode?: boolean;
  footer?: ReactNode;
  footerClassName?: string;
  panelRef?: React.Ref<HTMLDivElement>;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  contentScroll?: boolean;
  /**
   * Giữ nội dung trong DOM sau lần mở đầu. Bật vì dựng lại danh sách thẻ/ghi chú
   * mỗi lần mở là ~100ms React + DOM trên máy yếu. Tắt với bảng có media
   * (phòng học, chat) để không nuôi video/Firestore ngầm khi đã đóng.
   */
  keepMounted?: boolean;
  hiddenStrategy?: "display" | "offscreen";
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
  allowZenMode = true,
  footer,
  footerClassName,
  panelRef,
  onSwipeLeft,
  onSwipeRight,
  contentScroll = true,
  keepMounted = true,
  hiddenStrategy,
  children,
}: MobileSheetShellProps) {
  const effectiveSheetId =
    sheetId ||
    (typeof title === "string" ? title
      .replace(/\s*\([^)]*\)\s*/g, "")
      .trim()
      .toLowerCase()
      : "sheet");

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
  const effectiveZenMode = allowZenMode ? isZenMode : false;

  // Khi mở bảng, đồng bộ chế độ xem theo lựa chọn đã lưu của người dùng
  useEffect(() => {
    if (isOpen) {
      setIsZenMode(getSavedZenMode());
    }
  }, [isOpen, getSavedZenMode]);

  // Đồng bộ trạng thái mở rộng toàn màn hình để ẩn MobileTopBar tránh nhìn xuyên thấu
  useEffect(() => {
    if (isOpen && effectiveZenMode) {
      setSheetExpanded(effectiveSheetId, true);
      return () => {
        setSheetExpanded(effectiveSheetId, false);
      };
    } else {
      setSheetExpanded(effectiveSheetId, false);
    }
  }, [isOpen, effectiveZenMode, effectiveSheetId]);

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

  // Hợp nhất ref bên ngoài và ref nội bộ
  const setCombinedRef = (el: HTMLDivElement | null) => {
    localPanelRef.current = el;
    assignRef(panelRef, el);
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
      panelKey={`mobile-sheet-${effectiveSheetId}`}
      panelRef={setCombinedRef}
      ariaLabel={typeof title === "string" ? title : sheetId || "Bảng điều khiển"}
      keepMounted={keepMounted}
      hiddenStrategy={hiddenStrategy}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8, transition: { duration: 0.15, ease: [0.32, 0, 0.67, 0] } }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      backdropClassName="sm:hidden"
      panelClassName={cn(
        "fixed z-50 flex flex-col text-white overflow-hidden sm:hidden transform-gpu will-change-transform sheet-motion-panel",
        effectiveZenMode
          ? "inset-x-2 bottom-[calc(var(--mobile-nav-height)+var(--app-safe-bottom)+var(--mobile-nav-safe-gap)+0.75rem)] h-[calc(100dvh-var(--app-safe-top)-var(--mobile-nav-height)-var(--app-safe-bottom)-var(--mobile-nav-safe-gap)-1.25rem)] max-h-[calc(100dvh-var(--app-safe-top)-var(--mobile-nav-height)-var(--app-safe-bottom)-var(--mobile-nav-safe-gap)-1.25rem)] rounded-[32px] bg-neutral-950/94 backdrop-blur-xl border border-white/[0.18] shadow-[0_24px_60px_rgba(0,0,0,0.85),inset_0_1px_2px_rgba(255,255,255,0.25)]"
          : `inset-x-3 bottom-[calc(var(--mobile-nav-height)+var(--app-safe-bottom)+var(--mobile-nav-safe-gap)+0.75rem)] rounded-[28px] bg-neutral-950/90 backdrop-blur-lg border border-white/[0.16] shadow-[0_20px_50px_rgba(0,0,0,0.75),inset_0_1px_1.5px_rgba(255,255,255,0.2)] max-h-[calc(100dvh-var(--app-safe-top)-var(--mobile-nav-height)-var(--app-safe-bottom)-var(--mobile-nav-safe-gap)-1.25rem)] ${
              heightClassName || maxHeightClassName || "h-[68dvh] max-h-[72dvh]"
            }`
      )}
    >
      {/* Mép kính bắt sáng trên đỉnh tấm kính mẹ */}
      <div
        aria-hidden="true"
        className="absolute inset-x-12 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none"
      />

      {/* Tiêu đề & Nút thao tác dạng kính: bên trái co giãn, bên phải giữ nguyên kích thước */}
      <div className="shrink-0 select-none">
        <div className="flex items-center px-3.5 py-2.5 border-b border-white/[0.12] gap-2">
          {/* Bên trái: Nút Quay lại + Tiêu đề / Bộ chuyển bảng */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-start">
          {/* Nút Quay lại (Back Button) khi ở Stack cấp 2 trở lên */}
          {onBack && (
            <button
              type="button"
              onClick={() => {
                startTransition(() => {
                  onBack();
                });
              }}
              title={backLabel ? `Quay lại ${backLabel}` : "Quay lại"}
              aria-label={backLabel ? `Quay lại ${backLabel}` : "Quay lại"}
              className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.18] active:scale-90 border border-white/15 flex items-center justify-center text-white/90 hover:text-white transition-[background-color,border-color,transform] duration-75 shrink-0 select-none shadow-sm cursor-pointer touch-manipulation"
            >
              <CaretLeftIcon className="w-4 h-4" weight="bold" />
            </button>
          )}

          {typeof title === "string" ? (
            <h3 className="min-w-0 flex-1 text-sm font-semibold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] truncate text-left">
            {title}
            </h3>
          ) : (
            <div className="min-w-0 flex-1 flex items-center">{title}</div>
          )}

          </div>

          {/* Nửa bên phải: Nút thao tác mở rộng + Zen Mode + Đóng */}
          <div className="flex items-center justify-end gap-1.5 shrink-0">
            {headerRight}

            {/* Nút chuyển chế độ Full-Screen Zen Overlay / Khay đáy */}
            {allowZenMode && (
              <button
                type="button"
                onClick={() => {
                  startTransition(() => {
                    handleToggleZenMode();
                  });
                }}
                title={effectiveZenMode ? "Thu gọn về dạng khay đáy" : "Mở rộng không gian Zen (Toàn màn hình)"}
                aria-label="Chuyển chế độ xem"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 border border-white/15 flex items-center justify-center text-white/80 hover:text-white transition-[background-color,border-color,transform] duration-75 shadow-sm cursor-pointer touch-manipulation"
              >
                <span className={cn("inline-flex transition-transform duration-300 ease-out", effectiveZenMode ? "rotate-180 scale-105" : "rotate-0 scale-100")}>
                  {effectiveZenMode ? (
                    <ArrowsInSimpleIcon className="w-3.5 h-3.5" weight="bold" />
                  ) : (
                    <ArrowsOutSimpleIcon className="w-3.5 h-3.5" weight="bold" />
                  )}
                </span>
              </button>
            )}

            {/* Nút Đóng */}
            <button
              type="button"
              onClick={() => {
                startTransition(() => {
                  onClose();
                });
              }}
              aria-label={typeof title === "string" ? `Đóng ${title}` : "Đóng"}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 border border-white/15 flex items-center justify-center text-white/80 hover:text-white transition-[background-color,border-color,transform] duration-75 shadow-sm cursor-pointer touch-manipulation"
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
        <div className={cn("shrink-0 border-t border-white/[0.08] bg-white/[0.02]", footerClassName)}>
          {footer}
        </div>
      )}
    </ModalShell>
  );
}

