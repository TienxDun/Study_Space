"use client";

import React, { useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import type { StudySpaceState } from "@/components/study/hooks/useStudySpaceState";
import { MobileTopBar } from "@/components/study/mobile/top/MobileTopBar";
import { StudyMobileNav } from "@/components/study/mobile/navigation/StudyMobileNav";
import { MobileRadialBubbleMenu } from "@/components/study/mobile/navigation/MobileRadialBubbleMenu";
import { useMobileDoubleTap } from "@/components/study/mobile/hooks/useMobileDoubleTap";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { MobilePerfProbe } from "@/components/study/mobile/perf/MobilePerfProbe";
import {
  loadTasksSheet,
  loadNotesSheet,
  loadSceneSheet,
  loadSettingsSheet,
  loadStatsSheet,
  loadMoreSheet,
  loadRadioSheet,
  scheduleIdlePreloadMobileSheets,
} from "@/components/study/mobile/sheets/core/sheet-preloader";
import { SheetGlassSkeleton } from "@/components/study/mobile/sheets/core/SheetGlassSkeleton";

// Dynamic imports kết hợp Idle Preload: vừa giữ FCP ban đầu siêu nhẹ,
// vừa nạp ngầm trong nền để khi bấm mở là có sẵn 100% không độ trễ
const MobileTasksSheet = dynamic(
  () => loadTasksSheet().then((mod) => mod.MobileTasksSheet),
  { ssr: false, loading: () => <SheetGlassSkeleton title="Công việc" sheetId="tasks" /> }
);
const MobileNotesSheet = dynamic(
  () => loadNotesSheet().then((mod) => mod.MobileNotesSheet),
  { ssr: false, loading: () => <SheetGlassSkeleton title="Ghi chú" sheetId="notes" /> }
);
const MobileSceneSheet = dynamic(
  () => loadSceneSheet().then((mod) => mod.MobileSceneSheet),
  { ssr: false, loading: () => <SheetGlassSkeleton title="Không gian" sheetId="scenes" /> }
);
const MobileSettingsSheet = dynamic(
  () => loadSettingsSheet().then((mod) => mod.MobileSettingsSheet),
  { ssr: false, loading: () => <SheetGlassSkeleton title="Cài đặt" sheetId="settings" /> }
);
const MobileFocusStatsSheet = dynamic(
  () => loadStatsSheet().then((mod) => mod.MobileFocusStatsSheet),
  { ssr: false, loading: () => <SheetGlassSkeleton title="Thống kê" sheetId="stats" /> }
);
const MobileMoreSheet = dynamic(
  () => loadMoreSheet().then((mod) => mod.MobileMoreSheet),
  { ssr: false, loading: () => <SheetGlassSkeleton title="Thêm" sheetId="more" /> }
);
const MobileRadioSheet = dynamic(
  () => loadRadioSheet().then((mod) => mod.MobileRadioSheet),
  { ssr: false, loading: () => <SheetGlassSkeleton title="Đài phát thanh" sheetId="radio" /> }
);
const ChatV2Overlay = dynamic(
  () => import("@/features/chat-v2/ChatV2Overlay").then((mod) => mod.ChatV2Overlay),
  { ssr: false }
);
const FeedbackSheet = dynamic(
  () => import("@/components/study/feedback/FeedbackDialog").then((mod) => mod.FeedbackSheet),
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
    isFeedbackOpen,
    isStatsOpen,
    isChatOpen,
    isMoreOpen,
    isMixerOpen,
    isEmbedPlayerOpen,
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
    handleRandomScene,
    mobileCurrentScreen,
    mobileCanGoBack,
    mobilePrevScreen,
    handleMobileBack,
    handleMobileCloseAllSheets,
    handleOpenTasksDetail,
    handleCloseDetail,
    handleOpenNotesDetail,
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
    systemFlags,
    handleCloseEmbed,
    externalActiveItem,
    setIsExternalStreamActive,
    setExternalActiveItem,
  } = state;

  // Chỉ mount các bảng chức năng khi người dùng mở lần đầu để tiết kiệm RAM tối đa cho mobile.
  // Đồng bộ ngay trong lúc render (qua Ref) thay vì chờ useEffect sau frame đầu để sheet mount tức thì.
  const mountedSheetsRef = useRef<Record<string, boolean>>({});
  if (isTasksOpen) mountedSheetsRef.current.tasks = true;
  if (isNotesOpen) mountedSheetsRef.current.notes = true;
  if (isScenesOpen) mountedSheetsRef.current.scenes = true;
  if (isSettingsOpen) mountedSheetsRef.current.settings = true;
  if (isStatsOpen) mountedSheetsRef.current.stats = true;
  if (isMoreOpen) mountedSheetsRef.current.more = true;
  if (isFeedbackOpen) mountedSheetsRef.current.feedback = true;
  if (isEmbedPlayerOpen || Boolean(externalActiveItem)) mountedSheetsRef.current.radio = true;
  const mountedSheets = mountedSheetsRef.current;

  // Lên lịch nạp ngầm các bảng chức năng khi CPU rảnh rỗi (sau khi màn hình chính đã tải xong)
  useEffect(() => {
    const cancel = scheduleIdlePreloadMobileSheets(1500);
    return cancel;
  }, []);

  // Không cho phép Double Tap toggle Zen Mode khi đang mở bất kỳ sheet/bảng chức năng nào
  const isAnySheetOpen = Boolean(
    isTasksOpen ||
    isNotesOpen ||
    isScenesOpen ||
    isSettingsOpen ||
    isFeedbackOpen ||
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
          position: "top-center",
        });
      } else {
        toast("Đã thoát chế độ Zen", {
          id: "zen-mode-toggle",
          duration: 2000,
          position: "top-center",
        });
      }
      return next;
    });
  }, [setIsZenMode]);

  useMobileDoubleTap({
    enabled: !isAnySheetOpen,
    onDoubleTap: handleDoubleTap,
  });

  const handleQuickChangeScene = useCallback(() => {
    handleRandomScene();
  }, [handleRandomScene]);

  return (
    <>
      {/* Top Bar cho Mobile */}
      <MobilePerfProbe name="topbar">
        <MobileTopBar
          isZenMode={isZenMode}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          hasEntered={hasEntered}
          onChangeScene={handleQuickChangeScene}
          onOpenScenes={handleOpenScenesRoot}
          isPreloadingScene={isPreloadingScene}
        />
      </MobilePerfProbe>

      {/* Tasks Sheet */}
      {mountedSheets.tasks && (
        <ErrorBoundary>
          <MobilePerfProbe name="sheet:tasks">
            <MobileTasksSheet
              isOpen={isTasksOpen}
              onClose={handleMobileCloseAllSheets}
              onBack={mobileCanGoBack ? handleMobileBack : undefined}
              backLabel={mobileCanGoBack ? mobilePrevScreen?.title : undefined}
              isEditingDetail={mobileCurrentScreen?.id === "tasks-detail"}
              onOpenDetail={handleOpenTasksDetail}
              onCloseDetail={handleCloseDetail}
            />
          </MobilePerfProbe>
        </ErrorBoundary>
      )}

      {/* Notes Sheet */}
      {mountedSheets.notes && (
        <ErrorBoundary>
          <MobilePerfProbe name="sheet:notes">
            <MobileNotesSheet
              isOpen={isNotesOpen}
              onClose={handleMobileCloseAllSheets}
              onBack={mobileCanGoBack ? handleMobileBack : undefined}
              backLabel={mobileCanGoBack ? mobilePrevScreen?.title : undefined}
              isEditingDetail={mobileCurrentScreen?.id === "notes-detail"}
              onOpenDetail={handleOpenNotesDetail}
            />
          </MobilePerfProbe>
        </ErrorBoundary>
      )}

      {/* Scene Sheet */}
      {mountedSheets.scenes && (
        <ErrorBoundary>
          <MobilePerfProbe name="sheet:scenes">
            <MobileSceneSheet
              isOpen={isScenesOpen}
              onClose={handleMobileCloseAllSheets}
              onBack={mobileCanGoBack ? handleMobileBack : undefined}
              backLabel={mobileCanGoBack ? mobilePrevScreen?.title : undefined}
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
          </MobilePerfProbe>
        </ErrorBoundary>
      )}

      {/* Settings Sheet */}
      {mountedSheets.settings && (
        <ErrorBoundary>
          <MobilePerfProbe name="sheet:settings">
          <MobileSettingsSheet
            isOpen={isSettingsOpen}
            onClose={handleMobileCloseAllSheets}
            onBack={mobileCanGoBack ? handleMobileBack : undefined}
            backLabel={mobileCanGoBack ? mobilePrevScreen?.title : undefined}
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
          </MobilePerfProbe>
        </ErrorBoundary>
      )}

      {/* Focus Stats Sheet */}
      {mountedSheets.stats && (
        <ErrorBoundary>
          <MobilePerfProbe name="sheet:stats">
            <MobileFocusStatsSheet
              isOpen={isStatsOpen}
              onClose={handleMobileCloseAllSheets}
              onBack={mobileCanGoBack ? handleMobileBack : undefined}
              backLabel={mobileCanGoBack ? mobilePrevScreen?.title : undefined}
            />
          </MobilePerfProbe>
        </ErrorBoundary>
      )}

      {/* Chat v2: overlay toàn màn hình */}
      {isChatOpen && (
        <ErrorBoundary>
          <MobilePerfProbe name="chat-v2">
            <ChatV2Overlay onClose={handleMobileCloseAllSheets} />
          </MobilePerfProbe>
        </ErrorBoundary>
      )}

      {/* Radio Sheet */}
      {mountedSheets.radio && (
        <ErrorBoundary>
          <MobilePerfProbe name="sheet:radio">
            <MobileRadioSheet
              isOpen={isEmbedPlayerOpen}
              onClose={handleCloseEmbed}
              onBack={mobileCanGoBack ? handleMobileBack : undefined}
              backLabel={mobileCanGoBack ? mobilePrevScreen?.title : undefined}
              activeItem={externalActiveItem}
              onStreamActiveChange={setIsExternalStreamActive}
              onActiveItemChange={setExternalActiveItem}
            />
          </MobilePerfProbe>
        </ErrorBoundary>
      )}

      {/* Thanh điều hướng đáy 5 nút — ẩn khi chat v2 phủ toàn màn hình (nav portal nằm trên overlay). */}
      {!isZenMode && !isChatOpen && (
        <MobilePerfProbe name="nav">
          <StudyMobileNav
            active={activeNavTab}
            onSelect={handleMobileNavSelect}
            hasEntered={hasEntered}
          />
        </MobilePerfProbe>
      )}

      {/* Bảng Thêm */}
      {mountedSheets.more && (
        <ErrorBoundary>
          <MobilePerfProbe name="sheet:more">
            <MobileMoreSheet
              isOpen={isMoreOpen}
              onClose={handleMobileCloseAllSheets}
              onSelect={handleMoreSelect}
              chatEnabled={systemFlags.chatEnabled}
              roomsEnabled={systemFlags.roomsEnabled}
            />
          </MobilePerfProbe>
        </ErrorBoundary>
      )}

      {/* Khay góp ý/báo lỗi chung */}
      {mountedSheets.feedback && (
        <ErrorBoundary>
          <MobilePerfProbe name="sheet:feedback">
            <FeedbackSheet
              isOpen={isFeedbackOpen}
              onClose={handleMobileCloseAllSheets}
              onBack={mobileCanGoBack ? handleMobileBack : undefined}
              backLabel={mobileCanGoBack ? mobilePrevScreen?.title : undefined}
            />
          </MobilePerfProbe>
        </ErrorBoundary>
      )}

      {/* Bong bóng mở nhanh (Radial Menu) */}
      {!isZenMode && !isAnySheetOpen && (
        <div className="sm:hidden">
            <MobilePerfProbe name="radial">
              <MobileRadialBubbleMenu
                onOpenChat={handleOpenChatRoot}
                onOpenScenes={handleOpenScenesRoot}
                onOpenRooms={handleOpenRoomsRoot}
                onOpenRadio={handleOpenRadioRoot}
                onOpenStats={handleOpenStatsRoot}
                chatEnabled={systemFlags.chatEnabled}
                roomsEnabled={systemFlags.roomsEnabled}
              />
            </MobilePerfProbe>
          </div>
        )}
    </>
  );
});

StudyMobileLayout.displayName = "StudyMobileLayout";
