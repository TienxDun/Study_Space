"use client";

import React from "react";
import Link from "next/link";
import {
  FileTextIcon,
  RadioIcon,
  ChartBarIcon,
  UsersIcon,
  SparkleIcon,
  SlidersIcon,
  EyeSlashIcon,
  ImageIcon,
  ProhibitIcon,
  CaretRightIcon,
} from "@phosphor-icons/react";
import { MobileSheetShell } from "./MobileSheetShell";
import { MobileAccountCard } from "./MobileAccountCard";
import { BlockedUsersDialog } from "../../settings/BlockedUsersSection";
import { yieldToPaint } from "../perf/yieldToPaint";
import type { MobilePanelId } from "../types";
import { APP_VERSION_LABEL } from "@/lib/version";
import { cn } from "@/lib/utils";

interface MobileMoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (id: MobilePanelId) => void;
  chatEnabled?: boolean;
  roomsEnabled?: boolean;
}

function MoreButton({
  label,
  sub,
  onClick,
  icon,
  iconBg,
  disabled,
}: {
  label: string;
  sub?: string;
  onClick: () => void;
  icon: React.ReactNode;
  iconBg?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors text-left select-none touch-manipulation cursor-pointer disabled:opacity-40 disabled:cursor-default"
    >
      <span
        className={cn(
          "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
          iconBg || "bg-white/[0.08]"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium text-white/95 group-hover:text-white tracking-tight">
          {label}
        </span>
        {sub && <span className="block text-[11px] leading-tight text-white/45 mt-0.5">{sub}</span>}
      </span>
      <CaretRightIcon
        className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors shrink-0"
        weight="bold"
      />
    </button>
  );
}

// Bảng Thêm: gom các nút còn lại thành các cụm rõ ràng theo chuẩn Liquid Glass
export const MobileMoreSheet = React.memo(function MobileMoreSheet({
  isOpen,
  onClose,
  onSelect,
  chatEnabled = true,
  roomsEnabled = true,
}: MobileMoreSheetProps) {
  const [isBlockedUsersOpen, setIsBlockedUsersOpen] = React.useState(false);
  const go = React.useCallback(
    (id: MobilePanelId) => {
      yieldToPaint(() => {
        onSelect(id);
      });
    },
    [onSelect]
  );

  return (
    <MobileSheetShell
      isOpen={isOpen}
      onClose={onClose}
      sheetId="more"
      title="Thêm"
      maxHeightClassName="h-auto max-h-[82dvh]"
      allowZenMode={false}
    >
      <div className="px-3 pt-2 pb-1 space-y-3.5">
        <section>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/45">Tài khoản</p>
          <MobileAccountCard />
        </section>

        <section>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/45">Học và ghi</p>
          <div className="rounded-2xl bg-white/[0.035] border border-white/[0.08] overflow-hidden divide-y divide-white/[0.06] shadow-sm">
            <MoreButton
              label="Đổi cảnh không gian"
              onClick={() => go("scenes")}
              icon={<ImageIcon className="w-4 h-4 text-amber-300" />}
              iconBg="bg-amber-400/12"
            />
            <MoreButton
              label="Ghi chú nhanh"
              onClick={() => go("notes")}
              icon={<FileTextIcon className="w-4 h-4 text-emerald-300" />}
              iconBg="bg-emerald-400/12"
            />
            <MoreButton
              label="Đài YouTube và Spotify"
              onClick={() => go("embed")}
              icon={<RadioIcon className="w-4 h-4 text-rose-300" />}
              iconBg="bg-rose-400/12"
            />
            <MoreButton
              label="Thống kê tập trung"
              onClick={() => go("stats")}
              icon={<ChartBarIcon className="w-4 h-4 text-sky-300" />}
              iconBg="bg-sky-400/12"
            />
          </div>
        </section>

        <section>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/45">Học cùng nhau</p>
          <div className="rounded-2xl bg-white/[0.035] border border-white/[0.08] overflow-hidden divide-y divide-white/[0.06] shadow-sm">
            <MoreButton
              label="Phòng học nhóm"
              sub={roomsEnabled ? undefined : "Tạm tắt"}
              disabled={!roomsEnabled}
              onClick={() => go("rooms")}
              icon={<UsersIcon className="w-4 h-4 text-violet-300" />}
              iconBg="bg-violet-400/12"
            />
            <MoreButton
              label="Trợ lý AI"
              sub={chatEnabled ? undefined : "Tạm tắt"}
              disabled={!chatEnabled}
              onClick={() => go("chat")}
              icon={<SparkleIcon className="w-4 h-4 text-amber-300" />}
              iconBg="bg-amber-400/12"
            />
          </div>
        </section>

        <section>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/45">Chung</p>
          <div className="rounded-2xl bg-white/[0.035] border border-white/[0.08] overflow-hidden divide-y divide-white/[0.06] shadow-sm">
            <MoreButton
              label="Cài đặt"
              onClick={() => go("settings")}
              icon={<SlidersIcon className="w-4 h-4 text-slate-200" />}
              iconBg="bg-slate-400/12"
            />
            <MoreButton
              label="Chế độ Zen (Toàn màn hình)"
              onClick={() => go("pomodoro")}
              icon={<EyeSlashIcon className="w-4 h-4 text-slate-200" />}
              iconBg="bg-slate-400/12"
            />
            <MoreButton
              label="Người đã chặn"
              sub="Danh sách chặn trong phòng học"
              onClick={() => setIsBlockedUsersOpen(true)}
              icon={<ProhibitIcon className="w-4 h-4 text-rose-300" />}
              iconBg="bg-rose-400/12"
            />
          </div>
        </section>
        <div className="pt-3 pb-2 text-center select-none space-y-1.5">
          <p className="text-[11px] font-mono text-white/40 tracking-tight">
            ZenStudy Space · {APP_VERSION_LABEL}
          </p>
          <div className="flex items-center justify-center gap-1.5">
            <Link
              href="/privacy/"
              className="inline-block text-[11px] font-semibold text-white/60 hover:text-white underline underline-offset-2 transition-colors"
            >
              Chính sách quyền riêng tư
            </Link>
            <span aria-hidden="true" className="text-white/30 text-[11px]">
              ·
            </span>
            <Link
              href="/terms/"
              className="inline-block text-[11px] font-semibold text-white/60 hover:text-white underline underline-offset-2 transition-colors"
            >
              Điều khoản sử dụng
            </Link>
          </div>
        </div>
      </div>

      {/* Hộp thoại quản lý người đã chặn */}
      <BlockedUsersDialog
        isOpen={isBlockedUsersOpen}
        onClose={() => setIsBlockedUsersOpen(false)}
      />
    </MobileSheetShell>
  );
});
