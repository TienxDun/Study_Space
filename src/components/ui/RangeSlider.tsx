"use client";

import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type RangeSliderProps = InputHTMLAttributes<HTMLInputElement>;

/** Slider dùng chung (volume, seek, ambient). Màu accent do caller truyền. */
export const RangeSlider = ({ className, ...rest }: RangeSliderProps) => (
  <input
    type="range"
    className={cn(
      "h-1.5 rounded-lg appearance-none cursor-pointer bg-white/20 transition-all",
      // WebKit track + thumb (Chrome, Safari, Edge)
      "[&::-webkit-slider-runnable-track]:h-1.5",
      "[&::-webkit-slider-runnable-track]:rounded-lg",
      "[&::-webkit-slider-thumb]:appearance-none",
      "[&::-webkit-slider-thumb]:w-3",
      "[&::-webkit-slider-thumb]:h-3",
      "[&::-webkit-slider-thumb]:-mt-[3px]",
      "[&::-webkit-slider-thumb]:rounded-full",
      "[&::-webkit-slider-thumb]:bg-white",
      "[&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(52,211,153,0.8)]",
      "[&::-webkit-slider-thumb]:transition-transform",
      "[&::-webkit-slider-thumb]:hover:scale-125",
      // Firefox track + thumb
      "[&::-moz-range-track]:h-1.5",
      "[&::-moz-range-track]:rounded-lg",
      "[&::-moz-range-track]:bg-white/20",
      "[&::-moz-range-thumb]:w-3",
      "[&::-moz-range-thumb]:h-3",
      "[&::-moz-range-thumb]:rounded-full",
      "[&::-moz-range-thumb]:bg-white",
      "[&::-moz-range-thumb]:border-0",
      "[&::-moz-range-thumb]:shadow-[0_0_8px_rgba(52,211,153,0.8)]",
      className
    )}
    {...rest}
  />
);
