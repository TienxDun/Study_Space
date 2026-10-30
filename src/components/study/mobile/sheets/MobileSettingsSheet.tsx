"use client";

import React, { useState, useEffect } from "react";
import {
  ClockIcon,
  FlameIcon,
  SpeakerHighIcon,
  MinusIcon,
  PlusIcon,
  DeviceMobileIcon,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { MobileSheetShell } from "./MobileSheetShell";
import {
  PomodoroSoundType,
  POMODORO_SOUND_OPTIONS,
  playPomodoroSound,
} from "../../study-sound";
import { useRealtimeClock } from "../../pomodoro/hooks/useRealtimeClock";
import { formatStopwatch } from "../../pomodoro/utils/timer-formatters";
import { BlockedUsersSection } from "../../settings/BlockedUsersSection";
import type { StudySettingsProps } from "../../StudySettingsModal";

/** Demo bấm giờ chạy riêng trong cài đặt để thấy ngay .00 khác gì */
function StopwatchPreview({ showMs }: { showMs: boolean }) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(
      () => setMs(Date.now() - start),
      showMs ? 30 : 200
    );
    return () => window.clearInterval(id);
  }, [showMs]);
  return <span>{formatStopwatch(ms, showMs)}</span>;
}

// Modern Animated iOS-Style Toggle Switch
interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  activeColor?: string;
  disabled?: boolean;
}

const ToggleSwitch = ({
  checked,
  onChange,
  activeColor = "bg-emerald-500",
  disabled = false,
}: ToggleSwitchProps) => {
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

/** Khung nhóm cài đặt chuẩn Mobile Frosted Glass */
function SettingsSection({
  icon,
  title,
  children,
  staggerIdx = 0,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  staggerIdx?: number;
}) {
  return (
    <section
      style={{ "--stagger-idx": staggerIdx } as React.CSSProperties}
      className="space-y-3 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] sheet-stagger-item sheet-lazy-card"
    >
      <h4 className="flex items-center gap-2 text-xs font-bold text-white/70 uppercase tracking-wider pb-0.5">
        {icon}
        <span>{title}</span>
      </h4>
      <div className="space-y-2 pt-0.5">{children}</div>
    </section>
  );
}

/** 1 hàng cài đặt: tên + mô tả bên trái, nút điều khiển bên phải */
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
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      <div className="space-y-0.5 min-w-0 flex-1">
        <div className="font-semibold text-white/90 text-xs">{title}</div>
        {desc && <div className="text-[11px] text-white/50">{desc}</div>}
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

export function MobileSettingsSheet({
  isOpen,
  onClose,
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
  onBack,
  backLabel,
}: StudySettingsProps) {
  const [previewingSoundId, setPreviewingSoundId] = useState<string | null>(null);

  // Đồng hồ xem trước chạy thật
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
    setPreviewingSoundId(type);
    playPomodoroSound(type, true);
    window.setTimeout(() => {
      setPreviewingSoundId((prev) => (prev === type ? null : prev));
    }, 1200);
  };

  return (
    <MobileSheetShell
      isOpen={isOpen}
      onClose={onClose}
      onBack={onBack}
      backLabel={backLabel}
      sheetId="settings"
      title="Cài đặt không gian"
      maxHeightClassName="h-auto max-h-[82dvh]"
    >
      <div className="flex-1 flex flex-col px-4 pt-3.5 pb-6 space-y-4 text-white select-none">
        {/* NHÓM 1: HIỂN THỊ */}
        <SettingsSection
          icon={<ClockIcon className="w-4 h-4 text-emerald-400 shrink-0" weight="bold" />}
          title="Hiển thị"
          staggerIdx={0}
        >
          {/* Xem trước đồng hồ chạy thật */}
          <div
            className="rounded-xl bg-black/40 border border-white/10 py-2.5 px-3 text-center font-mono text-sm font-bold text-white tabular-nums tracking-wider shadow-inner"
            title="Xem trước kiểu giờ đã chọn"
          >
            <div className="text-[10px] font-sans font-medium text-white/50 tracking-normal mb-0.5">
              Đồng hồ
            </div>
            {clockDigits || "-- : --"}
            {clockPeriod ? (
              <span className="text-white/60 text-xs ml-1.5">{clockPeriod}</span>
            ) : null}
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

          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="font-semibold text-white/90 text-xs">Định dạng thời gian</div>
              <div className="text-[11px] text-white/50">24 Giờ hoặc 12 Giờ (AM/PM)</div>
            </div>
            <div className="flex items-center p-0.5 rounded-xl bg-white/10 border border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => isClock12Hour && onToggleClock12Hour()}
                aria-pressed={!isClock12Hour}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  !isClock12Hour
                    ? "bg-white text-black shadow-sm"
                    : "text-white/50 hover:text-white"
                }`}
              >
                24h
              </button>
              <button
                type="button"
                onClick={() => !isClock12Hour && onToggleClock12Hour()}
                aria-pressed={isClock12Hour}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isClock12Hour
                    ? "bg-white text-black shadow-sm"
                    : "text-white/50 hover:text-white"
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

          {/* Demo bấm giờ */}
          <div
            className="rounded-xl bg-black/40 border border-white/10 py-2.5 px-3 text-center font-mono text-sm font-bold text-white tabular-nums tracking-wider shadow-inner"
            title="Demo kiểu bấm giờ đã chọn"
          >
            <div className="text-[10px] font-sans font-medium text-white/50 tracking-normal mb-0.5">
              Bấm giờ (demo)
            </div>
            <StopwatchPreview showMs={showStopwatchMilliseconds} />
          </div>
        </SettingsSection>

        {/* NHÓM 2: PHIÊN HỌC */}
        <SettingsSection
          icon={<FlameIcon className="w-4 h-4 text-emerald-400 shrink-0" weight="bold" />}
          title="Thời lượng phiên học"
          staggerIdx={1}
        >
          {(Object.keys(DURATION_LIMITS) as DurationKey[]).map((key) => (
            <div
              key={key}
              className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
            >
              <span className="text-xs font-semibold text-white/90">
                {DURATION_LABELS[key]}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => stepDuration(key, -DURATION_LIMITS[key].step)}
                  disabled={durations[key] <= DURATION_LIMITS[key].min}
                  aria-label={`Giảm ${DURATION_LABELS[key]}`}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 active:scale-90 text-white font-bold flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <MinusIcon className="w-3.5 h-3.5" weight="bold" />
                </button>
                <span className="w-12 text-center text-sm font-bold font-mono text-white tabular-nums">
                  {durations[key]}′
                </span>
                <button
                  type="button"
                  onClick={() => stepDuration(key, DURATION_LIMITS[key].step)}
                  disabled={durations[key] >= DURATION_LIMITS[key].max}
                  aria-label={`Tăng ${DURATION_LABELS[key]}`}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 active:scale-90 text-white font-bold flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <PlusIcon className="w-3.5 h-3.5" weight="bold" />
                </button>
              </div>
            </div>
          ))}
        </SettingsSection>

        {/* NHÓM 3: CHUÔNG BÁO */}
        <SettingsSection
          icon={<SpeakerHighIcon className="w-4 h-4 text-emerald-400 shrink-0" weight="bold" />}
          title="Chuông báo"
          staggerIdx={2}
        >
          <SettingRow
            title="Chuông báo khi hoàn thành"
            desc="Phát âm thanh khi hết thời gian phiên học"
            control={
              <ToggleSwitch
                checked={soundEnabled}
                onChange={onToggleSound}
                activeColor="bg-emerald-500"
              />
            }
          />

          {soundEnabled && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              {POMODORO_SOUND_OPTIONS.map((opt) => {
                const isSelected = soundType === opt.id;
                const isPreviewing = previewingSoundId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectSound(opt.id)}
                    aria-pressed={isSelected}
                    title="Bấm để chọn và nghe thử"
                    className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 cursor-pointer truncate text-left ${
                      isSelected
                        ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-200 shadow-sm"
                        : "bg-white/[0.02] hover:bg-white/[0.06] border-white/[0.06] text-white/70"
                    }`}
                  >
                    <span className="truncate block">{opt.name}</span>
                    <span
                      className={`block text-[10px] font-medium mt-0.5 ${
                        isPreviewing ? "text-emerald-300 animate-pulse" : "text-white/40"
                      }`}
                    >
                      {isPreviewing ? "♪ đang phát…" : isSelected ? "đang dùng" : "chạm để thử"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </SettingsSection>

        {/* NHÓM 4: MÀN HÌNH */}
        <div
          style={{ "--stagger-idx": 3 } as React.CSSProperties}
          className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] sheet-stagger-item sheet-lazy-card"
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <DeviceMobileIcon className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" weight="bold" />
            <div className="min-w-0">
              <div className="font-semibold text-white/90 text-xs">Giữ màn hình sáng khi học</div>
              <p className="text-[11px] text-white/50 mt-0.5">
                {wakeLockSupported
                  ? "Ngăn màn hình điện thoại tự tắt trong phiên học"
                  : "Thiết bị này không hỗ trợ tính năng giữ sáng"}
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

        {/* Người đã chặn: báo cáo/chặn trong phòng học (P0.5) */}
        <BlockedUsersSection />

      </div>
    </MobileSheetShell>
  );
}
