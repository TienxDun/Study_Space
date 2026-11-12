"use client";

import { useMemo, useRef, useEffect } from "react";
import { STUDY_SCENES } from "@/components/study/study-types";
import { useStudyKeyboard } from "@/lib/use-study-keyboard";
import type { CommandAction } from "@/components/study/command/StudyCommandPalette";
import { useIsMobile } from "@/components/study/mobile/hooks/useIsMobile";

import { useSceneState } from "./useSceneState";
import { useDisplayModeState } from "./useDisplayModeState";
import { useTimerCenterState } from "./useTimerCenterState";
import { usePanelState } from "./usePanelState";
import { useExternalEmbedState } from "./useExternalEmbedState";
import { useMobileNavState } from "./useMobileNavState";

export function useStudySpaceState() {
  const isMobile = useIsMobile();

  // Ref trung gian kết nối các hook con mà không gây vòng lặp temporal dead zone
  const mobileNavStateRef = useRef<ReturnType<typeof useMobileNavState>>(null!);
  const panelStateRef = useRef<ReturnType<typeof usePanelState>>(null!);
  const embedStateRef = useRef<ReturnType<typeof useExternalEmbedState>>(null!);

  // 1. Scene & Slideshow
  const sceneState = useSceneState({ isMobile });

  // 2. Timer Center (Pomodoro / Clock / Stopwatch)
  const timerState = useTimerCenterState({
    isMobile,
    onCloseMobileSheets: () => {
      mobileNavStateRef.current?.handleMobileCloseAllSheets();
    },
    onCloseTasks: () => {
      panelStateRef.current?.setIsTasksOpen(false);
    },
    onPomodoroNavActiveChange: (active) => {
      mobileNavStateRef.current?.setIsPomodoroNavActive(active);
    },
  });

  // 3. Media Embed (YouTube / Spotify external streams)
  const embedState = useExternalEmbedState({
    isMobile,
    onBeforeOpen: () => {
      panelStateRef.current?.handleCloseSettings();
      panelStateRef.current?.setIsTasksOpen(false);
      panelStateRef.current?.setIsNotesOpen(false);
      panelStateRef.current?.setIsScenesOpen(false);
      panelStateRef.current?.setIsMixerOpen(false);
    },
    onMobileCloseAll: () => {
      mobileNavStateRef.current?.handleMobileCloseAllSheets();
    },
    onMobileOpenRoot: (id, title) => {
      mobileNavStateRef.current?.mobileOpenRoot(id, title);
    },
    getIsMobileEmbedActive: () => mobileNavStateRef.current?.mobileCurrentScreen?.id === "embed",
  });

  // 4. Display Mode, System Flags, Settings, WakeLock
  const displayState = useDisplayModeState({
    isTimerRunning: timerState.isTimerRunning,
    isExternalStreamActive: embedState.isExternalStreamActive,
    isMobile,
  });

  // 5. Panels & Modals (Tasks, Notes, Mixer, Settings, Chat, Rooms, v.v.)
  const panelState = usePanelState({
    systemFlags: displayState.systemFlags,
    isMobile,
    onCloseEmbed: () => {
      embedStateRef.current?.setIsEmbedPlayerOpen(false);
    },
    onMobileCloseAllSheets: () => {
      mobileNavStateRef.current?.handleMobileCloseAllSheets();
    },
    onMobileOpenRoot: (id, title) => {
      mobileNavStateRef.current?.mobileOpenRoot(id, title);
    },
    isEmbedPlayerOpen: embedState.isEmbedPlayerOpen,
    isPipActive: embedState.isPipActive,
  });

  // 6. Mobile Navigation & Sheets Stack
  const mobilePanelStates = useMemo(
    () => ({
      isTasksOpen: panelState.isTasksOpen,
      isNotesOpen: panelState.isNotesOpen,
      isScenesOpen: panelState.isScenesOpen,
      isMixerOpen: panelState.isMixerOpen,
      isEmbedPlayerOpen: embedState.isEmbedPlayerOpen,
      isRoomsOpen: panelState.isRoomsOpen,
      isChatOpen: panelState.isChatOpen,
      isMoreOpen: panelState.isMoreOpen,
      isStatsOpen: panelState.isStatsOpen,
      isSettingsOpen: panelState.isSettingsOpen,
      isFeedbackOpen: panelState.isFeedbackOpen,
    }),
    [
      panelState.isTasksOpen,
      panelState.isNotesOpen,
      panelState.isScenesOpen,
      panelState.isMixerOpen,
      embedState.isEmbedPlayerOpen,
      panelState.isRoomsOpen,
      panelState.isChatOpen,
      panelState.isMoreOpen,
      panelState.isStatsOpen,
      panelState.isSettingsOpen,
      panelState.isFeedbackOpen,
    ]
  );

  const mobilePanelSetters = useMemo(
    () => ({
      setIsTasksOpen: panelState.setIsTasksOpen,
      setIsNotesOpen: panelState.setIsNotesOpen,
      setIsScenesOpen: panelState.setIsScenesOpen,
      setIsMixerOpen: panelState.setIsMixerOpen,
      setIsEmbedPlayerOpen: embedState.setIsEmbedPlayerOpen,
      setIsRoomsOpen: panelState.setIsRoomsOpen,
      setIsChatOpen: panelState.setIsChatOpen,
      setIsStatsOpen: panelState.setIsStatsOpen,
      setIsSettingsOpen: panelState.setIsSettingsOpen,
      setIsFeedbackOpen: panelState.setIsFeedbackOpen,
      setIsMoreOpen: panelState.setIsMoreOpen,
    }),
    [
      panelState.setIsTasksOpen,
      panelState.setIsNotesOpen,
      panelState.setIsScenesOpen,
      panelState.setIsMixerOpen,
      embedState.setIsEmbedPlayerOpen,
      panelState.setIsRoomsOpen,
      panelState.setIsChatOpen,
      panelState.setIsStatsOpen,
      panelState.setIsSettingsOpen,
      panelState.setIsFeedbackOpen,
      panelState.setIsMoreOpen,
    ]
  );

  const mobileNavState = useMobileNavState({
    isMobile,
    isZenMode: displayState.isZenMode,
    onExitZen: displayState.handleExitZen,
    setIsZenMode: displayState.setIsZenMode,
    systemFlags: displayState.systemFlags,
    panelStates: mobilePanelStates,
    panelSetters: mobilePanelSetters,
    handleTogglePomodoroVisibility: timerState.handleTogglePomodoroVisibility,
    setIsPomodoroVisible: timerState.setIsPomodoroVisible,
  });

  // Đồng bộ refs sau mỗi commit render mà không vi phạm React render rules
  useEffect(() => {
    mobileNavStateRef.current = mobileNavState;
    panelStateRef.current = panelState;
    embedStateRef.current = embedState;
  }, [mobileNavState, panelState, embedState]);

  // 7. Hotkeys bàn phím
  useStudyKeyboard({
    closeSettings: panelState.handleCloseSettings,
    toggleFullscreen: displayState.toggleFullscreen,
    togglePomodoro: timerState.handleTogglePomodoroVisibility,
    setTasksOpen: panelState.setIsTasksOpen,
    setNotesOpen: panelState.setIsNotesOpen,
    setScenesOpen: panelState.setIsScenesOpen,
    setMixerOpen: panelState.setIsMixerOpen,
    setEmbedOpen: embedState.setIsEmbedPlayerOpen,
    setShortcutsOpen: panelState.setIsShortcutsHelpOpen,
    setZenMode: displayState.setIsZenMode,
    setCommandOpen: panelState.setIsCommandOpen,
    setRoomsOpen: panelState.setRoomsOpenGated,
    setChatOpen: panelState.setChatOpenGated,
  });

  // 8. Command Palette
  const commandActions = useMemo<CommandAction[]>(
    () => [
      {
        id: "nav-pomodoro",
        group: "Mở nhanh",
        label: "Đồng hồ Pomodoro",
        hint: "T",
        run: () => timerState.handleTogglePomodoroVisibility(),
      },
      {
        id: "nav-tasks",
        group: "Mở nhanh",
        label: "Kế hoạch học tập",
        hint: "K",
        run: () => panelState.openPanelOnly(panelState.setIsTasksOpen),
      },
      {
        id: "nav-notes",
        group: "Mở nhanh",
        label: "Ghi chép nhanh",
        hint: "N",
        run: () => panelState.openPanelOnly(panelState.setIsNotesOpen),
      },
      {
        id: "nav-scenes",
        group: "Mở nhanh",
        label: "Không gian làm việc",
        hint: "B",
        run: () => panelState.openPanelOnly(panelState.setIsScenesOpen),
      },
      {
        id: "nav-embed",
        group: "Mở nhanh",
        label: "Đài phát YouTube & Spotify",
        hint: "E",
        run: () => panelState.openPanelOnly(embedState.setIsEmbedPlayerOpen),
      },
      {
        id: "nav-mixer",
        group: "Mở nhanh",
        label: "Bộ trộn âm thanh",
        hint: "P",
        run: () => panelState.openPanelOnly(panelState.setIsMixerOpen),
      },
      ...(displayState.systemFlags.chatEnabled
        ? [
            {
              id: "nav-chat",
              group: "Mở nhanh",
              label: "Trợ lý học tập AI",
              hint: "C",
              run: () => panelState.openPanelOnly(panelState.setChatOpenGated),
            },
          ]
        : []),
      {
        id: "nav-settings",
        group: "Mở nhanh",
        label: "Cài đặt không gian",
        run: () => panelState.handleOpenSettings(),
      },
      {
        id: "nav-stats",
        group: "Mở nhanh",
        label: "Thống kê thời gian tập trung",
        run: () => panelState.setIsStatsOpen(true),
      },
      {
        id: "act-feedback",
        group: "Hành động",
        label: "Gửi góp ý / báo lỗi",
        run: () => panelState.handleOpenFeedback(),
      },
      {
        id: "nav-tour",
        group: "Mở nhanh",
        label: "Xem lại tour hướng dẫn",
        run: () => panelState.setIsTourOpen(true),
      },
      {
        id: "act-zen",
        group: "Hành động",
        label: "Bật/tắt chế độ Zen",
        hint: "Z",
        run: () => displayState.setIsZenMode((prev) => !prev),
      },
      {
        id: "act-mute",
        group: "Hành động",
        label: "Bật/tắt tiếng chung",
        hint: "M",
        run: () => displayState.toggleGlobalMute(),
      },
      {
        id: "act-fullscreen",
        group: "Hành động",
        label: "Bật/tắt toàn màn hình",
        hint: "F",
        run: () => displayState.toggleFullscreen(),
      },
      ...STUDY_SCENES.map((s) => ({
        id: `scene-${s.id}`,
        group: "Bối cảnh",
        label: s.name,
        run: () => sceneState.handleSelectScene(s),
      })),
    ],
    [
      timerState.handleTogglePomodoroVisibility,
      panelState.openPanelOnly,
      panelState.setIsTasksOpen,
      panelState.setIsNotesOpen,
      panelState.setIsScenesOpen,
      embedState.setIsEmbedPlayerOpen,
      panelState.setIsMixerOpen,
      displayState.systemFlags.chatEnabled,
      panelState.setChatOpenGated,
      panelState.handleOpenSettings,
      panelState.setIsStatsOpen,
      panelState.handleOpenFeedback,
      panelState.setIsTourOpen,
      displayState.setIsZenMode,
      displayState.toggleGlobalMute,
      displayState.toggleFullscreen,
      sceneState.handleSelectScene,
    ]
  );

  return useMemo(
    () => ({
      // Scene & Background
      currentScene: sceneState.currentScene,
      pendingScene: sceneState.pendingScene,
      isPreloadingScene: sceneState.isPreloadingScene,
      handleSelectScene: sceneState.handleSelectScene,
      setCurrentSceneDirectly: sceneState.setCurrentSceneDirectly,
      isSlideshowOn: sceneState.isSlideshowOn,
      slideshowIntervalMin: sceneState.slideshowIntervalMin,
      slideshowPool: sceneState.slideshowPool,
      isSlideshowPoolFavorites: sceneState.isSlideshowPoolFavorites,
      handleToggleSlideshow: sceneState.handleToggleSlideshow,
      handleCycleSlideshowInterval: sceneState.handleCycleSlideshowInterval,
      handleRandomScene: sceneState.handleRandomScene,

      // Layout & Display Mode
      isFullscreen: displayState.isFullscreen,
      toggleFullscreen: displayState.toggleFullscreen,
      isGlobalMuted: displayState.isGlobalMuted,
      toggleGlobalMute: displayState.toggleGlobalMute,
      setGlobalMute: displayState.setGlobalMute,
      isZenMode: displayState.isZenMode,
      setIsZenMode: displayState.setIsZenMode,
      isMobile,
      isAnyModalOpen: panelState.isAnyModalOpen,
      isAnyMobileSheetOpen: panelState.isAnyMobileSheetOpen,

      // Centerpiece Pomodoro & Timer
      isPomodoroVisible: timerState.isPomodoroVisible,
      setIsPomodoroVisible: timerState.setIsPomodoroVisible,
      centerTab: timerState.centerTab,
      setCenterTab: timerState.setCenterTab,
      handleToggleClock: timerState.handleToggleClock,
      handleTogglePomodoroVisibility: timerState.handleTogglePomodoroVisibility,
      handleWidgetToggleVisibility: timerState.handleWidgetToggleVisibility,
      isTimerRunning: timerState.isTimerRunning,
      setIsTimerRunning: timerState.setIsTimerRunning,

      // Settings
      isSettingsOpen: panelState.isSettingsOpen,
      setIsSettingsOpen: panelState.setIsSettingsOpen,
      handleOpenSettings: panelState.handleOpenSettings,
      handleCloseSettings: panelState.handleCloseSettings,
      handleToggleSettings: panelState.handleToggleSettings,
      isFeedbackOpen: panelState.isFeedbackOpen,
      setIsFeedbackOpen: panelState.setIsFeedbackOpen,
      handleOpenFeedback: panelState.handleOpenFeedback,
      handleCloseFeedback: panelState.handleCloseFeedback,
      showClockSeconds: displayState.showClockSeconds,
      handleToggleClockSeconds: displayState.handleToggleClockSeconds,
      isClock12Hour: displayState.isClock12Hour,
      handleToggleClock12Hour: displayState.handleToggleClock12Hour,
      showStopwatchMilliseconds: displayState.showStopwatchMilliseconds,
      handleToggleStopwatchMilliseconds: displayState.handleToggleStopwatchMilliseconds,
      pomodoroDurations: displayState.pomodoroDurations,
      handleSavePomodoroDurations: displayState.handleSavePomodoroDurations,
      soundEnabled: displayState.soundEnabled,
      handleToggleSound: displayState.handleToggleSound,
      soundType: displayState.soundType,
      handleSelectSoundType: displayState.handleSelectSoundType,
      keepAwake: displayState.keepAwake,
      handleToggleKeepAwake: displayState.handleToggleKeepAwake,
      wakeLockSupported: displayState.wakeLockSupported,

      // Widgets
      isTasksOpen: panelState.isTasksOpen,
      setIsTasksOpen: panelState.setIsTasksOpen,
      handleToggleTasks: panelState.handleToggleTasks,

      isNotesOpen: panelState.isNotesOpen,
      setIsNotesOpen: panelState.setIsNotesOpen,
      handleToggleNotes: panelState.handleToggleNotes,

      isScenesOpen: panelState.isScenesOpen,
      setIsScenesOpen: panelState.setIsScenesOpen,
      handleToggleScenes: panelState.handleToggleScenes,

      isMixerOpen: panelState.isMixerOpen,
      setIsMixerOpen: panelState.setIsMixerOpen,
      handleToggleMixer: panelState.handleToggleMixer,
      handleCloseMixer: panelState.handleCloseMixer,

      isEmbedPlayerOpen: embedState.isEmbedPlayerOpen,
      setIsEmbedPlayerOpen: embedState.setIsEmbedPlayerOpen,
      handleToggleEmbed: embedState.handleToggleEmbed,
      handleOpenEmbedRoot: embedState.handleOpenEmbedRoot,
      handleCloseEmbed: embedState.handleCloseEmbed,

      isExternalStreamActive: embedState.isExternalStreamActive,
      setIsExternalStreamActive: embedState.setIsExternalStreamActive,
      externalActiveItem: embedState.externalActiveItem,
      setExternalActiveItem: embedState.setExternalActiveItem,
      handleStopExternalStream: embedState.handleStopExternalStream,

      isPipActive: embedState.isPipActive,
      setIsPipActive: embedState.setIsPipActive,

      isShortcutsHelpOpen: panelState.isShortcutsHelpOpen,
      setIsShortcutsHelpOpen: panelState.setIsShortcutsHelpOpen,
      handleToggleShortcutsHelp: panelState.handleToggleShortcutsHelp,

      isTourOpen: panelState.isTourOpen,
      setIsTourOpen: panelState.setIsTourOpen,

      isCommandOpen: panelState.isCommandOpen,
      setIsCommandOpen: panelState.setIsCommandOpen,
      commandActions,

      systemFlags: displayState.systemFlags,

      isRoomsOpen: panelState.isRoomsOpen,
      setIsRoomsOpen: panelState.setRoomsOpenGated,

      isChatOpen: panelState.isChatOpen,
      setIsChatOpen: panelState.setChatOpenGated,

      isStatsOpen: panelState.isStatsOpen,
      setIsStatsOpen: panelState.setIsStatsOpen,
      bringPanelToFront: panelState.bringPanelToFront,
      getPanelZIndex: panelState.getPanelZIndex,

      // Mobile Navigation & Sheets
      isMoreOpen: panelState.isMoreOpen,
      setIsMoreOpen: panelState.setIsMoreOpen,
      mobileCurrentScreen: mobileNavState.mobileCurrentScreen,
      mobileCanGoBack: mobileNavState.mobileCanGoBack,
      mobilePrevScreen: mobileNavState.mobilePrevScreen,
      mobilePush: mobileNavState.mobilePush,
      mobilePop: mobileNavState.mobilePop,
      mobileOpenRoot: mobileNavState.mobileOpenRoot,
      handleMobileBack: mobileNavState.handleMobileBack,
      handleMobileCloseAllSheets: mobileNavState.handleMobileCloseAllSheets,
      handleOpenTasksDetail: mobileNavState.handleOpenTasksDetail,
      handleOpenNotesDetail: mobileNavState.handleOpenNotesDetail,
      handleCloseDetail: mobileNavState.handleCloseDetail,
      handleOpenChatRoot: mobileNavState.handleOpenChatRoot,
      handleOpenScenesRoot: mobileNavState.handleOpenScenesRoot,
      handleOpenRoomsRoot: mobileNavState.handleOpenRoomsRoot,
      handleOpenRadioRoot: mobileNavState.handleOpenRadioRoot,
      handleOpenStatsRoot: mobileNavState.handleOpenStatsRoot,
      handleMobileNavSelect: mobileNavState.handleMobileNavSelect,
      handleMoreSelect: mobileNavState.handleMoreSelect,
      activeNavTab: mobileNavState.activeNavTab,
    }),
    [
      sceneState,
      displayState,
      timerState,
      panelState,
      embedState,
      mobileNavState,
      commandActions,
      isMobile,
    ]
  );
}

export type StudySpaceState = ReturnType<typeof useStudySpaceState>;
