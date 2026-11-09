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
  isMobile?: boolean;
}

export function PlayerControls({
  onNextTrack,
  onPrevTrack,
  isShuffle,
  onToggleShuffle,
  isLooping,
  onToggleLoop,
  isMobile = false,
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
        type="button"
        onClick={onToggleShuffle}
        className={`relative w-8.5 h-8.5 rounded-full flex items-center justify-center transition-all duration-75 active:scale-90 cursor-pointer touch-manipulation ${
          isMobile
            ? isShuffle
              ? "glass-round-btn-active text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.85)]"
              : "glass-round-btn text-white/75 hover:text-white"
            : isShuffle
            ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.85)]"
            : "text-white/75 hover:text-white"
        }`}
        title="Xáo trộn bài hát (S)"
        aria-label="Xáo trộn bài hát"
      >
        <ShuffleIcon className="w-4 h-4" />
        {isShuffle && (
          <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,1)]" />
        )}
      </button>

      {/* 2. Bài trước đó */}
      <button
        type="button"
        onClick={onPrevTrack}
        className={`w-8.5 h-8.5 rounded-full flex items-center justify-center text-white/80 hover:text-white transition-all duration-75 active:scale-90 cursor-pointer touch-manipulation ${
          isMobile ? "glass-round-btn" : ""
        }`}
        title="Bài trước đó (←)"
        aria-label="Bài trước đó"
      >
        <SkipBackIcon weight="fill" className="w-4 h-4" />
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
              className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap rounded-full border border-white/20 bg-black/70 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg"
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
          className={`cursor-pointer rounded-full outline-none touch-manipulation focus-visible:ring-2 focus-visible:ring-emerald-300/70 ${
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
        type="button"
        onClick={onNextTrack}
        className={`w-8.5 h-8.5 rounded-full flex items-center justify-center text-white/80 hover:text-white transition-all duration-75 active:scale-90 cursor-pointer touch-manipulation ${
          isMobile ? "glass-round-btn" : ""
        }`}
        title="Bài tiếp theo (→)"
        aria-label="Bài tiếp theo"
      >
        <SkipForwardIcon weight="fill" className="w-4 h-4" />
      </button>

      {/* 5. Lặp lại danh sách */}
      <button
        type="button"
        onClick={onToggleLoop}
        className={`relative w-8.5 h-8.5 rounded-full flex items-center justify-center transition-all duration-75 active:scale-90 cursor-pointer touch-manipulation ${
          isMobile
            ? isLooping
              ? "glass-round-btn-active text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.85)]"
              : "glass-round-btn text-white/75 hover:text-white"
            : isLooping
            ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.85)]"
            : "text-white/75 hover:text-white"
        }`}
        title="Lặp lại danh sách (L)"
        aria-label="Lặp lại danh sách"
      >
        <RepeatIcon className="w-4 h-4" />
        {isLooping && (
          <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,1)]" />
        )}
      </button>
    </div>
  );
}
