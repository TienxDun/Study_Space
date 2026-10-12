"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Music2, CloudRain } from "lucide-react";
import { StudyMusicPlayerProps } from "./types";
import { SoundMixerWidget } from "../mixer/SoundMixerWidget";
import { MixerTab } from "../mixer/types";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import { useYouTubeRemote, sendYouTubeCommand } from "@/lib/youtube-remote";
import { WaveformScrubber } from "./components/WaveformScrubber";
import { PlayerControls } from "./components/PlayerControls";
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
  isZenMode = false,
}: StudyMusicPlayerProps) => {
  const [internalIsMixerOpen, setInternalIsMixerOpen] = useState(false);
  const [activeMixerTab, setActiveMixerTab] = useState<MixerTab>("ambience");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isExternalYouTube = Boolean(
    isExternalStreamActive && externalStreamItem?.platform === "youtube"
  );
  const { isPaused: isExternalPaused, toggleExternalPlay } = useYouTubeRemote(
    Boolean(isExternalStreamActive),
    isExternalYouTube
  );

  // M toàn cục cũng tắt tiếng đài YouTube ngoài (iframe không tự nghe theo).
  useEffect(() => {
    if (!isExternalYouTube) return;
    sendYouTubeCommand(isGlobalMuted ? "mute" : "unMute");
  }, [isGlobalMuted, isExternalYouTube, isExternalStreamActive]);

  const [ambientActiveCount, setAmbientActiveCount] = useState(0);

  const isMixerOpen =
    externalIsMixerOpen !== undefined ? externalIsMixerOpen : internalIsMixerOpen;
  const toggleMixer = onToggleMixer || (() => setInternalIsMixerOpen(!internalIsMixerOpen));
  const closeMixer = onCloseMixer || (() => setInternalIsMixerOpen(false));

  const handleOpenMusicTab = () => {
    if (isMixerOpen && activeMixerTab === "music") {
      closeMixer();
    } else {
      setActiveMixerTab("music");
      if (!isMixerOpen) {
        toggleMixer();
      }
    }
  };

  const handleOpenAmbienceTab = () => {
    if (isMixerOpen && activeMixerTab === "ambience") {
      closeMixer();
    } else {
      setActiveMixerTab("ambience");
      if (!isMixerOpen) {
        toggleMixer();
      }
    }
  };

  const {
    audioRef,
    currentMood,
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
    onStopExternalStream,
  });

  const isShowingExternalStream = Boolean(
    isExternalStreamActive && externalStreamItem && !isPlaying
  );

  // Cầu nối với mèo linh vật: báo cho mèo biết nhạc đang chạy hay dừng,
  // và nghe lệnh bật/tắt từ mèo. Hai bên nhắn qua cửa sổ, khỏi đụng chỗ khác.
  const musicBridgeRef = useRef({
    togglePlay,
    toggleExternalPlay,
    isShowingExternalStream,
  });
  useEffect(() => {
    musicBridgeRef.current = { togglePlay, toggleExternalPlay, isShowingExternalStream };
  });

  useEffect(() => {
    const playing = isPlaying || (isExternalStreamActive && !isExternalPaused);
    window.dispatchEvent(
      new CustomEvent("zenstudy:music-state", { detail: { isPlaying: playing } })
    );
  }, [isPlaying, isExternalStreamActive, isExternalPaused]);

  useEffect(() => {
    const onToggle = () => {
      const b = musicBridgeRef.current;
      if (b.isShowingExternalStream) b.toggleExternalPlay();
      else b.togglePlay();
    };
    window.addEventListener("zenstudy:music-toggle", onToggle);
    return () => window.removeEventListener("zenstudy:music-toggle", onToggle);
  }, []);

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
        activeTab={activeMixerTab}
        onTabChange={setActiveMixerTab}
        onAmbientActiveCountChange={setAmbientActiveCount}
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

      {/* Bottom Ambient Vignette: Dải dốc bảo vệ tương phản tự nhiên ở đáy màn hình */}
      <div className="fixed bottom-0 inset-x-0 h-28 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none z-30" />

      {/* 1. Now Playing Island: Góc trái dưới màn hình (Thuần túy không viền không hộp) */}
      {!isShowingExternalStream && (
        <motion.div
          animate={{
            opacity: isZenMode ? 0 : 1,
            y: isZenMode ? 32 : 0,
            pointerEvents: isZenMode ? "none" : "auto",
          }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed bottom-3 left-3 sm:bottom-3.5 sm:left-3.5 z-40 max-w-[calc(50vw-24px)] sm:max-w-xs md:max-w-sm select-none"
        >
          <div
            onClick={handleOpenMusicTab}
            className="h-[60px] sm:h-[62px] flex items-center gap-2.5 sm:gap-3 px-1 py-1 cursor-pointer group/art transition-all duration-200"
            title="Mở danh sách nhạc Chill & Thư giãn"
          >
            {/* Vinyl Record (Hiển thị full 100% nền đĩa, không bị lẹm viền) */}
            <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-full ring-1 ring-white/25 shadow-xl shadow-black/80 shrink-0 group-hover/art:scale-105 transition-transform duration-300">
              <div
                className={`w-full h-full rounded-full overflow-hidden relative shadow-inner ${
                  isPlaying ? "animate-[spin_10s_linear_infinite]" : ""
                }`}
              >
                <img
                  src={currentTrack?.cover || "/study/thumbnails/coffee-shop.PNG"}
                  alt={currentTrack?.title || "Track Cover"}
                  className="w-full h-full object-cover scale-[1.1]"
                />
                {/* Subtle Vinyl Grooves Rings */}
                <div className="absolute inset-0 rounded-full border border-white/15 pointer-events-none" />
                <div className="absolute inset-1.5 rounded-full border border-white/10 pointer-events-none" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12)_0%,transparent_65%)] pointer-events-none" />
                {/* Compact Center Spindle Hole */}
                <div className="absolute inset-0 m-auto w-2 h-2 rounded-full bg-slate-950 border border-white/40 shadow-sm z-10 flex items-center justify-center">
                  <div className="w-0.5 h-0.5 rounded-full bg-white/70" />
                </div>
              </div>
            </div>

            {/* Metadata: Title & Artist & Genre (Nổi thẳng lên hình nền với drop-shadow) */}
            <div className="min-w-0 flex-1 space-y-0.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              <h4 className="text-xs sm:text-sm font-bold text-white truncate leading-tight group-hover/art:text-accent-music-bright transition-colors">
                {currentTrack?.title || "Chưa phát nhạc"}
              </h4>
              <div className="flex items-center gap-1.5 text-xs text-slate-300/90 truncate">
                <span className="truncate">{currentTrack?.artist || "Zen Study"}</span>
                {currentTrack?.genre && (
                  <>
                    <span>•</span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-white/10 backdrop-blur-md text-slate-300 font-semibold border border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.4)] text-[10px] sm:text-[11px]">
                      {currentTrack.genre}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* 2. Playback Controller Island: Căn giữa đáy màn hình (Thuần túy không viền không hộp) */}
      <motion.div
        id="tour-music-player"
        animate={{
          opacity: isZenMode ? 0 : 1,
          y: isZenMode ? 32 : 0,
          pointerEvents: isZenMode ? "none" : "auto",
        }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="fixed bottom-3 left-1/2 -translate-x-1/2 sm:bottom-3.5 z-40 max-w-[calc(100vw-24px)] select-none will-change-transform"
      >

        <div
          className={`relative h-[60px] sm:h-[62px] text-white ${
            isShowingExternalStream && externalStreamItem
              ? "flex items-center justify-between gap-3 sm:gap-4 px-2 py-1 min-w-[min(320px,100%)] sm:min-w-[380px] md:min-w-[420px] drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]"
              : "flex flex-col items-center justify-center gap-1.5 sm:gap-2 px-1 py-1 min-w-[min(270px,100%)] sm:min-w-[290px] drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]"
          }`}
        >
          {isShowingExternalStream && externalStreamItem ? (
            <ExternalStreamBanner
              externalStreamItem={externalStreamItem}
              isExternalPaused={isExternalPaused}
              toggleExternalPlay={toggleExternalPlay}
              onExpandExternalStream={onExpandExternalStream}
              onStopExternalStream={onStopExternalStream}
            />
          ) : (
            <>
              {/* Row 1: 5 Core Playback Controls (Căn giữa màn hình hoàn hảo tuyệt đối) */}
              <PlayerControls
                onNextTrack={handleNextTrack}
                onPrevTrack={handlePrevTrack}
                isShuffle={isShuffle}
                onToggleShuffle={handleToggleShuffle}
                isLooping={isLooping}
                onToggleLoop={handleToggleLoop}
              />

              {/* Row 2: Waveform Scrubber with timing and Volume Control on the right */}
              <WaveformScrubber
                currentTime={currentTime}
                duration={duration}
                isActive={isPlaying || isExternalStreamActive}
                onSeek={handleSeek}
                effectiveVolume={effectiveVolume}
                onVolumeChange={handleVolumeChange}
                isGlobalMuted={isGlobalMuted}
                onToggleMute={handleToggleMute}
                audioRef={audioRef}
              />
            </>
          )}
        </div>
      </motion.div>

      {/* 3. Audio Dock Island: Cụm điều khiển góc phải dưới màn hình (Thuần túy không viền không hộp) */}
      {(() => {
        const dockContent = (
          <motion.div
            animate={{
              opacity: isZenMode ? 0 : 1,
              y: isZenMode ? 28 : 0,
              pointerEvents: isZenMode ? "none" : "auto",
            }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed bottom-3 right-3 sm:bottom-3.5 sm:right-3.5 z-40"
          >
            {/* Minimalist Floating Ghost Audio Dock (Hoàn toàn không background, không viền) */}
            <div
              id="audio-control-dock"
              className="h-9 sm:h-10 flex items-center gap-1 sm:gap-1.5 select-none pointer-events-auto transition-all will-change-transform drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]"
            >
              {/* Tab 1: Mở Playlist Nhạc Chill */}
              <button
                id="tour-music-tab-btn"
                onClick={handleOpenMusicTab}
                className={`group relative h-8 sm:h-8.5 px-2.5 sm:px-3 rounded-xl flex items-center gap-1.5 sm:gap-2 transition-all active:scale-95 cursor-pointer text-xs font-semibold ${
                  isMixerOpen && activeMixerTab === "music"
                    ? "text-white bg-white/15 backdrop-blur-md shadow-[0_0_16px_rgba(52,211,153,0.3)]"
                    : "text-slate-200 hover:text-white glass-hover"
                }`}
                title="Mở danh sách nhạc Chill & Thư giãn"
              >
                <Music2
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-all duration-200 group-hover:scale-110 shrink-0 ${
                    isMixerOpen && activeMixerTab === "music"
                      ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse"
                      : isPlaying && !isGlobalMuted
                      ? "text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.7)]"
                      : "text-emerald-400/80 group-hover:text-emerald-300 group-hover:drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                  }`}
                />
                <span className="sr-only">Nhạc Chill</span>
                <span className="leading-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">Nhạc</span>

                {/* Playing indicator: eq tĩnh — waveform ở giữa đã là motion chính */}
                {(isMixerOpen && activeMixerTab === "music" ||
                  (isPlaying && !isGlobalMuted)) && (
                  <span
                    className="flex items-end gap-[2px] h-3 ml-0.5 shrink-0"
                    aria-hidden="true"
                  >
                    <span className="w-[2.5px] rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" style={{ height: "5px" }} />
                    <span className="w-[2.5px] rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" style={{ height: "11px" }} />
                    <span className="w-[2.5px] rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" style={{ height: "7px" }} />
                  </span>
                )}
              </button>

              {/* Tab 2: Mở Bộ trộn âm thanh thiên nhiên */}
              {(() => {
                const isAmbienceTabOpen = isMixerOpen && activeMixerTab === "ambience";
                const isAmbienceActive = ambientActiveCount > 0;

                return (
                  <button
                    id="tour-music-mixer-btn"
                    onClick={handleOpenAmbienceTab}
                    className={`group relative h-8 sm:h-8.5 px-2.5 sm:px-3 rounded-xl flex items-center gap-1.5 sm:gap-2 transition-all active:scale-95 cursor-pointer text-xs font-semibold ${
                      isAmbienceTabOpen
                        ? "text-white bg-white/15 backdrop-blur-md shadow-[0_0_16px_rgba(56,189,248,0.3)]"
                        : isAmbienceActive
                        ? "text-sky-200 hover:text-white hover:bg-sky-500/20"
                        : "text-slate-200 hover:text-white glass-hover"
                    }`}
                    title={
                      isAmbienceActive
                        ? isGlobalMuted
                          ? `Đang bật ${ambientActiveCount} âm thanh thiên nhiên (Đang tắt tiếng chung)`
                          : `Đang phát ${ambientActiveCount} âm thanh thiên nhiên (Bấm để tùy chỉnh)`
                        : "Mở Bộ trộn 20 âm thanh thiên nhiên (Mưa, sóng biển, rừng cây...)"
                    }
                  >
                    <CloudRain
                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-all duration-200 group-hover:scale-110 shrink-0 ${
                        isAmbienceTabOpen
                          ? "text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.9)] animate-pulse"
                          : isAmbienceActive
                          ? "text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)] animate-pulse"
                          : "text-sky-400/80 group-hover:text-sky-300 group-hover:drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]"
                      }`}
                    />
                    <span className="sr-only">Âm thanh nền</span>
                    <span className="leading-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">Âm nền</span>

                    {/* Active Ambience Indicator Badge */}
                    {isAmbienceActive && (
                      <span
                        className="relative flex items-center justify-center shrink-0 ml-0.5"
                        aria-label={`${ambientActiveCount} âm thanh đang bật`}
                      >
                        {!isGlobalMuted && (
                          <span className="absolute inline-flex h-2.5 w-2.5 rounded-full bg-sky-400 opacity-75 animate-ping" />
                        )}
                        <span
                          className={`relative inline-flex items-center justify-center min-w-3.5 h-3.5 px-1 rounded-full text-[10px] font-black leading-none ${
                            isGlobalMuted
                              ? "bg-amber-400 text-slate-950"
                              : "bg-sky-400 text-slate-950 shadow-[0_0_8px_rgba(56,189,248,0.8)]"
                          }`}
                        >
                          {ambientActiveCount}
                        </span>
                      </span>
                    )}
                  </button>
                );
              })()}
            </div>
          </motion.div>
        );

        return isMounted ? createPortal(dockContent, document.body) : dockContent;
      })()}
    </>
  );
};
