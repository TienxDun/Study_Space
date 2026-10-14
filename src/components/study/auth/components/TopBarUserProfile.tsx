"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CircleNotchIcon, SignOutIcon } from "@phosphor-icons/react";
import { useAuth } from "@/lib/use-auth";
import { GoogleIcon } from "./GoogleIcon";

/**
 * Nút hồ sơ tài khoản và bảng menu đăng nhập / đăng xuất trên TopBar.
 * Hỗ trợ tự đóng khi click ra ngoài, avatar fallback và giao diện chuẩn glass-panel.
 */
export const TopBarUserProfile = () => {
  const { user, loading, isSigningIn, signIn, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
        className="h-8 px-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 hover:text-white transition-all active:scale-95 flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-xs shrink-0"
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
        onClick={() => setIsOpen((prev) => !prev)}
        className={`h-8 pl-1 pr-2 rounded-xl border transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-xs group ${
          isOpen
            ? "bg-white/20 border-white/25 text-white shadow-[0_0_12px_rgba(255,255,255,0.2)]"
            : "bg-white/10 hover:bg-white/15 border-white/15 text-slate-200 hover:text-white"
        }`}
        title={`${user.displayName || user.email} (Bấm để xem hồ sơ)`}
        aria-label={`${user.displayName || user.email}, bấm để xem hồ sơ`}
        aria-expanded={isOpen}
      >
        {user.photoURL && !avatarError ? (
          <img
            src={user.photoURL}
            alt={user.displayName || "Avatar"}
            className="w-6 h-6 rounded-lg object-cover border border-white/20"
            onError={() => setAvatarError(true)}
            referrerPolicy="no-referrer"
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
                <img
                  src={user.photoURL}
                  alt={user.displayName || "Avatar"}
                  className="w-10 h-10 rounded-xl object-cover border border-white/20"
                  onError={() => setAvatarError(true)}
                  referrerPolicy="no-referrer"
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

            <div className="pt-3 flex items-center justify-between">
              <span className="text-[11px] font-medium text-emerald-300/90 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Google Connected
              </span>
              <button
                onClick={() => {
                  signOut();
                  setIsOpen(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-rose-300 hover:text-rose-200 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <SignOutIcon className="w-3.5 h-3.5" />
                <span>Đăng xuất</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
