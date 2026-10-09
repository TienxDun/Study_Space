"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { StudyMusicPlayerProps } from "./types";
import { SoundMixerWidget } from "../mixer/SoundMixerWidget";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import { useWaveformSynthesizer } from "./hooks/useWaveformSynthesizer";
import { useYouTubeRemote } from "@/lib/youtube-remote";
import { VinylArtworkBadge } from "./components/VinylArtworkBadge";
import { WaveformScrubber } from "./components/WaveformScrubber";
import { PlayerControls } from "./components/PlayerControls";
import { MiniPlayerPill } from "./components/MiniPlayerPill";
import { ExternalStreamBanner } from "./components/ExternalStreamBanner";

export const StudyMusicPlayer = ({
  isGlobalMuted = false,
  onToggleMute,
  onMuteChange,
  isMixerOpen: externalIsMixerOpen,
  onToggleMixer,
  onCloseMixer,
  isExternalStreamActive = false,
  externalStreamItem = null,
  onExpandExternalStream,
  onStopExternalStream,
}: StudyMusicPlayerProps) => {
  const [internalIsMixerOpen, setInternalIsMixerOpen] = useState(false);
  const [isCompactMode, setIsCompactMode] = useState(false);

  // Phục hồi chế độ thu nhỏ từ LocalStorage
  useEffect(() => {
    try {
      const savedCompact = localStorage.getItem("study_player_compact");
      if (savedCompact !== null) {
        setIsCompactMode(savedCompact === "true");
      }
    } catch {}
  }, []);

  const handleToggleCompactMode = () => {
    setIsCompactMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("study_player_compact", String(next));
      } catch {}
      return next;
    });
  };

  const isExternalYouTube = Boolean(
    isExternalStreamActive && externalStreamItem?.platform === "youtube"
  );
  const { isPaused: isExternalPaused, toggleExternalPlay } = useYouTubeRemote(
    Boolean(isExternalStreamActive),
    isExternalYouTube
  );

  const isMixerOpen =
    externalIsMixerOpen !== undefined ? externalIsMixerOpen : internalIsMixerOpen;
  const toggleMixer = onToggleMixer || (() => setInternalIsMixerOpen(!internalIsMixerOpen));
  const closeMixer = onCloseMixer || (() => setInternalIsMixerOpen(false));

  const {
    audioRef,
    currentMood,
    tracks,
    currentTrack,
    isPlaying,
    volume,
    effectiveVolume,
    isLooping,
    isShuffle,
    currentTime,
    duration,
    togglePlay,
    handleNextTrack,
    handlePrevTrack,
    handleSelectMood,
    handleSelectTrack,
    handleVolumeChange,
    handleToggleMute,
    handleToggleShuffle,
    handleToggleLoop,
    handleSeek,
    syncDuration,
    handleTimeUpdate,
    handleLoadedMetadata,
    handleAudioError,
  } = useAudioPlayer({
    isGlobalMuted,
    onToggleMute,
    onMuteChange,
    isExternalStreamActive,
    externalStreamItem,
    toggleExternalPlay,
  });

  const frequencyData = useWaveformSynthesizer(isPlaying || isExternalStreamActive);

  return (
    <>
      <audio
        ref={audioRef}
        src={currentTrack?.src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={syncDuration}
        onCanPlay={syncDuration}
        onLoadedData={syncDuration}
        onError={handleAudioError}
        onEnded={handleNextTrack}
        loop={isLooping}
        preload="metadata"
      />

      {/* Sound Mixer Drawer Widget */}
      <SoundMixerWidget
        isOpen={isMixerOpen}
        onClose={closeMixer}
        currentMood={currentMood}
        onSelectMood={handleSelectMood}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        onNextTrack={handleNextTrack}
        onPrevTrack={handlePrevTrack}
        currentTime={currentTime}
        duration={duration}
        onSeek={handleSeek}
        onSelectTrack={handleSelectTrack}
        volume={volume}
        onVolumeChange={handleVolumeChange}
        isShuffle={isShuffle}
        onToggleShuffle={handleToggleShuffle}
        isLooping={isLooping}
        onToggleLoop={handleToggleLoop}
        isGlobalMuted={isGlobalMuted}
      />

      {/* Morphing Capsule Player Container */}
      <motion.div
        id="tour-music-player"
        layout
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className={`relative w-full px-2 sm:px-4 group select-none will-change-transform ${
          isExternalStreamActive && externalStreamItem
            ? "max-w-md"
            : isCompactMode
            ? "max-w-xs sm:max-w-sm"
            : "max-w-4xl"
        }`}
      >
        {/* Dynamic Aura Ambient Glow */}
        <div
          className={`absolute -inset-1 rounded-full blur-xl pointer-events-none transition-all duration-700 ${
            isExternalStreamActive && externalStreamItem
              ? externalStreamItem.platform === "spotify"
                ? "bg-gradient-to-r from-accent-music/40 via-[#1DB954]/30 to-accent-music-glow/40 opacity-40 animate-pulse"
                : "bg-gradient-to-r from-accent-stream-deep/40 via-accent-stream-rose/30 to-accent-stream/40 opacity-40 animate-pulse"
              : isPlaying
              ? "bg-gradient-to-r from-accent-music/25 via-accent-scene/25 to-accent-dream/25 opacity-40 animate-pulse"
              : "bg-gradient-to-r from-wash/10 via-wash/5 to-wash/10 opacity-20"
          }`}
        />

        <div className="relative flex items-center justify-between gap-3 sm:gap-4 pl-3 pr-3 sm:pl-3.5 sm:pr-3.5 py-2 rounded-full bg-black/60 hover:bg-black/65 backdrop-blur-2xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.6)] transition-colors text-white w-full">
          {isExternalStreamActive && externalStreamItem ? (
            <ExternalStreamBanner
              externalStreamItem={externalStreamItem}
              isExternalPaused={isExternalPaused}
              toggleExternalPlay={toggleExternalPlay}
              onExpandExternalStream={onExpandExternalStream}
              onStopExternalStream={onStopExternalStream}
            />
          ) : isCompactMode ? (
            <MiniPlayerPill
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onTogglePlay={togglePlay}
              onNextTrack={handleNextTrack}
              onToggleCompactMode={handleToggleCompactMode}
            />
          ) : (
            <>
              <VinylArtworkBadge
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onOpenMixer={toggleMixer}
              />

              <WaveformScrubber
                currentTime={currentTime}
                duration={duration}
                frequencyData={frequencyData}
                isPlaying={isPlaying}
                onSeek={handleSeek}
              />

              <PlayerControls
                isPlaying={isPlaying}
                onTogglePlay={togglePlay}
                onNextTrack={handleNextTrack}
                onPrevTrack={handlePrevTrack}
                isShuffle={isShuffle}
                onToggleShuffle={handleToggleShuffle}
                isLooping={isLooping}
                onToggleLoop={handleToggleLoop}
                effectiveVolume={effectiveVolume}
                onVolumeChange={handleVolumeChange}
                isGlobalMuted={isGlobalMuted}
                onToggleMute={handleToggleMute}
                isMixerOpen={isMixerOpen}
                onToggleMixer={toggleMixer}
                onToggleCompactMode={handleToggleCompactMode}
              />
            </>
          )}
        </div>
      </motion.div>
    </>
  );
};
