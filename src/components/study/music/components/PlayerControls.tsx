"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  SkipForwardIcon,
  SkipBackIcon,
  RepeatIcon,
  ShuffleIcon,
} from "@phosphor-icons/react";
import { MascotFace } from "@/components/study/mascot/MascotFace";
import { useMusicBridge } from "@/components/study/mascot/useMusicBridge";

interface PlayerControlsProps {
  onNextTrack: () => void;
  onPrevTrack: () => void;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  isLooping: boolean;
  onToggleLoop: () => void;
}

export function PlayerControls({
  onNextTrack,
  onPrevTrack,
  isShuffle,
  onToggleShuffle,
  isLooping,
  onToggleLoop,
}: PlayerControlsProps) {
  // Mèo ngồi giữa làm nút phát/dừng chính
  const { musicPlaying, toggleMusic } = useMusicBridge();
  const [poking, setPoking] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const bubbleTimer = useRef<number | null>(null);

  const handleCatPress = () => {
    const wasPlaying = musicPlaying;
    toggleMusic();
    setPoking(true);
    setBubble(wasPlaying ? "Nghỉ chút nhé~" : "Nhạc chạy rồi~");
    if (bubbleTimer.current) window.clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => setBubble(null), 1500);
    window.setTimeout(() => setPoking(false), 320);
  };

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-1 select-none w-full max-w-[270px] sm:max-w-[290px] px-1">
      {/* 1. Xáo trộn bài hát */}
      <button
        onClick={onToggleShuffle}
        className={`w-11 h-11 sm:w-8.5 sm:h-8.5 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
          isShuffle
            ? "text-accent-music-glow bg-accent-music/20 shadow-sm"
            : "text-slate-400 hover:text-white hover:bg-white/10"
        }`}
        title="Xáo trộn bài hát (S)"
      >
        <ShuffleIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>

      {/* 2. Bài trước đó */}
      <button
        onClick={onPrevTrack}
        className="w-11 h-11 sm:w-8.5 sm:h-8.5 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-all active:scale-90 cursor-pointer"
        title="Bài trước đó (←)"
      >
        <SkipBackIcon weight="fill" className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>

      {/* 3. Mèo linh vật: nút phát/dừng chính, bấm vào mèo để bật/tắt nhạc */}
      <div className="relative shrink-0 mx-0.5">
        <AnimatePresence>
          {bubble && (
            <motion.div
              key={bubble}
              initial={{ opacity: 0, y: 4, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 2, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap rounded-full border border-white/15 bg-black/40 backdrop-blur-2xl px-2.5 py-1 text-[11px] font-medium text-white shadow-lg"
            >
              {bubble}
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button
          onClick={handleCatPress}
          animate={poking ? { scale: [1, 0.85, 1.08, 1] } : { scale: 1 }}
          transition={{ duration: 0.32, ease: "easeOut" }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.9 }}
          className={`cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 ${
            musicPlaying ? "drop-shadow-[0_0_10px_rgba(52,211,153,0.6)]" : ""
          }`}
          title={musicPlaying ? "Tạm dừng (Space)" : "Phát nhạc (Space)"}
          aria-label={musicPlaying ? "Tạm dừng nhạc" : "Phát nhạc"}
        >
          <MascotFace size={42} musicPlaying={musicPlaying} poking={poking} />
        </motion.button>
      </div>

      {/* 4. Bài tiếp theo */}
      <button
        onClick={onNextTrack}
        className="w-11 h-11 sm:w-8.5 sm:h-8.5 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-all active:scale-90 cursor-pointer"
        title="Bài tiếp theo (→)"
      >
        <SkipForwardIcon weight="fill" className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>

      {/* 5. Lặp lại danh sách */}
      <button
        onClick={onToggleLoop}
        className={`w-11 h-11 sm:w-8.5 sm:h-8.5 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
          isLooping
            ? "text-accent-music-glow bg-accent-music/20 shadow-sm"
            : "text-slate-400 hover:text-white hover:bg-white/10"
        }`}
        title="Lặp lại danh sách (L)"
      >
        <RepeatIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>
    </div>
  );
}
