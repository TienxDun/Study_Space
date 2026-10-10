"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone =
  | "amber"
  | "red"
  | "sky"
  | "emerald"
  | "purple"
  | "skySolid";

const TONES: Record<BadgeTone, string> = {
  amber:
    "bg-black/60 text-accent-cat-amber-bright border-accent-cat-amber/30",
  red: "bg-black/60 text-accent-stream-glow border-accent-stream/30",
  sky: "bg-black/60 text-accent-scene-bright border-accent-scene-glow/30",
  emerald:
    "bg-black/60 text-accent-music-bright border-accent-music/30",
  purple: "bg-black/60 text-purple-300 border-purple-400/30",
  skySolid:
    "bg-accent-scene text-white border-accent-scene-glow/40 shadow-xl",
};

export interface BadgeProps {
  tone?: BadgeTone;
  shape?: "lg" | "full";
  className?: string;
  children: ReactNode;
}

/** Nhan trang thai (LIVE/VIDEO/4K/Dang dung...). */
export const Badge = ({
  tone = "sky",
  shape = "lg",
  className,
  children,
}: BadgeProps) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold border backdrop-blur-md",
      shape === "full" ? "rounded-full" : "rounded-lg",
      TONES[tone],
      className
    )}
  >
    {children}
  </span>
);
