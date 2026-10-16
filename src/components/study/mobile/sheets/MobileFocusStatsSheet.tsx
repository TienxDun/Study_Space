"use client";

import React, { useState } from "react";
import {
  ChartBarIcon,
  TimerIcon,
  CaretDownIcon,
  CalendarDotsIcon,
  PlayIcon,
} from "@phosphor-icons/react";
import { MobileSheetShell } from "./MobileSheetShell";
import { useFocusStats } from "@/lib/use-focus-stats";
import { EVENT_OPEN_POMODORO } from "@/lib/use-focus-task";
import {
  formatFocusDuration,
  formatDayLabel,
  getDailySeries,
  focusSessionStore,
  startOfWeek,
} from "@/lib/focus-sessions";

interface MobileFocusStatsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  backLabel?: string;
}

export function MobileFocusStatsSheet({
  isOpen,
  onClose,
  onBack,
  backLabel,
}: MobileFocusStatsSheetProps) {
  const today = useFocusStats("today");
  const week = useFocusStats("week");
  const month = useFocusStats("month");
  const all = useFocusStats("all");
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const cards = [
    { label: "Hôm nay", summary: today },
    { label: "Tuần này", summary: week },
    { label: "Tháng này", summary: month },
  ];

  const now = new Date();
  const dayFmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate() + 6
  );
  const cardRanges = [
    `Hôm nay (${dayFmt(now)})`,
    `Tuần này (${dayFmt(weekStart)} – ${dayFmt(weekEnd)})`,
    `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`,
  ];

  const topTasks = all.byTask.slice(0, 10);
  const maxTaskSeconds = topTasks[0]?.focusSeconds ?? 1;

  const series = getDailySeries(focusSessionStore.list());
  const firstDay = series.length > 0 ? series[series.length - 1] : null;

  const handleStartPomodoro = () => {
    onClose();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(EVENT_OPEN_POMODORO));
    }
  };

  return (
    <MobileSheetShell
      isOpen={isOpen}
      onClose={onClose}
      onBack={onBack}
      backLabel={backLabel}
      sheetId="stats"
      title="Thống kê tập trung"
      maxHeightClassName="h-auto max-h-[82dvh]"
    >
      <div className="flex-1 flex flex-col px-4 pt-3.5 pb-6 space-y-4 text-white select-none">
        {all.totalSeconds <= 0 ? (
          /* Trạng thái chưa có dữ liệu */
          <div className="py-12 flex flex-col items-center justify-center text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-3 text-white/40 shadow-inner">
              <ChartBarIcon className="w-7 h-7" weight="duotone" />
            </div>
            <h3 className="text-sm font-semibold text-white/90">
              Chưa có dữ liệu tập trung
            </h3>
            <p className="text-xs text-white/50 mt-1.5 max-w-[260px] leading-relaxed">
              Bắt đầu một phiên Pomodoro để hệ thống tự động ghi nhận và tích lũy thời gian học của bạn.
            </p>
            <button
              type="button"
              onClick={handleStartPomodoro}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold lg-btn-action text-white transition-all active:scale-95 cursor-pointer shadow-md"
            >
              <PlayIcon className="w-3.5 h-3.5 relative z-10" weight="fill" />
              <span className="relative z-10">Bắt đầu học ngay</span>
            </button>
          </div>
        ) : (
          <>
            {/* 1. Ba thẻ tổng quan: Hôm nay / Tuần này / Tháng này */}
            <div
              style={{ "--stagger-idx": 0 } as React.CSSProperties}
              className="grid grid-cols-3 gap-2.5 sheet-stagger-item"
            >
              {cards.map((c, i) => (
                <div
                  key={c.label}
                  className="rounded-2xl bg-white/[0.04] border border-white/[0.08] py-3 px-2 text-center transition-all hover:bg-white/[0.06] shadow-sm flex flex-col justify-center min-h-[72px]"
                  title={cardRanges[i]}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-white/50 mb-1">
                    {c.label}
                  </div>
                  <div className="text-sm sm:text-base font-bold text-white leading-tight tabular-nums truncate">
                    {formatFocusDuration(c.summary.totalSeconds)}
                  </div>
                </div>
              ))}
            </div>

            {/* 2. Thống kê theo Task tích lũy */}
            {topTasks.length > 0 && (
              <section
                aria-label="Thống kê theo task"
                style={{ "--stagger-idx": 1 } as React.CSSProperties}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4 space-y-3.5 sheet-stagger-item sheet-lazy-card"
              >
                <div className="flex items-center justify-between pb-0.5">
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/60">
                    <TimerIcon className="w-4 h-4 text-emerald-400 shrink-0" weight="bold" />
                    <span>Theo nhiệm vụ (Tích lũy)</span>
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-semibold text-white/70 tabular-nums">
                    {topTasks.length}
                  </span>
                </div>

                <ul className="space-y-3.5 pt-0.5">
                  {topTasks.map((t) => {
                    const pct = Math.max(
                      5,
                      Math.round((t.focusSeconds / maxTaskSeconds) * 100)
                    );
                    return (
                      <li
                        key={t.taskId}
                        title={`${t.taskTitle}: ${formatFocusDuration(t.focusSeconds)}`}
                        className="space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0 flex-1 truncate text-white/85 font-medium">
                            {t.taskTitle}
                          </span>
                          <span className="shrink-0 font-semibold text-emerald-300 tabular-nums text-[11px]">
                            {formatFocusDuration(t.focusSeconds)}
                          </span>
                        </div>
                        {/* Thanh tiến độ */}
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-1.5">
                          <div
                            className="h-full rounded-full bg-emerald-400/80 transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* 3. Lịch sử theo từng ngày */}
            {series.length > 0 && (
              <section
                aria-label="Lịch sử từng ngày"
                style={{ "--stagger-idx": 2 } as React.CSSProperties}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4 space-y-3 sheet-stagger-item sheet-lazy-card"
              >
                <div className="flex items-center justify-between pb-0.5">
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/60">
                    <CalendarDotsIcon className="w-4 h-4 text-sky-400 shrink-0" weight="bold" />
                    <span>Lịch sử từng ngày</span>
                  </h3>
                  <div className="flex items-center gap-1.5 text-[10px] text-white/40">
                    <span className="px-2 py-0.5 rounded-full bg-white/10 font-semibold text-white/70 tabular-nums">
                      {series.length} ngày
                    </span>
                    {firstDay && (
                      <span className="hidden sm:inline">
                        từ{" "}
                        {new Date(firstDay.dayStartMs).toLocaleDateString(
                          "vi-VN",
                          { day: "numeric", month: "numeric" }
                        )}
                      </span>
                    )}
                  </div>
                </div>

                <ul className="space-y-2 pt-0.5">
                  {series.map((day) => {
                    const expanded = expandedDay === day.dateKey;
                    return (
                      <li
                        key={day.dateKey}
                        className="rounded-xl bg-white/[0.04] border border-white/[0.08] overflow-hidden transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedDay(expanded ? null : day.dateKey)
                          }
                          className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs cursor-pointer hover:bg-white/[0.06] active:scale-[0.99] transition-all"
                          aria-expanded={expanded}
                        >
                          <span className="font-medium text-white/90">
                            {formatDayLabel(day.dayStartMs)}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-semibold text-white/60 tabular-nums text-[11px]">
                              {formatFocusDuration(day.totalSeconds)}
                            </span>
                            <CaretDownIcon
                              className={`w-3.5 h-3.5 text-white/40 transition-transform duration-200 ${
                                expanded ? "rotate-180 text-white" : ""
                              }`}
                              weight="bold"
                            />
                          </div>
                        </button>

                        {expanded && (
                          <div className="px-3.5 pb-2.5 pt-1.5 border-t border-white/[0.06] bg-black/20 space-y-1.5">
                            {day.byTask.map((t) => (
                              <div
                                key={t.taskId}
                                className="flex items-center justify-between gap-2 text-[11px] py-0.5"
                              >
                                <span className="min-w-0 flex-1 truncate text-white/70">
                                  {t.taskTitle}
                                </span>
                                <span className="shrink-0 font-medium text-emerald-300/80 tabular-nums">
                                  {formatFocusDuration(t.focusSeconds)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </MobileSheetShell>
  );
}
