"use client";

import { VolumeX } from "lucide-react";
import { AMBIENT_SOUNDS } from "../../study-types";
import { AmbientSound } from "../types";
import { AMBIENT_PRESETS } from "../constants";
import { SoundTileItem } from "./SoundTileItem";
import { isPresetActive } from "../utils/sound-helpers";

interface AmbientTabContentProps {
  ambientVolumes: Record<string, number>;
  activeCount: number;
  onResetAll: () => void;
  onTogglePreset: (recipe: Record<string, number>) => void;
  onToggleSound: (id: string) => void;
  onVolumeChange: (id: string, val: number) => void;
}

export function AmbientTabContent({
  ambientVolumes,
  activeCount,
  onResetAll,
  onTogglePreset,
  onToggleSound,
  onVolumeChange,
}: AmbientTabContentProps) {
  return (
    <div className="space-y-4 pb-2">
      {/* Header Info & Active Count & Reset */}
      <div className="flex items-center justify-between pb-1 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300">Âm thanh thiên nhiên</span>
          {activeCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/30 animate-pulse">
              Đang bật {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            onClick={onResetAll}
            className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 hover:underline transition-colors flex items-center gap-1 cursor-pointer"
          >
            <VolumeX className="w-3 h-3" />
            Tắt tất cả
          </button>
        )}
      </div>

      {/* Quick Presets (4 Columns x 2 Rows Grid) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Gợi ý phối âm nhanh
          </span>
          <span className="text-[10px] text-slate-500">Chạm để Bật / Tắt</span>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {AMBIENT_PRESETS.map((preset) => {
            const Icon = preset.icon;
            const isActive = isPresetActive(preset.recipe, ambientVolumes, AMBIENT_SOUNDS);

            return (
              <button
                key={preset.label}
                onClick={() => onTogglePreset(preset.recipe)}
                className={`relative flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-2xl border transition-all text-center group active:scale-95 shadow-sm cursor-pointer ${
                  isActive
                    ? "bg-emerald-500/25 border-emerald-400/60 text-emerald-300 ring-1 ring-emerald-400/40 shadow-[0_0_12px_rgba(52,211,153,0.3)] font-bold"
                    : "bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20 text-slate-300 hover:text-white font-medium"
                }`}
                title={isActive ? "Bấm để tắt" : "Bấm để bật"}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? "text-emerald-400" : preset.color
                  } transition-transform group-hover:scale-110`}
                />
                <span className="text-[11px] leading-tight truncate w-full">
                  {preset.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section Header for Soundboard Tiles */}
      <div className="flex items-center justify-between pt-2 border-t border-white/10">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Bộ phối âm chi tiết ({AMBIENT_SOUNDS.length} âm)
        </span>
        {activeCount > 0 && (
          <span className="text-[10px] text-slate-400">
            Đang kích hoạt <b className="text-emerald-400">{activeCount}</b> âm thanh
          </span>
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
}
