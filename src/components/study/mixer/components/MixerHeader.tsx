"use client";

import { memo } from "react";
import {
  XIcon,
  MusicNotesIcon,
  CloudRainIcon,
  SpeakerXIcon,
} from "@phosphor-icons/react";
import { IconBtn } from "@/components/ui/IconBtn";
import { MixerTab } from "../types";

interface MixerHeaderProps {
  onClose: () => void;
  activeTab: MixerTab;
  onTabChange?: (tab: MixerTab) => void;
  musicCount: number;
  ambienceCount: number;
  activeAmbienceCount?: number;
  onResetAmbience?: () => void;
}

export const MixerHeader = memo(function MixerHeader({
  onClose,
  activeTab,
  musicCount,
  ambienceCount,
  activeAmbienceCount = 0,
  onResetAmbience,
}: MixerHeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 pb-3 border-b border-white/10 shrink-0">
      <div className="flex items-center gap-2">
        {activeTab === "music" ? (
          <MusicNotesIcon className="w-4 h-4 text-emerald-400" />
        ) : (
          <CloudRainIcon className="w-4 h-4 text-emerald-400" />
        )}
        <h3 className="text-base font-bold tracking-tight">
          {activeTab === "music"
            ? `Nhạc Chill (${musicCount})`
            : `Âm thanh nền (${ambienceCount})`}
        </h3>
      </div>
      <div className="flex items-center gap-1.5">
        {activeTab === "ambience" && activeAmbienceCount > 0 && onResetAmbience && (
          <button
            onClick={onResetAmbience}
            className="h-8 px-2.5 rounded-full inline-flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-rose-500/20 active:bg-rose-500/30 text-slate-200 hover:text-white border border-white/15 hover:border-rose-400/40 active:scale-95 transition-all shadow-sm cursor-pointer"
            title="Tắt tất cả âm thanh thiên nhiên đang phát"
          >
            <SpeakerXIcon className="w-3.5 h-3.5 text-rose-400" weight="bold" />
            <span>Tắt tất cả ({activeAmbienceCount})</span>
          </button>
        )}
        <IconBtn
          onClick={onClose}
          title="Đóng"
          icon={<XIcon className="w-4 h-4" />}
          className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        />
      </div>
    </div>
  );
});

