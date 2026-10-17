"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CircleNotchIcon, SignOutIcon } from "@phosphor-icons/react";
import { useAuth } from "@/lib/use-auth";
import { GoogleIcon } from "@/components/study/auth/components/GoogleIcon";

// Thẻ tài khoản RIÊNG cho bảng Thêm trên mobile.
// Xếp dọc khoa học: avatar + tên + mail đầy đủ, nút đăng xuất full hàng dưới.
export function MobileAccountCard() {
  const { user, loading, isSigningIn, signIn, signOut } = useAuth();
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [user?.photoURL]);

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
        className="min-h-[48px] w-full flex items-center justify-center gap-2 px-4 rounded-2xl bg-white text-slate-950 text-sm font-bold active:scale-[0.98] disabled:opacity-60"
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
    <div className="min-h-[48px] flex items-center gap-3 px-3">
      {user.photoURL && !avatarError ? (
        <Image
          src={user.photoURL}
          alt={user.displayName || "Avatar"}
          width={44}
          height={44}
          unoptimized
          className="w-11 h-11 rounded-2xl object-cover border border-white/20 shrink-0"
          onError={() => setAvatarError(true)}
        />
      ) : (
        <span className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-base font-bold flex items-center justify-center shrink-0">
          {(user.displayName || user.email || "U")[0].toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white truncate" title={user.displayName || undefined}>
          {user.displayName || "Học viên ZenStudy"}
        </p>
        <p className="text-xs text-slate-400 truncate" title={user.email || undefined}>
          {user.email}
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-emerald-300/90 flex items-center gap-1.5 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          Google Connected
        </p>
      </div>
      {/* Nút đăng xuất gọn dạng icon tròn, không chen chữ */}
      <button
        onClick={() => signOut()}
        title="Đăng xuất"
        aria-label="Đăng xuất"
        className="w-10 h-10 shrink-0 grid place-items-center rounded-full border border-white/10 text-slate-300 hover:text-rose-200 hover:border-rose-400/30 active:scale-95"
      >
        <SignOutIcon className="w-[18px] h-[18px]" />
      </button>
    </div>
  );
}
