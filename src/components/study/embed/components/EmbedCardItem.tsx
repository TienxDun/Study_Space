"use client";

import {
  PlayIcon,
  MusicNotesIcon,
  TelevisionIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { StudyEmbedItem } from "../types";

interface EmbedCardItemProps {
  item: StudyEmbedItem;
  isCurrent: boolean;
  isSaved: boolean;
  hasImageError: boolean;
  isImageLoaded: boolean;
  onImageLoad: () => void;
  onImageError: () => void;
  onPlay: () => void;
  onDeleteSaved: (e: React.MouseEvent) => void;
}

export function EmbedCardItem({
  item,
  isCurrent,
  isSaved,
  hasImageError,
  isImageLoaded,
  onImageLoad,
  onImageError,
  onPlay,
  onDeleteSaved,
}: EmbedCardItemProps) {
  return (
    <div
      onClick={onPlay}
      onMouseMove={(e) => {
        const el = e.currentTarget as HTMLElement;
        const rect = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
        el.style.setProperty("--my", `${e.clientY - rect.top}px`);
      }}
      className={`group relative flex flex-col rounded-2xl overflow-hidden border transition-all cursor-pointer ${
        isCurrent
          ? "bg-white/[0.08] border-accent-music-glow/60 ring-1 ring-accent-music-glow/40 shadow-xl shadow-accent-music-ink/40"
          : "bg-white/[0.03] hover:bg-white/[0.06] border-line/10 hover:border-line/25 shadow-sm hover:-translate-y-0.5"
      }`}
    >
      <div className="relative w-full aspect-video bg-slate-950 overflow-hidden">
        {!isImageLoaded && !hasImageError && (
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 animate-pulse" />
        )}
        {item.thumbnail && !hasImageError ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-300 ${
              isImageLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"
            }`}
            onLoad={onImageLoad}
            onError={onImageError}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {item.platform === "spotify" ? (
              <MusicNotesIcon className="w-8 h-8 text-accent-music-glow" />
            ) : (
              <TelevisionIcon className="w-8 h-8 text-accent-stream-glow" />
            )}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

        {/* Spotlight theo chuột */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background:
              "radial-gradient(220px circle at var(--mx, 50%) var(--my, 50%), rgba(244,63,94,0.14), transparent 70%)",
          }}
        />

        {/* Platform Badge */}
        <div className="absolute top-2 right-2">
          {item.platform === "spotify" ? (
            <div className="flex items-end gap-0.5 h-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-accent-music/30 shadow-lg">
              <span className="w-0.5 h-1.5 bg-[#1DB954] rounded-full" />
              <span className="w-0.5 h-2.5 bg-accent-music-bright rounded-full" />
              <span className="w-0.5 h-1.5 bg-[#1DB954] rounded-full" />
            </div>
          ) : item.isLive ? (
            <Badge tone="red" shape="full" className="px-2 shadow-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-red-300 tracking-wider text-[10px]">LIVE</span>
            </Badge>
          ) : (
            <Badge tone="red" shape="full" className="px-2 shadow-lg">
              <PlayIcon weight="fill" className="w-2.5 h-2.5 text-red-400" />
              <span className="text-red-300 tracking-wider text-[10px]">VIDEO</span>
            </Badge>
          )}
        </div>

        {/* Play Hover Overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md shadow-lg transition-all duration-200 ${
              isCurrent
                ? "bg-accent-music text-panel scale-100"
                : "bg-white/90 text-slate-950 opacity-0 group-hover:opacity-100 group-hover:scale-105"
            }`}
          >
            <PlayIcon weight="fill" className="w-4 h-4 ml-0.5" />
          </div>
        </div>

        {/* Equalizer Wave Indicator when Active */}
        {isCurrent && (
          <div className="absolute bottom-2 right-2 flex items-end gap-0.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm border border-line/10">
            <span className="w-0.5 h-2.5 bg-accent-music-bright rounded-full animate-pulse" />
            <span
              className="w-0.5 h-3.5 bg-accent-music-glow rounded-full animate-pulse"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="w-0.5 h-2 bg-accent-music-bright rounded-full animate-pulse"
              style={{ animationDelay: "300ms" }}
            />
          </div>
        )}
      </div>

      <div className="p-2.5 sm:p-3 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4
            className={`text-xs font-bold truncate ${
              isCurrent
                ? "text-accent-music-bright"
                : "text-white group-hover:text-accent-music-pale transition-colors"
            }`}
          >
            {item.title}
          </h4>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs">
            <span
              className={`truncate ${
                item.platform === "spotify"
                  ? "text-accent-music-bright font-medium"
                  : "text-accent-stream-bright font-medium"
              }`}
            >
              {item.category || "Study Focus"}
            </span>
            {isCurrent && (
              <span className="text-xs text-accent-music-glow shrink-0">• Đang phát</span>
            )}
          </div>
        </div>

        {isSaved && (
          <button
            onClick={onDeleteSaved}
            title="Xóa khỏi đã lưu"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer shrink-0"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
