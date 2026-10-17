"use client";

import React from "react";
import dynamic from "next/dynamic";
import { StudyTopBar } from "@/components/study/StudyTopBar";
import { StudyLeftDock } from "@/components/study/StudyLeftDock";
import { StudySettingsModal } from "@/components/study/StudySettingsModal";
import { FocusStatsModal } from "@/components/study/stats/FocusStatsModal";
import { StudyCommandPalette } from "@/components/study/command/StudyCommandPalette";
import type { StudySpaceState } from "@/components/study/hooks/useStudySpaceState";

// Dynamic imports for heavy desktop widgets to optimize initial load
const StudyTasksWidget = dynamic(
  () => import("@/components/study/tasks/StudyTasksWidget").then((mod) => mod.StudyTasksWidget),
  { ssr: false }
);

const StudyNotesWidget = dynamic(
  () => import("@/components/study/notes/StudyNotesWidget").then((mod) => mod.StudyNotesWidget),
  { ssr: false }
);

const SceneSelectorWidget = dynamic(
  () => import("@/components/study/SceneSelectorWidget").then((mod) => mod.SceneSelectorWidget),
  { ssr: false }
);


const StudyChatWidget = dynamic(
  () => import("@/components/study/chat/StudyChatWidget").then((mod) => mod.StudyChatWidget),
  { ssr: false }
);

interface StudyDesktopLayoutProps {
  state: StudySpaceState;
}

export const StudyDesktopLayout = React.memo(function StudyDesktopLayout({
  state,
}: StudyDesktopLayoutProps) {
  const {
    isZenMode,
    isPomodoroVisible,
    centerTab,
    isGlobalMuted,
    isSettingsOpen,
    isFullscreen,
    isStatsOpen,
    setIsStatsOpen,
    showClockSeconds,
    isClock12Hour,
    handleToggleClock,
    handleToggleShortcutsHelp,
    setIsZenMode,
    setIsTasksOpen,
    setIsNotesOpen,
    setIsScenesOpen,
    setIsMixerOpen,
    setIsEmbedPlayerOpen,
    setIsRoomsOpen,
    setIsChatOpen,
    toggleGlobalMute,
    handleToggleSettings,
    toggleFullscreen,
    isTasksOpen,
    isNotesOpen,
    isScenesOpen,
    isEmbedPlayerOpen,
    isPipActive,
    isExternalStreamActive,
    handleTogglePomodoroVisibility,
    handleToggleTasks,
    handleToggleNotes,
    handleToggleScenes,
    handleToggleEmbed,
    isRoomsOpen,
    currentScene,
    pendingScene,
    isPreloadingScene,
    handleSelectScene,
    isSlideshowOn,
    slideshowIntervalMin,
    slideshowPool,
    isSlideshowPoolFavorites,
    handleToggleSlideshow,
    handleCycleSlideshowInterval,
    handleCloseSettings,
    setIsTourOpen,
    handleToggleClockSeconds,
    handleToggleClock12Hour,
    pomodoroDurations,
    handleSavePomodoroDurations,
    soundEnabled,
    handleToggleSound,
    soundType,
    handleSelectSoundType,
    showStopwatchMilliseconds,
    handleToggleStopwatchMilliseconds,
    keepAwake,
    handleToggleKeepAwake,
    wakeLockSupported,
    isChatOpen,
    isCommandOpen,
    setIsCommandOpen,
    commandActions,
  } = state;

  return (
    <>
      {/* Top Navigation Bar cho Desktop */}
      <div className="hidden sm:block">
        <StudyTopBar
          isZenMode={isZenMode}
          isPomodoroVisible={isPomodoroVisible}
          centerTab={centerTab}
          isGlobalMuted={isGlobalMuted}
          isSettingsOpen={isSettingsOpen}
          isFullscreen={isFullscreen}
          isStatsOpen={isStatsOpen}
          onToggleStats={() => setIsStatsOpen((prev) => !prev)}
          showClockSeconds={showClockSeconds}
          isClock12Hour={isClock12Hour}
          onToggleClock={handleToggleClock}
          onToggleShortcuts={handleToggleShortcutsHelp}
          onEnterZen={() => {
            setIsZenMode(true);
            setIsTasksOpen(false);
            setIsNotesOpen(false);
            setIsScenesOpen(false);
            setIsMixerOpen(false);
            setIsEmbedPlayerOpen(false);
            setIsRoomsOpen(false);
            setIsChatOpen(false);
            handleCloseSettings();
            setIsStatsOpen(false);
          }}
          onExitZen={() => setIsZenMode(false)}
          onToggleMute={toggleGlobalMute}
          onToggleSettings={handleToggleSettings}
          onToggleFullscreen={toggleFullscreen}
        />
      </div>

      {/* Floating Left Dock: Chỉ hiện trên máy tính */}
      <div className="hidden sm:block">
        <StudyLeftDock
          isZenMode={isZenMode}
          isPomodoroVisible={isPomodoroVisible}
          isTasksOpen={isTasksOpen}
          isNotesOpen={isNotesOpen}
          isScenesOpen={isScenesOpen}
          isEmbedPlayerOpen={isEmbedPlayerOpen && !isPipActive}
          isExternalStreamActive={isExternalStreamActive}
          onTogglePomodoro={handleTogglePomodoroVisibility}
          onToggleTasks={handleToggleTasks}
          onToggleNotes={handleToggleNotes}
          onToggleScenes={handleToggleScenes}
          onToggleEmbed={handleToggleEmbed}
          isRoomsOpen={isRoomsOpen}
          onToggleRooms={() => setIsRoomsOpen((prev) => !prev)}
        />
      </div>

      {/* Tasks Widget */}
      <StudyTasksWidget
        isOpen={isTasksOpen}
        onClose={() => setIsTasksOpen(false)}
      />

      {/* Notes Widget */}
      <StudyNotesWidget
        isOpen={isNotesOpen}
        onClose={() => setIsNotesOpen(false)}
      />

      {/* Scene Selector Widget */}
      <div className="hidden sm:contents">
        <SceneSelectorWidget
          isOpen={isScenesOpen}
          onClose={() => setIsScenesOpen(false)}
          currentScene={currentScene}
          pendingScene={pendingScene}
          isPreloading={isPreloadingScene}
          onSelectScene={handleSelectScene}
          slideshowEnabled={isSlideshowOn}
          slideshowIntervalMin={slideshowIntervalMin}
          slideshowPoolLabel={
            isSlideshowPoolFavorites
              ? `${slideshowPool.length} cảnh yêu thích`
              : `tất cả ${slideshowPool.length} cảnh`
          }
          onToggleSlideshow={handleToggleSlideshow}
          onCycleSlideshowInterval={handleCycleSlideshowInterval}
        />
      </div>


      {/* Settings Modal */}
      <StudySettingsModal
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        onOpenTour={() => setIsTourOpen(true)}
        showClockSeconds={showClockSeconds}
        onToggleClockSeconds={handleToggleClockSeconds}
        isClock12Hour={isClock12Hour}
        onToggleClock12Hour={handleToggleClock12Hour}
        durations={pomodoroDurations}
        onSaveDurations={handleSavePomodoroDurations}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        soundType={soundType}
        onSelectSoundType={handleSelectSoundType}
        showStopwatchMilliseconds={showStopwatchMilliseconds}
        onToggleStopwatchMilliseconds={handleToggleStopwatchMilliseconds}
        keepAwake={keepAwake}
        onToggleKeepAwake={handleToggleKeepAwake}
        wakeLockSupported={wakeLockSupported}
      />

      {/* Focus Stats Modal */}
      <FocusStatsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
      />

      {/* Chat AI Widget */}
      <StudyChatWidget
        isOpen={isChatOpen}
        onOpenChange={setIsChatOpen}
        onClose={() => setIsChatOpen(false)}
        isZenMode={isZenMode}
      />

      {/* Command Palette mở nhanh (Cmd/Ctrl+K) */}
      <StudyCommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        actions={commandActions}
      />
    </>
  );
});

StudyDesktopLayout.displayName = "StudyDesktopLayout";
