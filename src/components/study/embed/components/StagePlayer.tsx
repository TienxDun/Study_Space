"use client";

import {
  Tv,
  Music2,
  ExternalLink,
  Square,
  PictureInPicture2,
  Radio,
} from "lucide-react";
import { StudyEmbedItem } from "../types";
import { ensureYouTubeJsApi } from "@/lib/youtube-remote";

interface StagePlayerProps {
  activeItem: StudyEmbedItem | null;
  splitRatio: number;
  isIframeLoading: boolean;
  setIsIframeLoading: (loading: boolean) => void;
  onEnterPip: () => void;
  onStopStream: (e?: React.MouseEvent) => void;
}

export function StagePlayer({
  activeItem,
  splitRatio,
  isIframeLoading,
  setIsIframeLoading,
  onEnterPip,
  onStopStream,
}: StagePlayerProps) {
  return (
    <div
      style={{ flexBasis: `${splitRatio}%` }}
      className="w-full md:w-auto md:shrink-0 flex flex-col border-b md:border-b-0 bg-transparent p-4 sm:p-5 overflow-y-auto custom-study-scroll"
    >
      {activeItem ? (
        <div className="flex flex-col gap-4">
          {/* 16:9 Video Frame */}
          <div
            className={`relative w-full rounded-2xl overflow-hidden bg-black shadow-xl border border-line/15 ${
              activeItem.platform === "spotify" ? "h-[152px]" : "aspect-video"
            }`}
          >
            {/* Loading Skeleton */}
            <div
              className={`absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950 gap-2.5 pointer-events-none transition-opacity duration-300 ${
                isIframeLoading ? "opacity-100" : "opacity-0"
              }`}
            >
              <div className="flex items-end gap-1 h-5">
                <span className="w-1 h-3 bg-slate-400 rounded-full animate-pulse" />
                <span
                  className="w-1 h-5 bg-accent-music-glow rounded-full animate-pulse"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-1 h-4 bg-accent-stream-glow rounded-full animate-pulse"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
              <span className="text-[11px] font-medium text-slate-300">
                Đang tải luồng phát...
              </span>
            </div>

            {/* Isolated iframe container */}
            <div className="w-full h-full">
              <iframe
                key={activeItem.id}
                src={ensureYouTubeJsApi(activeItem.embedUrl)}
                title={activeItem.title}
                className="w-full h-full border-0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                onLoad={() => setIsIframeLoading(false)}
              />
            </div>
          </div>

          {/* Seamless Single-line Media Bar */}
          <div className="flex items-center justify-between gap-3 px-1 py-0.5">
            {/* Left: Badge + Truncated Title on single line */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {activeItem.platform === "spotify" ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-accent-music/15 text-accent-music-bright text-[10px] font-bold shrink-0">
                  <Music2 className="w-3 h-3" />
                  <span>SPOTIFY</span>
                </span>
              ) : activeItem.isLive ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-accent-stream/15 text-accent-stream-bright text-[10px] font-bold shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-stream animate-pulse" />
                  <span>LIVE</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/10 text-slate-300 text-[10px] font-bold shrink-0">
                  <Tv className="w-3 h-3" />
                  <span>VIDEO</span>
                </span>
              )}

              <span
                className="text-xs sm:text-sm font-semibold text-slate-200 truncate"
                title={activeItem.title}
              >
                {activeItem.title}
              </span>
            </div>

            {/* Right: Icon Buttons Strip */}
            <div className="flex items-center gap-1 shrink-0">
              {activeItem.platform === "youtube" && (
                <button
                  onClick={onEnterPip}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer active:scale-95"
                  title="Tách thành cửa sổ nổi (PiP)"
                >
                  <PictureInPicture2 className="w-4 h-4 text-accent-music-glow" />
                </button>
              )}

              <a
                href={activeItem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer active:scale-95 flex items-center justify-center"
                title="Mở trên trang web gốc"
              >
                <ExternalLink className="w-4 h-4" />
              </a>

              <button
                onClick={onStopStream}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer active:scale-95 flex items-center justify-center"
                title="Dừng phát đài này"
              >
                <Square className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty Stage State */
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-white/[0.04] border border-line/10 flex items-center justify-center text-slate-500 shadow-inner">
            <Radio className="w-8 h-8 text-slate-400" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-200">Chưa chọn đài phát</h4>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              Hãy chọn một kênh từ danh sách bên phải hoặc dán liên kết YouTube / Spotify để
              bắt đầu nghe nhạc.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
