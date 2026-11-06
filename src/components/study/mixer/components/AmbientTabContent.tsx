"use client";

import { memo } from "react";
import { AMBIENT_SOUNDS } from "../../study-types";
import { AmbientSound } from "../types";
import { AMBIENT_PRESETS } from "../constants";
import { SoundTileItem } from "./SoundTileItem";
import { isPresetActive } from "../utils/sound-helpers";

const PRESET_ACTIVE_STYLES: Record<
  string,
  {
    bg: string;
    text: string;
    icon: string;
    glow: string;
  }
> = {
  "text-amber-400": {
    bg: "bg-amber-500/25 border-amber-400/80",
    text: "text-amber-200",
    icon: "text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]",
    glow: "shadow-[0_0_14px_rgba(245,158,11,0.35),inset_0_1px_1px_rgba(255,255,255,0.2)]",
  },
  "text-orange-400": {
    bg: "bg-orange-500/25 border-orange-400/80",
    text: "text-orange-200",
    icon: "text-orange-300 drop-shadow-[0_0_6px_rgba(251,146,60,0.6)]",
    glow: "shadow-[0_0_14px_rgba(249,115,22,0.35),inset_0_1px_1px_rgba(255,255,255,0.2)]",
  },
  "text-sky-400": {
    bg: "bg-sky-500/25 border-sky-400/80",
    text: "text-sky-200",
    icon: "text-sky-300 drop-shadow-[0_0_6px_rgba(56,189,248,0.6)]",
    glow: "shadow-[0_0_14px_rgba(14,165,233,0.35),inset_0_1px_1px_rgba(255,255,255,0.2)]",
  },
  "text-teal-400": {
    bg: "bg-teal-500/25 border-teal-400/80",
    text: "text-teal-200",
    icon: "text-teal-300 drop-shadow-[0_0_6px_rgba(45,212,191,0.6)]",
    glow: "shadow-[0_0_14px_rgba(20,184,166,0.35),inset_0_1px_1px_rgba(255,255,255,0.2)]",
  },
  "text-purple-400": {
    bg: "bg-purple-500/25 border-purple-400/80",
    text: "text-purple-200",
    icon: "text-purple-300 drop-shadow-[0_0_6px_rgba(192,132,252,0.6)]",
    glow: "shadow-[0_0_14px_rgba(168,85,247,0.35),inset_0_1px_1px_rgba(255,255,255,0.2)]",
  },
  "text-emerald-400": {
    bg: "bg-emerald-500/25 border-emerald-400/80",
    text: "text-emerald-200",
    icon: "text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]",
    glow: "shadow-[0_0_14px_rgba(16,185,129,0.35),inset_0_1px_1px_rgba(255,255,255,0.2)]",
  },
  "text-indigo-400": {
    bg: "bg-indigo-500/25 border-indigo-400/80",
    text: "text-indigo-200",
    icon: "text-indigo-300 drop-shadow-[0_0_6px_rgba(129,140,248,0.6)]",
    glow: "shadow-[0_0_14px_rgba(99,102,241,0.35),inset_0_1px_1px_rgba(255,255,255,0.2)]",
  },
  "text-rose-400": {
    bg: "bg-rose-500/25 border-rose-400/80",
    text: "text-rose-200",
    icon: "text-rose-300 drop-shadow-[0_0_6px_rgba(251,113,133,0.6)]",
    glow: "shadow-[0_0_14px_rgba(244,63,94,0.35),inset_0_1px_1px_rgba(255,255,255,0.2)]",
  },
};

interface AmbientTabContentProps {
  ambientVolumes: Record<string, number>;
  activeCount: number;
  onTogglePreset: (recipe: Record<string, number>) => void;
  onToggleSound: (id: string) => void;
  onVolumeChange: (id: string, val: number) => void;
  isMobile?: boolean;
}

export const AmbientTabContent = memo(function AmbientTabContent({
  ambientVolumes,
  activeCount,
  onTogglePreset,
  onToggleSound,
  onVolumeChange,
}: AmbientTabContentProps) {
  return (
    <div className="space-y-4 pb-6">
      {/* Quick Presets (4 Columns x 2 Rows Grid) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between h-5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Gợi ý phối âm nhanh
          </span>
          <span className="text-xs text-slate-400">Chạm để Bật / Tắt</span>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {AMBIENT_PRESETS.map((preset) => {
            const Icon = preset.icon;
            const isActive = isPresetActive(preset.recipe, ambientVolumes, AMBIENT_SOUNDS);
            const style = PRESET_ACTIVE_STYLES[preset.color] || {
              bg: "bg-emerald-500/25 border-emerald-400/80",
              text: "text-emerald-200",
              icon: "text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]",
              glow: "shadow-[0_0_14px_rgba(16,185,129,0.35)]",
            };

            return (
              <button
                key={preset.label}
                onClick={() => onTogglePreset(preset.recipe)}
                className={`relative flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-2xl transition-all text-center group active:scale-95 cursor-pointer backdrop-blur-md border ${
                  isActive
                    ? `${style.bg} ${style.text} ${style.glow} font-bold ring-1 ring-white/10`
                    : "bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white font-medium"
                }`}
                title={isActive ? "Bấm để tắt" : "Bấm để bật"}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? style.icon : preset.color
                  } transition-transform group-hover:scale-110`}
                />
                <span className="text-xs leading-tight truncate w-full">
                  {preset.label}
                </span>
                {isActive && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-current shadow-[0_0_6px_currentColor]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section Header for Soundboard Tiles */}
      <div className="flex items-center justify-between pt-2 border-t border-white/10 h-7">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Bộ phối âm chi tiết ({AMBIENT_SOUNDS.length} âm)
        </span>
        {activeCount > 0 ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-emerald-300">
              Đang phối <b className="font-bold">{activeCount}</b> âm thanh
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-500">Tùy chỉnh từng âm</span>
        )}
      </div>

      {/* 20 Ambient Sounds Studio Soundboard */}
      <div className="grid grid-cols-2 gap-2.5">
        {AMBIENT_SOUNDS.map((sound: AmbientSound) => {
          const vol = ambientVolumes[sound.id] || 0;
          return (
            <SoundTileItem
              key={sound.id}
              sound={sound}
              volume={vol}
              onToggle={onToggleSound}
              onVolumeChange={onVolumeChange}
            />
          );
        })}
      </div>
    </div>
  );
});
