"use client";

import { Track } from "../types";

interface VinylArtworkBadgeProps {
  currentTrack?: Track;
  isPlaying: boolean;
  onOpenMixer: () => void;
}

export function VinylArtworkBadge({
  currentTrack,
  isPlaying,
  onOpenMixer,
}: VinylArtworkBadgeProps) {
  return (
    <div
      onClick={onOpenMixer}
      className="flex items-center gap-2.5 sm:gap-3 min-w-0 max-w-[160px] sm:max-w-[220px] md:max-w-[260px] shrink-0 cursor-pointer group/art"
      title="Mở Sound Mixer & Danh sách nhạc"
    >
      {/* Pro Vinyl Record with Specular Sheen */}
      <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full p-[2px] bg-gradient-to-tr from-white/20 via-panel-edge to-white/10 shadow-lg shadow-black/60 shrink-0 group-hover/art:scale-105 transition-transform duration-300">
        <div
          className={`w-full h-full rounded-full overflow-hidden relative shadow-inner ${
            isPlaying ? "animate-[spin_10s_linear_infinite]" : ""
          }`}
        >
          <img
            src={currentTrack?.cover || "/study/thumbnails/coffee-shop.PNG"}
            alt={currentTrack?.title || "Track Cover"}
            className="w-full h-full object-cover"
          />
          {/* Vinyl Specular Grooves Rings */}
          <div className="absolute inset-0 rounded-full border border-white/20 pointer-events-none" />
          <div className="absolute inset-1 rounded-full border border-white/10 pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.15)_0%,transparent_70%)] pointer-events-none" />

          {/* Center Core Spindle */}
          <div className="absolute inset-0 m-auto w-3 h-3 rounded-full bg-panel border border-line/40 shadow-sm z-10 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-white/40" />
          </div>
        </div>
      </div>

      {/* Title, Artist & Genre */}
      <div className="min-w-0 flex-1 space-y-0.5">
        <h4 className="text-xs sm:text-sm font-bold text-slate-100 truncate leading-tight group-hover/art:text-accent-music-bright transition-colors">
          {currentTrack?.title}
        </h4>

        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-400 truncate">
          <span className="truncate">{currentTrack?.artist}</span>
          <span>•</span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-accent-music/15 text-accent-music-bright font-semibold border border-accent-music/20 text-[10px]">
            {currentTrack?.genre}
          </span>
        </div>
      </div>
    </div>
  );
}
