"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { cn } from "@/lib/utils";

interface SheetGlassSkeletonProps {
  title?: string;
  sheetId?: string;
  isExpanded?: boolean;
}

/**
 * Skeleton kính lỏng cao cấp (Luminous Frosted Glass Skeleton):
 * Dùng làm fallback khi nạp dynamic import lần đầu.
 * Tự động đồng bộ kích thước theo trạng thái mở rộng (Zen Mode) của từng Sheet.
 */
export function SheetGlassSkeleton({
  title = "Đang mở...",
  sheetId,
  isExpanded,
}: SheetGlassSkeletonProps) {
  const [isZenMode] = useState<boolean>(() => {
    if (isExpanded !== undefined) return isExpanded;
    if (!sheetId || typeof window === "undefined") return false;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.mobileSheetZenMap);
      if (!raw) return false;
      const map = JSON.parse(raw);
      return Boolean(map[sheetId]);
    } catch {
      return false;
    }
  });

  return (
    <motion.div
      aria-label="Đang tải dữ liệu"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8, transition: { duration: 0.15, ease: [0.32, 0, 0.67, 0] } }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "fixed z-50 flex flex-col text-white overflow-hidden sm:hidden transform-gpu will-change-transform pointer-events-none select-none",
        isZenMode
          ? "inset-x-2 bottom-[calc(var(--mobile-nav-height)+var(--app-safe-bottom)+var(--mobile-nav-safe-gap)+0.75rem)] h-[calc(100dvh-var(--app-safe-top)-var(--mobile-nav-height)-var(--app-safe-bottom)-var(--mobile-nav-safe-gap)-1.25rem)] max-h-[calc(100dvh-var(--app-safe-top)-var(--mobile-nav-height)-var(--app-safe-bottom)-var(--mobile-nav-safe-gap)-1.25rem)] rounded-[32px] bg-neutral-950/94 backdrop-blur-xl border border-white/[0.18] shadow-[0_24px_60px_rgba(0,0,0,0.85),inset_0_1px_2px_rgba(255,255,255,0.25)]"
          : "inset-x-3 bottom-[calc(var(--mobile-nav-height)+var(--app-safe-bottom)+var(--mobile-nav-safe-gap)+0.75rem)] h-[68dvh] max-h-[calc(100dvh-var(--app-safe-top)-var(--mobile-nav-height)-var(--app-safe-bottom)-var(--mobile-nav-safe-gap)-1.25rem)] rounded-[28px] bg-neutral-950/90 backdrop-blur-lg border border-white/[0.16] shadow-[0_20px_50px_rgba(0,0,0,0.75),inset_0_1px_1.5px_rgba(255,255,255,0.2)]"
      )}
    >
      {/* Mép kính bắt sáng trên đỉnh */}
      <div
        aria-hidden="true"
        className="absolute inset-x-12 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none"
      />

      {/* Header bar */}
      <div className="shrink-0 select-none">
        <div className="flex items-center px-3.5 py-2.5 border-b border-white/[0.12] justify-between">
          <span className="text-sm font-semibold tracking-tight text-white/70">
            {title}
          </span>
          <div className="h-7 w-7 rounded-full bg-white/[0.08]" />
        </div>
      </div>

      {/* Danh sách các card kính mờ bên trong */}
      <div className="flex-1 p-3.5 space-y-3 overflow-hidden">
        {/* Card 1 */}
        <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] space-y-2 animate-pulse">
          <div className="h-4 w-3/5 bg-white/20 rounded-md" />
          <div className="h-3 w-4/5 bg-white/10 rounded-md" />
          <div className="h-2.5 w-2/5 bg-white/10 rounded-md" />
        </div>

        {/* Card 2 */}
        <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] space-y-2 animate-pulse">
          <div className="h-4 w-1/2 bg-white/20 rounded-md" />
          <div className="h-3 w-3/4 bg-white/10 rounded-md" />
        </div>

        {/* Card 3 */}
        <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] space-y-2 animate-pulse">
          <div className="h-4 w-2/3 bg-white/20 rounded-md" />
          <div className="h-3 w-1/2 bg-white/10 rounded-md" />
        </div>
      </div>
    </motion.div>
  );
}
