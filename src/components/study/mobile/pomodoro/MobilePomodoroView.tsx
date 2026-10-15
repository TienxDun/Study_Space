"use client";

import type { ReactNode } from "react";

// Bọc đồng hồ giữa cho mobile: giữ chỗ thoáng, đẩy lên cao để không đè cụm nhạc.
export function MobilePomodoroView({ children }: { children: ReactNode }) {
  return (
    <div className="w-full flex justify-center -mt-6 min-[380px]:-mt-4 sm:mt-0 sm:contents">
      <div className="w-full flex justify-center">{children}</div>
    </div>
  );
}
