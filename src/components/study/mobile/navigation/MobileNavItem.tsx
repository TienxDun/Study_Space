"use client";

import React, { type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface MobileNavItemProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  icon: ReactNode;
}

// 1 nút bấm thanh điều hướng kính lỏng với hiệu ứng nảy giọt nước đàn hồi (Droplet Squash & Stretch)
export const MobileNavItem = React.memo(function MobileNavItem({
  label,
  isActive,
  onClick,
  icon,
}: MobileNavItemProps) {
  const handleClick = () => {
    onClick();
    // Phản hồi rung haptic chạy bất đồng bộ (non-blocking) để không làm chậm sự kiện chạm/vẽ
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      setTimeout(() => {
        try {
          navigator.vibrate(10);
        } catch {
          // Bỏ qua nếu không hỗ trợ
        }
      }, 0);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
      className="lg-nav-btn group relative flex-1 h-full flex flex-col items-center justify-center focus:outline-none select-none cursor-pointer touch-manipulation active:scale-[0.96] transition-transform duration-75"
    >
      {/* Viên kính của nút đang chọn: có AnimatePresence để khi BỎ CHỌN viên kính tan biến êm dịu thay vì biến mất đột ngột */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            key="liquid-glass-active-pill"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{
              opacity: 0,
              scale: 0.88,
              transition: { duration: 0.14, ease: "easeOut" },
            }}
            transition={{
              duration: 0.16,
              ease: "easeOut",
            }}
            className="!absolute inset-y-0.5 inset-x-0.5 lg-pill pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Cụm Icon & Label trung tâm: Tịnh tiến mượt mà bằng transition CSS thay vì layout shift đột ngột */}
      <div
        className={cn(
          "pointer-events-none relative z-10 flex flex-col items-center justify-center transition-transform duration-200 ease-out",
          isActive ? "-translate-y-0.5" : "translate-y-0"
        )}
      >
        {/* Biểu tượng: 2 bóng mờ cố định (không animate filter), nút chọn sáng và lớn hơn 5% */}
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] transition-[color,transform] duration-200 ease-out",
            isActive ? "text-white scale-105" : "text-slate-300/80 scale-100"
          )}
        >
          {icon}
        </span>

        {/* Dòng chữ (Label): Bỏ mode="wait" để không bị nghẽn render khi unmount */}
        <AnimatePresence>
          {isActive && (
            <motion.span
              key={`label-${label}`}
              initial={{ opacity: 0, y: 3, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{
                opacity: 0,
                y: 1.5,
                scale: 0.85,
                transition: { duration: 0.14, ease: "easeIn" },
              }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="text-[10px] font-semibold leading-none mt-0.5 text-white tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] whitespace-nowrap"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </button>
  );
});


