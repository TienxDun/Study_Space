"use client";

import { useEffect, useState, startTransition } from "react";
import Image from "next/image";
import {
  ArrowsClockwiseIcon,
  CircleNotchIcon,
  SignOutIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAuth } from "@/lib/use-auth";
import { cloudConfigured, syncNow } from "@/lib/simple-cloud-sync";
import { GoogleIcon } from "@/components/study/auth/components/GoogleIcon";
import { DeleteAccountDialog } from "@/components/study/auth/components/DeleteAccountDialog";

// Thẻ tài khoản RIÊNG cho bảng Thêm trên mobile.
// Tinh gọn hiện đại: Avatar + Thông tin bên trái; Cụm nút tròn Đồng bộ & Đăng xuất bên phải.
export function MobileAccountCard() {
  const { user, loading, isSigningIn, isSigningOut, signIn, signOut, isConfigured } = useAuth();
  const [avatarError, setAvatarError] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [user?.photoURL, user?.uid]);

  const handleSync = async () => {
    if (isSyncing || loading) return;
    if (!isConfigured || !cloudConfigured()) {
      toast.error("Bản này chưa cấu hình đồng bộ máy chủ.");
      return;
    }
    if (!user) {
      toast("Đăng nhập rồi mới đồng bộ được nhé");
      return;
    }
    setIsSyncing(true);
    const t = toast.loading("Đang đồng bộ dữ liệu...");
    try {
      const ok = await syncNow();
      if (!ok) {
        toast.error("Chưa thể kết nối máy chủ, dữ liệu đã lưu an toàn trên máy.", { id: t });
        return;
      }
      toast.success("Đã đồng bộ dữ liệu lên đám mây thành công!", { id: t });
    } catch {
      toast.error("Đồng bộ thất bại, bạn thử lại nhé", { id: t });
    } finally {
      setIsSyncing(false);
    }
  };

  if (loading) {
    return (
      <div
        aria-busy="true"
        aria-label="Đang tải tài khoản"
        className="min-h-[48px] flex items-center gap-3 px-3"
      >
        <span className="w-11 h-11 rounded-2xl bg-white/10 animate-pulse shrink-0" />
        <span className="flex-1 space-y-2">
          <span className="block h-3 w-2/3 rounded bg-white/10 animate-pulse" />
          <span className="block h-2.5 w-1/2 rounded bg-white/10 animate-pulse" />
        </span>
      </div>
    );
  }

  if (!user) {
    return (
      <button
        onClick={signIn}
        disabled={isSigningIn}
        className="min-h-[48px] w-full flex items-center justify-center gap-2 px-4 rounded-2xl bg-white text-slate-950 text-sm font-bold active:scale-[0.98] disabled:opacity-60 cursor-pointer touch-manipulation"
      >
        {isSigningIn ? (
          <CircleNotchIcon className="w-4 h-4 animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        Đăng nhập bằng Google
      </button>
    );
  }

  return (
    <div>
      <div className="min-h-[48px] flex items-center gap-3 px-3">
        <div className="relative w-11 h-11 shrink-0">
          <span className="absolute inset-0 w-full h-full rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-base font-bold flex items-center justify-center">
            {(user.displayName || user.email || "U")[0].toUpperCase()}
          </span>
          {user.photoURL && !avatarError && (
            <Image
              src={user.photoURL}
              alt={user.displayName || "Avatar"}
              width={44}
              height={44}
              unoptimized
              priority
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full rounded-2xl object-cover border border-white/20"
              onError={() => setAvatarError(true)}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white truncate" title={user.displayName || undefined}>
            {user.displayName || "Học viên ZenStudy"}
          </p>
          <p className="text-xs text-slate-400 truncate" title={user.email || undefined}>
            {user.email}
          </p>
        </div>
        {/* Cụm thao tác tài khoản: Nút đồng bộ và Nút đăng xuất tròn gọn gàng */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={isSyncing}
            aria-busy={isSyncing || undefined}
            title={isSyncing ? "Đang đồng bộ…" : "Đồng bộ dữ liệu"}
            aria-label={isSyncing ? "Đang đồng bộ dữ liệu" : "Đồng bộ dữ liệu"}
            className="w-10 h-10 grid place-items-center rounded-full border border-white/10 text-slate-300 hover:text-sky-300 hover:border-sky-400/30 active:scale-95 disabled:opacity-60 disabled:cursor-wait transition-colors cursor-pointer touch-manipulation"
          >
            {isSyncing ? (
              <CircleNotchIcon className="w-[18px] h-[18px] text-sky-400 animate-spin" weight="bold" />
            ) : (
              <ArrowsClockwiseIcon className="w-[18px] h-[18px]" />
            )}
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={isSigningOut}
            aria-busy={isSigningOut || undefined}
            title={isSigningOut ? "Đang đăng xuất…" : "Đăng xuất"}
            aria-label={isSigningOut ? "Đang đăng xuất" : "Đăng xuất"}
            className="w-10 h-10 grid place-items-center rounded-full border border-white/10 text-slate-300 hover:text-rose-200 hover:border-rose-400/30 active:scale-95 disabled:opacity-60 disabled:cursor-wait transition-colors cursor-pointer touch-manipulation"
          >
            {isSigningOut ? (
              <CircleNotchIcon className="w-[18px] h-[18px] animate-spin" weight="bold" />
            ) : (
              <SignOutIcon className="w-[18px] h-[18px]" />
            )}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          startTransition(() => {
            setIsDeleteOpen(true);
          });
        }}
        className="group mt-1.5 w-full min-h-[46px] flex items-center gap-3 px-3 py-1 rounded-2xl bg-white/[0.04] hover:bg-rose-500/[0.08] active:bg-rose-500/[0.12] active:scale-[0.97] border border-white/[0.08] hover:border-rose-400/25 transition-[background-color,border-color,transform] duration-75 text-left select-none cursor-pointer touch-manipulation"
      >
        <span className="w-9 h-9 rounded-xl bg-white/[0.08] border border-white/[0.15] flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
          <TrashIcon className="w-5 h-5 text-rose-300" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-rose-200 group-hover:text-rose-100 tracking-tight">
            Xoá tài khoản
          </span>
        </span>
      </button>

      <DeleteAccountDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        accountEmail={user.email}
      />
    </div>
  );
}
