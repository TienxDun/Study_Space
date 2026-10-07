"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Timer,
  CheckSquare,
  FileText,
  Image as ImageIcon,
  Radio,
} from "lucide-react";

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

interface DockItemConfig {
  id: string;
  title: string;
  shortcut: string;
  isActive: boolean;
  onClick: () => void;
  icon: (isActive: boolean) => React.ReactNode;
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
  onTogglePomodoro,
  onToggleTasks,
  onToggleNotes,
  onToggleScenes,
  onToggleEmbed,
}: StudyLeftDockProps) => {
  const dockItems: DockItemConfig[] = [
    {
      id: "pomodoro",
      title: "Pomodoro & Hẹn giờ",
      shortcut: "T",
      isActive: isPomodoroVisible,
      onClick: onTogglePomodoro,
      icon: (active) => (
        <Timer className={`w-5 h-5 ${active ? "text-accent-music-glow" : "text-slate-300"}`} />
      ),
    },
    {
      id: "tasks",
      title: "Kế hoạch học tập",
      shortcut: "K",
      isActive: isTasksOpen,
      onClick: onToggleTasks,
      icon: (active) => (
        <CheckSquare className={`w-5 h-5 ${active ? "text-accent-music-glow" : "text-slate-300"}`} />
      ),
    },
    {
      id: "notes",
      title: "Ghi chép nhanh",
      shortcut: "N",
      isActive: isNotesOpen,
      onClick: onToggleNotes,
      icon: (active) => (
        <FileText className={`w-5 h-5 ${active ? "text-accent-music-glow" : "text-slate-300"}`} />
      ),
    },
    {
      id: "scenes",
      title: "Đổi không gian bối cảnh",
      shortcut: "B",
      isActive: isScenesOpen,
      onClick: onToggleScenes,
      icon: (active) => (
        <ImageIcon className={`w-5 h-5 ${active ? "text-accent-scene-glow" : "text-slate-300"}`} />
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
          <Radio className={`w-5 h-5 ${active ? "text-accent-stream-glow" : "text-slate-300"}`} />
        </div>
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
          className="absolute left-4 top-1/2 z-40 flex flex-col gap-1.5 p-1.5 rounded-3xl bg-panel/80 hover:bg-panel/90 backdrop-blur-2xl border border-line/15 shadow-[0_16px_48px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.12)] select-none will-change-transform"
        >
          {dockItems.map((item) => (
            <button
              key={item.id}
              onClick={item.onClick}
              className="relative w-11 h-11 rounded-2xl flex items-center justify-center cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-music-glow/50"
              title={`${item.title} (${item.shortcut})`}
            >
              {/* Sliding Active Pill Background (Không bị méo tỷ lệ khi hover icon) */}
              {item.isActive && (
                <motion.div
                  layoutId="dockActivePill"
                  transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  className="absolute inset-0 rounded-2xl bg-white/[0.14] border border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.1)_inset]"
                />
              )}

              {/* Hover Glow Pill */}
              <div className="absolute inset-0 rounded-2xl bg-white/0 group-hover:bg-white/[0.06] transition-colors duration-150" />

              {/* Magnified Icon (Tách biệt scale sang Icon để thanh trượt mượt mà) */}
              <motion.div 
                whileHover={{ scale: 1.18 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 450, damping: 22 }}
                className="relative z-10 flex items-center justify-center will-change-transform"
              >
                {item.icon(item.isActive)}
              </motion.div>

              {/* Active Dot Marker on the Left Rim */}
              {item.isActive && (
                <motion.span
                  layoutId="dockActiveDot"
                  transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  className="absolute -left-1 w-1 h-3 rounded-full bg-accent-music-glow shadow-[0_0_8px_rgba(52,211,153,0.9)]"
                />
              )}

              {/* Spatial Glass Flyout Tooltip */}
              <div className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-panel/95 text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-line/15 flex items-center gap-2 z-50">
                <span className="font-medium text-slate-200">{item.title}</span>
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-slate-300 font-semibold border border-line/10">
                  {item.shortcut}
                </kbd>
              </div>
            </button>
          ))}
        </motion.nav>
      )}
    </AnimatePresence>
  );
};
