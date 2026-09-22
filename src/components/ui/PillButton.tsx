"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PillButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  activeClassName?: string;
  inactiveClassName?: string;
  children: ReactNode;
}

/** Nut tab/pill dung chung (Settings, Mixer tabs). */
export const PillButton = ({
  active = false,
  activeClassName = "bg-wash text-black shadow font-extrabold",
  inactiveClassName = "text-slate-400 hover:text-white",
  className,
  children,
  type = "button",
  ...rest
}: PillButtonProps) => (
  <button
    type={type}
    className={cn(
      "py-1.5 rounded-xl text-xs transition-all cursor-pointer text-center",
      active ? activeClassName : inactiveClassName,
      className
    )}
    {...rest}
  >
    {children}
  </button>
);
