"use client";

import React from "react";

export type GlassIconVariant =
  | "liquid"
  | "purple"
  | "teal"
  | "amber"
  | "sky"
  | "emerald"
  | "rose"
  | "neutral"
  | "custom";

export interface GlassIconProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label?: string;
  size?: number; // Kích thước đường kính tính bằng pixel (mặc định: 44px)
  variant?: GlassIconVariant;
  plate?: "none" | "circle" | "squircle";
  plateGradient?: string; // Tùy biến gradient cho lớp plate nền phía sau (khi plate !== "none")
  glowColor?: string; // Tùy biến màu phát sáng đổ bóng
  plateShape?: "circle" | "squircle"; // Alias tương thích ngược cho plate
  showLabel?: boolean;
}

/**
 * Cấu hình phong cách kính lỏng chuẩn theo nguyên lý React Bits (https://reactbits.dev/components/glass-icons)
 * - liquid / neutral: Phong cách kính lỏng thuần khiết (Pure Liquid Glass), không màu, khúc xạ cảnh nền phía sau
 * - Các biến thể có màu: Dành cho khi cần phân biệt ngữ cảnh
 */
const VARIANT_CONFIGS: Record<
  Exclude<GlassIconVariant, "custom">,
  {
    plateGradient: string;
    glowShadow: string;
    borderClass: string;
    iconColor: string;
  }
> = {
  liquid: {
    plateGradient: "from-white/[0.12] via-white/[0.04] to-transparent",
    glowShadow: "rgba(0, 0, 0, 0.55)",
    borderClass: "border-white/35",
    iconColor: "text-white",
  },
  neutral: {
    plateGradient: "from-white/[0.15] via-white/[0.05] to-transparent",
    glowShadow: "rgba(0, 0, 0, 0.55)",
    borderClass: "border-white/35",
    iconColor: "text-white",
  },
  purple: {
    plateGradient: "from-purple-500 via-fuchsia-500 to-indigo-500",
    glowShadow: "rgba(192, 132, 252, 0.65)",
    borderClass: "border-purple-200/60",
    iconColor: "text-white",
  },
  teal: {
    plateGradient: "from-emerald-400 via-teal-400 to-cyan-400",
    glowShadow: "rgba(45, 212, 191, 0.65)",
    borderClass: "border-teal-200/60",
    iconColor: "text-white",
  },
  amber: {
    plateGradient: "from-amber-400 via-amber-500 to-orange-500",
    glowShadow: "rgba(251, 191, 36, 0.65)",
    borderClass: "border-amber-200/60",
    iconColor: "text-white",
  },
  sky: {
    plateGradient: "from-sky-400 via-blue-400 to-cyan-400",
    glowShadow: "rgba(56, 189, 248, 0.65)",
    borderClass: "border-sky-200/60",
    iconColor: "text-white",
  },
  emerald: {
    plateGradient: "from-emerald-400 via-green-400 to-teal-400",
    glowShadow: "rgba(52, 211, 153, 0.65)",
    borderClass: "border-emerald-200/60",
    iconColor: "text-white",
  },
  rose: {
    plateGradient: "from-rose-400 via-pink-400 to-red-400",
    glowShadow: "rgba(251, 113, 133, 0.65)",
    borderClass: "border-rose-200/60",
    iconColor: "text-white",
  },
};

/**
 * GlassIcon - Thành phần biểu tượng kính lỏng (Liquid Glass Icon)
 * Học tập từ nguyên lý thiết kế React Bits (https://reactbits.dev/components/glass-icons)
 * Được tối ưu hóa chuyên biệt cho màn hình cảm ứng di động (Mobile UI) & 100% GPU Hardware Acceleration.
 *
 * Cấu trúc quang học Kính lỏng (Liquid Glass):
 * 1. Backing Plate: Khi plate="none", loại bỏ toàn bộ lớp màu để trở thành kính trong suốt 100% khúc xạ nền cảnh.
 * 2. Glass Body: Thân kính lỏng siêu mờ đục (backdrop-blur-xl) với viền vát quang học (specular bevel rim).
 * 3. Specular Sheen: Vệt sáng bóng phản chiếu trên đỉnh vòm kính (Gloss highlight cong như giọt nước).
 * 4. Suspended Icon: Icon trắng nổi 3D lơ lửng trong chất lỏng kính.
 */
export const GlassIcon = React.memo(
  React.forwardRef<HTMLButtonElement, GlassIconProps>(function GlassIcon(
    {
      icon,
      label,
      size = 44,
      variant = "liquid",
      plate = "none",
      plateGradient,
      glowColor,
      plateShape,
      showLabel = false,
      className = "",
      onClick,
      ...buttonProps
    },
    ref
  ) {
    const config =
      variant !== "custom" ? VARIANT_CONFIGS[variant] : VARIANT_CONFIGS.liquid;

    // Xác định kiểu dáng viền bo: circle hoặc squircle
    const effectiveShape = plateShape || (plate === "squircle" ? "squircle" : "circle");
    const borderRadius = effectiveShape === "circle" ? "rounded-full" : "rounded-2xl";

    const hasColoredPlate = plate !== "none" && variant !== "liquid" && variant !== "neutral";
    const resolvedPlateGradient = plateGradient || config.plateGradient;
    const resolvedGlow = glowColor || config.glowShadow;

    return (
      <div className="flex flex-col items-center gap-1 shrink-0 select-none">
        <button
          ref={ref}
          type="button"
          onClick={onClick}
          className={`relative flex items-center justify-center cursor-pointer transition-transform duration-150 active:scale-90 focus:outline-none ${borderRadius} ${
            !hasColoredPlate ? "lg-bubble" : ""
          } ${className}`}
          style={{
            width: size,
            height: size,
            ...(hasColoredPlate
              ? {
                  boxShadow: `0 8px 24px -2px ${resolvedGlow}, 0 2px 8px -1px rgba(0,0,0,0.35)`,
                }
              : {}),
          }}
          {...buttonProps}
        >
          {/* LỚP 1: Backing Plate (Chỉ hiển thị khi có màu tùy biến) */}
          {hasColoredPlate && (
            <div
              className={`absolute inset-0 ${borderRadius} bg-gradient-to-br ${resolvedPlateGradient} opacity-95 pointer-events-none transition-opacity duration-200`}
            />
          )}

          {/* LỚP 2: Thân kính lỏng (Khi có màu tùy biến) */}
          {hasColoredPlate && (
            <div
              className={`absolute inset-0 ${borderRadius} bg-gradient-to-b from-white/[0.25] via-transparent to-black/[0.15] backdrop-blur-md border ${config.borderClass} pointer-events-none`}
              style={{
                boxShadow:
                  "inset 0 1.5px 2px 0 rgba(255, 255, 255, 0.65), inset 0 -1.5px 3px 0 rgba(0, 0, 0, 0.25)",
              }}
            />
          )}

          {/* LỚP 3: Specular Sheen (Khi có màu tùy biến) */}
          {hasColoredPlate && (
            <div
              className={`absolute top-0 left-1/2 -translate-x-1/2 w-[84%] h-[50%] ${
                effectiveShape === "circle" ? "rounded-t-full" : "rounded-t-xl"
              } bg-gradient-to-b from-white/60 via-white/20 to-transparent pointer-events-none`}
            />
          )}

          {/* LỚP 4: Icon trắng lơ lửng bên trong lòng kính (Suspended 3D Icon with drop-shadow) */}
          <div
            className={`relative z-10 flex items-center justify-center ${config.iconColor} filter drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.65)]`}
          >
            {icon}
          </div>
        </button>

        {/* Nhãn văn bản tùy chọn (phục vụ dock / grid) */}
        {showLabel && label && (
          <span className="text-[11px] font-medium text-white/80 tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            {label}
          </span>
        )}
      </div>
    );
  })
);

GlassIcon.displayName = "GlassIcon";
