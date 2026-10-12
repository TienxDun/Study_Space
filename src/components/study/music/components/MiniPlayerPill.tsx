"use client";

import {
  PlayIcon,
  PauseIcon,
  SkipForwardIcon,
  CornersOutIcon,
} from "@phosphor-icons/react";
import { Track } from "../types";

interface MiniPlayerPillProps {
  currentTrack?: Track;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onToggleCompactMode: () => void;
}

export function MiniPlayerPill({
  currentTrack,
  isPlaying,
  onTogglePlay,
  onNextTrack,
  onToggleCompactMode,
}: MiniPlayerPillProps) {
  return (
    <>
      {/* Mini Vinyl & Info */}
      <div
        onClick={onToggleCompactMode}
        className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group/art"
        title="Bấm để mở rộng thanh nhạc đầy đủ"
      >
        <div className="relative w-8 h-8 rounded-full p-[1.5px] bg-gradient-to-tr from-white/20 via-panel-edge to-white/10 shrink-0">
          <div
            className={`w-full h-full rounded-full overflow-hidden relative ${
              isPlaying ? "animate-[spin_8s_linear_infinite]" : ""
            }`}
          >
            <img
              src={currentTrack?.cover || "/study/thumbnails/coffee-shop.PNG"}
              alt={currentTrack?.title || "Track Cover"}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h4 className="text-xs font-bold text-slate-100 truncate group-hover/art:text-accent-music-bright transition-colors">
            {currentTrack?.title}
          </h4>
          <p className="text-xs text-slate-400 truncate">{currentTrack?.artist}</p>
        </div>
      </div>

      {/* Compact Controls */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onTogglePlay}
          className="p-2 rounded-full bg-gradient-to-tr from-accent-music to-accent-music-bright text-panel font-bold shadow-[0_0_15px_rgba(52,211,153,0.7)] transition-all active:scale-90 cursor-pointer flex items-center justify-center"
          title={isPlaying ? "Tạm dừng (Space)" : "Phát nhạc (Space)"}
        >
          {isPlaying ? (
            <PauseIcon className="w-3.5 h-3.5 fill-panel" />
          ) : (
            <PlayIcon className="w-3.5 h-3.5 fill-panel" />
          )}
        </button>

        <button
          onClick={onNextTrack}
          className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-all active:scale-90 cursor-pointer"
          title="Bài tiếp theo"
        >
          <SkipForwardIcon className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onToggleCompactMode}
          className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-90 cursor-pointer"
          title="Mở rộng đầy đủ"
        >
          <CornersOutIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </>
  );
}
