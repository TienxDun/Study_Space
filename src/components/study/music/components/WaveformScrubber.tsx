"use client";

import { useState, useRef } from "react";
import { Volume1, Volume2, VolumeX } from "lucide-react";
import { formatTime } from "../utils/time-format";
import { useSiriWaveform } from "../hooks/useSiriWaveform";

interface WaveformScrubberProps {
  currentTime: number;
  duration: number;
  isActive: boolean;
  onSeek: (time: number) => void;
  effectiveVolume?: number;
  onVolumeChange?: (val: number) => void;
  isGlobalMuted?: boolean;
  onToggleMute?: () => void;
}

export function WaveformScrubber({
  currentTime,
  duration,
  isActive,
  onSeek,
  effectiveVolume,
  onVolumeChange,
  isGlobalMuted,
  onToggleMute,
}: WaveformScrubberProps) {
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPositionRatio, setHoverPositionRatio] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Mirror hover vào ref để vòng vẽ canvas đọc được mà không cần re-render.
  const hoverRatioRef = useRef<number | null>(null);
  hoverRatioRef.current = hoverPositionRatio;

  const maxSeek = duration > 0 ? duration : 100;
  const hasVolumeControl = Boolean(onVolumeChange && onToggleMute);

  useSiriWaveform({
    canvasRef,
    isActive,
    getProgress: () => (duration > 0 ? currentTime / duration : 0),
    getHoverRatio: () => hoverRatioRef.current,
  });

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 w-full max-w-[270px] sm:max-w-[290px] px-1 select-none">
      {/* Current Time */}
      <span className="text-[10px] font-mono text-slate-400 w-7 text-left shrink-0">
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
        className="relative flex-1 h-3.5 sm:h-4 px-0.5 group/waveform cursor-pointer"
      >
        {/* Siri waveform canvas: sóng thật từ analyser, fallback synth */}
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {/* Floating Time Scrubber Tooltip */}
        {hoverTime !== null && hoverPositionRatio !== null && (
          <div
            style={{ left: `${hoverPositionRatio * 100}%` }}
            className="absolute -top-6 -translate-x-1/2 px-1.5 py-0.5 rounded bg-panel/95 text-[10px] font-mono font-bold text-accent-music-bright border border-line/20 shadow-lg pointer-events-none z-30"
          >
            {formatTime(hoverTime)}
          </div>
        )}

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

      {/* Duration Time */}
      <span className="text-[10px] font-mono text-slate-400 w-7 shrink-0 text-right">
        {duration > 0 ? formatTime(duration) : "0:00"}
      </span>

      {/* Subtle Divider */}
      {hasVolumeControl && (
        <div className="w-[1px] h-2.5 bg-white/20 shrink-0 mx-0.5" aria-hidden="true" />
      )}

      {/* Volume Control Button & Expandable Slider placed right next to duration */}
      {hasVolumeControl && (
        <div className="group/vol flex items-center shrink-0">
          <button
            onClick={onToggleMute}
            aria-label={isGlobalMuted ? "Bật âm thanh không gian" : "Tắt toàn bộ âm thanh"}
            aria-pressed={Boolean(isGlobalMuted)}
            className="w-5 h-5 sm:w-6 sm:h-6 rounded-full text-slate-400 hover:text-white focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80 glass-hover transition-all active:scale-90 cursor-pointer flex items-center justify-center shrink-0"
            title={isGlobalMuted ? "Bật âm thanh không gian (M)" : "Tắt toàn bộ âm thanh (M)"}
          >
            {isGlobalMuted || (effectiveVolume ?? 0) === 0 ? (
              <VolumeX className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-400" />
            ) : (effectiveVolume ?? 0) < 0.5 ? (
              <Volume1 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent-music-glow" />
            ) : (
              <Volume2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent-music-glow" />
            )}
          </button>

          {/* Expandable slider: hover chuột + focus bàn phím + luôn hiện trên cảm ứng */}
          <div className="w-0 opacity-0 overflow-hidden transition-all duration-300 ease-out flex items-center group-hover/vol:w-12 group-hover/vol:opacity-100 group-focus-within/vol:w-12 group-focus-within/vol:opacity-100 focus-within:w-12 focus-within:opacity-100 sm:group-hover/vol:w-14 sm:group-focus-within/vol:w-14 sm:focus-within:w-14 [@media(hover:none)]:w-12 [@media(hover:none)]:opacity-100 [@media(hover:none)]:overflow-visible max-sm:w-12 max-sm:opacity-100 max-sm:overflow-visible">
            <div className="relative flex items-center h-6 min-w-12 sm:min-w-14 cursor-pointer pl-1">
              <div className="w-full h-1 sm:h-1.5 rounded-full bg-white/20 overflow-hidden backdrop-blur-xs">
                <div
                  className={`h-full rounded-full transition-all duration-75 ${
                    isGlobalMuted
                      ? "bg-slate-600 w-0"
                      : "bg-gradient-to-r from-accent-music to-accent-music-glow shadow-[0_0_8px_rgba(52,211,153,0.7)]"
                  }`}
                  style={{ width: `${isGlobalMuted ? 0 : (effectiveVolume ?? 0) * 100}%` }}
                />
              </div>

              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isGlobalMuted ? 0 : (effectiveVolume ?? 0)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onVolumeChange?.(parseFloat(e.target.value))
                }
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80 focus-visible:rounded"
                aria-label="Điều chỉnh âm lượng nhạc"
                aria-valuetext={`${Math.round((isGlobalMuted ? 0 : (effectiveVolume ?? 0)) * 100)} phần trăm`}
                title="Điều chỉnh âm lượng nhạc"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
