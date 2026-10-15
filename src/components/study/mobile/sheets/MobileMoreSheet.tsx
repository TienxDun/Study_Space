"use client";

import React from "react";
import { FileTextIcon, RadioIcon, ChartBarIcon, UsersIcon, SparkleIcon, SlidersIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { MobileSheetShell } from "./MobileSheetShell";
import { MobileAccountCard } from "./MobileAccountCard";
import type { MobilePanelId } from "../types";

interface MobileMoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (id: MobilePanelId) => void;
}

function MoreButton({ label, onClick, icon }: { label: string; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full min-h-[46px] flex items-center gap-3 px-3 py-1 rounded-2xl bg-white/[0.04] hover:bg-white/[0.1] active:scale-[0.98] border border-white/[0.08] hover:border-white/[0.18] transition-all text-left select-none"
    >
      <span className="w-9 h-9 rounded-xl bg-white/[0.08] border border-white/[0.15] flex items-center justify-center shrink-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)] transition-transform group-hover:scale-105">
        {icon}
      </span>
      <span className="text-[13px] font-medium text-white/90 group-hover:text-white tracking-tight">
        {label}
      </span>
    </button>
  );
}

// Bảng Thêm: gom các nút còn lại thành các cụm rõ ràng theo chuẩn Liquid Glass
export const MobileMoreSheet = React.memo(function MobileMoreSheet({
  isOpen,
  onClose,
  onSelect,
}: MobileMoreSheetProps) {
  const go = (id: MobilePanelId) => {
    onClose();
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
            <MoreButton label="Ghi chú nhanh" onClick={() => go("notes")} icon={<FileTextIcon className="w-5 h-5 text-emerald-300" />} />
            <MoreButton label="Đài YouTube và Spotify" onClick={() => go("embed")} icon={<RadioIcon className="w-5 h-5 text-rose-300" />} />
            <MoreButton label="Thống kê tập trung" onClick={() => go("stats")} icon={<ChartBarIcon className="w-5 h-5 text-sky-300" />} />
          </div>
        </section>
        <section>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/50">Học cùng nhau</p>
          <div className="space-y-1.5">
            <MoreButton label="Phòng học nhóm" onClick={() => go("rooms")} icon={<UsersIcon className="w-5 h-5 text-violet-300" />} />
            <MoreButton label="Trợ lý AI" onClick={() => go("chat")} icon={<SparkleIcon className="w-5 h-5 text-amber-300" />} />
          </div>
        </section>
        <section>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/50">Chung</p>
          <div className="space-y-1.5">
            <MoreButton label="Cài đặt" onClick={() => go("settings")} icon={<SlidersIcon className="w-5 h-5 text-slate-200" />} />
            <MoreButton label="Chế độ Zen (Toàn màn hình)" onClick={() => go("pomodoro")} icon={<EyeSlashIcon className="w-5 h-5 text-slate-200" />} />
          </div>
        </section>
        {/* Bóng mờ đáy: báo còn nội dung bên dưới, vuốt lên để xem */}
        <div
          aria-hidden="true"
          className="sticky bottom-0 -mb-1 h-6 -mx-3 bg-gradient-to-t from-black/40 via-black/20 to-transparent pointer-events-none"
        />
      </div>
    </MobileSheetShell>
  );
});
