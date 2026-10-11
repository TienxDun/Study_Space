"use client";

import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Shuffle,
  Repeat,
} from "lucide-react";
import { RangeSlider } from "@/components/ui/RangeSlider";
import { MoodType, Track } from "../types";
import { MOOD_OPTIONS } from "../constants";
import { formatTime } from "../utils/sound-helpers";

interface MusicTabContentProps {
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

export function MusicTabContent({
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
}: MusicTabContentProps) {
  return (
    <>
      {/* MOODS SECTION */}
      <div>
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
          Moods
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {MOOD_OPTIONS.map((mood) => {
            const isSelected = currentMood === mood.key;
            const Icon = mood.icon;
            return (
              <button
                key={mood.key}
                onClick={() => onSelectMood(mood.key as MoodType)}
                className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl border transition-all active:scale-95 cursor-pointer ${
                  isSelected
                    ? "bg-emerald-600/90 text-white border-emerald-400 shadow-lg shadow-emerald-500/20 font-bold"
                    : "bg-white/5 hover:bg-white/10 text-slate-300 border-white/10 font-medium"
                }`}
              >
                <Icon className={`w-5 h-5 ${isSelected ? "text-white" : mood.color}`} />
                <span className="text-xs">{mood.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* CURRENT PLAYING CARD */}
      <div className="relative p-4 rounded-3xl bg-gradient-to-b from-slate-800/70 via-slate-900/85 to-[#0b0f19]/95 border border-white/15 shadow-[0_12px_36px_rgba(0,0,0,0.6)] overflow-hidden">
        {/* Ambient dynamic glow blobs */}
        <div className="absolute -top-10 -right-10 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Track Header & Artwork */}
        <div className="relative z-10 flex items-center gap-3.5 mb-3.5">
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-xl shrink-0 bg-slate-800 border border-white/20 group">
            <img
              src={currentTrack.cover}
              alt={currentTrack.title}
              className={`w-full h-full object-cover transition-transform duration-700 ${
                isPlaying ? "scale-105" : "scale-100"
              }`}
            />
            {isPlaying && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center gap-1">
                <span className="w-1 h-4 bg-emerald-400 rounded-full animate-[bounce_1s_infinite_100ms]" />
                <span className="w-1 h-6 bg-emerald-300 rounded-full animate-[bounce_1s_infinite_300ms]" />
                <span className="w-1 h-3 bg-emerald-400 rounded-full animate-[bounce_1s_infinite_200ms]" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <h4 className="text-sm font-bold text-white tracking-tight truncate leading-snug">
              {currentTrack.title}
            </h4>
            <p className="text-xs text-slate-400 truncate font-medium">
              {currentTrack.artist}
            </p>
          </div>
        </div>

        {/* Modern Progress Bar with Time Display */}
        <div className="relative z-10 space-y-1.5 my-3">
          <div className="relative group flex items-center">
            <RangeSlider
              min={0}
              max={duration > 0 ? duration : 100}
              value={currentTime}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onSeek(parseFloat(e.target.value))
              }
              className="w-full bg-white/15 hover:bg-white/25 rounded-full accent-emerald-400"
            />
          </div>
          <div className="flex justify-between text-xs font-mono font-medium text-slate-400 px-0.5">
            <span className="text-emerald-400 font-semibold">{formatTime(currentTime)}</span>
            <span>{duration > 0 ? formatTime(duration) : "0:00"}</span>
          </div>
        </div>

        {/* Primary Modern Controls */}
        <div className="relative z-10 flex items-center justify-between pt-1">
          <button
            onClick={onToggleShuffle}
            className={`p-2 rounded-xl transition-all duration-200 active:scale-90 cursor-pointer ${
              isShuffle
                ? "text-emerald-300 bg-emerald-500/20 border border-emerald-400/30 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/10"
            }`}
            title="Xáo trộn bài hát"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={onPrevTrack}
            className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/15 text-slate-200 hover:text-white border border-white/10 active:scale-90 transition-all shadow-sm cursor-pointer"
            title="Bài trước"
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </button>

          <button
            onClick={onTogglePlay}
            className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-400 via-teal-300 to-emerald-200 text-slate-950 hover:scale-105 active:scale-95 transition-all duration-300 shadow-[0_0_24px_rgba(52,211,153,0.45)] hover:shadow-[0_0_32px_rgba(52,211,153,0.7)] flex items-center justify-center group cursor-pointer"
            title={isPlaying ? "Tạm dừng" : "Phát nhạc"}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-slate-950" />
            ) : (
              <Play className="w-5 h-5 fill-slate-950" />
            )}
          </button>

          <button
            onClick={onNextTrack}
            className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/15 text-slate-200 hover:text-white border border-white/10 active:scale-90 transition-all shadow-sm cursor-pointer"
            title="Bài tiếp theo"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>

          <button
            onClick={onToggleLoop}
            className={`p-2 rounded-xl transition-all duration-200 active:scale-90 cursor-pointer ${
              isLooping
                ? "text-emerald-300 bg-emerald-500/20 border border-emerald-400/30 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/10"
            }`}
            title="Lặp lại bài hát"
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* UP NEXT PLAYLIST */}
      <div className="space-y-2 pb-6">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Up Next ({currentMoodTracks.length} bài)
        </h4>
        <div className="space-y-1.5">
          {currentMoodTracks.map((t) => {
            const isSelected = t.id === currentTrack.id;
            return (
              <button
                key={t.id}
                onClick={() => onSelectTrack(t)}
                className={`flex items-center gap-3 p-2 rounded-2xl w-full text-left transition-all cursor-pointer ${
                  isSelected
                    ? "bg-emerald-600/20 border border-emerald-400/40 text-emerald-300"
                    : "bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-transparent"
                }`}
              >
                <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 bg-slate-800 border border-white/10">
                  <img src={t.cover} alt={t.title} className="w-full h-full object-cover" />
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
    </>
  );
}
