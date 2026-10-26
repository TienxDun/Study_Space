"use client";

import React from "react";
import { resolveBannerText, type SystemFlags } from "@/lib/system-flags";

interface SystemBannerProps {
  flags: SystemFlags;
}

// Dải thông báo chỉ đọc: nội dung là text thuần, không render HTML từ cờ.
export const SystemBanner = React.memo(function SystemBanner({ flags }: SystemBannerProps) {
  const message = resolveBannerText(flags);
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 -translate-x-1/2 z-[65] w-max max-w-[calc(100vw-1.5rem)] top-[calc(env(safe-area-inset-top,0px)+3.75rem)] sm:top-[4.75rem] px-4 py-2 rounded-full bg-amber-500/15 border border-amber-300/35 backdrop-blur-xl text-[12px] sm:text-[13px] leading-snug text-amber-100 text-center shadow-[0_10px_30px_rgba(0,0,0,0.55)] select-none"
    >
      {message}
    </div>
  );
});

SystemBanner.displayName = "SystemBanner";
