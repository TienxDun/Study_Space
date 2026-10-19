"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import type { StudySpaceState } from "@/components/study/hooks/useStudySpaceState";
import { MobileTopBar } from "@/components/study/mobile/top/MobileTopBar";
import { StudyMobileNav } from "@/components/study/mobile/navigation/StudyMobileNav";
import { MobileRadialBubbleMenu } from "@/components/study/mobile/navigation/MobileRadialBubbleMenu";
import { useMobileDoubleTap } from "@/components/study/mobile/hooks/useMobileDoubleTap";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
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
  hasEntered?: boolean;
}

export const StudyMobileLayout = React.memo(function StudyMobileLayout({
  state,
  hasEntered = true,
}: StudyMobileLayoutProps) {
  const {
    isZenMode,
    setIsZenMode,
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

  // Không cho phép Double Tap toggle Zen Mode khi đang mở bất kỳ sheet/bảng chức năng nào
  const isAnySheetOpen = Boolean(
    isTasksOpen ||
    isNotesOpen ||
    isScenesOpen ||
    isSettingsOpen ||
    isStatsOpen ||
    isChatOpen ||
    isMoreOpen ||
    isMixerOpen ||
    isEmbedPlayerOpen ||
    isRoomsOpen
  );

  const handleDoubleTap = useCallback(() => {
    setIsZenMode((prev) => {
      const next = !prev;
      if (next) {
        toast("Đã bật chế độ Zen (Chạm đúp để thoát)", {
          id: "zen-mode-toggle",
          duration: 2000,
          position: "bottom-center",
        });
      } else {
        toast("Đã thoát chế độ Zen", {
          id: "zen-mode-toggle",
          duration: 2000,
          position: "bottom-center",
        });
      }
      return next;
    });
  }, [setIsZenMode]);

  useMobileDoubleTap({
    enabled: !isAnySheetOpen,
    onDoubleTap: handleDoubleTap,
  });

  return (
    <>
      {/* Top Bar cho Mobile */}
      <MobileTopBar
        isZenMode={isZenMode}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        hasEntered={hasEntered}
      />

      {/* Tasks Sheet */}
      {mountedSheets.tasks && (
        <ErrorBoundary>
          <MobileTasksSheet
            isOpen={isTasksOpen}
            onClose={handleMobileCloseAllSheets}
            onBack={mobileCanGoBack ? handleMobileBack : undefined}
            backLabel={mobileCanGoBack ? mobilePrevScreen?.title : undefined}
            isEditingDetail={mobileCurrentScreen?.id === "tasks-detail"}
            onOpenDetail={handleOpenTasksDetail}
            onCloseDetail={handleCloseDetail}
          />
        </ErrorBoundary>
      )}

      {/* Notes Sheet */}
      {mountedSheets.notes && (
        <ErrorBoundary>
          <MobileNotesSheet
            isOpen={isNotesOpen}
            onClose={handleMobileCloseAllSheets}
            onBack={mobileCanGoBack ? handleMobileBack : undefined}
            backLabel={mobileCanGoBack ? mobilePrevScreen?.title : undefined}
            isEditingDetail={mobileCurrentScreen?.id === "notes-detail"}
            onOpenDetail={handleOpenNotesDetail}
          />
        </ErrorBoundary>
      )}

      {/* Scene Sheet */}
      {mountedSheets.scenes && (
        <ErrorBoundary>
          <MobileSceneSheet
            isOpen={isScenesOpen}
            onClose={handleMobileCloseAllSheets}
            onBack={mobileCanGoBack ? handleMobileBack : undefined}
            backLabel={mobileCanGoBack ? mobilePrevScreen?.title : undefined}
            currentScene={currentScene}
            pendingScene={pendingScene}
            onSelectScene={handleSelectScene}
          />
        </ErrorBoundary>
      )}

      {/* Settings Sheet */}
      {mountedSheets.settings && (
        <ErrorBoundary>
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
        </ErrorBoundary>
      )}

      {/* Focus Stats Sheet */}
      {mountedSheets.stats && (
        <ErrorBoundary>
          <MobileFocusStatsSheet
            isOpen={isStatsOpen}
            onClose={handleMobileCloseAllSheets}
            onBack={mobileCanGoBack ? handleMobileBack : undefined}
            backLabel={mobileCanGoBack ? mobilePrevScreen?.title : undefined}
          />
        </ErrorBoundary>
      )}

      {/* Chat Sheet */}
      {mountedSheets.chat && (
        <ErrorBoundary>
          <MobileChatSheet
            isOpen={isChatOpen}
            onClose={handleMobileCloseAllSheets}
            onBack={mobileCanGoBack ? handleMobileBack : undefined}
            backLabel={mobileCanGoBack ? mobilePrevScreen?.title : undefined}
          />
        </ErrorBoundary>
      )}

      {/* Thanh điều hướng đáy 5 nút */}
      {!isZenMode && (
        <StudyMobileNav
          active={activeNavTab}
          onSelect={handleMobileNavSelect}
          hasEntered={hasEntered}
        />
      )}

      {/* Bảng Thêm */}
      {mountedSheets.more && (
        <ErrorBoundary>
          <MobileMoreSheet
            isOpen={isMoreOpen}
            onClose={handleMobileCloseAllSheets}
            onSelect={handleMoreSelect}
          />
        </ErrorBoundary>
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
