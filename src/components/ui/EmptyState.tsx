"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  message: string;
  icon?: ReactNode;
  className?: string;
}

/** Trang thai rong dung chung (grid scene, dai phat, task...). */
export const EmptyState = ({ message, icon, className }: EmptyStateProps) => (
  <div
    className={cn(
      "py-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2",
      className
    )}
  >
    {icon}
    <span>{message}</span>
  </div>
);
