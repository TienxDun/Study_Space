"use client";

import React from "react";
import dynamic from "next/dynamic";
import { MobileTopBar } from "@/components/study/mobile/top/MobileTopBar";
import { StudyMobileNav } from "@/components/study/mobile/navigation/StudyMobileNav";
import { MobileRadialBubbleMenu } from "@/components/study/mobile/navigation/MobileRadialBubbleMenu";
import { MobileTasksSheet } from "@/components/study/mobile/sheets/MobileTasksSheet";
import { MobileNotesSheet } from "@/components/study/mobile/sheets/MobileNotesSheet";
import { MobileSceneSheet } from "@/components/study/mobile/sheets/MobileSceneSheet";
import { MobileSettingsSheet } from "@/components/study/mobile/sheets/MobileSettingsSheet";
import { MobileFocusStatsSheet } from "@/components/study/mobile/sheets/MobileFocusStatsSheet";
import { MobileMoreSheet } from "@/components/study/mobile/sheets/MobileMoreSheet";
import type { StudySpaceState } from "@/components/study/hooks/useStudySpaceState";

// Dynamic import cho Chat Sheet vì dùng Firebase auth và markdown rendering
const MobileChatSheet = dynamic(
  () => import("@/components/study/mobile/sheets/MobileChatSheet").then((mod) => mod.MobileChatSheet),
  { ssr: false }
);

interface StudyMobileLayoutProps {
  state: StudySpaceState;
}

export const StudyMobileLayout = React.memo(function StudyMobileLayout({
  state,
}: StudyMobileLayoutProps) {
  const {
    isZenMode,
    isFullscreen,
    toggleFullscreen,
    isTasksOpen,
    isNotesOpen,
    isScenesOpen,
    isSettingsOpen,
    isStatsOpen,
    isChatOpen,
    isMoreOpen,
    isMixerOpen,
    isEmbedPlayerOpen,
    isRoomsOpen,
    currentScene,
    pendingScene,
    handleSelectScene,
    mobileCurrentScreen,
    mobileCanGoBack,
    mobilePrevScreen,
    handleMobileBack,
    handleMobileCloseAllSheets,
    handleOpenTasksDetail,
    handleCloseDetail,
    handleOpenNotesDetail,
    setIsTourOpen,
    showClockSeconds,
    handleToggleClockSeconds,
    isClock12Hour,
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
    activeNavTab,
    handleMobileNavSelect,
    handleMoreSelect,
    handleOpenChatRoot,
    handleOpenScenesRoot,
    handleOpenRoomsRoot,
    handleOpenRadioRoot,
    handleOpenStatsRoot,
  } = state;

  return (
    <>
      {/* Top Bar cho Mobile */}
      <MobileTopBar
        isZenMode={isZenMode}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      {/* Tasks Sheet */}
      <MobileTasksSheet
        isOpen={isTasksOpen}
        onClose={handleMobileCloseAllSheets}
        onBack={mobileCanGoBack ? handleMobileBack : undefined}
        backLabel={mobileCanGoBack ? mobilePrevScreen?.title : undefined}
        isEditingDetail={mobileCurrentScreen?.id === "tasks-detail"}
        onOpenDetail={handleOpenTasksDetail}
        onCloseDetail={handleCloseDetail}
      />

      {/* Notes Sheet */}
      <MobileNotesSheet
        isOpen={isNotesOpen}
        onClose={handleMobileCloseAllSheets}
        onBack={mobileCanGoBack ? handleMobileBack : undefined}
        backLabel={mobileCanGoBack ? mobilePrevScreen?.title : undefined}
        isEditingDetail={mobileCurrentScreen?.id === "notes-detail"}
        onOpenDetail={handleOpenNotesDetail}
      />

      {/* Scene Sheet */}
      <MobileSceneSheet
        isOpen={isScenesOpen}
        onClose={handleMobileCloseAllSheets}
        onBack={mobileCanGoBack ? handleMobileBack : undefined}
        backLabel={mobileCanGoBack ? mobilePrevScreen?.title : undefined}
        currentScene={currentScene}
        pendingScene={pendingScene}
        onSelectScene={handleSelectScene}
      />

      {/* Settings Sheet */}
      <MobileSettingsSheet
        isOpen={isSettingsOpen}
        onClose={handleMobileCloseAllSheets}
        onBack={mobileCanGoBack ? handleMobileBack : undefined}
        backLabel={mobileCanGoBack ? mobilePrevScreen?.title : undefined}
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

      {/* Focus Stats Sheet */}
      <MobileFocusStatsSheet
        isOpen={isStatsOpen}
        onClose={handleMobileCloseAllSheets}
        onBack={mobileCanGoBack ? handleMobileBack : undefined}
        backLabel={mobileCanGoBack ? mobilePrevScreen?.title : undefined}
      />

      {/* Chat Sheet */}
      <MobileChatSheet
        isOpen={isChatOpen}
        onClose={handleMobileCloseAllSheets}
        onBack={mobileCanGoBack ? handleMobileBack : undefined}
        backLabel={mobileCanGoBack ? mobilePrevScreen?.title : undefined}
      />

      {/* Thanh điều hướng đáy 5 nút */}
      {!isZenMode && (
        <StudyMobileNav active={activeNavTab} onSelect={handleMobileNavSelect} />
      )}

      {/* Bảng Thêm */}
      <MobileMoreSheet
        isOpen={isMoreOpen}
        onClose={handleMobileCloseAllSheets}
        onSelect={handleMoreSelect}
      />

      {/* Bong bóng mở nhanh (Radial Menu) */}
      {!isZenMode &&
        !isMoreOpen &&
        !isTasksOpen &&
        !isNotesOpen &&
        !isScenesOpen &&
        !isMixerOpen &&
        !isEmbedPlayerOpen &&
        !isRoomsOpen &&
        !isChatOpen &&
        !isSettingsOpen &&
        !isStatsOpen && (
          <div className="sm:hidden">
            <MobileRadialBubbleMenu
              onOpenChat={handleOpenChatRoot}
              onOpenScenes={handleOpenScenesRoot}
              onOpenRooms={handleOpenRoomsRoot}
              onOpenRadio={handleOpenRadioRoot}
              onOpenStats={handleOpenStatsRoot}
            />
          </div>
        )}
    </>
  );
});

StudyMobileLayout.displayName = "StudyMobileLayout";
