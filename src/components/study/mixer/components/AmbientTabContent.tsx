"use client";

import { memo } from "react";
import { AMBIENT_SOUNDS } from "../../study-types";
import { AmbientSound } from "../types";
import { AMBIENT_PRESETS } from "../constants";
import { SoundTileItem } from "./SoundTileItem";
import { isPresetActive } from "../utils/sound-helpers";

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
  isMobile = false,
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

            return (
              <button
                key={preset.label}
                onClick={() => onTogglePreset(preset.recipe)}
                className={`relative flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-2xl transition-all text-center group active:scale-95 cursor-pointer ${
                  isActive
                    ? isMobile
                      ? "lg-tab-active"
                      : "border shadow-sm bg-emerald-500/25 border-emerald-400/60 text-emerald-300 ring-1 ring-emerald-400/40 shadow-[0_0_12px_rgba(52,211,153,0.3)] font-bold"
                    : "lg-tab-inactive"
                }`}
                title={isActive ? "Bấm để tắt" : "Bấm để bật"}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? (isMobile ? "text-white" : "text-emerald-400") : preset.color
                  } transition-transform group-hover:scale-110`}
                />
                <span className="text-xs leading-tight truncate w-full">
                  {preset.label}
                </span>
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
