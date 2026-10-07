"use client";

import { useState } from "react";
import { formatTime } from "../utils/time-format";

interface WaveformScrubberProps {
  currentTime: number;
  duration: number;
  frequencyData: number[];
  isPlaying: boolean;
  onSeek: (time: number) => void;
}

export function WaveformScrubber({
  currentTime,
  duration,
  frequencyData,
  isPlaying,
  onSeek,
}: WaveformScrubberProps) {
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPositionRatio, setHoverPositionRatio] = useState<number | null>(null);

  const maxSeek = duration > 0 ? duration : 100;

  return (
    <div className="hidden md:flex items-center gap-2.5 flex-1 min-w-[160px] px-2">
      <span className="text-[11px] font-mono text-slate-400 w-8 text-right shrink-0">
        {formatTime(currentTime)}
      </span>

      {/* Waveform Visualization Container with Hover Scrubber */}
      <div
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
          const ratio = x / rect.width;
          setHoverPositionRatio(ratio);
          setHoverTime(ratio * maxSeek);
        }}
        onMouseLeave={() => {
          setHoverPositionRatio(null);
          setHoverTime(null);
        }}
        className="relative w-full h-8 flex items-center justify-between gap-[2px] px-1 group/waveform cursor-pointer"
      >
        {/* Floating Time Scrubber Tooltip */}
        {hoverTime !== null && hoverPositionRatio !== null && (
          <div
            style={{ left: `${hoverPositionRatio * 100}%` }}
            className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded-md bg-panel/95 text-[10px] font-mono font-bold text-accent-music-bright border border-line/20 shadow-lg pointer-events-none z-30"
          >
            {formatTime(hoverTime)}
          </div>
        )}

        {/* Frequency Bars */}
        {frequencyData.map((heightPercent, idx) => {
          const progressRatio = duration > 0 ? currentTime / duration : 0;
          const barRatio = idx / (frequencyData.length - 1);
          const isPlayed = barRatio <= progressRatio;
          const isHovered = hoverPositionRatio !== null && barRatio <= hoverPositionRatio;

          return (
            <div key={`freq-${idx}`} className="flex-1 flex items-center justify-center h-full">
              <span
                style={{
                  height: isPlaying ? `${heightPercent}%` : "20%",
                }}
                className={`w-full max-w-[3.5px] rounded-full will-change-[height] ${
                  isPlayed
                    ? "bg-gradient-to-t from-accent-music to-accent-music-bright shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                    : isHovered
                    ? "bg-accent-music-glow/60"
                    : "bg-white/20 group-hover/waveform:bg-white/35"
                }`}
              />
            </div>
          );
        })}

        {/* Invisible native range input for smooth seeking */}
        <input
          type="range"
          min={0}
          max={maxSeek}
          value={currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          title="Kéo hoặc bấm để tua bài hát"
        />
      </div>

      <span className="text-[11px] font-mono text-slate-400 w-8 shrink-0">
        {duration > 0 ? formatTime(duration) : "0:00"}
      </span>
    </div>
  );
}
