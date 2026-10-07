"use client";

import { Play, Pause, Maximize2, X } from "lucide-react";
import { StudyEmbedItem } from "../types";

interface ExternalStreamBannerProps {
  externalStreamItem: StudyEmbedItem;
  isExternalPaused: boolean;
  toggleExternalPlay: () => void;
  onExpandExternalStream?: () => void;
  onStopExternalStream?: () => void;
}

export function ExternalStreamBanner({
  externalStreamItem,
  isExternalPaused,
  toggleExternalPlay,
  onExpandExternalStream,
  onStopExternalStream,
}: ExternalStreamBannerProps) {
  return (
    <>
      {/* Left: Artwork & Metadata */}
      <div
        onClick={onExpandExternalStream}
        className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 shrink-0 cursor-pointer group/art"
        title="Mở rộng đài phát (E)"
      >
        {externalStreamItem.platform === "spotify" ? (
          <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden bg-accent-music-ink/90 border border-accent-music/40 shadow-md shadow-accent-music-ink/60 shrink-0 group-hover/art:scale-105 transition-transform duration-300">
            {externalStreamItem.thumbnail && (
              <img
                src={externalStreamItem.thumbnail}
                alt={externalStreamItem.title}
                className="w-full h-full object-cover"
              />
            )}
          </div>
        ) : (
          <div className="relative w-13 h-9 sm:w-14 sm:h-10 rounded-lg overflow-hidden bg-accent-stream-ink/90 border border-accent-stream/40 shadow-md shadow-accent-stream-ink/60 shrink-0 group-hover/art:scale-105 transition-transform duration-300">
            {externalStreamItem.thumbnail && (
              <img
                src={externalStreamItem.thumbnail}
                alt={externalStreamItem.title}
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-accent-stream-deep via-accent-stream-rose to-accent-stream" />
          </div>
        )}

        {/* Title & Live Status */}
        <div className="min-w-0 flex-1 space-y-0.5 pr-2">
          <h4 className="text-xs sm:text-sm font-bold text-slate-100 truncate leading-tight group-hover/art:text-accent-music-bright transition-colors">
            {externalStreamItem.title}
          </h4>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs">
            {externalStreamItem.platform === "spotify" ? (
              <div className="flex items-end gap-0.5 h-2.5 px-1.5 py-0.5 rounded-full bg-accent-music/20 border border-accent-music/30">
                <span className="w-0.5 h-1.5 bg-[#1DB954] rounded-full animate-pulse" />
                <span
                  className="w-0.5 h-2.5 bg-accent-music-bright rounded-full animate-pulse"
                  style={{ animationDelay: "120ms" }}
                />
                <span
                  className="w-0.5 h-2 bg-[#1DB954] rounded-full animate-pulse"
                  style={{ animationDelay: "240ms" }}
                />
              </div>
            ) : externalStreamItem.isLive ? (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-accent-stream/20 border border-accent-stream/30">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-stream-glow opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-stream" />
                </span>
                <span className="text-[9px] font-bold text-accent-stream-bright tracking-wider">
                  LIVE
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-accent-stream/15 border border-accent-stream/25 text-accent-stream-bright text-[9px] font-bold tracking-wider">
                <span className="w-1 h-1 rounded-full bg-accent-stream-glow" />
                <span>VIDEO</span>
              </div>
            )}
            <span className="text-slate-400 truncate text-[10px] sm:text-xs">
              {externalStreamItem.category || "Study Stream"}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Controls [Play/Pause if YouTube] [Expand] [Stop] */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {externalStreamItem.platform === "youtube" && (
          <button
            onClick={toggleExternalPlay}
            className="p-2 rounded-full bg-accent-stream/20 hover:bg-accent-stream/30 text-accent-stream-bright border border-accent-stream/40 transition-all active:scale-95 cursor-pointer shadow-sm flex items-center justify-center"
            title={
              isExternalPaused
                ? "Tiếp tục phát YouTube (Space)"
                : "Tạm dừng YouTube (Space)"
            }
          >
            {isExternalPaused ? (
              <Play className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Pause className="w-3.5 h-3.5 fill-current" />
            )}
          </button>
        )}

        <button
          onClick={onExpandExternalStream}
          className={`p-2 rounded-full font-bold transition-all active:scale-95 cursor-pointer shadow-sm border ${
            externalStreamItem.platform === "spotify"
              ? "bg-accent-music/20 hover:bg-accent-music/30 text-accent-music-bright border-accent-music/40 shadow-[0_0_15px_rgba(52,211,153,0.3)]"
              : "bg-accent-stream/20 hover:bg-accent-stream/30 text-accent-stream-bright border-accent-stream/40 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
          }`}
          title="Mở rộng đài phát (E)"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onStopExternalStream}
          className="p-2 rounded-full bg-accent-stream/15 hover:bg-accent-stream/30 text-slate-300 hover:text-accent-stream-pale border border-accent-stream/30 transition-all active:scale-90 cursor-pointer shadow-sm"
          title="Dừng phát đài ngoài"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </>
  );
}
