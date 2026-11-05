"use client";

import type { ReactNode } from "react";

// Bọc đồng hồ giữa cho mobile: giữ chữ thoáng, đẩy lên cao để không đè cụm nhạc.
export function MobilePomodoroView({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`w-full flex justify-center -mt-6 min-[380px]:-mt-4 sm:mt-0 sm:contents contain-layout${
        className ? ` ${className}` : ""
      }`}
    >
      <div className="w-full flex justify-center contain-paint transform-gpu">{children}</div>
    </div>
  );
}
