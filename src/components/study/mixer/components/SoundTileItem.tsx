"use client";

import {
  CloudRain,
  Zap,
  Trees,
  Bird,
  Flame,
  Waves,
  Wind,
  Keyboard,
  Coffee,
  Fan,
  TrainTrack,
  Plane,
  Car,
  Droplets,
  Orbit,
  Volume2,
} from "lucide-react";
import { RangeSlider } from "@/components/ui/RangeSlider";
import { AmbientSound } from "../types";
import { getSoundTheme } from "../utils/sound-helpers";

interface SoundTileItemProps {
  sound: AmbientSound;
  volume: number;
  onToggle: (id: string) => void;
  onVolumeChange: (id: string, val: number) => void;
}

const renderSoundIcon = (iconName: string, active: boolean) => {
  const props = { className: `w-4 h-4 ${active ? "text-emerald-400" : "text-slate-400"}` };
  switch (iconName) {
    case "CloudRain": return <CloudRain {...props} />;
    case "Zap": return <Zap {...props} />;
    case "Trees": return <Trees {...props} />;
    case "Bird": return <Bird {...props} />;
    case "Flame": return <Flame {...props} />;
    case "Waves": return <Waves {...props} />;
    case "Wind": return <Wind {...props} />;
    case "Keyboard": return <Keyboard {...props} />;
    case "Coffee": return <Coffee {...props} />;
    case "Fan": return <Fan {...props} />;
    case "TrainTrack": return <TrainTrack {...props} />;
    case "Plane": return <Plane {...props} />;
    case "Car": return <Car {...props} />;
    case "Droplets": return <Droplets {...props} />;
    case "Orbit": return <Orbit {...props} />;
    default: return <Volume2 {...props} />;
  }
};

export function SoundTileItem({
  sound,
  volume,
  onToggle,
  onVolumeChange,
}: SoundTileItemProps) {
  const isActive = volume > 0;
  const { activeBg, activeIconBg, accentColor } = getSoundTheme(sound);

  return (
    <div
      className={`flex flex-col justify-between p-2.5 rounded-2xl border transition-all duration-300 ${
        isActive
          ? activeBg
          : "bg-white/5 border-white/5 hover:border-white/15 hover:bg-white/8"
      }`}
    >
      {/* Top row: Icon button + Sound Name + Equalizer */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => onToggle(sound.id)}
          className={`p-2 rounded-xl transition-all border shrink-0 cursor-pointer ${
            isActive
              ? `${activeIconBg} scale-105 shadow-md`
              : "bg-white/5 hover:bg-white/10 border-white/5 text-slate-400 hover:text-white"
          }`}
          title={isActive ? "Tắt âm thanh này" : "Bật âm thanh này (60%)"}
        >
          {renderSoundIcon(sound.icon, isActive)}
        </button>

        <div className="min-w-0 flex-1">
          <p
            className={`text-xs font-bold truncate leading-tight ${
              isActive ? "text-white" : "text-slate-300"
            }`}
          >
            {sound.name}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            {isActive ? (
              <div className="flex items-center gap-0.5 text-emerald-400">
                <span className="w-0.5 h-2.5 bg-current rounded-full animate-[bounce_0.8s_infinite_100ms]" />
                <span className="w-0.5 h-3.5 bg-current rounded-full animate-[bounce_0.8s_infinite_300ms]" />
                <span className="w-0.5 h-2 bg-current rounded-full animate-[bounce_0.8s_infinite_200ms]" />
                <span className="text-xs font-semibold ml-1 text-emerald-300">Phát</span>
              </div>
            ) : (
              <span className="text-xs text-slate-500">Tắt</span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row: Mini Slider & Volume Percent */}
      <div className="flex items-center gap-2 pt-1 border-t border-white/5">
        <RangeSlider
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onVolumeChange(sound.id, parseFloat(e.target.value))
          }
          className={`w-full ${
            isActive
              ? `bg-white/20 hover:bg-white/30 ${accentColor}`
              : "bg-white/10 hover:bg-white/20 accent-slate-500 opacity-50"
          }`}
        />
        <span
          className={`text-[10px] font-mono font-semibold w-7 text-right ${
            isActive ? "text-white" : "text-slate-500"
          }`}
        >
          {Math.round(volume * 100)}%
        </span>
      </div>
    </div>
  );
}
