"use client";

import React, { useState } from "react";
import {
  CircleNotchIcon,
  CloudCheckIcon,
  CloudSlashIcon,
  CloudWarningIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSyncStatus, syncNow } from "@/lib/simple-cloud-sync";
import { getSyncStatusView, type SyncStatusView } from "./sync-status-view";

const PILL_TONES: Record<SyncStatusView["tone"], string> = {
  emerald:
    "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25",
  amber:
    "bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25",
  sky: "bg-sky-500/15 border-sky-500/30 text-sky-300 hover:bg-sky-500/25",
  rose:
    "bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500/25",
};

const TEXT_TONES_DARK: Record<SyncStatusView["tone"], { base: string; hover: string }> = {
  emerald: { base: "text-emerald-400", hover: "hover:text-emerald-300" },
  amber: { base: "text-amber-300", hover: "hover:text-amber-200" },
  sky: { base: "text-sky-300", hover: "hover:text-sky-200" },
  rose: { base: "text-rose-300", hover: "hover:text-rose-200" },
};

const TEXT_TONES_LIGHT: Record<SyncStatusView["tone"], { base: string; hover: string }> = {
  emerald: { base: "text-emerald-600", hover: "hover:text-emerald-500" },
  amber: { base: "text-amber-600", hover: "hover:text-amber-500" },
  sky: { base: "text-sky-600", hover: "hover:text-sky-500" },
  rose: { base: "text-rose-600", hover: "hover:text-rose-500" },
};

interface SyncStatusBadgeProps {
  savedTime?: string;
  variant?: "pill" | "text";
  light?: boolean;
  className?: string;
  iconOnly?: boolean;
  /** Chỉ hiển thị trạng thái, không bấm để đồng bộ (dùng trong menu hồ sơ). */
  interactive?: boolean;
}

export const SyncStatusBadge = React.memo(function SyncStatusBadge({
  savedTime,
  variant = "pill",
  light = false,
  className,
  iconOnly = false,
  interactive = true,
}: SyncStatusBadgeProps) {
  const { state, lastSyncedAt } = useSyncStatus();
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  const effectiveState = isManualSyncing ? "syncing" : state;
  const view = getSyncStatusView({
    status: effectiveState,
    lastSyncedAt,
    savedTime,
  });

  const handleSyncClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isManualSyncing) return;

    if (state === "idle") {
      toast.info("Đăng nhập Google để tự động sao lưu dữ liệu lên đám mây nhé.");
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.warning(
        "Bạn đang offline. Dữ liệu đã lưu an toàn trên máy và sẽ tự sao lưu khi có mạng trở lại."
      );
      return;
    }

    setIsManualSyncing(true);
    const toastId = toast.loading("Đang sao lưu dữ liệu lên đám mây...");

    try {
      const ok = await syncNow();
      if (ok) {
        toast.success("Đã sao lưu dữ liệu lên đám mây thành công!", {
          id: toastId,
        });
      } else {
        toast.error("Không thể kết nối máy chủ. Dữ liệu vẫn an toàn trên máy.", {
          id: toastId,
        });
      }
    } catch {
      toast.error("Đồng bộ thất bại. Vui lòng thử lại sau.", { id: toastId });
    } finally {
      setIsManualSyncing(false);
    }
  };

  const icon =
    view.motion === "spin" ? (
      <CircleNotchIcon
        className="w-3.5 h-3.5 animate-spin shrink-0"
        weight="bold"
      />
    ) : effectiveState === "synced" ? (
      <CloudCheckIcon className="w-3.5 h-3.5 shrink-0" weight="fill" />
    ) : effectiveState === "offline" ? (
      <CloudWarningIcon className="w-3.5 h-3.5 shrink-0" weight="fill" />
    ) : effectiveState === "error" ? (
      <CloudSlashIcon className="w-3.5 h-3.5 shrink-0" weight="fill" />
    ) : (
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full bg-current shrink-0",
          view.motion === "pulse" && "animate-pulse"
        )}
      />
    );

  if (variant === "text") {
    const tone = light
      ? TEXT_TONES_LIGHT[view.tone]
      : TEXT_TONES_DARK[view.tone];
    const content = (
      <>
        {icon}
        {!iconOnly && <span className="text-xs">{view.label}</span>}
      </>
    );

    if (!interactive) {
      return (
        <span
          role="status"
          title={view.label}
          className={cn("flex items-center gap-1.5 select-none", tone.base, className)}
        >
          {content}
        </span>
      );
    }

    return (
      <button
        type="button"
        onClick={handleSyncClick}
        aria-label={view.title}
        title={view.title}
        className={cn(
          "flex items-center gap-1.5 select-none transition-colors cursor-pointer",
          tone.base,
          tone.hover,
          className
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSyncClick}
      aria-label={view.title}
      title={view.title}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-medium select-none h-7 shrink-0 whitespace-nowrap transition-all active:scale-95 cursor-pointer shadow-sm",
        PILL_TONES[view.tone],
        className
      )}
    >
      {icon}
      {!iconOnly && <span>{view.label}</span>}
    </button>
  );
});
