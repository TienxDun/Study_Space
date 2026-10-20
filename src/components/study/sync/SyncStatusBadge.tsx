"use client";

import React from "react";
import {
  CircleNotchIcon,
  CloudCheckIcon,
  CloudSlashIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useCloudSyncStatus } from "@/lib/use-cloud-sync-status";
import { getSyncStatusView, type SyncStatusView } from "./sync-status-view";

const PILL_TONES: Record<SyncStatusView["tone"], string> = {
  emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",
  amber: "bg-amber-500/10 border-amber-500/20 text-amber-300",
  sky: "bg-sky-500/10 border-sky-500/20 text-sky-300",
  rose: "bg-rose-500/10 border-rose-500/20 text-rose-300",
};

const TEXT_TONES_DARK: Record<SyncStatusView["tone"], string> = {
  emerald: "text-emerald-400",
  amber: "text-amber-300",
  sky: "text-sky-300",
  rose: "text-rose-300",
};

const TEXT_TONES_LIGHT: Record<SyncStatusView["tone"], string> = {
  emerald: "text-emerald-600",
  amber: "text-amber-600",
  sky: "text-sky-600",
  rose: "text-rose-600",
};

interface SyncStatusBadgeProps {
  /** Giờ lưu local gần nhất, đưa vào tooltip khi dữ liệu còn nằm máy. */
  savedTime?: string;
  /** "pill": viên kính có nền; "text": chỉ chữ + icon cho footer gọn. */
  variant?: "pill" | "text";
  /** Footer sticky note đổi theo nền sáng/tối. */
  light?: boolean;
  className?: string;
}

/** Trạng thái đồng bộ thật (chờ / đang gửi / đã đồng bộ / lỗi / chỉ lưu máy). */
export const SyncStatusBadge = React.memo(function SyncStatusBadge({
  savedTime,
  variant = "pill",
  light = false,
  className,
}: SyncStatusBadgeProps) {
  const { status, lastSyncedAt } = useCloudSyncStatus();
  const view = getSyncStatusView({ status, lastSyncedAt, savedTime });

  const icon =
    view.motion === "spin" ? (
      <CircleNotchIcon className="w-3 h-3 animate-spin shrink-0" weight="bold" />
    ) : status === "synced" ? (
      <CloudCheckIcon className="w-3 h-3 shrink-0" weight="fill" />
    ) : status === "error" ? (
      <CloudSlashIcon className="w-3 h-3 shrink-0" weight="fill" />
    ) : (
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full bg-current shrink-0",
          view.motion === "pulse" && "animate-pulse"
        )}
      />
    );

  if (variant === "text") {
    const tone = light ? TEXT_TONES_LIGHT[view.tone] : TEXT_TONES_DARK[view.tone];
    return (
      <span
        role="status"
        aria-live="polite"
        title={view.title}
        className={cn("flex items-center gap-1.5 select-none", tone, className)}
      >
        {icon}
        <span>{view.label}</span>
      </span>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      title={view.title}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-medium select-none h-7 shrink-0 whitespace-nowrap",
        PILL_TONES[view.tone],
        className
      )}
    >
      {icon}
      <span>{view.label}</span>
    </div>
  );
});
