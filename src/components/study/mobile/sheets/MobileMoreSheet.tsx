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
} from "@phosphor-icons/react";
import { MobileSheetShell } from "./MobileSheetShell";
import { MobileAccountCard } from "./MobileAccountCard";
import type { MobilePanelId } from "../types";
import { APP_VERSION_LABEL } from "@/lib/version";

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
  disabled,
}: {
  label: string;
  sub?: string;
  onClick: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group w-full min-h-[46px] flex items-center gap-3 px-3 py-1 rounded-2xl bg-white/[0.04] hover:bg-white/[0.1] active:scale-[0.98] border border-white/[0.08] hover:border-white/[0.18] transition-all text-left select-none disabled:opacity-60 disabled:cursor-default disabled:active:scale-100"
    >
      <span className="w-9 h-9 rounded-xl bg-white/[0.08] border border-white/[0.15] flex items-center justify-center shrink-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)] transition-transform group-hover:scale-105">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-white/90 group-hover:text-white tracking-tight">
          {label}
        </span>
        {sub && <span className="block text-[11px] leading-tight text-white/45 mt-0.5">{sub}</span>}
      </span>
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
  const go = (id: MobilePanelId) => {
    onSelect(id);
  };

  return (
    <MobileSheetShell isOpen={isOpen} onClose={onClose} sheetId="more" title="Thêm">
      <div className="px-3 pt-2 pb-1 space-y-3.5">
        <section>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/50">Tài khoản</p>
          <MobileAccountCard />
        </section>
        <section>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/50">Học và ghi</p>
          <div className="space-y-1.5">
            <MoreButton label="Đổi cảnh không gian" onClick={() => go("scenes")} icon={<ImageIcon className="w-5 h-5 text-amber-300" />} />
            <MoreButton label="Ghi chú nhanh" onClick={() => go("notes")} icon={<FileTextIcon className="w-5 h-5 text-emerald-300" />} />
            <MoreButton label="Đài YouTube và Spotify" onClick={() => go("embed")} icon={<RadioIcon className="w-5 h-5 text-rose-300" />} />
            <MoreButton label="Thống kê tập trung" onClick={() => go("stats")} icon={<ChartBarIcon className="w-5 h-5 text-sky-300" />} />
          </div>
        </section>
        <section>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/50">Học cùng nhau</p>
          <div className="space-y-1.5">
            <MoreButton
              label="Phòng học nhóm"
              sub={roomsEnabled ? undefined : "Tạm tắt"}
              disabled={!roomsEnabled}
              onClick={() => go("rooms")}
              icon={<UsersIcon className="w-5 h-5 text-violet-300" />}
            />
            <MoreButton
              label="Trợ lý AI"
              sub={chatEnabled ? undefined : "Tạm tắt"}
              disabled={!chatEnabled}
              onClick={() => go("chat")}
              icon={<SparkleIcon className="w-5 h-5 text-amber-300" />}
            />
          </div>
        </section>
        <section>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/50">Chung</p>
          <div className="space-y-1.5">
            <MoreButton label="Cài đặt" onClick={() => go("settings")} icon={<SlidersIcon className="w-5 h-5 text-slate-200" />} />
            <MoreButton label="Chế độ Zen (Toàn màn hình)" onClick={() => go("pomodoro")} icon={<EyeSlashIcon className="w-5 h-5 text-slate-200" />} />
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
        {/* Bóng mờ đáy: báo còn nội dung bên dưới, vuốt lên để xem */}
        <div
          aria-hidden="true"
          className="pointer-events-none sticky -bottom-1 -mx-3 h-8 bg-gradient-to-t from-black/60 to-transparent"
        />
      </div>
    </MobileSheetShell>
  );
});
