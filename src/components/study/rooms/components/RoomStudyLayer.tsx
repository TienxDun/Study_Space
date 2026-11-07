"use client";

import { useState, useEffect } from "react";
import { useMeetStudyState, type UseMeetStudyStateReturn } from "../hooks/useMeetStudyState";
import { RoomStudyBar } from "./RoomStudyBar";
import { RoomReactionsOverlay } from "./RoomReactionsOverlay";
import { ModalShell } from "@/components/ui/ModalShell";
import type { PomodoroSoundType } from "@/components/study/study-sound";
import { TargetIcon, XIcon, CheckIcon, TrashIcon } from "@phosphor-icons/react";

export interface RoomStudyLayerProps {
  compact?: boolean;
  soundEnabled?: boolean;
  soundType?: PomodoroSoundType;
  studyState?: UseMeetStudyStateReturn;
  hideHandButton?: boolean;
}

/**
 * Tầng tương tác học tập tích hợp cho phòng học nhóm ZenStudy (Phase 2):
 * - Kết nối logic qua useMeetStudyState
 * - Thanh công cụ RoomStudyBar (Pomodoro, trạng thái, giơ tay, mục tiêu, reaction)
 * - Hiệu ứng reaction bay lên RoomReactionsOverlay
 * - Modal thiết lập mục tiêu học tập cá nhân (tối đa 120 ký tự)
 */
export function RoomStudyLayer(props: RoomStudyLayerProps) {
  if (props.studyState) {
    return <RoomStudyLayerContent {...props} state={props.studyState} />;
  }
  return <RoomStudyLayerWithState {...props} />;
}

function RoomStudyLayerWithState(props: RoomStudyLayerProps) {
  const state = useMeetStudyState({
    soundEnabled: props.soundEnabled,
    soundType: props.soundType,
  });
  return <RoomStudyLayerContent {...props} state={state} />;
}

function RoomStudyLayerContent({
  compact = false,
  hideHandButton = false,
  state,
}: RoomStudyLayerProps & { state: UseMeetStudyStateReturn }) {
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
  } = state;

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
        hideHandButton={hideHandButton}
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
        backdropClassName="z-[95] bg-black/60 backdrop-blur-md"
        panelClassName="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-sm p-0 rounded-2xl border border-white/15 bg-neutral-950/88 text-white z-[100] select-none overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.75),inset_0_1px_1.5px_rgba(255,255,255,0.18)]"
      >
        <div className="absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none z-10" />

        <div className="relative px-5 pt-4 pb-3 border-b border-white/[0.08]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                <TargetIcon className="w-4 h-4" weight="fill" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">Mục tiêu học tập</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">Hiển thị trên khung hình của bạn trong phòng</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsGoalModalOpen(false)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Đóng"
              aria-label="Đóng"
            >
              <XIcon className="w-3.5 h-3.5" weight="bold" />
            </button>
          </div>
        </div>

        <div className="p-4.5">
          <div className="relative">
            <textarea
              value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value.slice(0, 120))}
              placeholder="VD: Hoàn thành 5 bài tập, đọc xong chương 3..."
              rows={3}
              maxLength={120}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/12 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 resize-none transition-all"
            />
            <div className="text-right text-[10px] text-zinc-400 pr-1 tabular-nums mt-1">
              {goalDraft.length}/120
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-4.5 py-3 border-t border-white/[0.08]">
          {local.goal ? (
            <button
              type="button"
              onClick={handleClearGoal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-rose-300 hover:text-rose-200 hover:bg-rose-500/10 border border-rose-400/20 transition-colors cursor-pointer"
            >
              <TrashIcon className="w-3.5 h-3.5" />
              <span>Xóa</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsGoalModalOpen(false)}
              className="h-8 px-3.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSaveGoal}
              className="flex items-center gap-1.5 h-8 px-4 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 transition-all shadow-sm shadow-emerald-500/25 cursor-pointer"
            >
              <CheckIcon className="w-3.5 h-3.5" weight="bold" />
              <span>Lưu</span>
            </button>
          </div>
        </div>
      </ModalShell>
    </>
  );
}
