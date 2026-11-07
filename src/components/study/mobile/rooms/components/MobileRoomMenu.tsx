"use client";

import React, { memo } from "react";
import {
  DotsThreeVerticalIcon,
  SquaresFourIcon,
  PresentationIcon,
  CheckIcon,
  LinkSimpleIcon,
  ClockCounterClockwiseIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react";
import type { MobileRoomLayoutMode } from "../MobileRoomView";

export interface MobileRoomMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  layoutMode: MobileRoomLayoutMode;
  onSelectLayout: (mode: MobileRoomLayoutMode) => void;
  onCopyInvite: () => void;
  copied: boolean;
  onOpenHistory: () => void;
  onOpenHostControls: () => void;
  canModerate: boolean;
}

/**
 * Menu 3 chấm chứa các tiện ích phòng học trên điện thoại:
 * Chuyển bố cục hiển thị (Lưới đều / Tiêu điểm), sao chép link mời,
 * xem lịch sử phòng và bảng điều khiển quản lý phòng.
 */
export const MobileRoomMenu = memo(function MobileRoomMenu({
  isOpen,
  onToggle,
  onClose,
  layoutMode,
  onSelectLayout,
  onCopyInvite,
  copied,
  onOpenHistory,
  onOpenHostControls,
  canModerate,
}: MobileRoomMenuProps) {
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={onToggle}
        className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-sm shrink-0 active:scale-95 ${
          isOpen
            ? "bg-white/15 border-white/30 text-white"
            : "bg-white/[0.05] hover:bg-white/[0.12] border-white/10 text-slate-200 hover:text-white"
        }`}
        title="Tiện ích phòng (Mời, Lịch sử, Quản lý)"
        aria-label="Tiện ích phòng"
      >
        <DotsThreeVerticalIcon className="w-4 h-4 text-emerald-400" weight="bold" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop bắt chạm ra ngoài để đóng */}
          <div
            className="fixed inset-0 z-40"
            onClick={onClose}
          />

          {/* Menu popup tiện ích & bố cục */}
          <div className="absolute right-0 top-full mt-1.5 z-50 w-52 py-1.5 rounded-2xl surface-frost border shadow-[0_16px_40px_rgba(0,0,0,0.85)] select-none">
            {/* Phần 1: Bố cục hiển thị */}
            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/[0.08] mb-1">
              Bố cục hiển thị
            </div>

            <button
              type="button"
              onClick={() => {
                onSelectLayout("grid");
                onClose();
              }}
              className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <SquaresFourIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Lưới đều</span>
              </div>
              {layoutMode === "grid" && (
                <CheckIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" weight="bold" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectLayout("speaker");
                onClose();
              }}
              className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <PresentationIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Tiêu điểm</span>
              </div>
              {layoutMode === "speaker" && (
                <CheckIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" weight="bold" />
              )}
            </button>

            {/* Phần 2: Tiện ích phòng */}
            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-y border-white/[0.08] my-1">
              Tiện ích phòng
            </div>

            <button
              type="button"
              onClick={() => {
                onCopyInvite();
                setTimeout(onClose, 900);
              }}
              className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
            >
              {copied ? (
                <CheckIcon className="w-4 h-4 text-emerald-400 shrink-0" weight="bold" />
              ) : (
                <LinkSimpleIcon className="w-4 h-4 text-emerald-400 shrink-0" weight="bold" />
              )}
              <span className={copied ? "text-emerald-300 font-semibold" : ""}>
                {copied ? "Đã chép link mời" : "Sao chép link mời"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenHistory();
              }}
              className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
            >
              <ClockCounterClockwiseIcon className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Lịch sử phòng</span>
            </button>

            {canModerate && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenHostControls();
                }}
                className="w-full text-left px-3 py-2 text-xs text-amber-300 hover:bg-amber-500/15 transition-colors flex items-center gap-2 cursor-pointer border-t border-white/[0.08] mt-1 pt-2"
              >
                <ShieldCheckIcon className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Quản lý phòng</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
});
