"use client";

import React from "react";
import Image from "next/image";

export interface ZenStudyLogoProps {
  /**
   * Kiểu logo: 'full' (cả biểu tượng & chữ) hoặc 'icon' (chỉ biểu tượng squircle)
   * Mặc định là 'full'
   */
  variant?: "full" | "icon";
  /**
   * ClassName tùy chỉnh cho hình ảnh
   */
  className?: string;
  /**
   * Ưu tiên tải hình ảnh (LCP)
   */
  priority?: boolean;
}

/**
 * ZenStudyLogo - Component hiển thị ảnh Logo chính thức của ZenStudy Space
 * Được thiết kế dưới dạng vector SVG sắc nét trên mọi mật độ điểm ảnh (Retina/4K),
 * kết hợp biểu tượng tách cà phê thiền Lo-fi và chữ thương hiệu ZenStudy cách điệu cao cấp.
 */
export const ZenStudyLogo: React.FC<ZenStudyLogoProps> = ({
  variant = "full",
  className = "h-6 w-auto",
  priority = true,
}) => {
  if (variant === "icon") {
    return (
      <Image
        src="/brand/zenstudy-logo-icon.svg"
        alt="ZenStudy Space Icon Logo"
        width={34}
        height={34}
        priority={priority}
        className={`object-contain select-none pointer-events-none ${className}`}
      />
    );
  }

  return (
    <Image
      src="/brand/zenstudy-logo.svg"
      alt="ZenStudy Logo"
      width={146}
      height={36}
      priority={priority}
      className={`object-contain select-none pointer-events-none ${className}`}
    />
  );
};

export default ZenStudyLogo;
