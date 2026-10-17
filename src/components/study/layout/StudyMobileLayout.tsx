"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { StudySpaceState } from "@/components/study/hooks/useStudySpaceState";
import { MobileTopBar } from "@/components/study/mobile/top/MobileTopBar";
import { StudyMobileNav } from "@/components/study/mobile/navigation/StudyMobileNav";
import { MobileRadialBubbleMenu } from "@/components/study/mobile/navigation/MobileRadialBubbleMenu";
import { MobileWelcomeScreen } from "@/components/study/mobile/welcome/MobileWelcomeScreen";
// Dynamic imports cho các bảng chức năng mobile để giảm tải RAM ban đầu
const MobileTasksSheet = dynamic(
  () => import("@/components/study/mobile/sheets/MobileTasksSheet").then((mod) => mod.MobileTasksSheet),
  { ssr: false }
);
const MobileNotesSheet = dynamic(
  () => import("@/components/study/mobile/sheets/MobileNotesSheet").then((mod) => mod.MobileNotesSheet),
  { ssr: false }
);
const MobileSceneSheet = dynamic(
  () => import("@/components/study/mobile/sheets/MobileSceneSheet").then((mod) => mod.MobileSceneSheet),
  { ssr: false }
);
const MobileSettingsSheet = dynamic(
  () => import("@/components/study/mobile/sheets/MobileSettingsSheet").then((mod) => mod.MobileSettingsSheet),
  { ssr: false }
);
const MobileFocusStatsSheet = dynamic(
  () => import("@/components/study/mobile/sheets/MobileFocusStatsSheet").then((mod) => mod.MobileFocusStatsSheet),
  { ssr: false }
);
const MobileMoreSheet = dynamic(
  () => import("@/components/study/mobile/sheets/MobileMoreSheet").then((mod) => mod.MobileMoreSheet),
  { ssr: false }
);
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

  // Chỉ mount các bảng chức năng khi người dùng mở lần đầu để tiết kiệm RAM tối đa cho mobile
  const [mountedSheets, setMountedSheets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setMountedSheets((prev) => {
      let changed = false;
      const next = { ...prev };
      if (isTasksOpen && !next.tasks) { next.tasks = true; changed = true; }
      if (isNotesOpen && !next.notes) { next.notes = true; changed = true; }
      if (isScenesOpen && !next.scenes) { next.scenes = true; changed = true; }
      if (isSettingsOpen && !next.settings) { next.settings = true; changed = true; }
      if (isStatsOpen && !next.stats) { next.stats = true; changed = true; }
      if (isChatOpen && !next.chat) { next.chat = true; changed = true; }
      if (isMoreOpen && !next.more) { next.more = true; changed = true; }
      return changed ? next : prev;
    });
  }, [isTasksOpen, isNotesOpen, isScenesOpen, isSettingsOpen, isStatsOpen, isChatOpen, isMoreOpen]);

  return (
    <>
      {/* Màn hình chào mừng chuyên nghiệp khi mở/tải lại app trên điện thoại */}
      <MobileWelcomeScreen sceneName={currentScene?.name} />

      {/* Top Bar cho Mobile */}
      <MobileTopBar
        isZenMode={isZenMode}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      {/* Tasks Sheet */}
      {mountedSheets.tasks && (
        <MobileTasksSheet
          isOpen={isTasksOpen}
          onClose={handleMobileCloseAllSheets}
          onBack={mobileCanGoBack ? handleMobileBack : undefined}
          backLabel={mobileCanGoBack ? mobilePrevScreen?.title : undefined}
          isEditingDetail={mobileCurrentScreen?.id === "tasks-detail"}
          onOpenDetail={handleOpenTasksDetail}
          onCloseDetail={handleCloseDetail}
        />
      )}

      {/* Notes Sheet */}
      {mountedSheets.notes && (
        <MobileNotesSheet
          isOpen={isNotesOpen}
          onClose={handleMobileCloseAllSheets}
          onBack={mobileCanGoBack ? handleMobileBack : undefined}
          backLabel={mobileCanGoBack ? mobilePrevScreen?.title : undefined}
          isEditingDetail={mobileCurrentScreen?.id === "notes-detail"}
          onOpenDetail={handleOpenNotesDetail}
        />
      )}

      {/* Scene Sheet */}
      {mountedSheets.scenes && (
        <MobileSceneSheet
          isOpen={isScenesOpen}
          onClose={handleMobileCloseAllSheets}
          onBack={mobileCanGoBack ? handleMobileBack : undefined}
          backLabel={mobileCanGoBack ? mobilePrevScreen?.title : undefined}
          currentScene={currentScene}
          pendingScene={pendingScene}
          onSelectScene={handleSelectScene}
        />
      )}

      {/* Settings Sheet */}
      {mountedSheets.settings && (
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
      )}

      {/* Focus Stats Sheet */}
      {mountedSheets.stats && (
        <MobileFocusStatsSheet
          isOpen={isStatsOpen}
          onClose={handleMobileCloseAllSheets}
          onBack={mobileCanGoBack ? handleMobileBack : undefined}
          backLabel={mobileCanGoBack ? mobilePrevScreen?.title : undefined}
        />
      )}

      {/* Chat Sheet */}
      {mountedSheets.chat && (
        <MobileChatSheet
          isOpen={isChatOpen}
          onClose={handleMobileCloseAllSheets}
          onBack={mobileCanGoBack ? handleMobileBack : undefined}
          backLabel={mobileCanGoBack ? mobilePrevScreen?.title : undefined}
        />
      )}

      {/* Thanh điều hướng đáy 5 nút */}
      {!isZenMode && (
        <StudyMobileNav active={activeNavTab} onSelect={handleMobileNavSelect} />
      )}

      {/* Bảng Thêm */}
      {mountedSheets.more && (
        <MobileMoreSheet
          isOpen={isMoreOpen}
          onClose={handleMobileCloseAllSheets}
          onSelect={handleMoreSelect}
        />
      )}

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
