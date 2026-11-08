"use client";

import { memo } from "react";
import { AMBIENT_SOUNDS } from "@/components/study/study-types";
import { AMBIENT_PRESETS } from "@/components/study/mixer/constants";
import { isPresetActive } from "@/components/study/mixer/utils/sound-helpers";
import { MobileSoundTileItem } from "./MobileSoundTileItem";

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

interface MobileAmbientTabContentProps {
  ambientVolumes: Record<string, number>;
  onTogglePreset: (recipe: Record<string, number>) => void;
  onToggleSound: (id: string) => void;
  onVolumeChange: (id: string, val: number) => void;
}

/**
 * Tab phối âm thanh thiên nhiên cho Mobile.
 * Hỗ trợ các phối cảnh nhanh bằng một chạm và danh sách âm thanh dạng thẻ kép.
 */
export const MobileAmbientTabContent = memo(function MobileAmbientTabContent({
  ambientVolumes,
  onTogglePreset,
  onToggleSound,
  onVolumeChange,
}: MobileAmbientTabContentProps) {
  return (
    <div className="space-y-4 pb-6 select-none">
      {/* Gợi ý phối âm nhanh (Grid 4 cột tối ưu ngón tay) */}
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
              icon: "text-emerald-300",
              glow: "shadow-[0_0_14px_rgba(52,211,153,0.35)]",
            };

            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => onTogglePreset(preset.recipe)}
                className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all cursor-pointer active:scale-95 touch-manipulation border ${
                  isActive
                    ? `${style.bg} ${style.glow} font-bold ring-1 ring-white/10`
                    : "bg-white/5 active:bg-white/10 border-white/5 text-slate-300"
                }`}
                title={preset.label}
              >
                <Icon
                  className={`w-4 h-4 mb-1 transition-transform ${
                    isActive ? `${style.icon} scale-110` : preset.color
                  }`}
                  weight={isActive ? "fill" : "regular"}
                />
                <span
                  className={`text-[10px] truncate max-w-full leading-tight ${
                    isActive ? `${style.text} font-bold` : "text-slate-400"
                  }`}
                >
                  {preset.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Danh sách thẻ âm thanh thiên nhiên */}
      <div className="space-y-2">
        <div className="flex items-center justify-between h-5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Âm thanh thiên nhiên ({AMBIENT_SOUNDS.length})
          </span>
          <span className="text-xs text-slate-400">Kéo để chỉnh âm</span>
        </div>

        <div className="space-y-1.5">
          {AMBIENT_SOUNDS.map((sound) => (
            <MobileSoundTileItem
              key={sound.id}
              sound={sound}
              volume={ambientVolumes[sound.id] || 0}
              onToggle={onToggleSound}
              onVolumeChange={onVolumeChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
});
