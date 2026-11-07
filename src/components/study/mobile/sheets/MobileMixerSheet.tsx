"use client";

import { useRef, useMemo, memo } from "react";
import { MusicNotesIcon, CloudRainIcon, SpeakerXIcon } from "@phosphor-icons/react";
import { MobileSheetShell } from "./core/MobileSheetShell";
import { MixerTab, Track, MoodType } from "../../mixer/types";
import { STUDY_TRACKS_BY_MOOD } from "../../study-types";
import { MusicTabContent } from "../../mixer/components/MusicTabContent";
import { AmbientTabContent } from "../../mixer/components/AmbientTabContent";

const EMPTY_TRACKS: Track[] = [];

export interface MobileMixerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  backLabel?: string;
  activeTab: MixerTab;
  onTabChange: (tab: MixerTab) => void;
  currentMood: MoodType;
  onSelectMood: (mood: MoodType) => void;
  currentTrack: Track;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onSelectTrack: (track: Track) => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  isLooping: boolean;
  onToggleLoop: () => void;
  ambientVolumes: Record<string, number>;
  activeCount: number;
  toggleSound: (id: string) => void;
  handleSoundVolume: (id: string, volume: number) => void;
  resetAllSounds: () => void;
  handleTogglePreset: (recipe: Record<string, number>) => void;
}

/**
 * Bottom Sheet âm thanh và nhạc Chill dành riêng cho Mobile.
 * Thiết kế công thái học dạng vuốt trượt kính mờ, tối ưu thao tác bằng ngón tay cái.
 */
export const MobileMixerSheet = memo(function MobileMixerSheet({
  isOpen,
  onClose,
  onBack,
  backLabel,
  activeTab,
  onTabChange,
  currentMood,
  onSelectMood,
  currentTrack,
  isPlaying,
  onTogglePlay,
  onNextTrack,
  onPrevTrack,
  onSelectTrack,
  currentTime,
  duration,
  onSeek,
  isShuffle,
  onToggleShuffle,
  isLooping,
  onToggleLoop,
  ambientVolumes,
  activeCount,
  toggleSound,
  handleSoundVolume,
  resetAllSounds,
  handleTogglePreset,
}: MobileMixerSheetProps) {
  const mobileSheetRef = useRef<HTMLDivElement | null>(null);

  const currentMoodTracks = useMemo(
    () => STUDY_TRACKS_BY_MOOD[currentMood] || EMPTY_TRACKS,
    [currentMood]
  );

  const tabContent = activeTab === "music" ? (
    <MusicTabContent
      currentMood={currentMood}
      onSelectMood={onSelectMood}
      currentTrack={currentTrack}
      isPlaying={isPlaying}
      onTogglePlay={onTogglePlay}
      onNextTrack={onNextTrack}
      onPrevTrack={onPrevTrack}
      onSelectTrack={onSelectTrack}
      currentTime={currentTime}
      duration={duration}
      onSeek={onSeek}
      isShuffle={isShuffle}
      onToggleShuffle={onToggleShuffle}
      isLooping={isLooping}
      onToggleLoop={onToggleLoop}
      currentMoodTracks={currentMoodTracks}
      isMobile={true}
    />
  ) : (
    <AmbientTabContent
      ambientVolumes={ambientVolumes}
      activeCount={activeCount}
      onTogglePreset={handleTogglePreset}
      onToggleSound={toggleSound}
      onVolumeChange={handleSoundVolume}
      isMobile={true}
    />
  );

  return (
    <MobileSheetShell
      isOpen={isOpen}
      onClose={onClose}
      onBack={onBack}
      backLabel={backLabel}
      sheetId="mixer"
      title="Âm thanh & Nhạc Chill"
      panelRef={mobileSheetRef}
      heightClassName="h-[68dvh] max-h-[72dvh]"
      onSwipeLeft={() => onTabChange("ambience")}
      onSwipeRight={() => onTabChange("music")}
      headerRight={
        activeTab === "ambience" && activeCount > 0 ? (
          <button
            type="button"
            onClick={resetAllSounds}
            className="h-8 px-2.5 rounded-full inline-flex items-center gap-1.5 text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-400/30 active:scale-95 transition-all shadow-sm cursor-pointer touch-manipulation"
            title="Tắt tất cả âm thanh thiên nhiên"
            aria-label="Tắt tất cả âm thanh thiên nhiên"
          >
            <SpeakerXIcon className="w-3.5 h-3.5" weight="bold" />
            <span>Tắt hết ({activeCount})</span>
          </button>
        ) : undefined
      }
      footer={
        /* Thanh gạt chuyển Tab công thái học (Segmented Control) tinh gọn ở đáy */
        <div className="p-2.5 select-none">
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-black/40 border border-white/10">
            <button
              type="button"
              onClick={() => onTabChange("music")}
              className={`py-2 rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                activeTab === "music"
                  ? "bg-white/15 text-white font-semibold shadow-sm"
                  : "text-white/60 hover:text-white font-medium"
              }`}
            >
              <MusicNotesIcon className="w-4 h-4" />
              <span>Nhạc Chill ({currentMoodTracks.length})</span>
            </button>
            <button
              type="button"
              onClick={() => onTabChange("ambience")}
              className={`py-2 rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                activeTab === "ambience"
                  ? "bg-white/15 text-white font-semibold shadow-sm"
                  : "text-white/60 hover:text-white font-medium"
              }`}
            >
              <CloudRainIcon className="w-4 h-4" />
              <span>Âm thanh nền {activeCount > 0 ? `(${activeCount})` : ""}</span>
            </button>
          </div>
        </div>
      }
    >
      {/* Nội dung Tab cuộn mượt mà - hỗ trợ vuốt ở cả nội dung lẫn khoảng trống */}
      <div className="flex-1 px-3 pt-2 pb-3 space-y-3">
        {tabContent}
      </div>
    </MobileSheetShell>
  );
});
