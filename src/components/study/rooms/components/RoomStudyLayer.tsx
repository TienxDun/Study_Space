"use client";

import { useState, useEffect } from "react";
import { useMeetStudyState } from "../hooks/useMeetStudyState";
import { RoomStudyBar } from "./RoomStudyBar";
import { RoomReactionsOverlay } from "./RoomReactionsOverlay";
import { ModalShell } from "@/components/ui/ModalShell";
import type { PomodoroSoundType } from "@/components/study/study-sound";
import { TargetIcon, XIcon, CheckIcon, TrashIcon } from "@phosphor-icons/react";

interface RoomStudyLayerProps {
  compact?: boolean;
  soundEnabled?: boolean;
  soundType?: PomodoroSoundType;
}

/**
 * Tầng tương tác học tập tích hợp cho phòng học nhóm ZenStudy (Phase 2):
 * - Kết nối logic qua useMeetStudyState
 * - Thanh công cụ RoomStudyBar (Pomodoro, trạng thái, giơ tay, mục tiêu, reaction)
 * - Hiệu ứng reaction bay lên RoomReactionsOverlay
 * - Modal thiết lập mục tiêu học tập cá nhân (tối đa 120 ký tự)
 */
export function RoomStudyLayer({
  compact = false,
  soundEnabled,
  soundType,
}: RoomStudyLayerProps) {
  const {
    local,
    timer,
    remainingSec,
    isTimerOwner,
    handRaisedCount,
    reactions,
    setStatus,
    toggleHand,
    setGoal,
    startTimer,
    stopTimer,
    startNextPhase,
    sendReaction,
  } = useMeetStudyState({ soundEnabled, soundType });

  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");

  // Đồng bộ draft khi mở modal
  useEffect(() => {
    if (isGoalModalOpen) {
      setGoalDraft(local.goal || "");
    }
  }, [isGoalModalOpen, local.goal]);

  const handleSaveGoal = () => {
    setGoal(goalDraft);
    setIsGoalModalOpen(false);
  };

  const handleClearGoal = () => {
    setGoal("");
    setIsGoalModalOpen(false);
  };

  return (
    <>
      {/* 1. Thanh công cụ học tập */}
      <RoomStudyBar
        local={local}
        timer={timer}
        remainingSec={remainingSec}
        isTimerOwner={isTimerOwner}
        handRaisedCount={handRaisedCount}
        compact={compact}
        onSetStatus={setStatus}
        onToggleHand={toggleHand}
        onEditGoal={() => setIsGoalModalOpen(true)}
        onStartTimer={startTimer}
        onStopTimer={stopTimer}
        onStartNextPhase={startNextPhase}
        onReaction={sendReaction}
      />

      {/* 2. Hiệu ứng reaction bay lên từ khu vực video */}
      <RoomReactionsOverlay reactions={reactions} />

      {/* 3. Modal chỉnh sửa mục tiêu học tập cá nhân */}
      <ModalShell
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        ariaLabel="Thiết lập mục tiêu học tập cá nhân"
        backdropClassName="z-[95] bg-black/40 backdrop-blur-sm"
        panelClassName="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md p-0 rounded-3xl bg-neutral-950/96 border border-white/20 shadow-[0_24px_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl text-white z-[100] select-none overflow-hidden"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/50 to-transparent pointer-events-none z-10" />

        <div className="relative px-5 pt-5 pb-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-500/15 text-teal-300 border border-teal-500/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                <TargetIcon className="w-5 h-5" weight="fill" />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-white">Mục tiêu học tập</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Hiển thị cho cả phòng cùng thấy</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsGoalModalOpen(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/10 text-slate-300 hover:text-white transition-colors"
              title="Đóng"
              aria-label="Đóng"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-slate-300 leading-relaxed">
            Đặt mục tiêu ngắn gọn cho phiên học này (tối đa 120 ký tự). Mục tiêu hiển thị trực tiếp trên khung hình của bạn để các bạn cùng phòng cùng thấy và cùng cố gắng.
          </p>

          <div className="relative">
            <textarea
              value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value.slice(0, 120))}
              placeholder="VD: Làm 5 bài tập Giải tích chương 2, không mở mạng xã hội..."
              rows={3}
              maxLength={120}
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-400/60 focus:ring-2 focus:ring-teal-400/20 resize-none transition-colors"
            />
            <div className="text-right text-[10px] text-slate-400 pr-1 tabular-nums mt-1">
              {goalDraft.length}/120
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-white/10 bg-white/[0.02]">
          <div>
            {local.goal && (
              <button
                type="button"
                onClick={handleClearGoal}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold border border-rose-400/20 transition-all cursor-pointer"
              >
                <TrashIcon className="w-3.5 h-3.5" />
                <span>Xóa mục tiêu</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsGoalModalOpen(false)}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/10 transition-all cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSaveGoal}
              className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <CheckIcon className="w-3.5 h-3.5" weight="bold" />
              <span>Lưu mục tiêu</span>
            </button>
          </div>
        </div>
      </ModalShell>
    </>
  );
}
