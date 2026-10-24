"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { CircleNotchIcon, SignOutIcon } from "@phosphor-icons/react";
import { useAuth } from "@/lib/use-auth";
import { GoogleIcon } from "./GoogleIcon";
import { toast } from "sonner";
import { SyncStatusBadge } from "@/components/study/sync/SyncStatusBadge";
import { syncNow } from "@/lib/simple-cloud-sync";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { APP_VERSION_LABEL } from "@/lib/version";

/**
 * Nút hồ sơ tài khoản và bảng menu đăng nhập / đăng xuất trên TopBar.
 * Hỗ trợ tự đóng khi click ra ngoài, avatar fallback và giao diện chuẩn glass-panel.
 */
interface TopBarUserProfileProps {
  bare?: boolean;
}

export const TopBarUserProfile = ({ bare = false }: TopBarUserProfileProps = {}) => {
  const { user, loading, isSigningIn, isSigningOut, signIn, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncingRef = useRef(false);
  const [avatarError, setAvatarError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setAvatarError(false);
  }, [user?.photoURL]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400" aria-label="Đang tải tài khoản">
        <CircleNotchIcon className="w-3.5 h-3.5 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <button
        onClick={signIn}
        disabled={isSigningIn}
        className={`h-8 px-2.5 rounded-xl transition-all active:scale-95 flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-xs shrink-0 ${
          bare
            ? "bg-transparent border border-transparent text-slate-200 hover:text-white hover:bg-white/5"
            : "bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 hover:text-white"
        }`}
        title="Đăng nhập tài khoản Google"
        aria-label="Đăng nhập tài khoản Google"
      >
        {isSigningIn ? (
          <CircleNotchIcon className="w-3.5 h-3.5 animate-spin text-emerald-400" />
        ) : (
          <GoogleIcon />
        )}
        <span className="hidden sm:inline">Đăng nhập</span>
      </button>
    );
  }

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`h-8 pl-1 pr-2 rounded-xl border transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-xs group ${
          isOpen
            ? "bg-white/20 border-white/25 text-white shadow-[0_0_12px_rgba(255,255,255,0.2)]"
            : bare
              ? "bg-transparent border-transparent text-slate-200 hover:text-white hover:bg-white/5"
              : "bg-white/10 hover:bg-white/15 border-white/15 text-slate-200 hover:text-white"
        }`}
        title={`${user.displayName || user.email} (Bấm để xem hồ sơ)`}
        aria-label={`${user.displayName || user.email}, bấm để xem hồ sơ`}
        aria-expanded={isOpen}
      >
        {user.photoURL && !avatarError ? (
          <Image
            src={user.photoURL}
            alt={user.displayName || "Avatar"}
            width={24}
            height={24}
            unoptimized
            className="w-6 h-6 rounded-lg object-cover border border-white/20"
            onError={() => setAvatarError(true)}
          />
        ) : (
          <span className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold flex items-center justify-center">
            {(user.displayName || user.email || "U")[0].toUpperCase()}
          </span>
        )}
        <span className="hidden sm:inline-block text-xs font-semibold text-white/90 max-w-[85px] truncate">
          {user.displayName?.split(" ").slice(-1)[0] || user.displayName || user.email?.split("@")[0]}
        </span>
      </button>

      {/* Profile Dropdown Card */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 6 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full mt-2 z-50 w-72 glass-panel hover:bg-black/45 p-4 text-left select-none text-white shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
          >
            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
              {user.photoURL && !avatarError ? (
                <Image
                  src={user.photoURL}
                  alt={user.displayName || "Avatar"}
                  width={40}
                  height={40}
                  unoptimized
                  className="w-10 h-10 rounded-xl object-cover border border-white/20"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <span className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-sm font-bold flex items-center justify-center">
                  {(user.displayName || user.email || "U")[0].toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">
                  {user.displayName || "Học viên ZenStudy"}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {user.email}
                </p>
              </div>
            </div>

            {/* Đồng bộ đám mây & Nút sync ngay */}
            <div className="py-2.5 border-b border-white/10 flex items-center justify-between text-xs">
              <SyncStatusBadge variant="text" interactive={false} />
              <button
                type="button"
                disabled={isSyncing}
                aria-busy={isSyncing || undefined}
                onClick={async () => {
                  if (syncingRef.current) return;
                  syncingRef.current = true;
                  setIsSyncing(true);
                  const toastId = toast.loading("Đang đồng bộ dữ liệu lên đám mây...");
                  try {
                    const ok = await syncNow();
                    if (ok) {
                      toast.success("Đã đồng bộ lên đám mây thành công!", { id: toastId });
                    } else {
                      toast.error("Không thể kết nối máy chủ.", { id: toastId });
                    }
                  } catch {
                    toast.error("Đồng bộ thất bại. Vui lòng thử lại sau.", { id: toastId });
                  } finally {
                    syncingRef.current = false;
                    setIsSyncing(false);
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/30 text-sky-300 hover:text-sky-200 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-wait"
              >
                {isSyncing && <CircleNotchIcon className="w-3.5 h-3.5 animate-spin" weight="bold" />}
                {isSyncing ? "Đang đồng bộ…" : "Đồng bộ ngay"}
              </button>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] font-medium text-emerald-300/90 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Đã kết nối Google
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsLogoutConfirmOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-rose-300 hover:text-rose-200 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <SignOutIcon className="w-3.5 h-3.5" />
                <span>Đăng xuất</span>
              </button>
            </div>

            {/* Chân thẻ hồ sơ: Phiên bản ứng dụng */}
            <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] select-none">
              <span className="text-slate-400">Phiên bản</span>
              <span className="font-mono text-emerald-300 font-semibold px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10">
                {APP_VERSION_LABEL}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDeleteModal
        isOpen={isLogoutConfirmOpen}
        pending={isSigningOut}
        onClose={() => {
          if (isSigningOut) return;
          setIsLogoutConfirmOpen(false);
          triggerRef.current?.focus();
        }}
        onConfirm={async () => {
          await signOut();
          setIsLogoutConfirmOpen(false);
        }}
        title="Đăng xuất khỏi ZenStudy?"
        description="Dữ liệu đã đồng bộ vẫn còn trên đám mây, nhưng dữ liệu trên thiết bị này sẽ bị xoá. Nếu đang offline, thay đổi chưa đồng bộ có thể mất."
        confirmText="Đăng xuất"
        cancelText="Ở lại"
      />
    </div>
  );
};
