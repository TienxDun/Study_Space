"use client";

import {
  CornersOutIcon,
  XIcon,
} from "@phosphor-icons/react";
import { StudyEmbedItem } from "../types";
import { MascotFace } from "@/components/study/mascot/MascotFace";

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
      {/* Left: Artwork & Metadata (Thuần túy không viền không hộp) */}
      <div
        onClick={onExpandExternalStream}
        role="button"
        tabIndex={0}
        aria-label={`Mở rộng đài phát: ${externalStreamItem.title}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onExpandExternalStream?.();
          }
        }}
        className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 shrink-0 cursor-pointer group/art rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        title="Mở rộng đài phát (E)"
      >
        {/* Vinyl Record / Thumbnail Disc (Hiển thị full 100% nền đĩa, không bị lẹm viền) */}
        <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-full ring-1 ring-white/25 shadow-xl shadow-black/80 shrink-0 group-hover/art:scale-105 transition-transform duration-300">
          <div
            className={`w-full h-full rounded-full overflow-hidden relative shadow-inner ${
              !isExternalPaused
                ? "animate-[spin_10s_linear_infinite] motion-reduce:animate-none"
                : ""
            }`}
          >
            {externalStreamItem.thumbnail ? (
              <img
                src={externalStreamItem.thumbnail.replace("/hqdefault.jpg", "/mqdefault.jpg")}
                alt={externalStreamItem.title}
                width={48}
                height={48}
                loading="lazy"
                className="w-full h-full object-cover scale-[1.38]"
              />
            ) : (
              <div className="w-full h-full bg-slate-800 flex items-center justify-center" />
            )}
            {/* Subtle Vinyl Grooves Rings */}
            <div className="absolute inset-0 rounded-full border border-white/15 pointer-events-none" />
            <div className="absolute inset-1.5 rounded-full border border-white/10 pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12)_0%,transparent_65%)] pointer-events-none" />
            {/* Compact Center Spindle Hole */}
            <div className="absolute inset-0 m-auto w-2 h-2 rounded-full bg-slate-950 border border-white/40 shadow-sm z-10 flex items-center justify-center">
              <div className="w-0.5 h-0.5 rounded-full bg-white/70" />
            </div>
          </div>
        </div>

        {/* Title & Live Status (Nổi với drop-shadow sắc nét) */}
        <div className="min-w-0 flex-1 space-y-0.5 pr-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
          <p className="text-xs sm:text-sm font-bold text-white truncate leading-tight group-hover/art:text-accent-stream-bright transition-colors">
            {externalStreamItem.title}
          </p>
          <div className="flex items-center gap-1.5 text-xs">
            {externalStreamItem.platform === "spotify" ? (
              <div className="flex items-end gap-0.5 h-2.5 px-1.5 py-0.5 rounded-full bg-[#1DB954]/20 border border-[#1DB954]/30">
                <span className="w-0.5 h-1.5 bg-[#1DB954] rounded-full animate-pulse" />
                <span
                  className="w-0.5 h-2.5 bg-[#1DB954] rounded-full animate-pulse"
                  style={{ animationDelay: "120ms" }}
                />
                <span
                  className="w-0.5 h-2 bg-[#1DB954] rounded-full animate-pulse"
                  style={{ animationDelay: "240ms" }}
                />
              </div>
            ) : externalStreamItem.isLive ? (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                </span>
                <span className="text-[10px] font-bold tracking-wider leading-none">LIVE</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-slate-200 text-[10px] font-bold tracking-wider">
                <span className="w-1 h-1 rounded-full bg-white/60" />
                <span>VIDEO</span>
              </div>
            )}
            <span className="text-slate-300/90 truncate text-xs">
              {externalStreamItem.category || "Study Stream"}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Modern Glassmorphic Controls [Play/Pause] [Expand] [Stop] */}
      <div className="flex items-center gap-2 shrink-0">
        {externalStreamItem.platform === "youtube" && (
          <button
            onClick={toggleExternalPlay}
            className="relative w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white backdrop-blur-md transition-[color,background-color,box-shadow,transform] duration-200 active:scale-95 cursor-pointer shadow-lg shadow-black/50 hover:shadow-[0_0_15px_rgba(255,255,255,0.25)] flex items-center justify-center group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 before:content-[''] before:absolute before:-inset-2"
            title={
              isExternalPaused
                ? "Tiếp tục phát YouTube (Space)"
                : "Tạm dừng YouTube (Space)"
            }
            aria-label={
              isExternalPaused
                ? "Tiếp tục phát YouTube"
                : "Tạm dừng YouTube"
            }
          >
            {/* Mèo linh vật làm nút phát/dừng: chạy thì tươi, dừng thì lim dim */}
            <span className="transition-transform group-hover:scale-110 leading-none">
              <MascotFace size={36} musicPlaying={!isExternalPaused} />
            </span>
          </button>
        )}

        <button
          onClick={onExpandExternalStream}
          className="relative w-8 h-8 rounded-full hidden sm:flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-[color,background-color,transform] duration-200 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 before:content-[''] before:absolute before:-inset-2"
          title="Mở rộng đài phát (E)"
          aria-label="Mở rộng đài phát"
        >
          <CornersOutIcon className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onStopExternalStream}
          className="relative w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-300 hover:bg-rose-500/15 transition-[color,background-color,transform] duration-200 active:scale-90 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 before:content-[''] before:absolute before:-inset-2"
          title="Dừng phát đài ngoài"
          aria-label="Dừng phát đài ngoài"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>
    </>
  );
}
