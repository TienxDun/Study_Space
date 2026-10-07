"use client";

import { Sliders, X, Music2, CloudRain } from "lucide-react";
import { IconBtn } from "@/components/ui/IconBtn";
import { PillButton } from "@/components/ui/PillButton";
import { MixerTab } from "../types";

interface MixerHeaderProps {
  onClose: () => void;
  activeTab: MixerTab;
  onTabChange: (tab: MixerTab) => void;
  musicCount: number;
  ambienceCount: number;
}

export function MixerHeader({
  onClose,
  activeTab,
  onTabChange,
  musicCount,
  ambienceCount,
}: MixerHeaderProps) {
  return (
    <>
      {/* Header Bar */}
      <div className="flex items-center justify-between p-4 pb-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <h3 className="text-base font-bold tracking-tight">Sound Mixer</h3>
        </div>
        <IconBtn
          onClick={onClose}
          title="Đóng"
          icon={<X className="w-4 h-4" />}
          className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        />
      </div>

      {/* View Tabs: Nhạc nền (Music) vs Âm thanh môi trường (Ambience) */}
      <div className="flex items-center gap-1.5 p-1 mx-4 mt-3 bg-black/40 rounded-2xl border border-white/10 shrink-0">
        <PillButton
          onClick={() => onTabChange("music")}
          active={activeTab === "music"}
          activeClassName="bg-emerald-600 text-white shadow-md"
          className="flex-1 text-xs font-bold flex items-center justify-center gap-1.5"
        >
          <Music2 className="w-3.5 h-3.5" />
          Nhạc Chill ({musicCount})
        </PillButton>
        <PillButton
          onClick={() => onTabChange("ambience")}
          active={activeTab === "ambience"}
          activeClassName="bg-emerald-600 text-white shadow-md"
          className="flex-1 text-xs font-bold flex items-center justify-center gap-1.5"
        >
          <CloudRain className="w-3.5 h-3.5" />
          Âm thanh nền ({ambienceCount})
        </PillButton>
      </div>
    </>
  );
}
