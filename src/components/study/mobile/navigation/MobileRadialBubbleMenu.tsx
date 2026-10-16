"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  ChartBarIcon,
  ImageIcon,
  UsersIcon,
  RadioIcon,
  XIcon,
} from "@phosphor-icons/react";
import { StudySproutMascot } from "@/components/study/chat/components/StudySproutMascot";
import { GlassIcon } from "@/components/ui/GlassIcon";

interface MobileRadialBubbleMenuProps {
  onOpenChat: () => void;
  onOpenScenes: () => void;
  onOpenRooms: () => void;
  onOpenRadio: () => void;
  onOpenStats: () => void;
}

export const MobileRadialBubbleMenu = React.memo(function MobileRadialBubbleMenu({
  onOpenChat,
  onOpenScenes,
  onOpenRooms,
  onOpenRadio,
  onOpenStats,
}: MobileRadialBubbleMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasAudioBar, setHasAudioBar] = useState(false);
  const [hasRoomPill, setHasRoomPill] = useState(false);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggeredRef = useRef(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  React.useEffect(() => {
    const handleAudioBarChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setHasAudioBar(Boolean(detail?.hasAudioBar));
    };

    const handleRoomPillChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setHasRoomPill(Boolean(detail?.hasRoomPill));
    };

    if (typeof document !== "undefined") {
      const playerEl = document.getElementById("tour-music-player");
      if (playerEl && playerEl.querySelector("[aria-label*='đài phát']")) {
        setHasAudioBar(true);
      }
      setHasRoomPill(Boolean(document.getElementById("mobile-active-room-pill")));
    }

    window.addEventListener("zenstudy:active-audio-bar", handleAudioBarChange);
    window.addEventListener("zenstudy:active-room-pill", handleRoomPillChange);
    return () => {
      window.removeEventListener("zenstudy:active-audio-bar", handleAudioBarChange);
      window.removeEventListener("zenstudy:active-room-pill", handleRoomPillChange);
    };
  }, []);

  const toggleOpen = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(25);
      } catch {}
    }
    setIsOpen((prev) => !prev);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  }, []);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  const startLongPress = useCallback(
    (clientX: number, clientY: number) => {
      isLongPressTriggeredRef.current = false;
      touchStartPosRef.current = { x: clientX, y: clientY };

      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

      longPressTimerRef.current = setTimeout(() => {
        isLongPressTriggeredRef.current = true;
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          try {
            navigator.vibrate([35, 45]);
          } catch {}
        }
        closeMenu();
        onOpenChat();
      }, 450);
    },
    [closeMenu, onOpenChat]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartPosRef.current) return;
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
      const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
      if (dx > 10 || dy > 10) {
        cancelLongPress();
      }
    },
    [cancelLongPress]
  );

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  /**
   * Bán kính xòe quạt R = 98px từ tâm nút gốc ở góc dưới bên phải.
   * Góc bung từ 90° (thẳng đứng lên trên) đến 180° (thẳng sang trái)
   * tương ứng cung phần tư Tây Bắc (North-West Arc):
   * 1. 90°: x = 0, y = -98px (Chatbot AI)
   * 2. 120°: x = -49px, y = -85px (Cảnh)
   * 3. 150°: x = -85px, y = -49px (Phòng học nhóm)
   * 4. 180°: x = -98px, y = 0px (Đài phát thanh)
   */
  /**
   * Bán kính xòe quạt chuẩn hình học lượng giác đồng tâm (R = 108px).
   * Cả 4 nút bong bóng và 4 nhãn tiêu đề đều được phân bổ dàn đều hoàn hảo,
   * uốn lượn song hành theo nan quạt tròn, đối xứng và thanh lịch.
   */
  const items = useMemo(
    () => [
      {
        id: "focus-stats",
        label: "Thống kê",
        icon: <ChartBarIcon className="w-5 h-5 text-white/95" weight="fill" />,
        x: 0,
        y: -108,
        labelAlignClass: "-translate-y-[130%] mr-2",
        onClick: () => {
          closeMenu();
          onOpenStats();
        },
      },
      {
        id: "scenes-picker",
        label: "Cảnh không gian",
        icon: <ImageIcon className="w-5 h-5 text-white/95" weight="fill" />,
        x: -54,
        y: -94,
        labelAlignClass: "-translate-y-[65%] mr-3",
        onClick: () => {
          closeMenu();
          onOpenScenes();
        },
      },
      {
        id: "study-rooms",
        label: "Phòng học nhóm",
        icon: <UsersIcon className="w-5 h-5 text-white/95" weight="fill" />,
        x: -94,
        y: -54,
        labelAlignClass: "-translate-y-1/2 mr-3",
        onClick: () => {
          closeMenu();
          onOpenRooms();
        },
      },
      {
        id: "radio-embed",
        label: "Đài phát thanh",
        icon: <RadioIcon className="w-5 h-5 text-white/95" weight="fill" />,
        x: -108,
        y: 0,
        labelAlignClass: "-translate-y-1/2 mr-3",
        onClick: () => {
          closeMenu();
          onOpenRadio();
        },
      },
    ],
    [closeMenu, onOpenStats, onOpenScenes, onOpenRooms, onOpenRadio]
  );

  return (
    <>
      {/* Backdrop mờ nền khi mở quạt - Thường trực DOM, fade bằng opacity GPU */}
      <div
        aria-hidden="true"
        onClick={closeMenu}
        className={`fixed inset-0 z-[55] bg-black/40 backdrop-blur-[2px] sm:hidden transition-opacity duration-200 ease-out ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Container nút gốc tại góc dưới bên phải - tự động nâng lên tầng trên nếu có thanh nhạc/đài */}
      <div
        className="fixed z-[60] right-3.5 sm:hidden select-none pointer-events-none transition-[bottom] duration-300 ease-out"
        style={{
          bottom: hasAudioBar
            ? hasRoomPill
              ? "calc(var(--mobile-nav-height) + var(--app-safe-bottom) + var(--mobile-nav-safe-gap) + 4.25rem + 4px)"
              : "calc(var(--mobile-nav-height) + var(--app-safe-bottom) + var(--mobile-nav-safe-gap) + 1rem + 4px)"
            : hasRoomPill
            ? "calc(var(--mobile-nav-height) + var(--app-safe-bottom) + var(--mobile-nav-safe-gap) + 0.65rem)"
            : "calc(var(--mobile-nav-height) + var(--app-safe-bottom) + var(--mobile-nav-safe-gap) + 1.25rem)",
        }}
      >
        <div className="relative w-[52px] h-[52px] flex items-center justify-center pointer-events-auto">
          {/* Cụm bong bóng con bung tỏa hình nan quạt (Phong cách Kính lỏng Pure Liquid Glass) */}
          {items.map((item, index) => {
            const transitionDelay = isOpen
              ? `${index * 30}ms`
              : `${(items.length - 1 - index) * 20}ms`;

            const labelDelay = isOpen
              ? `${index * 30 + 35}ms`
              : `${(items.length - 1 - index) * 15}ms`;

            return (
              <div
                key={item.id}
                className="absolute flex items-center justify-center will-change-transform"
                style={{
                  zIndex: 20 - index,
                  transform: isOpen
                    ? `translate3d(${item.x}px, ${item.y}px, 0) scale(1)`
                    : `translate3d(0, 0, 0) scale(0.2)`,
                  opacity: isOpen ? 1 : 0,
                  pointerEvents: isOpen ? "auto" : "none",
                  transition: `transform ${
                    isOpen
                      ? "0.34s cubic-bezier(0.34, 1.56, 0.64, 1)"
                      : "0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                  } ${transitionDelay}, opacity ${
                    isOpen ? "0.22s" : "0.15s"
                  } ease ${transitionDelay}`,
                }}
              >
                {/* Nhãn tiêu đề nội dung nút (Dàn đều theo nan quạt: Đổ bóng 3D, không nền, không viền) */}
                <button
                  type="button"
                  onClick={item.onClick}
                  tabIndex={isOpen ? 0 : -1}
                  aria-hidden={!isOpen}
                  className={`absolute right-full py-1 px-1 flex items-center justify-end select-none cursor-pointer active:scale-95 transition-all duration-200 whitespace-nowrap top-1/2 ${item.labelAlignClass} ${
                    isOpen
                      ? "opacity-100 translate-x-0 scale-100 pointer-events-auto"
                      : "opacity-0 translate-x-2 scale-90 pointer-events-none"
                  }`}
                  style={{
                    transitionDelay: labelDelay,
                  }}
                >
                  <span className="text-[12.5px] font-semibold text-white tracking-wide filter drop-shadow-[0_1.5px_4px_rgba(0,0,0,0.95)]">
                    {item.label}
                  </span>
                </button>

                {/* Bong bóng kính lỏng trong suốt thuần khiết (Pure Liquid Glass - No Color) */}
                <GlassIcon
                  icon={item.icon}
                  label={item.label}
                  title={item.label}
                  aria-label={item.label}
                  variant="liquid"
                  plate="none"
                  size={46}
                  onClick={item.onClick}
                  tabIndex={isOpen ? 0 : -1}
                />
              </div>
            );
          })}

          {/* Nút Trigger gốc (Chứa linh vật Mascot mầm cây StudySprout) */}
          <button
            type="button"
            onClick={() => {
              if (isLongPressTriggeredRef.current) {
                isLongPressTriggeredRef.current = false;
                return;
              }
              toggleOpen();
            }}
            onTouchStart={(e) => {
              const touch = e.touches[0];
              startLongPress(touch.clientX, touch.clientY);
            }}
            onTouchMove={handleTouchMove}
            onTouchEnd={cancelLongPress}
            onTouchCancel={cancelLongPress}
            onMouseDown={(e) => startLongPress(e.clientX, e.clientY)}
            onMouseMove={(e) => {
              if (!touchStartPosRef.current) return;
              const dx = Math.abs(e.clientX - touchStartPosRef.current.x);
              const dy = Math.abs(e.clientY - touchStartPosRef.current.y);
              if (dx > 10 || dy > 10) cancelLongPress();
            }}
            onMouseUp={cancelLongPress}
            onMouseLeave={cancelLongPress}
            aria-label={isOpen ? "Đóng menu tiện ích" : "Mở menu tiện ích nhanh (Nhấn giữ để mở Chatbot AI)"}
            title="Chạm để mở menu, Nhấn giữ để mở Chatbot AI"
            aria-expanded={isOpen}
            className="relative z-10 w-[52px] h-[52px] rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform duration-150 touch-manipulation select-none"
          >
            {/* Đĩa nền tròn kính lỏng trong suốt - đồng bộ 100% với lg-bubble */}
            <div
              className="absolute inset-0 rounded-full lg-bubble pointer-events-none transition-all duration-200 ease-out"
              style={{
                opacity: isOpen ? 1 : 0,
                transform: isOpen ? "scale(1)" : "scale(0.5)",
              }}
            />

            {/* Mascot: Giữ thường trực trong DOM, không mount/unmount để tránh giật lag render */}
            <div
              className="absolute inset-0 flex items-center justify-center transition-all duration-200 ease-out drop-shadow-[0_4px_14px_rgba(0,0,0,0.85)]"
              style={{
                opacity: isOpen ? 0 : 1,
                transform: isOpen ? "scale(0.5) rotate(-30deg)" : "scale(1) rotate(0deg)",
                pointerEvents: isOpen ? "none" : "auto",
              }}
            >
              <StudySproutMascot size={46} />
            </div>

            {/* Icon X Đóng: Giữ thường trực trong DOM, xoay và phóng to đồng thời */}
            <div
              className="absolute inset-0 flex items-center justify-center transition-all duration-200 ease-out"
              style={{
                opacity: isOpen ? 1 : 0,
                transform: isOpen ? "scale(1) rotate(0deg)" : "scale(0.5) rotate(45deg)",
                pointerEvents: isOpen ? "auto" : "none",
              }}
            >
              <XIcon className="w-5 h-5 text-white/95 filter drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.65)]" weight="bold" />
            </div>
          </button>
        </div>
      </div>
    </>
  );
});
