"use client";

import React from "react";
import { CardPriority } from "../types";

export interface PrioritySignalIconProps {
  priority?: CardPriority | null;
  className?: string;
  usePriorityColor?: boolean;
}

/**
 * PrioritySignalIcon - Biểu tượng cột sóng phân biệt độ ưu tiên:
 * - Thấp (Low): 1 cột sóng sáng (xanh lục), 2 cột mờ
 * - Vừa (Medium): 2 cột sóng sáng (vàng hổ phách), 1 cột mờ
 * - Cao (High): Cả 3 cột sóng sáng (đỏ hồng)
 */
export const PrioritySignalIcon: React.FC<PrioritySignalIconProps> = ({
  priority = "medium",
  className = "w-3.5 h-3.5",
  usePriorityColor = true,
}) => {
  const currentPriority = priority || "medium";

  const activeColor = usePriorityColor
    ? currentPriority === "high"
      ? "#f43f5e" // rose-500
      : currentPriority === "medium"
      ? "#fbbf24" // amber-400
      : "#34d399" // emerald-400
    : "currentColor";

  const inactiveColor = usePriorityColor
    ? "rgba(255, 255, 255, 0.2)"
    : "currentColor";

  const isBar1Active = Boolean(priority);
  const isBar2Active = currentPriority === "medium" || currentPriority === "high";
  const isBar3Active = currentPriority === "high";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="none"
      className={`shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      {/* Cột 1 (Thấp nhất - Cao 4px) */}
      <rect
        x="2"
        y="10"
        width="3"
        height="4"
        rx="1"
        fill={isBar1Active ? activeColor : inactiveColor}
        opacity={isBar1Active ? 1 : 0.25}
      />

      {/* Cột 2 (Trung bình - Cao 7.5px) */}
      <rect
        x="6.5"
        y="6.5"
        width="3"
        height="7.5"
        rx="1"
        fill={isBar2Active ? activeColor : inactiveColor}
        opacity={isBar2Active ? 1 : 0.25}
      />

      {/* Cột 3 (Cao nhất - Cao 11px) */}
      <rect
        x="11"
        y="3"
        width="3"
        height="11"
        rx="1"
        fill={isBar3Active ? activeColor : inactiveColor}
        opacity={isBar3Active ? 1 : 0.25}
      />
    </svg>
  );
};

export default PrioritySignalIcon;
