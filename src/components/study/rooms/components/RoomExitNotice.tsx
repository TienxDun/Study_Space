"use client";

import { InfoIcon, SignInIcon, WarningCircleIcon } from "@phosphor-icons/react";
import type { RoomExitNotice as RoomExitNoticeData } from "../utils/room-exit";

export interface RoomExitNoticeProps {
  notice: RoomExitNoticeData;
  onDismiss: () => void;
  onRejoin?: () => void;
}

// Thẻ giải thích vì sao người dùng bị đưa ra khỏi phòng học.
// Dùng chung cho sảnh desktop và sheet mobile, nằm cùng chỗ với khối lỗi.
export function RoomExitNotice({ notice, onDismiss, onRejoin }: RoomExitNoticeProps) {
  if (!notice.showNotice) return null;

  const isWarning = notice.tone === "amber";

  return (
    <div role="status" className="glass-panel p-3.5 text-white space-y-2.5">
      <div className="flex items-start gap-2.5">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
            isWarning
              ? "bg-amber-500/15 border-amber-400/30 text-amber-300"
              : "bg-white/[0.06] border-white/15 text-slate-300"
          }`}
        >
          {isWarning ? (
            <WarningCircleIcon className="w-4 h-4" weight="fill" />
          ) : (
            <InfoIcon className="w-4 h-4" weight="fill" />
          )}
        </span>

        <div className="min-w-0 space-y-1">
          <p className="text-xs font-bold text-white">{notice.title}</p>
          {notice.description && (
            <p className="text-[11px] leading-relaxed text-slate-300">{notice.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-[44px] flex-1 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-[11px] font-semibold text-slate-200 transition-colors cursor-pointer active:scale-95"
        >
          Đã hiểu
        </button>

        {notice.allowRejoin && onRejoin && (
          <button
            type="button"
            onClick={onRejoin}
            className="min-h-[44px] flex-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-emerald-200 text-[11px] font-bold transition-colors cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
          >
            <SignInIcon className="w-3.5 h-3.5" weight="bold" />
            <span>Vào lại phòng</span>
          </button>
        )}
      </div>
    </div>
  );
}
