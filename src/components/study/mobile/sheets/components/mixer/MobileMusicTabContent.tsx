"use client";

import { memo, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  PlayIcon,
  SkipForwardIcon,
  SkipBackIcon,
  ShuffleIcon,
  RepeatIcon,
} from "@phosphor-icons/react";
import { MascotFace } from "@/components/study/mascot/MascotFace";
import { RangeSlider } from "@/components/ui/RangeSlider";
import { MoodType, Track } from "@/components/study/mixer/types";
import { MOOD_OPTIONS } from "@/components/study/mixer/constants";
import { formatTime } from "@/components/study/mixer/utils/sound-helpers";

const MOOD_STYLES: Record<
  MoodType,
  {
    activeBg: string;
    activeText: string;
    activeIcon: string;
    glow: string;
  }
> = {
  lofi: {
    activeBg: "bg-indigo-500/25 border-indigo-400/80",
    activeText: "text-indigo-200",
    activeIcon: "text-indigo-300 drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]",
    glow: "shadow-[0_0_16px_rgba(99,102,241,0.35),inset_0_1px_1px_rgba(255,255,255,0.25)]",
  },
  jazz: {
    activeBg: "bg-emerald-500/25 border-emerald-400/80",
    activeText: "text-emerald-200",
    activeIcon: "text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]",
    glow: "shadow-[0_0_16px_rgba(16,185,129,0.35),inset_0_1px_1px_rgba(255,255,255,0.25)]",
  },
  relax: {
    activeBg: "bg-amber-500/25 border-amber-400/80",
    activeText: "text-amber-200",
    activeIcon: "text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]",
    glow: "shadow-[0_0_16px_rgba(245,158,11,0.35),inset_0_1px_1px_rgba(255,255,255,0.25)]",
  },
};

interface MobileMusicTabContentProps {
  currentMood: MoodType;
  onSelectMood: (mood: MoodType) => void;
  currentTrack: Track;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onSelectTrack: (track: Track) => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  isLooping: boolean;
  onToggleLoop: () => void;
  currentMoodTracks: Track[];
}

/**
 * Tab Nhạc Chill tối ưu riêng cho giao diện Mobile:
 * Nút bấm lớn hơn, thanh tua nhạc touch-none chống trượt cử chỉ vuốt sheet,
 * và danh sách bài hát có tap target thoải mái cho ngón tay cái.
 */
export const MobileMusicTabContent = memo(function MobileMusicTabContent({
  currentMood,
  onSelectMood,
  currentTrack,
  isPlaying,
  onTogglePlay,
  onNextTrack,
  onPrevTrack,
  onSelectTrack,
  currentTime,
  duration,
  onSeek,
  isShuffle,
  onToggleShuffle,
  isLooping,
  onToggleLoop,
  currentMoodTracks,
}: MobileMusicTabContentProps) {
  const [poking, setPoking] = useState(false);

  const handlePlayToggle = () => {
    onTogglePlay();
    setPoking(true);
    window.setTimeout(() => setPoking(false), 320);
  };

  return (
    <div className="space-y-4 pb-6 select-none">
      {/* VÙNG CHỌN TÂM TRẠNG (MOODS) */}
      <div>
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
          Tâm trạng âm nhạc
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {MOOD_OPTIONS.map((mood) => {
            const isSelected = currentMood === mood.key;
            const Icon = mood.icon;
            const style = MOOD_STYLES[mood.key as MoodType];

            return (
              <button
                key={mood.key}
                type="button"
                onClick={() => onSelectMood(mood.key as MoodType)}
                className={`relative flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl transition-all active:scale-95 cursor-pointer backdrop-blur-md border touch-manipulation ${
                  isSelected
                    ? `${style.activeBg} ${style.activeText} ${style.glow} font-bold ring-1 ring-white/10`
                    : "bg-white/5 active:bg-white/10 border-white/10 text-white/70 font-medium"
                }`}
              >
                <Icon className={`w-5 h-5 ${isSelected ? style.activeIcon : mood.color}`} />
                <span className="text-xs">{mood.label}</span>
                {isSelected && (
                  <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-current shadow-[0_0_6px_currentColor]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* KHỐI TRÌNH PHÁT NHẠC (Thẻ thông tin + Cụm nút điều khiển độc lập liên kết chặt chẽ) */}
      <div className="space-y-2">
        {/* Thẻ bài hát đang phát */}
        <div className="relative p-3 sm:p-3.5 rounded-2xl bg-gradient-to-b from-slate-800/70 via-slate-900/85 to-[#0b0f19]/95 border border-white/15 shadow-[0_8px_24px_rgba(0,0,0,0.5)] overflow-hidden">
          {/* Glow blobs trang trí nhẹ */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Thông tin bài hát & Ảnh bìa */}
          <div className="relative z-10 flex items-center gap-3 mb-2">
            <div className="relative w-11 h-11 rounded-xl overflow-hidden shadow-lg shrink-0 bg-slate-800 border border-white/20">
              <Image
                src={currentTrack.cover}
                alt={currentTrack.title}
                fill
                unoptimized
                sizes="44px"
                className={`object-cover transition-transform duration-700 ${
                  isPlaying ? "scale-105" : "scale-100"
                }`}
              />
              {isPlaying && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center gap-0.5">
                  <span className="w-0.5 h-3 bg-emerald-400 rounded-full animate-[bounce_1s_infinite_100ms]" />
                  <span className="w-0.5 h-4.5 bg-emerald-300 rounded-full animate-[bounce_1s_infinite_300ms]" />
                  <span className="w-0.5 h-2.5 bg-emerald-400 rounded-full animate-[bounce_1s_infinite_200ms]" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-0.5">
              <h4 className="text-sm font-bold text-white tracking-tight truncate leading-tight">
                {currentTrack.title}
              </h4>
              <p className="text-[11px] text-slate-400 truncate font-medium">
                {currentTrack.artist}
              </p>
            </div>
          </div>

          {/* Thanh tiến độ bài hát: touch-none để tua nhạc không bị hiểu lầm thành cuộn trang */}
          <div className="relative z-10 space-y-1 my-1.5 touch-none">
            <RangeSlider
              min={0}
              max={duration > 0 ? duration : 100}
              value={currentTime}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onSeek(parseFloat(e.target.value))
              }
              className="w-full bg-white/15 rounded-full accent-emerald-400"
            />
            <div className="flex justify-between text-[11px] font-mono font-medium text-slate-400 px-0.5 pt-0.5">
              <span className="text-emerald-400 font-semibold">{formatTime(currentTime)}</span>
              <span>{duration > 0 ? formatTime(duration) : "0:00"}</span>
            </div>
          </div>
        </div>

        {/* Cụm nút điều khiển phát nhạc Mobile: Tách riêng độc lập, nền kính mờ đồng bộ với toàn sheet */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 select-none w-full max-w-[285px] mx-auto py-1">
          {/* 1. Xáo trộn bài hát */}
          <button
            type="button"
            onClick={onToggleShuffle}
            className={`relative w-9.5 h-9.5 rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 cursor-pointer touch-manipulation shadow-sm ${
              isShuffle
                ? "bg-emerald-500/20 active:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.3)]"
                : "bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/15 text-white/80 hover:text-white"
            }`}
            title="Xáo trộn bài hát"
            aria-label="Xáo trộn bài hát"
          >
            <ShuffleIcon className="w-4 h-4" />
            {isShuffle && (
              <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.9)]" />
            )}
          </button>

          {/* 2. Bài trước đó */}
          <button
            type="button"
            onClick={onPrevTrack}
            className="w-9.5 h-9.5 rounded-full bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/15 flex items-center justify-center text-white/80 hover:text-white transition-all duration-150 active:scale-90 cursor-pointer touch-manipulation shadow-sm"
            title="Bài trước đó"
            aria-label="Bài trước đó"
          >
            <SkipBackIcon weight="fill" className="w-4 h-4" />
          </button>

          {/* 3. Mèo linh vật: nút phát/dừng chính */}
          <div className="relative shrink-0 mx-1">
            <motion.button
              type="button"
              onClick={handlePlayToggle}
              animate={poking ? { scale: [1, 0.85, 1.08, 1] } : { scale: 1 }}
              transition={{ duration: 0.32, ease: "easeOut" }}
              whileTap={{ scale: 0.9 }}
              className={`relative cursor-pointer rounded-full outline-none touch-manipulation focus-visible:ring-2 focus-visible:ring-emerald-300/70 transition-all ${
                isPlaying
                  ? "drop-shadow-[0_0_14px_rgba(52,211,153,0.7)]"
                  : "opacity-90 hover:opacity-100"
              }`}
              title={isPlaying ? "Tạm dừng" : "Phát nhạc"}
              aria-label={isPlaying ? "Tạm dừng nhạc" : "Phát nhạc"}
            >
              <MascotFace size={42} musicPlaying={isPlaying} poking={poking} isMobile={false} />
              {/* Badge Play mini khi đang dừng để người dùng nhận diện ngay nút phát nhạc */}
              {!isPlaying && (
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-400 text-slate-950 flex items-center justify-center shadow-md shadow-black/60 ring-2 ring-slate-900 pointer-events-none animate-pulse">
                  <PlayIcon weight="fill" className="w-2.5 h-2.5 translate-x-0.25" />
                </span>
              )}
            </motion.button>
          </div>

          {/* 4. Bài tiếp theo */}
          <button
            type="button"
            onClick={onNextTrack}
            className="w-9.5 h-9.5 rounded-full bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/15 flex items-center justify-center text-white/80 hover:text-white transition-all duration-150 active:scale-90 cursor-pointer touch-manipulation shadow-sm"
            title="Bài tiếp theo"
            aria-label="Bài tiếp theo"
          >
            <SkipForwardIcon weight="fill" className="w-4 h-4" />
          </button>

          {/* 5. Lặp lại danh sách */}
          <button
            type="button"
            onClick={onToggleLoop}
            className={`relative w-9.5 h-9.5 rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 cursor-pointer touch-manipulation shadow-sm ${
              isLooping
                ? "bg-emerald-500/20 active:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.3)]"
                : "bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/15 text-white/80 hover:text-white"
            }`}
            title="Lặp lại danh sách"
            aria-label="Lặp lại danh sách"
          >
            <RepeatIcon className="w-4 h-4" />
            {isLooping && (
              <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.9)]" />
            )}
          </button>
        </div>
      </div>

      {/* DANH SÁCH BÀI HÁT TIẾP THEO (UP NEXT) */}
      <div className="space-y-2 pb-6">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Danh sách phát ({currentMoodTracks.length} bài)
        </h4>
        <div className="space-y-1.5">
          {currentMoodTracks.map((t) => {
            const isSelected = t.id === currentTrack.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTrack(t)}
                className={`flex items-center gap-3 p-2.5 rounded-2xl w-full text-left transition-all cursor-pointer active:scale-[0.99] touch-manipulation ${
                  isSelected
                    ? "bg-emerald-600/20 border border-emerald-400/40 text-emerald-300"
                    : "bg-white/5 active:bg-white/10 text-slate-300 active:text-white border border-transparent"
                }`}
              >
                <div className="relative w-9 h-9 rounded-xl overflow-hidden shrink-0 bg-slate-800 border border-white/10">
                  <Image
                    src={t.cover}
                    alt={t.title}
                    fill
                    unoptimized
                    sizes="36px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate leading-tight">{t.title}</p>
                  <p className="text-xs text-slate-400 truncate">{t.artist}</p>
                </div>
                {isSelected && isPlaying && (
                  <div className="flex items-center gap-0.5 pr-1">
                    <span className="w-1 h-3 bg-emerald-400 animate-pulse rounded-full" />
                    <span className="w-1 h-4 bg-emerald-400 animate-pulse delay-75 rounded-full" />
                    <span className="w-1 h-2 bg-emerald-400 animate-pulse delay-150 rounded-full" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
