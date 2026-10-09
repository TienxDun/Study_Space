"use client";

import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Repeat,
  Shuffle,
  SlidersHorizontal,
  Minimize2,
} from "lucide-react";
import { RangeSlider } from "@/components/ui/RangeSlider";

interface PlayerControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  isLooping: boolean;
  onToggleLoop: () => void;
  effectiveVolume: number;
  onVolumeChange: (val: number) => void;
  isGlobalMuted: boolean;
  onToggleMute: () => void;
  isMixerOpen: boolean;
  onToggleMixer: () => void;
  onToggleCompactMode: () => void;
}

export function PlayerControls({
  isPlaying,
  onTogglePlay,
  onNextTrack,
  onPrevTrack,
  isShuffle,
  onToggleShuffle,
  isLooping,
  onToggleLoop,
  effectiveVolume,
  onVolumeChange,
  isGlobalMuted,
  onToggleMute,
  isMixerOpen,
  onToggleMixer,
  onToggleCompactMode,
}: PlayerControlsProps) {
  return (
    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
      {/* Shuffle */}
      <button
        onClick={onToggleShuffle}
        className={`p-1.5 rounded-full transition-all active:scale-90 cursor-pointer ${
          isShuffle
            ? "text-accent-music-glow bg-accent-music/20 shadow-sm border border-accent-music-glow/30"
            : "text-slate-400 hover:text-white hover:bg-white/10"
        }`}
        title="Xáo trộn bài hát (S)"
      >
        <Shuffle className="w-3.5 h-3.5" />
      </button>

      {/* Previous */}
      <button
        onClick={onPrevTrack}
        className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-all active:scale-90 cursor-pointer"
        title="Bài trước đó (←)"
      >
        <SkipBack className="w-4 h-4 fill-current" />
      </button>

      {/* Play/Pause Main Pearl Button */}
      <button
        onClick={onTogglePlay}
        className="relative p-2.5 sm:p-3 rounded-full bg-gradient-to-tr from-accent-music to-accent-music-bright hover:from-accent-music-glow hover:to-accent-music-pale text-panel font-black shadow-[0_0_20px_rgba(52,211,153,0.7)] hover:shadow-[0_0_28px_rgba(52,211,153,0.9)] transition-all active:scale-90 cursor-pointer shrink-0 flex items-center justify-center"
        title={isPlaying ? "Tạm dừng (Space)" : "Phát nhạc (Space)"}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-panel" />
        ) : (
          <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-panel" />
        )}
      </button>

      {/* Next */}
      <button
        onClick={onNextTrack}
        className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-all active:scale-90 cursor-pointer"
        title="Bài tiếp theo (→)"
      >
        <SkipForward className="w-4 h-4 fill-current" />
      </button>

      {/* Loop */}
      <button
        onClick={onToggleLoop}
        className={`p-1.5 rounded-full transition-all active:scale-90 cursor-pointer ${
          isLooping
            ? "text-accent-music-glow bg-accent-music/20 shadow-sm border border-accent-music-glow/30"
            : "text-slate-400 hover:text-white hover:bg-white/10"
        }`}
        title="Lặp lại danh sách (L)"
      >
        <Repeat className="w-3.5 h-3.5" />
      </button>

      {/* Volume Slider Control */}
      <div className="hidden lg:flex items-center gap-1.5 pl-1.5 pr-1 border-l border-line/15">
        <button
          onClick={onToggleMute}
          className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          title={isGlobalMuted ? "Bật âm thanh không gian (M)" : "Tắt toàn bộ âm thanh (M)"}
        >
          {isGlobalMuted ? (
            <VolumeX className="w-3.5 h-3.5 text-accent-stream-rose-bright" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-accent-music-glow" />
          )}
        </button>
        <RangeSlider
          min={0}
          max={1}
          step={0.05}
          value={effectiveVolume}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onVolumeChange(parseFloat(e.target.value))
          }
          className="w-12 h-1 bg-white/20 rounded-lg accent-accent-music-glow"
        />
      </div>

      {/* Sound Mixer Open Button */}
      <button
        id="tour-music-mixer-btn"
        onClick={onToggleMixer}
        className={`p-2 rounded-full transition-all active:scale-95 cursor-pointer border shrink-0 ${
          isMixerOpen
            ? "bg-accent-music text-panel font-bold border-accent-music-bright shadow-[0_0_15px_rgba(52,211,153,0.6)]"
            : "bg-white/10 text-slate-200 hover:text-white hover:bg-white/20 border-line/15 shadow-sm"
        }`}
        title="Mở Sound Mixer (Lo-fi / Jazz / Relax & Âm thanh nền)"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
      </button>

      {/* Minimize to Mini Pill Button */}
      <button
        onClick={onToggleCompactMode}
        className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-90 cursor-pointer hidden sm:inline-flex"
        title="Thu nhỏ thanh nhạc (Mini Mode)"
      >
        <Minimize2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
