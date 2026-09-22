"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Timer,
  CheckSquare,
  FileText,
  Image as ImageIcon,
  Radio,
} from "lucide-react";
import { IconBtn } from "../ui/IconBtn";

export interface StudyLeftDockProps {
  isZenMode: boolean;
  isPomodoroVisible: boolean;
  isTasksOpen: boolean;
  isNotesOpen: boolean;
  isScenesOpen: boolean;
  isEmbedPlayerOpen: boolean;
  isExternalStreamActive: boolean;
  onTogglePomodoro: () => void;
  onToggleTasks: () => void;
  onToggleNotes: () => void;
  onToggleScenes: () => void;
  onToggleEmbed: () => void;
}

/** Dock công cụ bên trái (Pomodoro / Tasks / Notes / Scenes / Đài). */
export const StudyLeftDock = ({
  isZenMode,
  isPomodoroVisible,
  isTasksOpen,
  isNotesOpen,
  isScenesOpen,
  isEmbedPlayerOpen,
  isExternalStreamActive,
  onTogglePomodoro,
  onToggleTasks,
  onToggleNotes,
  onToggleScenes,
  onToggleEmbed,
}: StudyLeftDockProps) => (
  <AnimatePresence>
    {!isZenMode && (
      <motion.div
        key="study-left-dock-bar"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2.5 p-2 rounded-3xl bg-slate-900/75 backdrop-blur-2xl border border-white/15 shadow-2xl"
      >
        {/* Pomodoro Focus Timer Toggle */}
        <IconBtn
          onClick={onTogglePomodoro}
          title="Đồng hồ Pomodoro (T)"
          tooltip="Pomodoro (T)"
          icon={<Timer className="w-5 h-5 text-rose-400 group-hover:scale-110 transition-transform" />}
          className={`p-2.5 rounded-2xl ${
            isPomodoroVisible ? "bg-rose-500/25 text-rose-300 border border-rose-400/40 shadow-sm" : "text-slate-400 hover:text-white hover:bg-white/10"
          }`}
        />

        {/* Tasks Widget Trigger */}
        <IconBtn
          onClick={onToggleTasks}
          title="Kế hoạch học tập (K)"
          tooltip="Nhiệm vụ (K)"
          icon={<CheckSquare className="w-5 h-5" />}
          className={`p-2.5 rounded-2xl ${
            isTasksOpen ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40" : "text-slate-300 hover:text-white hover:bg-white/10"
          }`}
        />

        {/* Quick Notes Widget Trigger */}
        <IconBtn
          onClick={onToggleNotes}
          title="Ghi chép nhanh (N)"
          tooltip="Ghi chú (N)"
          icon={<FileText className="w-5 h-5" />}
          className={`p-2.5 rounded-2xl ${
            isNotesOpen ? "bg-amber-500/20 text-amber-300 border border-amber-400/40" : "text-slate-300 hover:text-white hover:bg-white/10"
          }`}
        />

        {/* Scenes Selector Widget Trigger */}
        <IconBtn
          onClick={onToggleScenes}
          title="Thay đổi hình nền & không gian (B)"
          tooltip="Không gian (B)"
          icon={<ImageIcon className="w-5 h-5" />}
          className={`p-2.5 rounded-2xl ${
            isScenesOpen ? "bg-sky-500/20 text-sky-300 border border-sky-400/40" : "text-slate-300 hover:text-white hover:bg-white/10"
          }`}
        />

        {/* External Stream / Embed Player Trigger */}
        <IconBtn
          onClick={onToggleEmbed}
          title="Đài phát ngoài (YouTube & Spotify) (E)"
          tooltip="Đài phát (E)"
          icon={
            <>
              <Radio className="w-5 h-5 text-purple-300" />
              {isExternalStreamActive && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </>
          }
          className={`p-2.5 rounded-2xl ${
            isEmbedPlayerOpen || isExternalStreamActive
              ? "bg-purple-500/20 text-purple-300 border border-purple-400/40 shadow-sm"
              : "text-slate-300 hover:text-white hover:bg-white/10"
          }`}
        />
      </motion.div>
    )}
  </AnimatePresence>
);
