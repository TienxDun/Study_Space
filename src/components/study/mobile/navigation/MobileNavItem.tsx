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
    // Phản hồi rung nhẹ (Haptic feedback) tạo cảm giác bấm phím vật lý trên điện thoại
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(10);
      } catch {
        // Trình duyệt không hỗ trợ rung thì bỏ qua êm đềm
      }
    }
    onClick();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
      className="lg-nav-btn group relative flex-1 h-full flex flex-col items-center justify-center py-0.5 focus:outline-none select-none cursor-pointer"
    >
      {/* Viên kính của nút đang chọn: đặc hơn thanh ngoài 1 nấc */}
      {isActive && (
        <motion.div
          layoutId="liquid-glass-active-pill"
          transition={{
            type: "spring",
            stiffness: 420,
            damping: 32,
          }}
          className="absolute inset-y-0.5 inset-x-0.5 lg-pill"
        />
      )}

      {/* Biểu tượng: 24px, nút chọn trắng phát sáng nhẹ, nút thường 2 lớp chìm */}
      <span
        className={cn(
          "relative z-10 flex h-6 w-6 items-center justify-center transition-colors duration-200",
          isActive
            ? "text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.35)]"
            : "text-white/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
        )}
      >
        {icon}
      </span>

      {/* Dòng chữ (Label) - CHỈ hiển thị khi nút được chọn, nhỏ gọn 10px */}
      <AnimatePresence mode="wait">
        {isActive && (
          <motion.span
            key={`label-${label}`}
            initial={{ opacity: 0, y: 2, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 1, scale: 0.9 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="relative z-10 text-[10px] font-semibold leading-none mt-0.5 text-white tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
});


