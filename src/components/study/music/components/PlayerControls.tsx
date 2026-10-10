"use client";

import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Repeat,
  Shuffle,
} from "lucide-react";

interface PlayerControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  isLooping: boolean;
  onToggleLoop: () => void;
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
}: PlayerControlsProps) {
  return (
    <div className="flex items-center justify-between select-none w-full max-w-[270px] sm:max-w-[290px] px-1">
      {/* 1. Xáo trộn bài hát */}
      <button
        onClick={onToggleShuffle}
        className={`w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
          isShuffle
            ? "text-accent-music-glow bg-accent-music/20 shadow-sm"
            : "text-slate-400 hover:text-white hover:bg-white/10"
        }`}
        title="Xáo trộn bài hát (S)"
      >
        <Shuffle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>

      {/* 2. Bài trước đó */}
      <button
        onClick={onPrevTrack}
        className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-all active:scale-90 cursor-pointer"
        title="Bài trước đó (←)"
      >
        <SkipBack className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
      </button>

      {/* 3. Nút Play/Pause chính ở trung tâm (Trục đối xứng tuyệt đối) */}
      <button
        onClick={onTogglePlay}
        className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-accent-music to-accent-music-bright hover:from-accent-music-glow hover:to-accent-music-pale text-panel font-black shadow-[0_0_18px_rgba(52,211,153,0.75)] hover:shadow-[0_0_26px_rgba(52,211,153,0.95)] transition-all active:scale-90 cursor-pointer shrink-0 flex items-center justify-center"
        title={isPlaying ? "Tạm dừng (Space)" : "Phát nhạc (Space)"}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-panel" />
        ) : (
          <Play className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-panel ml-0.5" />
        )}
      </button>

      {/* 4. Bài tiếp theo */}
      <button
        onClick={onNextTrack}
        className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-all active:scale-90 cursor-pointer"
        title="Bài tiếp theo (→)"
      >
        <SkipForward className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
      </button>

      {/* 5. Lặp lại danh sách */}
      <button
        onClick={onToggleLoop}
        className={`w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
          isLooping
            ? "text-accent-music-glow bg-accent-music/20 shadow-sm"
            : "text-slate-400 hover:text-white hover:bg-white/10"
        }`}
        title="Lặp lại danh sách (L)"
      >
        <Repeat className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>
    </div>
  );
}
