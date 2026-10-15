"use client";

import { useState, useRef, useEffect } from "react";
import { MusicNotesIcon, CloudRainIcon, SpeakerXIcon } from "@phosphor-icons/react";
import { ModalShell } from "@/components/ui/ModalShell";
import { SoundMixerWidgetProps, MixerTab } from "./types";
import { STUDY_TRACKS_BY_MOOD, AMBIENT_SOUNDS } from "../study-types";
import { useAmbientAudio } from "./hooks/useAmbientAudio";
import { MixerHeader } from "./components/MixerHeader";
import { MusicTabContent } from "./components/MusicTabContent";
import { AmbientTabContent } from "./components/AmbientTabContent";
import { MobileSheetShell } from "../mobile/sheets/MobileSheetShell";

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
  const mobileSheetRef = useRef<HTMLDivElement | null>(null);

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

      // Không đóng nếu click/touch bên trong desktop popup hoặc mobile sheet
      if (popupRef.current && popupRef.current.contains(target)) return;
      if (mobileSheetRef.current && mobileSheetRef.current.contains(target)) return;

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

  const currentMoodTracks = STUDY_TRACKS_BY_MOOD[currentMood] || [];

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
    />
  ) : (
    <AmbientTabContent
      ambientVolumes={ambientVolumes}
      activeCount={activeCount}
      onTogglePreset={handleTogglePreset}
      onToggleSound={toggleSound}
      onVolumeChange={handleSoundVolume}
    />
  );

  return (
    <>
      {/* Phiên bản Desktop (Modal nổi bên phải) */}
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
            onTabChange={setActiveTab}
            musicCount={currentMoodTracks.length}
            ambienceCount={AMBIENT_SOUNDS.length}
            activeAmbienceCount={activeCount}
            onResetAmbience={resetAllSounds}
          />
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-study-scroll">
            {tabContent}
          </div>
        </ModalShell>
      </div>

      {/* Phiên bản Mobile (Bottom Sheet trượt đáy Liquid Glass) */}
      <MobileSheetShell
        isOpen={isOpen}
        onClose={onClose}
        title="Âm thanh & Nhạc Chill"
        panelRef={mobileSheetRef}
        heightClassName="h-[80dvh] max-h-[85dvh]"
        onSwipeLeft={() => setActiveTab("ambience")}
        onSwipeRight={() => setActiveTab("music")}
        headerRight={
          activeTab === "ambience" && activeCount > 0 ? (
            <button
              type="button"
              onClick={resetAllSounds}
              className="h-7 px-2.5 rounded-full inline-flex items-center gap-1.5 text-[11px] font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-400/30 active:scale-95 transition-all shadow-xs"
              title="Tắt tất cả âm thanh thiên nhiên"
            >
              <SpeakerXIcon className="w-3.5 h-3.5" />
              <span>Tắt hết ({activeCount})</span>
            </button>
          ) : undefined
        }
        footer={
          /* Bộ chuyển Tab lớn công thái học Thumb-Zone ghim ở đáy */
          <div className="p-2.5 select-none">
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-white/[0.06] border border-white/[0.1] shadow-inner">
              <button
                type="button"
                onClick={() => setActiveTab("music")}
                className={`py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                  activeTab === "music"
                    ? "bg-white text-black font-bold shadow-md"
                    : "text-white/70 hover:text-white"
                }`}
              >
                <MusicNotesIcon className="w-4 h-4" />
                <span>Nhạc Chill ({currentMoodTracks.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ambience")}
                className={`py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                  activeTab === "ambience"
                    ? "bg-white text-black font-bold shadow-md"
                    : "text-white/70 hover:text-white"
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
        <div className="flex-1 px-3 pt-2 pb-3 space-y-4">
          {tabContent}
        </div>
      </MobileSheetShell>
    </>
  );
};
