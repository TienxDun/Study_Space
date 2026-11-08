"use client";

import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { clamp } from "@/lib/utils";
import {
  MEET_PRESETS,
  MEET_REACTIONS,
  type MeetLocalState,
  type ActiveMeetTimer,
  type MeetStatus,
  type MeetPreset,
  formatMeetCountdown,
  nextPhasePreset,
} from "../utils/meet-protocol";
import {
  HandWavingIcon,
  TimerIcon,
  SmileyIcon,
  TargetIcon,
  StopIcon,
  PlayIcon,
  CoffeeIcon,
  BrainIcon,
  CaretDownIcon,
  ArrowsClockwiseIcon,
  CheckIcon,
} from "@phosphor-icons/react";

export interface RoomStudyBarProps {
  local: MeetLocalState;
  timer: ActiveMeetTimer | null;
  remainingSec: number;
  isTimerOwner: boolean;
  handRaisedCount: number;
  compact?: boolean;
  hideHandButton?: boolean;
  onSetStatus: (status: MeetStatus) => void;
  onToggleHand: () => void;
  onEditGoal: () => void;
  onStartTimer: (preset: MeetPreset) => void;
  onStopTimer: () => void;
  onStartNextPhase: () => void;
  onReaction: (emoji: string) => void;
}

interface MenuPosition {
  top: number;
  left: number;
}

/**
 * Thanh công cụ tương tác học tập trong phòng (Phase 2):
 * - Pomodoro đồng bộ (bắt đầu, đếm ngược, chuyển phase, ghi đè timer)
 * - Trạng thái cá nhân (Tập trung, Nghỉ, Cần giúp, Bình thường)
 * - Nút Giơ tay
 * - Mục tiêu học tập cá nhân
 * - Thả reaction nhanh
 * - Các menu dropdown dùng React Portal gắn vào document.body để không bao giờ bị cắt bởi container cuộn ngang.
 */
export function RoomStudyBar({
  local,
  timer,
  remainingSec,
  isTimerOwner,
  handRaisedCount,
  compact = false,
  hideHandButton = false,
  onSetStatus,
  onToggleHand,
  onEditGoal,
  onStartTimer,
  onStopTimer,
  onStartNextPhase,
  onReaction,
}: RoomStudyBarProps) {
  const [mounted, setMounted] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [isStopConfirmOpen, setIsStopConfirmOpen] = useState(false);
  const [pendingPreset, setPendingPreset] = useState<MeetPreset | null>(null);
  const [isCycleConfirmOpen, setIsCycleConfirmOpen] = useState(false);

  const [presetsPos, setPresetsPos] = useState<MenuPosition | null>(null);
  const [statusPos, setStatusPos] = useState<MenuPosition | null>(null);
  const [reactionsPos, setReactionsPos] = useState<MenuPosition | null>(null);

  const presetsBtnRef = useRef<HTMLButtonElement>(null);
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const reactionsBtnRef = useRef<HTMLButtonElement>(null);

  const presetsMenuRef = useRef<HTMLDivElement>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const reactionsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Đóng popover khi click ra ngoài hoặc khi cuộn trang
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      if (
        presetsMenuRef.current &&
        !presetsMenuRef.current.contains(target) &&
        presetsBtnRef.current &&
        !presetsBtnRef.current.contains(target)
      ) {
        setShowPresets(false);
      }

      if (
        statusMenuRef.current &&
        !statusMenuRef.current.contains(target) &&
        statusBtnRef.current &&
        !statusBtnRef.current.contains(target)
      ) {
        setShowStatusMenu(false);
      }

      if (
        reactionsMenuRef.current &&
        !reactionsMenuRef.current.contains(target) &&
        reactionsBtnRef.current &&
        !reactionsBtnRef.current.contains(target)
      ) {
        setShowReactions(false);
      }
    };

    const handleScroll = () => {
      setShowPresets(false);
      setShowStatusMenu(false);
      setShowReactions(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  const nextPhaseInfo = timer ? nextPhasePreset(timer) : null;
  const isTimerExpired = timer !== null && remainingSec <= 0;
  const timerTotalSec = timer?.durationSec || 1;
  const timerElapsedSec = Math.max(0, timerTotalSec - remainingSec);
  const timerProgressPercent = Math.min(100, Math.max(0, (timerElapsedSec / timerTotalSec) * 100));

  // Nhãn trạng thái đầy đủ và nhãn compact ngắn gọn chuẩn tiếng Việt
  const currentStatusLabel =
    local.status === "focus"
      ? "Tập trung"
      : local.status === "break"
      ? "Nghỉ ngơi"
      : local.status === "help"
      ? "Cần giúp"
      : "Bình thường";

  const compactStatusLabel =
    local.status === "focus"
      ? "Học"
      : local.status === "break"
      ? "Nghỉ"
      : local.status === "help"
      ? "Giúp"
      : "Trạng thái";

  const togglePresetsMenu = () => {
    if (!showPresets && presetsBtnRef.current) {
      const rect = presetsBtnRef.current.getBoundingClientRect();
      setPresetsPos({
        top: rect.bottom + 6,
        left: clamp(rect.left, 8, window.innerWidth - 220),
      });
      setShowPresets(true);
      setShowStatusMenu(false);
      setShowReactions(false);
    } else {
      setShowPresets(false);
    }
  };

  const toggleStatusMenu = () => {
    if (!showStatusMenu && statusBtnRef.current) {
      const rect = statusBtnRef.current.getBoundingClientRect();
      setStatusPos({
        top: rect.bottom + 6,
        left: clamp(rect.left, 8, window.innerWidth - 160),
      });
      setShowStatusMenu(true);
      setShowPresets(false);
      setShowReactions(false);
    } else {
      setShowStatusMenu(false);
    }
  };

  const toggleReactionsMenu = () => {
    if (!showReactions && reactionsBtnRef.current) {
      const rect = reactionsBtnRef.current.getBoundingClientRect();
      const REACTION_MENU_WIDTH = 264;
      const margin = 8;
      const calculatedLeft = Math.max(
        margin,
        Math.min(rect.right - REACTION_MENU_WIDTH, window.innerWidth - REACTION_MENU_WIDTH - margin)
      );
      setReactionsPos({
        top: rect.bottom + 6,
        left: calculatedLeft,
      });
      setShowReactions(true);
      setShowPresets(false);
      setShowStatusMenu(false);
    } else {
      setShowReactions(false);
    }
  };

  return (
    <>
      <div
        className={`select-none transition-all ${
        compact
          ? "px-3.5 py-1.5 flex items-center gap-1.5 text-[11px] overflow-x-auto no-scrollbar"
          : "flex items-center gap-1.5 px-3 py-1.5 border-b border-white/10 bg-white/[0.02] text-xs overflow-x-auto custom-study-scroll"
      }`}
    >
      {/* 1. KHU VỰC POMODORO ĐỒNG BỘ: CHIP TIẾN TRÌNH TỐI GIẢN CHỈ HIỆN SỐ PHÚT */}
      <div className="flex items-center gap-1 shrink-0">
        {timer ? (
          <button
            ref={presetsBtnRef}
            type="button"
            onClick={togglePresetsMenu}
            className={`relative flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] hover:bg-white/[0.12] text-white tabular-nums transition-all shrink-0 overflow-hidden cursor-pointer active:scale-95 select-none shadow-sm backdrop-blur-md ${
              compact ? "h-7.5 px-2.5" : "px-3 py-1"
            }`}
            title={`Pomodoro (${timer.phase === "focus" ? "Tập trung" : "Nghỉ ngơi"}): ${formatMeetCountdown(remainingSec)} • Chạm để đổi chu kỳ hoặc dừng`}
            aria-label={`Pomodoro: ${formatMeetCountdown(remainingSec)}`}
          >
            {/* Lớp nền Progress Fill đồng bộ hệ thống */}
            <div
              className={`absolute inset-y-0 left-0 transition-[width] duration-1000 ease-linear pointer-events-none ${
                timer.phase === "focus"
                  ? "bg-emerald-500/20"
                  : "bg-amber-500/20"
              }`}
              style={{ width: `${timerProgressPercent}%` }}
            />

            {/* Chỉ hiển thị số phút đếm ngược và mũi tên mở menu */}
            <span
              className={`relative z-10 font-bold font-mono text-xs tracking-tight ${
                timer.phase === "focus" ? "text-emerald-300" : "text-amber-300"
              }`}
            >
              {formatMeetCountdown(remainingSec)}
            </span>
            <CaretDownIcon
              className={`relative z-10 w-2.5 h-2.5 text-slate-400 transition-transform duration-150 ${
                showPresets ? "rotate-180" : ""
              }`}
            />
          </button>
        ) : (
          <button
            ref={presetsBtnRef}
            type="button"
            onClick={togglePresetsMenu}
            className={`flex items-center gap-1 rounded-xl transition-all cursor-pointer font-medium shrink-0 active:scale-95 shadow-sm backdrop-blur-md ${
              compact
                ? "h-7.5 px-2.5 bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-slate-200 hover:text-white"
                : "px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white"
            }`}
            title="Khởi tạo đồng hồ Pomodoro cho cả phòng"
            aria-label="Khởi tạo Pomodoro"
          >
            <TimerIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" weight="bold" />
            <span>{compact ? "Pomo" : "Pomodoro"}</span>
            <CaretDownIcon className="w-2.5 h-2.5 text-slate-400" />
          </button>
        )}
      </div>

      {!compact && <div className="h-4 w-px bg-white/10 shrink-0" />}

      {/* 2. TRẠNG THÁI CÁ NHÂN */}
      <div className="shrink-0">
        <button
          ref={statusBtnRef}
          type="button"
          onClick={toggleStatusMenu}
          className={`flex items-center gap-1 rounded-xl border transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm backdrop-blur-md ${
            compact ? "h-7.5 px-2.5" : "px-2 py-1"
          } ${
            local.status === "focus"
              ? "bg-emerald-500/20 border-emerald-400/35 text-emerald-300 font-semibold shadow-[0_0_10px_rgba(16,185,129,0.15)]"
              : local.status === "break"
              ? "bg-amber-500/20 border-amber-400/35 text-amber-300 font-semibold shadow-[0_0_10px_rgba(245,158,11,0.15)]"
              : local.status === "help"
              ? "bg-rose-500/20 border-rose-400/35 text-rose-300 font-semibold shadow-[0_0_10px_rgba(244,63,94,0.15)]"
              : compact
              ? "bg-white/[0.06] hover:bg-white/[0.12] border-white/10 text-slate-300 hover:text-white"
              : "bg-white/5 border-white/10 text-slate-300 hover:text-white"
          }`}
          title="Chọn trạng thái học tập của bạn"
          aria-label={`Trạng thái: ${currentStatusLabel}`}
        >
          <span>{compact ? compactStatusLabel : currentStatusLabel}</span>
          <CaretDownIcon className="w-2.5 h-2.5 text-slate-400" />
        </button>
      </div>

      {/* 3. NÚT GIƠ TAY */}
      {!hideHandButton && (
        <>
          <button
            type="button"
            onClick={onToggleHand}
            className={`flex items-center gap-1 rounded-xl border transition-all cursor-pointer shrink-0 active:scale-95 ${
              compact ? "h-7.5 px-2" : "px-2 py-1"
            } ${
              local.handRaised
                ? "bg-amber-500/25 border-amber-400/40 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
                : compact
                ? "bg-white/[0.06] hover:bg-white/[0.12] border-white/10 text-slate-300 hover:text-white"
                : "bg-white/5 border-white/10 text-slate-300 hover:text-white"
            }`}
            title={local.handRaised ? "Hạ tay xuống" : "Giơ tay phát biểu"}
            aria-label={local.handRaised ? "Hạ tay" : "Giơ tay"}
          >
            <HandWavingIcon
              className={`w-3.5 h-3.5 ${local.handRaised ? "text-amber-300 animate-bounce" : "text-slate-400"}`}
              weight={local.handRaised ? "fill" : "bold"}
            />
            <span>{compact ? "" : "Giơ tay"}</span>
            {handRaisedCount > 0 && (
              <span className="ml-0.5 px-1 rounded-full bg-amber-400/20 text-amber-300 font-bold text-[10px]">
                {handRaisedCount}
              </span>
            )}
          </button>
          {!compact && <div className="h-4 w-px bg-white/10 shrink-0" />}
        </>
      )}

      {/* 4. MỤC TIÊU CÁ NHÂN */}
      <button
        type="button"
        onClick={onEditGoal}
        className={`flex items-center gap-1.5 rounded-xl border transition-all cursor-pointer shrink-0 active:scale-95 ${
          compact ? "h-7.5 px-2.5" : "px-2.5 py-1 min-w-0 max-w-[180px] sm:max-w-[240px]"
        } ${
          local.goal
            ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.12)]"
            : compact
            ? "bg-white/[0.06] hover:bg-white/[0.12] border-white/10 text-slate-300 hover:text-white"
            : "bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white"
        }`}
        title={local.goal ? `Mục tiêu của bạn: ${local.goal}` : "Đặt mục tiêu học tập cho phiên này"}
        aria-label="Mục tiêu học tập"
      >
        <TargetIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" weight="bold" />
        <span className={`truncate font-medium ${compact ? "text-[11px] max-w-[85px] xs:max-w-[120px]" : "text-[11px]"}`}>
          {local.goal || (compact ? "Mục tiêu" : "Đặt mục tiêu")}
        </span>
      </button>

      {/* 5. THẢ REACTION NHANH */}
      <div className="shrink-0 ml-auto">
        <button
          ref={reactionsBtnRef}
          type="button"
          onClick={toggleReactionsMenu}
          className={`flex items-center justify-center rounded-xl border border-white/10 transition-all cursor-pointer active:scale-95 shadow-sm backdrop-blur-md ${
            compact
              ? "h-7.5 w-7.5 bg-white/[0.06] hover:bg-white/[0.12] text-yellow-400"
              : "px-2 py-1 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
          }`}
          title="Thả cảm xúc biểu tượng"
          aria-label="Thả cảm xúc"
        >
          <SmileyIcon className="w-3.5 h-3.5 text-yellow-400 shrink-0" weight="bold" />
          {!compact && <span>Cảm xúc</span>}
        </button>
      </div>
      </div>

      {/* PORTALS: Các menu dropdown nổi thoát khỏi scroll container, không bao giờ bị cắt */}
      {showPresets && mounted && presetsPos && typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[95] bg-black/20"
              onClick={() => setShowPresets(false)}
            />
            <div
              ref={presetsMenuRef}
              style={{ top: `${presetsPos.top}px`, left: `${presetsPos.left}px` }}
              className="fixed z-[100] w-52 p-1.5 rounded-2xl border border-white/15 bg-neutral-950/88 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.75),inset_0_1px_1.5px_rgba(255,255,255,0.18)] transition-all duration-150 select-none overflow-hidden"
            >
              <div className="absolute inset-x-4 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

              {/* Trạng thái & hành động nhanh khi timer đang chạy */}
              {timer ? (
                <>
                  <div className="px-3 py-1.5 flex items-center justify-between border-b border-white/[0.08] mb-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      {timer.phase === "focus" ? "Đang tập trung" : "Đang nghỉ ngơi"}
                    </span>
                    <span className={`text-[11px] font-mono font-bold ${timer.phase === "focus" ? "text-emerald-300" : "text-amber-300"}`}>
                      {formatMeetCountdown(remainingSec)}
                    </span>
                  </div>

                  {isTimerOwner && (
                    <>
                      {!isTimerExpired ? (
                        <button
                          type="button"
                          onClick={() => {
                            setShowPresets(false);
                            setIsStopConfirmOpen(true);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs text-rose-300 hover:bg-rose-500/15 transition-colors flex items-center gap-2 cursor-pointer"
                        >
                          <StopIcon className="w-3.5 h-3.5 text-rose-400 shrink-0" weight="bold" />
                          <span>Dừng Pomodoro</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setShowPresets(false);
                            onStartNextPhase();
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-950 font-bold bg-emerald-400 hover:bg-emerald-300 transition-colors flex items-center gap-2 cursor-pointer shadow-sm shadow-emerald-500/25"
                        >
                          <PlayIcon className="w-3.5 h-3.5 shrink-0" weight="bold" />
                          <span>{nextPhaseInfo?.phase === "focus" ? "Bắt đầu học tiếp" : "Bắt đầu nghỉ ngơi"}</span>
                        </button>
                      )}
                      <div className="my-1 border-t border-white/[0.08]" />
                    </>
                  )}

                  <div className="px-3 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">
                    Đổi chu kỳ khác
                  </div>
                </>
              ) : (
                <div className="px-3 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-white/[0.08] mb-1">
                  Chọn chu kỳ Pomodoro
                </div>
              )}

              {MEET_PRESETS.map((preset) => {
                const isCurrentActive =
                  Boolean(timer) &&
                  ((timer?.phase === "focus" && timer?.durationSec === preset.focus * 60) ||
                    (timer?.phase === "break" && timer?.durationSec === preset.break * 60));
                return (
                  <button
                    key={`${preset.focus}-${preset.break}`}
                    type="button"
                    onClick={() => {
                      setShowPresets(false);
                      if (timer) {
                        setPendingPreset(preset);
                        setIsCycleConfirmOpen(true);
                      } else {
                        onStartTimer(preset);
                      }
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-between cursor-pointer ${
                      isCurrentActive
                        ? "bg-emerald-500/15 text-emerald-300 font-semibold"
                        : "text-zinc-200 hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    <span>{preset.focus}p học / {preset.break}p nghỉ</span>
                    {isCurrentActive && (
                      <CheckIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" weight="bold" />
                    )}
                  </button>
                );
              })}
            </div>
          </>,
          document.body
        )}

      {showStatusMenu && mounted && statusPos && typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[95] bg-black/20"
              onClick={() => setShowStatusMenu(false)}
            />
            <div
              ref={statusMenuRef}
              style={{ top: `${statusPos.top}px`, left: `${statusPos.left}px` }}
              className="fixed z-[100] w-44 p-1.5 rounded-2xl border border-white/15 bg-neutral-950/88 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.75),inset_0_1px_1.5px_rgba(255,255,255,0.18)] transition-all duration-150 select-none overflow-hidden"
            >
              <div className="absolute inset-x-4 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />
              <button
                type="button"
                onClick={() => {
                  onSetStatus("focus");
                  setShowStatusMenu(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-between cursor-pointer ${
                  local.status === "focus"
                    ? "bg-emerald-500/15 text-emerald-300 font-semibold"
                    : "text-emerald-300 hover:bg-white/[0.08]"
                }`}
              >
                <span className="truncate">Tập trung</span>
                {local.status === "focus" && (
                  <CheckIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" weight="bold" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  onSetStatus("break");
                  setShowStatusMenu(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-between cursor-pointer ${
                  local.status === "break"
                    ? "bg-amber-500/15 text-amber-300 font-semibold"
                    : "text-amber-300 hover:bg-white/[0.08]"
                }`}
              >
                <span className="truncate">Nghỉ ngơi</span>
                {local.status === "break" && (
                  <CheckIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" weight="bold" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  onSetStatus("help");
                  setShowStatusMenu(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-between cursor-pointer ${
                  local.status === "help"
                    ? "bg-rose-500/15 text-rose-300 font-semibold"
                    : "text-rose-300 hover:bg-white/[0.08]"
                }`}
              >
                <span className="truncate">Cần giúp</span>
                {local.status === "help" && (
                  <CheckIcon className="w-3.5 h-3.5 text-rose-400 shrink-0" weight="bold" />
                )}
              </button>
              <div className="my-1 border-t border-white/[0.08]" />
              <button
                type="button"
                onClick={() => {
                  onSetStatus("");
                  setShowStatusMenu(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-between cursor-pointer ${
                  !local.status
                    ? "bg-white/[0.1] text-white font-semibold"
                    : "text-zinc-300 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                <span className="truncate">Bình thường</span>
                {!local.status && (
                  <CheckIcon className="w-3.5 h-3.5 text-white/80 shrink-0" weight="bold" />
                )}
              </button>
            </div>
          </>,
          document.body
        )}

      {showReactions && mounted && reactionsPos && typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[95] bg-black/20"
              onClick={() => setShowReactions(false)}
            />
            <div
              ref={reactionsMenuRef}
              style={{ top: `${reactionsPos.top}px`, left: `${reactionsPos.left}px` }}
              className="fixed z-[100] p-1.5 rounded-2xl border border-white/15 bg-neutral-950/88 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.75),inset_0_1px_1.5px_rgba(255,255,255,0.18)] flex items-center gap-1 transition-all duration-150 select-none overflow-hidden"
            >
              <div className="absolute inset-x-4 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />
              {MEET_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onReaction(emoji);
                    setShowReactions(false);
                  }}
                  className="w-9 h-9 rounded-xl hover:bg-white/[0.1] active:scale-125 transition-transform flex items-center justify-center text-xl cursor-pointer"
                  title={`Thả ${emoji}`}
                  aria-label={`Thả ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}

      <ConfirmDeleteModal
        isOpen={isStopConfirmOpen}
        onClose={() => setIsStopConfirmOpen(false)}
        onConfirm={onStopTimer}
        title="Xác nhận dừng đồng hồ"
        description="Bạn có chắc muốn dừng đồng hồ Pomodoro cho cả phòng?"
        confirmText="Dừng"
        cancelText="Hủy"
      />

      <ConfirmDeleteModal
        isOpen={isCycleConfirmOpen}
        onClose={() => {
          setIsCycleConfirmOpen(false);
          setPendingPreset(null);
        }}
        onConfirm={() => {
          if (pendingPreset) onStartTimer(pendingPreset);
        }}
        title="Bắt đầu chu kỳ mới?"
        description={
          pendingPreset
            ? `Bắt đầu ${pendingPreset.focus}p học / ${pendingPreset.break}p nghỉ và ghi đè timer hiện tại?`
            : "Bắt đầu chu kỳ Pomodoro mới?"
        }
        confirmText="Bắt đầu"
        cancelText="Hủy"
      />
    </>
  );
}
