"use client";

import { memo } from "react";
import {
  CloudRainIcon,
  LightningIcon,
  TreeEvergreenIcon,
  BirdIcon,
  FlameIcon,
  WavesIcon,
  WindIcon,
  KeyboardIcon,
  CoffeeIcon,
  FanIcon,
  TrainIcon,
  AirplaneIcon,
  CarIcon,
  DropIcon,
  PlanetIcon,
  SpeakerHighIcon,
} from "@phosphor-icons/react";
import { RangeSlider } from "@/components/ui/RangeSlider";
import { AmbientSound } from "@/components/study/mixer/types";
import { getSoundTheme } from "@/components/study/mixer/utils/sound-helpers";

interface MobileSoundTileItemProps {
  sound: AmbientSound;
  volume: number;
  onToggle: (id: string) => void;
  onVolumeChange: (id: string, val: number) => void;
}

const renderSoundIcon = (iconName: string, active: boolean) => {
  const props = { className: `w-4 h-4 ${active ? "text-emerald-400" : "text-slate-400"}` };
  switch (iconName) {
    case "CloudRain": return <CloudRainIcon {...props} />;
    case "Zap": return <LightningIcon {...props} />;
    case "Trees": return <TreeEvergreenIcon {...props} />;
    case "Bird": return <BirdIcon {...props} />;
    case "Flame": return <FlameIcon {...props} />;
    case "Waves": return <WavesIcon {...props} />;
    case "Wind": return <WindIcon {...props} />;
    case "Keyboard": return <KeyboardIcon {...props} />;
    case "Coffee": return <CoffeeIcon {...props} />;
    case "Fan": return <FanIcon {...props} />;
    case "TrainTrack": return <TrainIcon {...props} />;
    case "Plane": return <AirplaneIcon {...props} />;
    case "Car": return <CarIcon {...props} />;
    case "Droplets": return <DropIcon {...props} />;
    case "Orbit": return <PlanetIcon {...props} />;
    default: return <SpeakerHighIcon {...props} />;
  }
};

/**
 * Thẻ âm thanh thiên nhiên tối ưu gọn gàng cho Mobile:
 * Bố cục 1 hàng tinh giản (Icon + Tên + Thanh trượt + % Âm lượng),
 * giảm hơn 50% chiều cao để người dùng thấy nhiều âm thanh cùng lúc mà không phải cuộn nhiều.
 */
export const MobileSoundTileItem = memo(function MobileSoundTileItem({
  sound,
  volume,
  onToggle,
  onVolumeChange,
}: MobileSoundTileItemProps) {
  const isActive = volume > 0;
  const { activeBg, activeIconBg, accentColor } = getSoundTheme(sound);

  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all duration-200 ${
        isActive
          ? activeBg
          : "bg-white/[0.03] border-white/[0.06] active:bg-white/[0.07]"
      }`}
    >
      {/* Icon button tròn gọn 32x32 */}
      <button
        type="button"
        onClick={() => onToggle(sound.id)}
        className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center transition-all cursor-pointer active:scale-90 touch-manipulation ${
          isActive
            ? `${activeIconBg} shadow-sm`
            : "bg-white/5 active:bg-white/10 text-slate-400 active:text-white"
        }`}
        title={isActive ? "Tắt âm thanh này" : "Bật âm thanh này (60%)"}
        aria-label={`${sound.name} (${isActive ? "Đang bật" : "Đang tắt"})`}
      >
        {renderSoundIcon(sound.icon, isActive)}
      </button>

      {/* Tên âm thanh + Trạng thái */}
      <div className="w-24 sm:w-28 shrink-0 min-w-0">
        <p
          className={`text-xs font-semibold truncate leading-tight ${
            isActive ? "text-white" : "text-slate-300"
          }`}
        >
          {sound.name}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          {isActive ? (
            <div className="flex items-center gap-0.5 text-emerald-400">
              <span className="w-0.5 h-2 bg-current rounded-full animate-[bounce_0.8s_infinite_100ms]" />
              <span className="w-0.5 h-3 bg-current rounded-full animate-[bounce_0.8s_infinite_300ms]" />
              <span className="w-0.5 h-1.5 bg-current rounded-full animate-[bounce_0.8s_infinite_200ms]" />
              <span className="text-[10px] font-medium ml-1 text-emerald-300">Bật</span>
            </div>
          ) : (
            <span className="text-[10px] text-slate-500">Tắt</span>
          )}
        </div>
      </div>

      {/* Thanh trượt âm lượng trên cùng 1 hàng: touch-none chống trượt cử chỉ vuốt sheet */}
      <div className="flex-1 flex items-center gap-2 min-w-0 touch-none">
        <RangeSlider
          min={0}
          max={1}
          step={0.05}
          value={volume > 1 ? volume / 100 : volume}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onVolumeChange(sound.id, parseFloat(e.target.value))
          }
          className={`w-full ${
            isActive
              ? `bg-white/20 ${accentColor}`
              : "bg-white/10 accent-slate-500 opacity-60"
          }`}
        />
        <span
          className={`text-[10px] font-mono w-7 text-right shrink-0 ${
            isActive ? "text-slate-200 font-semibold" : "text-slate-500"
          }`}
        >
          {Math.round((volume > 1 ? volume / 100 : volume) * 100)}%
        </span>
      </div>
    </div>
  );
});
