"use client";

import { useState, useRef, useEffect } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import { SoundMixerWidgetProps, MixerTab } from "./types";
import { STUDY_TRACKS_BY_MOOD, AMBIENT_SOUNDS } from "../study-types";
import { useAmbientAudio } from "./hooks/useAmbientAudio";
import { MixerHeader } from "./components/MixerHeader";
import { MusicTabContent } from "./components/MusicTabContent";
import { AmbientTabContent } from "./components/AmbientTabContent";

export const SoundMixerWidget = ({
  isOpen,
  onClose,
  activeTab: externalActiveTab,
  onTabChange: externalOnTabChange,
  onAmbientActiveCountChange,
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
  isGlobalMuted,
}: SoundMixerWidgetProps) => {
  const [internalActiveTab, setInternalActiveTab] = useState<MixerTab>("music");
  const activeTab = externalActiveTab !== undefined ? externalActiveTab : internalActiveTab;
  const setActiveTab = externalOnTabChange || setInternalActiveTab;
  const popupRef = useRef<HTMLDivElement | null>(null);

  const {
    ambientVolumes,
    activeCount,
    toggleSound,
    handleSoundVolume,
    resetAllSounds,
    handleTogglePreset,
  } = useAmbientAudio({ isGlobalMuted });

  // Đồng bộ số lượng âm thanh môi trường đang bật ra bên ngoài
  useEffect(() => {
    onAmbientActiveCountChange?.(activeCount);
  }, [activeCount, onAmbientActiveCountChange]);

  // Tự động đóng popup Sound Mixer khi bấm vào bất kỳ vị trí nào bên ngoài popup
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      const dock = document.getElementById("audio-control-dock");
      if (dock && dock.contains(target)) return;

      if (popupRef.current && !popupRef.current.contains(target)) {
        onClose();
      }
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

  const currentMoodTracks = STUDY_TRACKS_BY_MOOD[currentMood] || [];

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      panelKey="sound-mixer"
      panelRef={popupRef}
      initial={{ opacity: 0, x: 20, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 16, scale: 0.97 }}
      panelClassName="fixed top-16 bottom-[80px] sm:bottom-[84px] right-3 sm:right-3.5 z-50 w-[390px] sm:w-[420px] max-w-[calc(100vw-24px)] flex flex-col rounded-3xl bg-[#0b0f17]/95 backdrop-blur-xl border border-white/15 shadow-[0_25px_60px_rgba(0,0,0,0.7)] text-white overflow-hidden"
    >
      <MixerHeader
        onClose={onClose}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        musicCount={currentMoodTracks.length}
        ambienceCount={AMBIENT_SOUNDS.length}
        activeAmbienceCount={activeCount}
        onResetAmbience={resetAllSounds}
      />

      {/* Tab Content */}
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
          />
        ) : (
          <AmbientTabContent
            ambientVolumes={ambientVolumes}
            activeCount={activeCount}
            onTogglePreset={handleTogglePreset}
            onToggleSound={toggleSound}
            onVolumeChange={handleSoundVolume}
          />
        )}
      </div>
    </ModalShell>
  );
};
