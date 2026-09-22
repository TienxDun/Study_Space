"use client";

import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type RangeSliderProps = InputHTMLAttributes<HTMLInputElement>;

/** Slider dung chung (volume, seek, ambient). Mau accent do caller truyen. */
export const RangeSlider = ({ className, ...rest }: RangeSliderProps) => (
  <input
    type="range"
    className={cn(
      "h-1.5 rounded-lg appearance-none cursor-pointer transition-all",
      className
    )}
    {...rest}
  />
);
