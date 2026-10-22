"use client";

import { useState, useEffect } from "react";
import { useMeetStudyState } from "./useMeetStudyState";
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
        panelClassName="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md p-5 rounded-2xl bg-slate-900 border border-white/15 shadow-2xl backdrop-blur-2xl text-white z-[100] select-none"
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <TargetIcon className="w-4 h-4 text-teal-400" weight="bold" />
            <h3 className="text-sm font-bold text-white">Mục tiêu học tập của bạn</h3>
          </div>
          <button
            type="button"
            onClick={() => setIsGoalModalOpen(false)}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Đóng"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 space-y-2">
          <p className="text-xs text-slate-300">
            Đặt mục tiêu ngắn gọn cho phiên học này (tối đa 120 ký tự). Mục tiêu hiển thị trực tiếp trên khung hình của bạn để các bạn cùng phòng cùng thấy và cùng cố gắng.
          </p>

          <div className="relative">
            <textarea
              value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value.slice(0, 120))}
              placeholder="VD: Làm 5 bài tập Giải tích chương 2, không mở mạng xã hội..."
              rows={3}
              maxLength={120}
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-400/50 resize-none transition-colors"
            />
            <div className="text-right text-[10px] text-slate-400 pr-1 tabular-nums">
              {goalDraft.length}/120
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <div>
            {local.goal && (
              <button
                type="button"
                onClick={handleClearGoal}
                className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold border border-rose-400/20 transition-all cursor-pointer flex items-center gap-1.5"
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
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/10 transition-all cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSaveGoal}
              className="px-4 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
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
