"use client";

import React, { useState } from "react";
import {
  FileTextIcon,
  RadioIcon,
  ChartBarIcon,
  UsersIcon,
  SparkleIcon,
  SlidersIcon,
  EyeSlashIcon,
  ImageIcon,
  ArrowsClockwiseIcon,
  CircleNotchIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { MobileSheetShell } from "./MobileSheetShell";
import { MobileAccountCard } from "./MobileAccountCard";
import { useAuth } from "@/lib/use-auth";
import { cloudConfigured, syncNow } from "@/lib/cloud-sync";
import type { MobilePanelId } from "../types";

interface MobileMoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (id: MobilePanelId) => void;
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

// Bấm để kéo bản mới nhất từ máy chủ về (áp dụng luôn nếu có thay đổi).
function SyncRow() {
  const { user, loading, isConfigured } = useAuth();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (busy || loading) return;
    if (!isConfigured || !cloudConfigured()) {
      toast.error("Bản này chưa cấu hình đồng bộ máy chủ.");
      return;
    }
    if (!user) {
      toast("Đăng nhập rồi mới đồng bộ được nhé");
      return;
    }
    setBusy(true);
    const t = toast.loading("Đang lấy dữ liệu mới nhất...");
    try {
      const res = await syncNow();
      if (!res.ok) {
        toast.error("Chưa lấy được dữ liệu, bạn kiểm tra mạng nhé", { id: t });
        return;
      }
      if (res.applied > 0) {
        toast.success("Đã lấy dữ liệu mới nhất, đang tải lại...", { id: t });
        window.location.reload();
        return;
      }
      toast.success(res.pushed > 0 ? "Đã gửi thay đổi của bạn lên mây" : "Dữ liệu đã là mới nhất", { id: t });
    } catch {
      toast.error("Đồng bộ thất bại, bạn thử lại nhé", { id: t });
    } finally {
      setBusy(false);
    }
  };

  return (
    <MoreButton
      label="Đồng bộ"
      sub="Đồng bộ dữ liệu mới nhất"
      onClick={() => void run()}
      disabled={busy}
      icon={
        busy ? (
          <CircleNotchIcon className="w-5 h-5 text-sky-300 animate-spin" />
        ) : (
          <ArrowsClockwiseIcon className="w-5 h-5 text-sky-300" />
        )
      }
    />
  );
}

// Bảng Thêm: gom các nút còn lại thành các cụm rõ ràng theo chuẩn Liquid Glass
export const MobileMoreSheet = React.memo(function MobileMoreSheet({
  isOpen,
  onClose,
  onSelect,
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
          <div className="space-y-1.5 pt-1.5">
            <SyncRow />
          </div>
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
