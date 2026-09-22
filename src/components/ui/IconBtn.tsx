"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface IconBtnProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  tooltip?: string;
  icon: ReactNode;
}

/** Nut icon dung chung (dock, header panel). className tu caller
 *  quyet dinh hinh dang + mau active; tooltip kieu dock trai. */
export const IconBtn = ({
  tooltip,
  icon,
  className,
  type = "button",
  ...rest
}: IconBtnProps) => (
  <button
    type={type}
    className={cn(
      "group relative cursor-pointer transition-all active:scale-95",
      className
    )}
    {...rest}
  >
    {icon}
    {tooltip && (
      <span className="absolute left-full ml-3 px-2 py-1 rounded-md bg-panel/90 text-[10px] font-semibold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg border border-line/10">
        {tooltip}
      </span>
    )}
  </button>
);
