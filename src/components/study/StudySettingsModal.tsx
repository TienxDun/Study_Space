"use client";

import React, { useState, useEffect } from "react";
import {
  XIcon,
  ClockIcon,
  FlameIcon,
  SpeakerHighIcon,
  MinusIcon,
  PlusIcon,
  CompassIcon,
  DeviceMobileIcon,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { ModalShell } from "../ui/ModalShell";
import { IconBtn } from "../ui/IconBtn";
import {
  PomodoroSoundType,
  POMODORO_SOUND_OPTIONS,
  playPomodoroSound
} from "./study-sound";
import { useRealtimeClock } from "./pomodoro/hooks/useRealtimeClock";
import { formatStopwatch } from "./pomodoro/utils/timer-formatters";

/** Demo bấm giờ chạy riêng trong cài đặt để thấy ngay .00 khác gì. */
function StopwatchPreview({ showMs }: { showMs: boolean }) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const delay = showMs ? 30 : 200;
    let id: number | undefined;
    const tick = () => setMs(Date.now() - start);
    const startTimer = () => {
      if (id !== undefined) return;
      tick();
      id = window.setInterval(tick, delay);
    };
    const stopTimer = () => {
      if (id === undefined) return;
      window.clearInterval(id);
      id = undefined;
    };
    // Chỉ nhịp khi tab đang hiện — đồng hồ demo 30ms không cần chạy khi bị ẩn.
    const onVisibility = () => (document.hidden ? stopTimer() : startTimer());
    if (!document.hidden) startTimer();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopTimer();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [showMs]);
  return <span>{formatStopwatch(ms, showMs)}</span>;
}

export interface StudySettingsProps {
  isOpen: boolean;
  onClose: () => void;
  // Tour walkthrough
  onOpenTour?: () => void;
  // Clock settings
  showClockSeconds: boolean;
  onToggleClockSeconds: () => void;
  isClock12Hour: boolean;
  onToggleClock12Hour: () => void;
  // Pomodoro settings
  durations: { focus: number; short_break: number; long_break: number };
  onSaveDurations: (durations: { focus: number; short_break: number; long_break: number }) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  soundType?: PomodoroSoundType;
  onSelectSoundType?: (type: PomodoroSoundType) => void;
  // Stopwatch settings
  showStopwatchMilliseconds: boolean;
  onToggleStopwatchMilliseconds: () => void;
  // Giữ màn hình sáng khi đang học
  keepAwake: boolean;
  onToggleKeepAwake: () => void;
  wakeLockSupported: boolean;
  // Stack navigation (mobile)
  onBack?: () => void;
  backLabel?: string;
}

// Reusable Modern Animated iOS-Style Toggle Switch
interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  activeColor?: string;
  disabled?: boolean;
}

const ToggleSwitch = ({ checked, onChange, activeColor = "bg-emerald-500", disabled = false }: ToggleSwitchProps) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) onChange();
      }}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-250 ease-in-out focus:outline-none active:scale-95 ${
        disabled
          ? "bg-white/5 border border-white/10 opacity-40 cursor-not-allowed"
          : checked
          ? `${activeColor} shadow-[0_0_12px_rgba(255,255,255,0.25)] cursor-pointer`
          : "bg-white/10 hover:bg-white/15 border border-white/10 cursor-pointer"
      }`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 600, damping: 35 }}
        className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-md transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
};

/** Khung nhóm + tiêu đề dùng chung cho 4 nhóm cài đặt. */
function SettingsSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
      <h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-wider">
        {icon}
        <span>{title}</span>
      </h4>
      {children}
    </section>
  );
}

/** 1 hàng: tên + mô tả bên trái, nút gạt bên phải. */
function SettingRow({
  title,
  desc,
  control,
}: {
  title: string;
  desc?: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      <div className="space-y-0.5 min-w-0">
        <div className="font-bold text-slate-200 text-xs">{title}</div>
        {desc && <div className="text-[11px] text-slate-400">{desc}</div>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

const DURATION_LIMITS = {
  focus: { min: 1, max: 120, step: 1 },
  short_break: { min: 1, max: 60, step: 1 },
  long_break: { min: 1, max: 90, step: 1 },
} as const;

type DurationKey = keyof typeof DURATION_LIMITS;

const DURATION_LABELS: Record<DurationKey, string> = {
  focus: "Tập trung",
  short_break: "Nghỉ ngắn",
  long_break: "Nghỉ dài",
};

export const StudySettingsModal = ({
  isOpen,
  onClose,
  onOpenTour,
  showClockSeconds,
  onToggleClockSeconds,
  isClock12Hour,
  onToggleClock12Hour,
  durations,
  onSaveDurations,
  soundEnabled,
  onToggleSound,
  soundType = "classic_clock",
  onSelectSoundType,
  showStopwatchMilliseconds,
  onToggleStopwatchMilliseconds,
  keepAwake,
  onToggleKeepAwake,
  wakeLockSupported,
}: StudySettingsProps) => {
  const [previewingSoundId, setPreviewingSoundId] = useState<string | null>(null);

  // Đồng hồ xem trước chạy thật: gạt nút nào là thấy đổi ngay tại chỗ,
  // khỏi phải đóng bảng ra nhìn đồng hồ lớn giữa màn hình.
  const { clockDigits, clockPeriod } = useRealtimeClock({
    showClockSeconds,
    isClock12Hour,
  });

  const stepDuration = (key: DurationKey, delta: number) => {
    const { min, max } = DURATION_LIMITS[key];
    const next = Math.max(min, Math.min(max, durations[key] + delta));
    if (next !== durations[key]) {
      onSaveDurations({ ...durations, [key]: next });
    }
  };

  const handleSelectSound = (type: PomodoroSoundType) => {
    if (onSelectSoundType) onSelectSoundType(type);
    // Bấm là nghe thử luôn, khỏi nút riêng
    setPreviewingSoundId(type);
    playPomodoroSound(type, true);
    window.setTimeout(() => {
      setPreviewingSoundId((prev) => (prev === type ? null : prev));
    }, 1200);
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      panelKey="settings-modal"
      backdropClassName="z-[60] bg-transparent"
      initial={{ opacity: 0, scale: 0.96, y: -6, x: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -6, x: 6 }}
      panelClassName="fixed top-[4.5rem] right-4 sm:right-6 z-[70] w-full max-w-[340px] sm:max-w-[380px] glass-panel hover:bg-black/45 p-5 space-y-4 text-white select-none max-h-[min(480px,calc(100vh-100px))] overflow-y-auto custom-study-scroll"
    >
      {/* Header (Đã xóa icon thừa, tinh gọn & thanh lịch) */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div>
          <h3 className="text-sm font-extrabold text-white tracking-wide">Cài đặt không gian</h3>
          <p className="text-xs text-slate-400 font-medium">Tùy biến hiển thị & thời lượng</p>
        </div>

        <IconBtn
          onClick={onClose}
          title="Đóng (Esc)"
          icon={<XIcon className="w-4 h-4" />}
          className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        />
      </div>

      {/* NHÓM 1: HIỂN THỊ */}
      <SettingsSection
        icon={<ClockIcon className="w-3.5 h-3.5 text-emerald-400" />}
        title="Hiển thị"
      >
        {/* Xem trước chạy thật theo đúng nút gạt bên dưới */}
        <div
          className="rounded-xl bg-black/40 border border-white/10 py-2 px-3 text-center font-mono text-sm font-bold text-white tabular-nums tracking-wider"
          title="Xem trước kiểu giờ đã chọn"
        >
          <div className="text-[10px] font-sans font-medium text-slate-500 tracking-normal mb-0.5">Đồng hồ</div>
          {clockDigits || "-- : --"}
          {clockPeriod ? <span className="text-white/60 text-xs ml-1.5">{clockPeriod}</span> : null}
        </div>

        <SettingRow
          title="Hiển thị giây (:ss)"
          desc="23:52:48 ⟷ 23:52"
          control={
            <ToggleSwitch
              checked={showClockSeconds}
              onChange={onToggleClockSeconds}
              activeColor="bg-emerald-500"
            />
          }
        />

        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="space-y-0.5">
            <div className="font-bold text-slate-200 text-xs">Định dạng thời gian</div>
            <div className="text-xs text-slate-400">24 Giờ hoặc 12 Giờ (AM/PM)</div>
          </div>
          <div className="flex items-center p-0.5 rounded-xl bg-white/10 border border-white/10 shrink-0">
            <button
              type="button"
              onClick={() => isClock12Hour && onToggleClock12Hour()}
              aria-pressed={!isClock12Hour}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                !isClock12Hour ? "bg-white text-black shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              24h
            </button>
            <button
              type="button"
              onClick={() => !isClock12Hour && onToggleClock12Hour()}
              aria-pressed={isClock12Hour}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isClock12Hour ? "bg-white text-black shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              12h
            </button>
          </div>
        </div>

        <SettingRow
          title="Phần trăm giây bấm giờ (.00)"
          desc="00:00.00 ⟷ 00:00"
          control={
            <ToggleSwitch
              checked={showStopwatchMilliseconds}
              onChange={onToggleStopwatchMilliseconds}
              activeColor="bg-emerald-500"
            />
          }
        />

        {/* Demo bấm giờ chạy riêng để thấy ngay .00 khác gì */}
        <div
          className="rounded-xl bg-black/40 border border-white/10 py-2 px-3 text-center font-mono text-sm font-bold text-white tabular-nums tracking-wider"
          title="Demo kiểu bấm giờ đã chọn"
        >
          <div className="text-[10px] font-sans font-medium text-slate-500 tracking-normal mb-0.5">Bấm giờ (demo)</div>
          <StopwatchPreview showMs={showStopwatchMilliseconds} />
        </div>
      </SettingsSection>

      {/* NHÓM 2: PHIÊN HỌC */}
      <SettingsSection
        icon={<FlameIcon className="w-3.5 h-3.5 text-emerald-400" />}
        title="Phiên học"
      >
        {/* Chỉnh tay từng phút bằng nút cộng trừ */}
        {(Object.keys(DURATION_LIMITS) as DurationKey[]).map((key) => (
          <div
            key={key}
            className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]"
          >
            <span className="text-xs font-bold text-slate-200">{DURATION_LABELS[key]}</span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => stepDuration(key, -DURATION_LIMITS[key].step)}
                disabled={durations[key] <= DURATION_LIMITS[key].min}
                aria-label={`Giảm ${DURATION_LABELS[key]}`}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center transition-all active:scale-90 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <MinusIcon className="w-3.5 h-3.5" />
              </button>
              <span className="w-10 text-center text-xs font-bold font-mono text-white tabular-nums">
                {durations[key]}′
              </span>
              <button
                type="button"
                onClick={() => stepDuration(key, DURATION_LIMITS[key].step)}
                disabled={durations[key] >= DURATION_LIMITS[key].max}
                aria-label={`Tăng ${DURATION_LABELS[key]}`}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center transition-all active:scale-90 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <PlusIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </SettingsSection>

      {/* NHÓM 3: CHUÔNG */}
      <SettingsSection
        icon={<SpeakerHighIcon className="w-3.5 h-3.5 text-emerald-400" />}
        title="Chuông báo"
      >
        <SettingRow
          title="Chuông báo hoàn thành"
          control={
            <ToggleSwitch
              checked={soundEnabled}
              onChange={onToggleSound}
              activeColor="bg-emerald-500"
            />
          }
        />

        {soundEnabled && (
          <div className="grid grid-cols-2 gap-1.5">
            {POMODORO_SOUND_OPTIONS.map((opt) => {
              const isSelected = soundType === opt.id;
              const isPreviewing = previewingSoundId === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectSound(opt.id)}
                  aria-pressed={isSelected}
                  title="Bấm để chọn + nghe thử"
                  className={`px-2 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer truncate ${
                    isSelected
                      ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-200"
                      : "bg-white/[0.02] hover:bg-white/[0.06] border-white/[0.06] text-slate-300"
                  }`}
                >
                  <span className="truncate block">{opt.name}</span>
                  <span
                    className={`block text-[10px] font-medium mt-0.5 ${
                      isPreviewing ? "text-emerald-300 animate-pulse" : "text-slate-500"
                    }`}
                  >
                    {isPreviewing ? "♪ đang phát…" : isSelected ? "đang dùng" : "bấm để thử"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </SettingsSection>

      {/* NHÓM 4: MÀN HÌNH — chỉ 1 nút nên gọn 1 hàng, khỏi khung nhóm + tiêu đề riêng */}
      <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
        <div className="flex items-start gap-2 min-w-0">
          <DeviceMobileIcon className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-slate-200 text-xs">Giữ màn hình sáng khi học</div>
            <p className="text-[11px] text-slate-400">
              {wakeLockSupported
                ? "Không tắt màn hình khi đang học"
                : "Máy này không hỗ trợ giữ sáng"}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <ToggleSwitch
            checked={keepAwake && wakeLockSupported}
            onChange={onToggleKeepAwake}
            activeColor="bg-emerald-500"
            disabled={!wakeLockSupported}
          />
        </div>
      </div>

      {/* Tour hướng dẫn sử dụng */}
      {onOpenTour && (
        <div className="pt-2 border-t border-white/10">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] transition-colors">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <CompassIcon className="w-3.5 h-3.5 text-accent-music-glow" />
                <span>Tour hướng dẫn sử dụng</span>
              </div>
                    <p className="text-xs text-slate-400">Xem lại cách dùng các tính năng</p>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenTour();
              }}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-accent-music/20 hover:bg-accent-music/30 text-accent-music-bright border border-accent-music-glow/30 transition-all active:scale-95 cursor-pointer flex items-center gap-1 shadow-sm shrink-0"
              title="Mở lại Onboarding Tour"
            >
              <span>Xem lại</span>
            </button>
          </div>
        </div>
      )}

    </ModalShell>
  );
};
