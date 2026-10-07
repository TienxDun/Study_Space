"use client";

import { Play, Trash2 } from "lucide-react";
import { StudyEmbedItem } from "../types";

interface EmbedListItemProps {
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

export function EmbedListItem({
  item,
  isCurrent,
  isSaved,
  hasImageError,
  isImageLoaded,
  onImageLoad,
  onImageError,
  onPlay,
  onDeleteSaved,
}: EmbedListItemProps) {
  return (
    <div
      onClick={onPlay}
      className={`group relative flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
        isCurrent
          ? "bg-white/[0.08] border-accent-music-glow/60 shadow-sm"
          : "bg-white/[0.03] hover:bg-white/[0.06] border-line/10 hover:border-line/20 shadow-sm"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 pr-2">
        <div className="w-10 h-10 rounded-lg bg-slate-950 shrink-0 overflow-hidden relative border border-line/15 flex items-center justify-center">
          {!isImageLoaded && !hasImageError && (
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 animate-pulse" />
          )}
          {item.thumbnail && !hasImageError ? (
            <img
              src={item.thumbnail}
              alt={item.title}
              className={`w-full h-full object-cover ${
                isImageLoaded ? "opacity-100" : "opacity-0"
              }`}
              onLoad={onImageLoad}
              onError={onImageError}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-accent-music-glow" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 flex items-center justify-center transition-colors">
            <Play
              className={`w-3.5 h-3.5 ml-0.5 fill-current ${
                isCurrent
                  ? "text-accent-music-glow opacity-100"
                  : "text-white opacity-0 group-hover:opacity-100"
              } transition-opacity`}
            />
          </div>
        </div>

        <div className="min-w-0">
          <h4
            className={`text-xs font-semibold truncate ${
              isCurrent
                ? "text-accent-music-bright"
                : "text-white group-hover:text-accent-music-pale"
            }`}
          >
            {item.title}
          </h4>
          <div className="flex items-center gap-1.5 mt-0.5 text-[11px]">
            <span
              className={
                item.platform === "spotify"
                  ? "text-accent-music-bright font-medium"
                  : "text-accent-stream-bright font-medium"
              }
            >
              {item.category || "Study Focus"}
            </span>
            {isCurrent && (
              <span className="text-[10px] text-accent-music-glow">• Đang phát</span>
            )}
          </div>
        </div>
      </div>

      {isSaved && (
        <button
          onClick={onDeleteSaved}
          title="Xóa khỏi đã lưu"
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
