"use client";

import { useRef, useEffect, useMemo, memo } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import { SoundMixerWidgetProps, Track } from "./types";
import { STUDY_TRACKS_BY_MOOD, AMBIENT_SOUNDS } from "../study-types";
import { MixerHeader } from "./components/MixerHeader";
import { MusicTabContent } from "./components/MusicTabContent";
import { AmbientTabContent } from "./components/AmbientTabContent";

const EMPTY_TRACKS: Track[] = [];

/**
 * Bảng phối âm thanh & Nhạc Chill dành cho Desktop.
 * Hiển thị dạng Modal nổi bên cạnh Dock âm thanh ở góc dưới màn hình.
 */
export const SoundMixerWidget = memo(function SoundMixerWidget({
  isOpen,
  onClose,
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
}: SoundMixerWidgetProps) {
  const popupRef = useRef<HTMLDivElement | null>(null);

  // Tự động đóng popup Sound Mixer khi bấm vào bất kỳ vị trí nào bên ngoài popup trên Desktop
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      const dock = document.getElementById("audio-control-dock");
      if (dock && dock.contains(target)) return;

      // Không đóng nếu click/touch bên trong desktop popup
      if (popupRef.current && popupRef.current.contains(target)) return;

      onClose();
    };

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handlePointerDown);
      document.addEventListener("touchstart", handlePointerDown);
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen, onClose]);

  const currentMoodTracks = useMemo(
    () => STUDY_TRACKS_BY_MOOD[currentMood] || EMPTY_TRACKS,
    [currentMood]
  );

  return (
    <div className="hidden sm:contents">
      <ModalShell
        isOpen={isOpen}
        onClose={onClose}
        panelKey="sound-mixer"
        panelRef={popupRef}
        initial={{ opacity: 0, x: 20, scale: 0.97 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 16, scale: 0.97 }}
        panelClassName="hidden sm:flex fixed top-16 bottom-[84px] right-3.5 z-50 w-[420px] max-w-[calc(100vw-24px)] flex-col glass-panel hover:bg-black/45 text-white overflow-hidden"
        backdropClassName="hidden sm:block"
      >
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none z-10" />
        <MixerHeader
          onClose={onClose}
          activeTab={activeTab}
          onTabChange={onTabChange}
          musicCount={currentMoodTracks.length}
          ambienceCount={AMBIENT_SOUNDS.length}
          activeAmbienceCount={activeCount}
          onResetAmbience={resetAllSounds}
        />
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-study-scroll">
          {activeTab === "music" ? (
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
              isMobile={false}
            />
          ) : (
            <AmbientTabContent
              ambientVolumes={ambientVolumes}
              activeCount={activeCount}
              onTogglePreset={handleTogglePreset}
              onToggleSound={toggleSound}
              onVolumeChange={handleSoundVolume}
              isMobile={false}
            />
          )}
        </div>
      </ModalShell>
    </div>
  );
});
