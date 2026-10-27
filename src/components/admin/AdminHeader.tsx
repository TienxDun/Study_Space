"use client";

import Link from "next/link";
import {
  LightningIcon,
  FilmStripIcon,
  ArrowLeftIcon,
  ShieldCheckIcon,
  SunIcon,
  MoonIcon,
} from "@phosphor-icons/react";
import { useAdminTheme } from "./AdminThemeContext";

export type AdminTab = "limits" | "studio";

interface AdminHeaderProps {
  activeTab: AdminTab;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}

const TABS: { id: AdminTab; href: string; label: string; icon: typeof LightningIcon }[] = [
  { id: "limits", href: "/admin", label: "Hạn Mức Hệ Thống", icon: LightningIcon },
  { id: "studio", href: "/dev/studio", label: "Studio Bối Cảnh (local)", icon: FilmStripIcon },
];

export function AdminHeader({ activeTab, title, description, actions }: AdminHeaderProps) {
  const { isDark, toggleTheme } = useAdminTheme();

  return (
    <header className={`space-y-4 pb-6 border-b transition-colors ${isDark ? "border-white/[0.08]" : "border-slate-200"}`}>
      {/* Top Bar: Brand, Environment Pill, Theme Switcher & Main Site Link */}
      <div className="flex items-center justify-between gap-3">
        {/* Brand & Status */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/admin"
            className="group flex items-center gap-2 font-bold tracking-tight text-sm hover:opacity-90 transition-opacity"
          >
            <span
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 ${
                isDark
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                  : "bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-xs"
              }`}
            >
              <ShieldCheckIcon className="w-4 h-4" />
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className={isDark ? "text-white" : "text-slate-900"}>ZenStudy</span>
              <span className={`text-[11px] font-semibold ${isDark ? "text-slate-400 group-hover:text-slate-300" : "text-slate-500 group-hover:text-slate-700"}`}>
                Admin
              </span>
            </span>
          </Link>

          <span
            className={`hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              isDark
                ? "bg-white/[0.05] text-emerald-400 border-white/10"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            OFFLINE DEV
          </span>
        </div>

        {/* Right actions: Theme Toggle & Back to study page & custom actions */}
        <div className="flex items-center gap-2">
          {actions}

          {/* Theme Switcher Button */}
          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? "Chuyển sang giao diện Sáng (Light Mode)" : "Chuyển sang giao diện Tối (Dark Mode)"}
            aria-label="Đổi giao diện Sáng/Tối"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer active:scale-95 ${
              isDark
                ? "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-amber-300 hover:text-amber-200"
                : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 hover:text-slate-900 shadow-2xs"
            }`}
          >
            {isDark ? (
              <>
                <SunIcon className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Giao diện sáng</span>
              </>
            ) : (
              <>
                <MoonIcon className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Giao diện tối</span>
              </>
            )}
          </button>

          <Link
            href="/"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all active:scale-95 shadow-xs ${
              isDark
                ? "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-slate-300 hover:text-white"
                : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 hover:text-slate-900"
            }`}
            title="Quay lại không gian học chính"
          >
            <ArrowLeftIcon className={`w-3.5 h-3.5 ${isDark ? "text-slate-400" : "text-slate-500"}`} />
            <span>Về Trang Học</span>
          </Link>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <nav
        aria-label="Admin Navigation Tabs"
        className={`flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none border-b transition-colors ${
          isDark ? "border-white/[0.04]" : "border-slate-200/60"
        }`}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? isDark
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-300/80 shadow-2xs"
                  : isDark
                    ? "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent"
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  isActive
                    ? isDark
                      ? "text-emerald-400"
                      : "text-emerald-600"
                    : isDark
                      ? "text-slate-500"
                      : "text-slate-400"
                }`}
              />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Page Title & Description (if provided) */}
      {title && (
        <div className="pt-1">
          <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
            {title}
          </h1>
          {description && (
            <p className={`text-xs sm:text-sm mt-1 max-w-3xl leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              {description}
            </p>
          )}
        </div>
      )}
    </header>
  );
}
