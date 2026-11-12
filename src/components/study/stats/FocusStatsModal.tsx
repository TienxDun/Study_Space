"use client";

import { useState } from "react";
import {
  XIcon,
  ChartBarIcon,
  CaretDownIcon,
  TimerIcon,
} from "@phosphor-icons/react";
import { ModalShell } from "@/components/ui/ModalShell";
import { useFocusStats } from "@/lib/use-focus-stats";
import { EVENT_OPEN_POMODORO } from "@/lib/use-focus-task";
import {
  formatFocusDuration,
  formatDayLabel,
  getDailySeries,
  focusSessionStore,
  startOfWeek,
} from "@/lib/focus-sessions";

interface FocusStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Khoảng trắng không ngắt giữa số và đơn vị: thẻ hẹp thì xuống dòng cả cụm
 *  ("3 giờ" / "41 phút"), không để chữ "phút" rơi xuống một mình. */
const keepUnitWithNumber = (text: string) => text.replace(/ (\D)/g, "\u00A0$1");

/** Toàn bộ thời gian Pomodoro đã tích lũy: hôm nay / tuần / tháng + theo task. */
export function FocusStatsModal({ isOpen, onClose }: FocusStatsModalProps) {
  const today = useFocusStats("today");
  const week = useFocusStats("week");
  const month = useFocusStats("month");
  const all = useFocusStats("all");
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  // Bẫy Tab + Esc + trả focus do ModalShell lo chung

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
    `Tuần này (${dayFmt(weekStart)} – ${dayFmt(weekEnd)}, từ Thứ Hai)`,
    `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`,
  ];
  const topTasks = all.byTask.slice(0, 8);
  const maxTaskSeconds = topTasks[0]?.focusSeconds ?? 1;
  // Đọc trực tiếp để dựng timeline — render này luôn chạy sau khi
  // các hook trên cập nhật nên số liệu vẫn tươi.
  const series = getDailySeries(focusSessionStore.list());
  const firstDay = series.length > 0 ? series[series.length - 1] : null;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      panelKey="focus-stats-panel"
      backdropClassName="z-[60] bg-transparent"
      panelClassName="fixed top-[4.5rem] right-4 sm:right-6 z-[70] w-full max-w-[340px] sm:max-w-[380px] glass-panel p-5 text-white select-none max-h-[calc(100vh-92px)] overflow-y-auto overscroll-contain custom-study-scroll"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Thống kê thời gian tập trung"
        className="flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <ChartBarIcon className="w-4 h-4 text-emerald-300" />
            Thống kê tập trung
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="relative p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer active:scale-95 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 before:content-[''] before:absolute before:-inset-2"
            title="Đóng thống kê (Esc)"
            aria-label="Đóng thống kê"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {all.totalSeconds <= 0 ? (
          <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3.5 space-y-3 text-center">
            <p className="text-xs leading-relaxed text-slate-400">
              Chưa ghi nhận phiên nào. Bấm chạy Pomodoro để bắt đầu tích lũy —
              pause giữa chừng vẫn tính giờ.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                window.dispatchEvent(new Event(EVENT_OPEN_POMODORO));
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-400/15 border border-emerald-400/30 text-emerald-300 hover:bg-emerald-400/25 hover:text-emerald-200 transition-colors cursor-pointer active:scale-[0.98] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
            >
              <TimerIcon className="w-4 h-4" />
              Mở Pomodoro ngay
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {cards.map((c, i) => (
                <div
                  key={c.label}
                  className="rounded-2xl bg-white/[0.04] border border-white/10 p-2.5 text-center flex flex-col justify-center min-h-[76px]"
                  title={cardRanges[i]}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {c.label}
                  </div>
                  <div className="mt-0.5 text-sm font-bold text-white leading-tight text-balance">
                    {keepUnitWithNumber(formatFocusDuration(c.summary.totalSeconds))}
                  </div>
                </div>
              ))}
            </div>

            {topTasks.length > 0 && (
              <section
                aria-label="Thống kê theo task"
                className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-3 space-y-3"
              >
                <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Theo task (tích lũy)
                  <span className="px-1.5 py-px rounded-md bg-white/10 text-[10px] font-semibold normal-case tracking-normal text-slate-300 tabular-nums">
                    {topTasks.length}
                  </span>
                </h3>
                <ul className="space-y-2.5">
                  {topTasks.map((t) => (
                    <li
                      key={t.taskId}
                      title={`${t.taskTitle}: ${formatFocusDuration(t.focusSeconds)}`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 flex-1 truncate text-slate-200 font-medium">
                          {t.taskTitle}
                        </span>
                        <span className="shrink-0 font-semibold text-emerald-300 tabular-nums">
                          {formatFocusDuration(t.focusSeconds)}
                        </span>
                      </div>
                      <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-400/80"
                          style={{
                            width: `${Math.max(
                              4,
                              Math.round(
                                (t.focusSeconds / maxTaskSeconds) * 100
                              )
                            )}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {series.length > 0 && (
              <section
                aria-label="Lịch sử từng ngày"
                className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-3 space-y-3"
              >
                <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Lịch sử từng ngày
                  <span className="px-1.5 py-px rounded-md bg-white/10 text-[10px] font-semibold normal-case tracking-normal text-slate-300 tabular-nums">
                    {series.length} ngày
                  </span>
                  {firstDay && (
                    <span className="normal-case font-medium tracking-normal text-slate-500">
                      • từ{" "}
                      {new Date(firstDay.dayStartMs).toLocaleDateString(
                        "vi-VN",
                        { day: "numeric", month: "numeric", year: "numeric" }
                      )}
                    </span>
                  )}
                </h3>
                <ul className="space-y-2">
                  {series.map((day) => {
                    const expanded = expandedDay === day.dateKey;
                    return (
                      <li
                        key={day.dateKey}
                        className="rounded-xl bg-white/[0.04] border border-white/10 overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedDay(expanded ? null : day.dateKey)
                          }
                          className="relative w-full flex items-center justify-between gap-2 px-2.5 py-2.5 text-xs cursor-pointer hover:bg-white/[0.04] transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70 before:content-[''] before:absolute before:-inset-1"
                          aria-expanded={expanded}
                          title={`${formatDayLabel(day.dayStartMs)}: ${formatFocusDuration(day.totalSeconds)}`}
                        >
                          <span className="font-semibold text-slate-200">
                            {formatDayLabel(day.dayStartMs)}
                          </span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            <span className="text-slate-400 tabular-nums">
                              {formatFocusDuration(day.totalSeconds)}
                            </span>
                            <CaretDownIcon
                              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 motion-reduce:transition-none ${
                                expanded ? "rotate-180" : ""
                              }`}
                            />
                          </span>
                        </button>
                        {expanded && (
                          <ul className="px-2.5 pb-2 space-y-1 border-t border-white/5 pt-1.5">
                            {day.byTask.map((t) => (
                              <li
                                key={t.taskId}
                                className="flex items-center justify-between gap-2 text-[11px]"
                              >
                                <span className="min-w-0 flex-1 truncate text-slate-300">
                                  {t.taskTitle}
                                </span>
                                <span className="shrink-0 font-semibold text-emerald-300/90 tabular-nums">
                                  {formatFocusDuration(t.focusSeconds)}
                                </span>
                              </li>
                            ))}
                          </ul>
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
    </ModalShell>
  );
}
