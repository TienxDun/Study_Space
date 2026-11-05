"use client";

import React from "react";

interface SheetGlassSkeletonProps {
  title?: string;
}

/**
 * Skeleton kính lỏng cao cấp (Luminous Frosted Glass Skeleton):
 * Dùng làm fallback khi mạng yếu hoặc đang nạp dynamic import lần đầu.
 * Thiết kế hoàn toàn bằng gradient kính mờ phát sáng nhẹ, hòa quyện 100%
 * với phong cách Liquid Glass của ZenStudy, không gây cảm giác "chớp hộp xám" rẻ tiền.
 */
export function SheetGlassSkeleton({ title = "Đang mở..." }: SheetGlassSkeletonProps) {
  return (
    <div
      aria-label="Đang tải dữ liệu"
      className="fixed z-50 flex flex-col text-white overflow-hidden sm:hidden inset-x-3 bottom-[calc(var(--mobile-nav-height)+var(--app-safe-bottom)+var(--mobile-nav-safe-gap)+0.75rem)] h-[68dvh] max-h-[72dvh] rounded-[28px] surface-frost border shadow-[0_10px_24px_rgba(0,0,0,0.65),inset_0_1px_1.5px_rgba(255,255,255,0.2)] animate-pulse pointer-events-none select-none"
    >
      {/* Mép kính bắt sáng trên đỉnh */}
      <div
        aria-hidden="true"
        className="absolute inset-x-12 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none"
      />

      {/* Pill Handle trên đỉnh */}
      <div className="pt-2.5 pb-1 flex items-center justify-center">
        <span className="h-1.5 w-12 rounded-full bg-white/25" />
      </div>

      {/* Header bar */}
      <div className="flex items-center px-4 pb-2.5 pt-0.5 border-b border-white/[0.12] justify-between">
        <span className="text-sm font-semibold tracking-tight text-white/70">
          {title}
        </span>
        <div className="h-7 w-7 rounded-full bg-white/10" />
      </div>

      {/* Danh sách các card kính mờ bên trong */}
      <div className="flex-1 p-3.5 space-y-3 overflow-hidden">
        {/* Card 1 */}
        <div className="p-3.5 rounded-2xl bg-white/[0.06] border border-white/10 space-y-2">
          <div className="h-4 w-3/5 bg-white/20 rounded-md" />
          <div className="h-3 w-4/5 bg-white/10 rounded-md" />
          <div className="h-2.5 w-2/5 bg-white/10 rounded-md" />
        </div>

        {/* Card 2 */}
        <div className="p-3.5 rounded-2xl bg-white/[0.06] border border-white/10 space-y-2">
          <div className="h-4 w-1/2 bg-white/20 rounded-md" />
          <div className="h-3 w-3/4 bg-white/10 rounded-md" />
        </div>

        {/* Card 3 */}
        <div className="p-3.5 rounded-2xl bg-white/[0.06] border border-white/10 space-y-2">
          <div className="h-4 w-2/3 bg-white/20 rounded-md" />
          <div className="h-3 w-1/2 bg-white/10 rounded-md" />
        </div>
      </div>
    </div>
  );
}
