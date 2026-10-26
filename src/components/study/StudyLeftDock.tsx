"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TimerIcon,
  CheckSquareIcon,
  FileTextIcon,
  ImageIcon,
  RadioIcon,
  UsersIcon,
} from "@phosphor-icons/react";

export interface StudyLeftDockProps {
  isZenMode: boolean;
  isPomodoroVisible: boolean;
  isTasksOpen: boolean;
  isNotesOpen: boolean;
  isScenesOpen: boolean;
  isEmbedPlayerOpen: boolean;
  isExternalStreamActive: boolean;
  isRoomsOpen: boolean;
  roomsEnabled: boolean;
  onTogglePomodoro: () => void;
  onToggleTasks: () => void;
  onToggleNotes: () => void;
  onToggleScenes: () => void;
  onToggleEmbed: () => void;
  onToggleRooms: () => void;
}

interface DockItemConfig {
  id: string;
  title: string;
  shortcut: string;
  isActive: boolean;
  onClick: () => void;
  icon: (isActive: boolean) => React.ReactNode;
  disabled?: boolean;
}

/** Dock công cụ cạnh trái phong cách macOS Spring Magnification & Spatial Glass */
export const StudyLeftDock = ({
  isZenMode,
  isPomodoroVisible,
  isTasksOpen,
  isNotesOpen,
  isScenesOpen,
  isEmbedPlayerOpen,
  isExternalStreamActive,
  isRoomsOpen,
  roomsEnabled,
  onTogglePomodoro,
  onToggleTasks,
  onToggleNotes,
  onToggleScenes,
  onToggleEmbed,
  onToggleRooms,
}: StudyLeftDockProps) => {
  const dockItems: DockItemConfig[] = [
    {
      id: "pomodoro",
      title: "Pomodoro & Hẹn giờ",
      shortcut: "T",
      isActive: isPomodoroVisible,
      onClick: onTogglePomodoro,
      icon: (active) => (
        <TimerIcon
          className={`w-5 h-5 transition-all ${
            active
              ? "text-accent-music-glow drop-shadow-[0_0_8px_rgba(52,211,153,0.9)]"
              : "text-slate-200 group-hover:text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
          }`}
        />
      ),
    },
    {
      id: "tasks",
      title: "Kế hoạch học tập",
      shortcut: "K",
      isActive: isTasksOpen,
      onClick: onToggleTasks,
      icon: (active) => (
        <CheckSquareIcon
          className={`w-5 h-5 transition-all ${
            active
              ? "text-accent-music-glow drop-shadow-[0_0_8px_rgba(52,211,153,0.9)]"
              : "text-slate-200 group-hover:text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
          }`}
        />
      ),
    },
    {
      id: "notes",
      title: "Ghi chép nhanh",
      shortcut: "N",
      isActive: isNotesOpen,
      onClick: onToggleNotes,
      icon: (active) => (
        <FileTextIcon
          className={`w-5 h-5 transition-all ${
            active
              ? "text-accent-music-glow drop-shadow-[0_0_8px_rgba(52,211,153,0.9)]"
              : "text-slate-200 group-hover:text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
          }`}
        />
      ),
    },
    {
      id: "scenes",
      title: "Đổi không gian bối cảnh",
      shortcut: "B",
      isActive: isScenesOpen,
      onClick: onToggleScenes,
      icon: (active) => (
        <ImageIcon
          className={`w-5 h-5 transition-all ${
            active
              ? "text-accent-scene-glow drop-shadow-[0_0_8px_rgba(56,189,248,0.9)]"
              : "text-slate-200 group-hover:text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
          }`}
        />
      ),
    },
    {
      id: "embed",
      title: "Đài phát YouTube & Spotify",
      shortcut: "E",
      isActive: isEmbedPlayerOpen || isExternalStreamActive,
      onClick: onToggleEmbed,
      icon: (active) => (
        <div className="relative flex items-center justify-center">
          <RadioIcon
            className={`w-5 h-5 transition-all ${
              active
                ? "text-accent-stream-glow drop-shadow-[0_0_8px_rgba(244,63,94,0.9)]"
                : "text-slate-200 group-hover:text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
            }`}
          />
        </div>
      ),
    },
    {
      id: "rooms",
      title: "Phòng học nhóm",
      shortcut: "G",
      isActive: isRoomsOpen,
      onClick: onToggleRooms,
      disabled: !roomsEnabled,
      icon: (active) => (
        <UsersIcon
          className={`w-5 h-5 transition-all ${
            active
              ? "text-accent-music-glow drop-shadow-[0_0_8px_rgba(52,211,153,0.9)]"
              : "text-slate-200 group-hover:text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
          }`}
        />
      ),
    },
  ];

  return (
    <AnimatePresence>
      {!isZenMode && (
        <motion.nav
          aria-label="Thanh công cụ nhanh Study Space"
          key="study-left-dock-bar"
          initial={{ opacity: 0, x: -28, y: "-50%" }}
          animate={{ opacity: 1, x: 0, y: "-50%" }}
          exit={{ opacity: 0, x: -28, y: "-50%" }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="absolute left-3 sm:left-4 top-1/2 z-40 flex flex-col gap-1 select-none will-change-transform drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]"
        >
          {dockItems.map((item) => (
            <button
              key={item.id}
              id={`tour-dock-${item.id}`}
              onClick={item.onClick}
              disabled={item.disabled}
              aria-label={item.disabled ? `${item.title} (Tạm tắt)` : `${item.title} (${item.shortcut})`}
              title={item.disabled ? `${item.title} (Tạm tắt)` : `${item.title} (${item.shortcut})`}
              className={`relative w-11 h-11 rounded-2xl flex items-center justify-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-music-glow/50 transition-transform ${
                item.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer active:scale-95"
              }`}
            >
              {/* Sliding Active Pill Background (Không viền, hiệu ứng kính phát sáng tinh tế) */}
              {item.isActive && (
                <motion.div
                  layoutId="dockActivePill"
                  transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  className="absolute inset-0 rounded-2xl bg-white/15 backdrop-blur-md shadow-[0_0_16px_rgba(52,211,153,0.25)]"
                />
              )}

              {/* Hover Glow Pill */}
              <div className="absolute inset-0 rounded-2xl group-hover:glass-hover transition-all duration-150" />

              {/* Icon with Hover Scale effect */}
              <div className="relative z-10 flex items-center justify-center pointer-events-none transition-transform duration-200 ease-out group-hover:scale-110">
                {item.icon(item.isActive)}
              </div>

              {/* Active Dot Marker on the Left Rim */}
              {item.isActive && (
                <motion.span
                  layoutId="dockActiveDot"
                  transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  className="absolute -left-1 w-1 h-3 rounded-full bg-accent-music-glow shadow-[0_0_8px_rgba(52,211,153,1)]"
                />
              )}

              {/* Spatial Glass Flyout Tooltip */}
              <div className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-black/85 backdrop-blur-xl text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none shadow-[0_10px_30px_rgba(0,0,0,0.6)] border border-white/15 flex items-center gap-2 z-50">
                <span className="font-medium text-slate-200">{item.title}</span>
                {item.disabled ? (
                  <span className="px-1.5 py-0.5 rounded bg-amber-400/15 text-[10px] font-semibold text-amber-200 border border-amber-300/25">
                    Tạm tắt
                  </span>
                ) : (
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-slate-300 font-semibold border border-line/10">
                    {item.shortcut}
                  </kbd>
                )}
              </div>
            </button>
          ))}
        </motion.nav>
      )}
    </AnimatePresence>
  );
};
