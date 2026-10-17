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
            className="h-8 px-2.5 rounded-full inline-flex items-center gap-1.5 text-xs font-medium bg-white/[0.06] hover:bg-rose-500/15 text-slate-300 hover:text-rose-300 border border-white/10 hover:border-rose-400/30 transition-all active:scale-95 cursor-pointer"
            title="Tắt tất cả âm thanh thiên nhiên đang phát"
          >
            <SpeakerXIcon className="w-3.5 h-3.5" />
            <span>Tắt tất cả</span>
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

