"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { STUDY_SCENES, StudyEmbedItem } from "@/components/study/study-types";
import { useScenePreloader } from "@/lib/use-scene-preloader";
import {
  useSceneSlideshow,
  SLIDESHOW_INTERVALS_MIN,
  DEFAULT_SLIDESHOW_INTERVAL_MIN,
} from "@/lib/use-scene-slideshow";
import { useFavoriteScenes } from "@/lib/use-favorites";
import type { TimerTab } from "@/components/study/pomodoro/types";
import { useStudyKeyboard } from "@/lib/use-study-keyboard";
import type { MobileNavId } from "@/components/study/mobile/navigation/types";
import type { MobilePanelId } from "@/components/study/mobile/types";
import { useMobileStack, type MobileStackItem } from "@/components/study/mobile/navigation/useMobileStack";
import type { CommandAction } from "@/components/study/command/StudyCommandPalette";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { useStudySettings } from "@/lib/use-study-settings";
import { useWakeLock } from "@/lib/use-wake-lock";
import { sendYouTubeCommand } from "@/lib/youtube-remote";
import { useIsMobile } from "@/components/study/mobile/hooks/useIsMobile";
import {
  SYSTEM_FLAGS_DEFAULT,
  fetchSystemFlags,
  type SystemFlags,
} from "@/lib/system-flags";

export function useStudySpaceState() {
  const {
    currentScene,
    pendingScene,
    isPreloading: isPreloadingScene,
    selectScene: handleSelectScene,
    setCurrentSceneDirectly,
  } = useScenePreloader({
    initialScene: STUDY_SCENES[0],
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isGlobalMuted, setIsGlobalMuted] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const isMobile = useIsMobile();

  // Widget States
  const [isPomodoroVisible, setIsPomodoroVisible] = useState(false);
  const [centerTab, setCenterTab] = useState<TimerTab>("pomodoro");
  const [isTasksOpen, setIsTasksOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isScenesOpen, setIsScenesOpen] = useState(false);
  const [isMixerOpen, setIsMixerOpen] = useState(false);
  const [isEmbedPlayerOpen, setIsEmbedPlayerOpen] = useState(false);
  const [isExternalStreamActive, setIsExternalStreamActive] = useState(false);
  const [externalActiveItem, setExternalActiveItem] = useState<StudyEmbedItem | null>(null);
  const [isPipActive, setIsPipActive] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isRoomsOpen, setIsRoomsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPomodoroNavActive, setIsPomodoroNavActive] = useState(false);

  // Cờ hệ thống lấy từ chat-proxy /config: quyết định banner và việc khóa nút.
  const [systemFlags, setSystemFlags] = useState<SystemFlags>(SYSTEM_FLAGS_DEFAULT);

  useEffect(() => {
    let cancelled = false;

    const loadFlags = async () => {
      const next = await fetchSystemFlags();
      if (cancelled) return;
      setSystemFlags((prev) =>
        prev.chatEnabled === next.chatEnabled &&
        prev.roomsEnabled === next.roomsEnabled &&
        prev.maintenance === next.maintenance &&
        prev.banner === next.banner
          ? prev
          : next
      );
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") void loadFlags();
    };

    void loadFlags();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void loadFlags();
    }, 60 * 1000);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // Setter có cổng: cờ tắt thì không mở được, nhưng đóng thì luôn cho phép.
  const setChatOpenGated = useCallback<React.Dispatch<React.SetStateAction<boolean>>>(
    (value) => {
      setIsChatOpen((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        return systemFlags.chatEnabled ? next : false;
      });
    },
    [systemFlags.chatEnabled]
  );

  const setRoomsOpenGated = useCallback<React.Dispatch<React.SetStateAction<boolean>>>(
    (value) => {
      setIsRoomsOpen((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        return systemFlags.roomsEnabled ? next : false;
      });
    },
    [systemFlags.roomsEnabled]
  );

  // Đồng bộ mở đúng Sheet theo màn hình đỉnh stack mobile
  const syncScreenToStates = useCallback((screen: MobileStackItem | null) => {
    setIsTasksOpen(false);
    setIsNotesOpen(false);
    setIsScenesOpen(false);
    setIsMixerOpen(false);
    setIsEmbedPlayerOpen(false);
    setIsRoomsOpen(false);
    setIsChatOpen(false);
    setIsStatsOpen(false);
    setIsSettingsOpen(false);
    setIsMoreOpen(false);

    if (!screen) return;
    setIsPomodoroNavActive(false);
    if (screen.id === "more") setIsMoreOpen(true);
    else if (screen.id === "tasks" || screen.id === "tasks-detail") setIsTasksOpen(true);
    else if (screen.id === "notes" || screen.id === "notes-detail") setIsNotesOpen(true);
    else if (screen.id === "scenes") setIsScenesOpen(true);
    else if (screen.id === "stats") setIsStatsOpen(true);
    else if (screen.id === "settings") setIsSettingsOpen(true);
    else if (screen.id === "rooms") setIsRoomsOpen(true);
    else if (screen.id === "chat") setIsChatOpen(true);
    else if (screen.id === "embed") setIsEmbedPlayerOpen(true);
    else if (screen.id === "music") setIsMixerOpen(true);
  }, []);

  const handleExitZen = useCallback(() => {
    setIsZenMode(false);
  }, []);

  // Stack navigation cho mobile với đồng bộ hai chiều
  const {
    currentScreen: mobileCurrentScreen,
    canGoBack: mobileCanGoBack,
    previousScreen: mobilePrevScreen,
    push: mobilePush,
    pop: mobilePop,
    closeAll: mobileCloseAll,
    openRoot: mobileOpenRoot,
  } = useMobileStack({
    isZenMode,
    onExitZen: handleExitZen,
    onStackChange: (current) => {
      syncScreenToStates(current);
    },
  });

  const handleMobileCloseAllSheets = useCallback(() => {
    mobileCloseAll();
    syncScreenToStates(null);
    setIsPomodoroNavActive(false);
  }, [mobileCloseAll, syncScreenToStates]);

  const handleMobileBack = useCallback(() => {
    if (mobileCanGoBack) {
      mobilePop();
    } else {
      handleMobileCloseAllSheets();
    }
  }, [mobileCanGoBack, mobilePop, handleMobileCloseAllSheets]);

  // Slideshow tự xoay bối cảnh
  const [isSlideshowOn, setIsSlideshowOn] = useState(true);
  const [slideshowIntervalMin, setSlideshowIntervalMin] = useState(
    DEFAULT_SLIDESHOW_INTERVAL_MIN
  );
  const { favoriteIds } = useFavoriteScenes();
  const slideshowPool = useMemo(() => {
    const favs = STUDY_SCENES.filter((s) => favoriteIds.includes(s.id));
    return favs.length >= 2 ? favs : STUDY_SCENES;
  }, [favoriteIds]);
  const isSlideshowPoolFavorites = slideshowPool.length < STUDY_SCENES.length;

  useSceneSlideshow({
    enabled: isSlideshowOn,
    intervalMin: slideshowIntervalMin,
    currentSceneId: currentScene.id,
    pool: slideshowPool,
    onAdvance: handleSelectScene,
  });

  const handleToggleSlideshow = useCallback(() => {
    setIsSlideshowOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.slideshowEnabled, String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleCycleSlideshowInterval = useCallback(() => {
    setSlideshowIntervalMin((prev) => {
      const idx = SLIDESHOW_INTERVALS_MIN.indexOf(prev);
      const next =
        SLIDESHOW_INTERVALS_MIN[(idx + 1) % SLIDESHOW_INTERVALS_MIN.length];
      try {
        localStorage.setItem(STORAGE_KEYS.slideshowIntervalMin, String(next));
      } catch {}
      return next;
    });
  }, []);

  // Cài đặt chung
  const {
    showClockSeconds,
    isClock12Hour,
    showStopwatchMilliseconds,
    pomodoroDurations,
    soundEnabled,
    soundType,
    toggleClockSeconds: handleToggleClockSeconds,
    toggleClock12Hour: handleToggleClock12Hour,
    toggleStopwatchMilliseconds: handleToggleStopwatchMilliseconds,
    savePomodoroDurations: handleSavePomodoroDurations,
    toggleSound: handleToggleSound,
    selectSoundType: handleSelectSoundType,
    keepAwake,
    toggleKeepAwake: handleToggleKeepAwake,
  } = useStudySettings();

  // Khôi phục cài đặt từ LocalStorage
  useEffect(() => {
    try {
      const savedSceneId = localStorage.getItem(STORAGE_KEYS.sceneId);
      if (savedSceneId) {
        const found = STUDY_SCENES.find((s) => s.id === savedSceneId);
        if (found) setCurrentSceneDirectly(found);
      } else if (STUDY_SCENES.length > 0) {
        const random =
          STUDY_SCENES[Math.floor(Math.random() * STUDY_SCENES.length)];
        setCurrentSceneDirectly(random, { persist: false });
      }
      const savedMute = localStorage.getItem(STORAGE_KEYS.globalMute);
      if (savedMute !== null) {
        setIsGlobalMuted(savedMute === "true");
      }
      const savedPomoVis = localStorage.getItem(STORAGE_KEYS.pomoVisible);
      if (savedPomoVis !== null) {
        setIsPomodoroVisible(savedPomoVis === "true");
      }
      const savedSlideshow = localStorage.getItem(STORAGE_KEYS.slideshowEnabled);
      if (savedSlideshow !== null) {
        setIsSlideshowOn(savedSlideshow === "true");
      }
      const savedSlideshowMin = localStorage.getItem(STORAGE_KEYS.slideshowIntervalMin);
      const parsedMin = savedSlideshowMin ? parseInt(savedSlideshowMin, 10) : NaN;
      if (SLIDESHOW_INTERVALS_MIN.includes(parsedMin)) {
        setSlideshowIntervalMin(parsedMin);
      }
    } catch {}
  }, [setCurrentSceneDirectly]);

  // Lắng nghe sự kiện Bắt đầu tập trung vào Task
  useEffect(() => {
    const handleStartFocus = () => {
      setIsPomodoroVisible(true);
      setCenterTab("pomodoro");
      if (isMobile) {
        handleMobileCloseAllSheets();
      } else {
        setIsTasksOpen(false);
      }
    };

    window.addEventListener("study_space_start_focus", handleStartFocus);
    return () => {
      window.removeEventListener("study_space_start_focus", handleStartFocus);
    };
  }, [isMobile, handleMobileCloseAllSheets]);

  // Lắng nghe sự kiện mở Pomodoro
  useEffect(() => {
    const handleOpenPomodoro = () => {
      setIsPomodoroVisible(true);
      setCenterTab("pomodoro");
      if (isMobile) {
        handleMobileCloseAllSheets();
      }
    };

    window.addEventListener("study_space_open_pomodoro", handleOpenPomodoro);
    return () => {
      window.removeEventListener("study_space_open_pomodoro", handleOpenPomodoro);
    };
  }, [isMobile, handleMobileCloseAllSheets]);

  // Giữ màn hình sáng khi học
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);

  useEffect(() => {
    const onMusicState = (e: Event) => {
      setIsMusicPlaying(Boolean((e as CustomEvent).detail?.isPlaying));
    };
    window.addEventListener("zenstudy:music-state", onMusicState);
    return () => {
      window.removeEventListener("zenstudy:music-state", onMusicState);
    };
  }, []);

  // Làm nóng sẵn bảng Không gian khi máy rảnh
  useEffect(() => {
    let cancelled = false;
    const warmUp = () => {
      if (cancelled) return;
      void import("@/components/study/SceneSelectorWidget").catch(() => {});
    };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let idleId = 0;
    let timer = 0;
    if (typeof w.requestIdleCallback === "function") {
      idleId = w.requestIdleCallback(warmUp, { timeout: 3000 });
    } else {
      timer = window.setTimeout(warmUp, 2000);
    }
    return () => {
      cancelled = true;
      if (idleId && typeof w.cancelIdleCallback === "function") {
        w.cancelIdleCallback(idleId);
      }
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const { supported: wakeLockSupported } = useWakeLock(
    keepAwake && (isTimerRunning || isMusicPlaying || isExternalStreamActive)
  );

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
    setIsMixerOpen(false);
    setIsTasksOpen(false);
    setIsNotesOpen(false);
    setIsScenesOpen(false);
    setIsEmbedPlayerOpen(false);
    setIsShortcutsHelpOpen(false);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const handleToggleClock = useCallback(() => {
    if (isPomodoroVisible && centerTab === "clock") {
      setIsPomodoroVisible(false);
    } else {
      setIsPomodoroVisible(true);
      setCenterTab("clock");
    }
  }, [isPomodoroVisible, centerTab]);

  const handleToggleShortcutsHelp = useCallback(() => {
    setIsShortcutsHelpOpen((prev) => {
      const next = !prev;
      if (next) handleCloseSettings();
      return next;
    });
    setIsMixerOpen(false);
  }, [handleCloseSettings]);

  const handleToggleSettings = useCallback(() => {
    if (isSettingsOpen) {
      handleCloseSettings();
    } else {
      handleOpenSettings();
    }
  }, [isSettingsOpen, handleCloseSettings, handleOpenSettings]);

  const handleTogglePomodoroVisibility = useCallback(() => {
    setIsPomodoroVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.pomoVisible, String(next));
      } catch {}
      setIsPomodoroNavActive(next);
      return next;
    });
  }, []);

  const handleToggleTasks = useCallback(() => {
    setIsTasksOpen((prev) => {
      const next = !prev;
      if (next) handleCloseSettings();
      return next;
    });
    setIsScenesOpen(false);
    setIsMixerOpen(false);
  }, [handleCloseSettings]);

  const handleToggleNotes = useCallback(() => {
    setIsNotesOpen((prev) => {
      const next = !prev;
      if (next) handleCloseSettings();
      return next;
    });
    setIsScenesOpen(false);
    setIsMixerOpen(false);
  }, [handleCloseSettings]);

  const handleToggleScenes = useCallback(() => {
    setIsScenesOpen((prev) => {
      const next = !prev;
      if (next) handleCloseSettings();
      return next;
    });
    setIsTasksOpen(false);
    setIsNotesOpen(false);
    setIsMixerOpen(false);
    setIsEmbedPlayerOpen(false);
  }, [handleCloseSettings]);

  const handleToggleEmbed = useCallback(() => {
    if (isPipActive) {
      setIsEmbedPlayerOpen(true);
      setIsPipActive(false);
    } else {
      setIsEmbedPlayerOpen((prev) => {
        const next = !prev;
        if (next) handleCloseSettings();
        return next;
      });
    }
    setIsTasksOpen(false);
    setIsNotesOpen(false);
    setIsScenesOpen(false);
    setIsMixerOpen(false);
  }, [isPipActive, handleCloseSettings]);

  const toggleGlobalMute = useCallback(() => {
    setIsGlobalMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.globalMute, String(next));
      } catch {}
      return next;
    });
  }, []);

  const setGlobalMute = useCallback((muted: boolean) => {
    setIsGlobalMuted(muted);
    try {
      localStorage.setItem(STORAGE_KEYS.globalMute, String(muted));
    } catch {}
  }, []);

  const isFullscreenRef = useRef(false);
  useEffect(() => {
    isFullscreenRef.current = isFullscreen;
  }, [isFullscreen]);

  const toggleFullscreen = useCallback(() => {
    const next = !isFullscreenRef.current;
    if (typeof document !== "undefined") {
      try {
        if (next) {
          if (!document.fullscreenElement) {
            const el = document.documentElement as HTMLElement & {
              requestFullscreen?: () => Promise<void>;
              webkitRequestFullscreen?: () => void;
            };
            const req = el.requestFullscreen || el.webkitRequestFullscreen;
            if (typeof req === "function") {
              const result = req.call(el);
              if (result && typeof (result as Promise<void>).catch === "function") {
                (result as Promise<void>).catch(() => {});
              }
            }
          }
        } else {
          const doc = document as Document & {
            exitFullscreen?: () => Promise<void>;
            webkitExitFullscreen?: () => void;
          };
          if (document.fullscreenElement && (doc.exitFullscreen || doc.webkitExitFullscreen)) {
            const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
            if (typeof exit === "function") {
              const result = exit.call(doc);
              if (result && typeof (result as Promise<void>).catch === "function") {
                (result as Promise<void>).catch(() => {});
              }
            }
          }
        }
      } catch {}
    }
    setIsFullscreen(next);
  }, []);

  useStudyKeyboard({
    closeSettings: handleCloseSettings,
    toggleFullscreen,
    togglePomodoro: handleTogglePomodoroVisibility,
    setTasksOpen: setIsTasksOpen,
    setNotesOpen: setIsNotesOpen,
    setScenesOpen: setIsScenesOpen,
    setMixerOpen: setIsMixerOpen,
    setEmbedOpen: setIsEmbedPlayerOpen,
    setShortcutsOpen: setIsShortcutsHelpOpen,
    setZenMode: setIsZenMode,
    setCommandOpen: setIsCommandOpen,
    setRoomsOpen: setRoomsOpenGated,
    setChatOpen: setChatOpenGated,
  });

  // Lắng nghe sự kiện mở Takenote từ các component khác
  useEffect(() => {
    const handleOpenNotes = () => {
      if (isMobile) {
        if (mobileCurrentScreen) {
          mobilePush("notes", "Ghi chú");
        } else {
          mobileOpenRoot("notes", "Ghi chú");
        }
      } else {
        setIsNotesOpen(true);
      }
    };
    window.addEventListener("study-space:open-notes", handleOpenNotes);
    return () => {
      window.removeEventListener("study-space:open-notes", handleOpenNotes);
    };
  }, [isMobile, mobileCurrentScreen, mobilePush, mobileOpenRoot]);

  // Lắng nghe sự kiện gửi ghi chú sang Trợ lý AI
  useEffect(() => {
    const handleSendToChat = () => {
      if (!systemFlags.chatEnabled) return;
      if (isMobile) {
        if (mobileCurrentScreen) {
          mobilePush("chat", "Trợ lý AI");
        } else {
          mobileOpenRoot("chat", "Trợ lý AI");
        }
      } else {
        setIsChatOpen(true);
      }
    };
    window.addEventListener("study-space:send-to-chat", handleSendToChat);
    return () => {
      window.removeEventListener("study-space:send-to-chat", handleSendToChat);
    };
  }, [isMobile, mobileCurrentScreen, mobilePush, mobileOpenRoot, systemFlags.chatEnabled]);

  // Mở 1 panel duy nhất
  const openPanelOnly = useCallback((
    setter: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    handleCloseSettings();
    if (setter !== setIsNotesOpen) setIsTasksOpen(false);
    if (setter !== setIsTasksOpen) setIsNotesOpen(false);
    setIsScenesOpen(false);
    setIsMixerOpen(false);
    setIsEmbedPlayerOpen(false);
    setIsRoomsOpen(false);
    setIsChatOpen(false);
    setter(true);
  }, [handleCloseSettings]);

  // Handler ổn định cho Mobile
  const handleOpenTasksDetail = useCallback(
    () => mobilePush("tasks-detail", "Công việc"),
    [mobilePush]
  );
  const handleOpenNotesDetail = useCallback(
    () => mobilePush("notes-detail", "Ghi chú"),
    [mobilePush]
  );
  const handleCloseDetail = useCallback(() => mobilePop(), [mobilePop]);

  const handleOpenChatRoot = useCallback(
    () => {
      if (!systemFlags.chatEnabled) return;
      mobileOpenRoot("chat", "Trợ lý AI");
    },
    [mobileOpenRoot, systemFlags.chatEnabled]
  );
  const handleOpenScenesRoot = useCallback(
    () => mobileOpenRoot("scenes", "Không gian"),
    [mobileOpenRoot]
  );
  const handleOpenRoomsRoot = useCallback(
    () => {
      if (!systemFlags.roomsEnabled) return;
      mobileOpenRoot("rooms", "Phòng học nhóm");
    },
    [mobileOpenRoot, systemFlags.roomsEnabled]
  );
  const handleOpenRadioRoot = useCallback(
    () => mobileOpenRoot("embed", "Đài phát"),
    [mobileOpenRoot]
  );
  const handleOpenStatsRoot = useCallback(
    () => mobileOpenRoot("stats", "Thống kê"),
    [mobileOpenRoot]
  );

  const handleMobileNavSelect = useCallback(
    (id: MobileNavId) => {
      const isAnySheetOpen =
        isMoreOpen ||
        isTasksOpen ||
        isNotesOpen ||
        isScenesOpen ||
        isMixerOpen ||
        isEmbedPlayerOpen ||
        isRoomsOpen ||
        isChatOpen ||
        isStatsOpen ||
        isSettingsOpen;

      if (id === "pomodoro") {
        if (isAnySheetOpen) {
          handleMobileCloseAllSheets();
          setIsPomodoroVisible(true);
          setIsPomodoroNavActive(true);
          return;
        }
        handleTogglePomodoroVisibility();
        return;
      }

      setIsPomodoroNavActive(false);

      const isMoreGroupActive =
        isMoreOpen ||
        isScenesOpen ||
        isEmbedPlayerOpen ||
        isRoomsOpen ||
        isChatOpen ||
        isStatsOpen ||
        isSettingsOpen;

      const isCurrentlyActive =
        (id === "more" && isMoreGroupActive) ||
        (id === "tasks" && isTasksOpen) ||
        (id === "notes" && isNotesOpen) ||
        (id === "music" && isMixerOpen);

      if (isCurrentlyActive) {
        handleMobileCloseAllSheets();
        return;
      }

      if (id === "more") {
        mobileOpenRoot("more", "Thêm");
      } else if (id === "tasks") {
        mobileOpenRoot("tasks", "Công việc");
      } else if (id === "notes") {
        mobileOpenRoot("notes", "Ghi chú");
      } else if (id === "music") {
        mobileOpenRoot("music", "Nhạc & Âm thanh");
      }
    },
    [
      isMoreOpen,
      isTasksOpen,
      isNotesOpen,
      isScenesOpen,
      isMixerOpen,
      isEmbedPlayerOpen,
      isRoomsOpen,
      isChatOpen,
      isStatsOpen,
      isSettingsOpen,
      handleMobileCloseAllSheets,
      handleTogglePomodoroVisibility,
      mobileOpenRoot,
    ]
  );

  const handleMoreSelect = useCallback(
    (id: MobilePanelId) => {
      if (id === "notes") {
        mobilePush("notes", "Ghi chú");
      } else if (id === "scenes") {
        mobilePush("scenes", "Không gian");
      } else if (id === "embed") {
        mobilePush("embed", "Đài phát");
      } else if (id === "rooms") {
        if (systemFlags.roomsEnabled) mobilePush("rooms", "Phòng học nhóm");
      } else if (id === "chat") {
        if (systemFlags.chatEnabled) mobilePush("chat", "Trợ lý AI");
      } else if (id === "settings") {
        mobilePush("settings", "Cài đặt");
      } else if (id === "stats") {
        mobilePush("stats", "Thống kê");
      } else if (id === "pomodoro") {
        handleMobileCloseAllSheets();
        setIsZenMode(true);
      }
    },
    [mobilePush, handleMobileCloseAllSheets, systemFlags.chatEnabled, systemFlags.roomsEnabled]
  );

  const handleWidgetToggleVisibility = useCallback(() => {
    setIsPomodoroVisible((prev) => !prev);
  }, []);

  const handleOpenEmbedRoot = useCallback(() => {
    if (isMobile) {
      if (mobileCurrentScreen?.id === "embed") return;
      mobileOpenRoot("embed", "Đài phát");
    } else {
      handleCloseSettings();
      setIsTasksOpen(false);
      setIsNotesOpen(false);
      setIsScenesOpen(false);
      setIsMixerOpen(false);
      setIsEmbedPlayerOpen(true);
      setIsPipActive(false);
    }
  }, [isMobile, mobileOpenRoot, handleCloseSettings, mobileCurrentScreen]);

  const handleCloseEmbed = useCallback(() => {
    if (isMobile) {
      handleMobileCloseAllSheets();
    } else {
      setIsEmbedPlayerOpen(false);
    }
  }, [isMobile, handleMobileCloseAllSheets]);

  const handleStopExternalStream = useCallback(() => {
    setIsExternalStreamActive(false);
    setExternalActiveItem(null);
    sendYouTubeCommand("pauseVideo");
    try {
      localStorage.removeItem(STORAGE_KEYS.activeEmbed);
    } catch {}
  }, []);

  const handleCloseMixer = useCallback(() => {
    if (isMobile) {
      handleMobileCloseAllSheets();
    } else {
      setIsMixerOpen(false);
    }
  }, [isMobile, handleMobileCloseAllSheets]);

  const handleToggleMixer = useCallback(() => {
    if (isMobile) {
      if (isMixerOpen) {
        handleMobileCloseAllSheets();
      } else {
        mobileOpenRoot("music", "Nhạc & Âm thanh");
      }
    } else {
      setIsMixerOpen((prev) => {
        const next = !prev;
        if (next) {
          handleCloseSettings();
          setIsTasksOpen(false);
          setIsNotesOpen(false);
          setIsScenesOpen(false);
          setIsEmbedPlayerOpen(false);
          setIsShortcutsHelpOpen(false);
        }
        return next;
      });
    }
  }, [
    isMobile,
    isMixerOpen,
    handleMobileCloseAllSheets,
    mobileOpenRoot,
    handleCloseSettings,
  ]);

  const commandActions = useMemo<CommandAction[]>(
    () => [
      { id: "nav-pomodoro", group: "Mở nhanh", label: "Đồng hồ Pomodoro", hint: "T", run: () => handleTogglePomodoroVisibility() },
      { id: "nav-tasks", group: "Mở nhanh", label: "Kế hoạch học tập", hint: "K", run: () => openPanelOnly(setIsTasksOpen) },
      { id: "nav-notes", group: "Mở nhanh", label: "Ghi chép nhanh", hint: "N", run: () => openPanelOnly(setIsNotesOpen) },
      { id: "nav-scenes", group: "Mở nhanh", label: "Không gian làm việc", hint: "B", run: () => openPanelOnly(setIsScenesOpen) },
      { id: "nav-embed", group: "Mở nhanh", label: "Đài phát YouTube & Spotify", hint: "E", run: () => openPanelOnly(setIsEmbedPlayerOpen) },
      { id: "nav-mixer", group: "Mở nhanh", label: "Bộ trộn âm thanh", hint: "P", run: () => openPanelOnly(setIsMixerOpen) },
      ...(systemFlags.chatEnabled
        ? [{ id: "nav-chat", group: "Mở nhanh", label: "Trợ lý học tập AI", hint: "C", run: () => openPanelOnly(setChatOpenGated) }]
        : []),
      { id: "nav-settings", group: "Mở nhanh", label: "Cài đặt không gian", run: () => handleOpenSettings() },
      { id: "nav-tour", group: "Mở nhanh", label: "Xem lại tour hướng dẫn", run: () => setIsTourOpen(true) },
      { id: "act-zen", group: "Hành động", label: "Bật/tắt chế độ Zen", hint: "Z", run: () => setIsZenMode((prev) => !prev) },
      { id: "act-mute", group: "Hành động", label: "Bật/tắt tiếng chung", hint: "M", run: () => toggleGlobalMute() },
      { id: "act-fullscreen", group: "Hành động", label: "Bật/tắt toàn màn hình", hint: "F", run: () => toggleFullscreen() },
      ...STUDY_SCENES.map((s) => ({
        id: `scene-${s.id}`,
        group: "Bối cảnh",
        label: s.name,
        run: () => handleSelectScene(s),
      })),
    ],
    [
      handleTogglePomodoroVisibility,
      openPanelOnly,
      handleOpenSettings,
      toggleGlobalMute,
      toggleFullscreen,
      handleSelectScene,
      systemFlags.chatEnabled,
      setChatOpenGated,
    ]
  );

  const isAnyModalOpen =
    isSettingsOpen ||
    isStatsOpen ||
    isTasksOpen ||
    isScenesOpen ||
    (isEmbedPlayerOpen && !isPipActive) ||
    isMixerOpen ||
    isShortcutsHelpOpen;

  const activeNavTab = useMemo<MobileNavId | null>(() => {
    const currentId = mobileCurrentScreen?.id;
    if (currentId === "tasks" || currentId === "tasks-detail" || isTasksOpen) return "tasks";
    if (currentId === "notes" || currentId === "notes-detail" || isNotesOpen) return "notes";
    if (currentId === "music" || currentId === "mixer" || isMixerOpen) return "music";
    if (
      currentId === "more" ||
      currentId === "scenes" ||
      currentId === "embed" ||
      currentId === "rooms" ||
      currentId === "chat" ||
      currentId === "stats" ||
      currentId === "settings" ||
      isMoreOpen ||
      isScenesOpen ||
      isEmbedPlayerOpen ||
      isRoomsOpen ||
      isChatOpen ||
      isStatsOpen ||
      isSettingsOpen
    ) {
      return "more";
    }
    if (isPomodoroNavActive) {
      return "pomodoro";
    }
    return null;
  }, [
    mobileCurrentScreen,
    isTasksOpen,
    isNotesOpen,
    isMixerOpen,
    isMoreOpen,
    isScenesOpen,
    isEmbedPlayerOpen,
    isRoomsOpen,
    isChatOpen,
    isStatsOpen,
    isSettingsOpen,
    isPomodoroNavActive,
  ]);

  return useMemo(
    () => ({
      // Scene & Background
      currentScene,
      pendingScene,
      isPreloadingScene,
      handleSelectScene,
      setCurrentSceneDirectly,
      isSlideshowOn,
      slideshowIntervalMin,
      slideshowPool,
      isSlideshowPoolFavorites,
      handleToggleSlideshow,
      handleCycleSlideshowInterval,

      // Layout & Display Mode
      isFullscreen,
      toggleFullscreen,
      isGlobalMuted,
      toggleGlobalMute,
      setGlobalMute,
      isZenMode,
      setIsZenMode,
      isMobile,
      isAnyModalOpen,

      // Centerpiece Pomodoro & Timer
      isPomodoroVisible,
      setIsPomodoroVisible,
      centerTab,
      setCenterTab,
      handleToggleClock,
      handleTogglePomodoroVisibility,
      handleWidgetToggleVisibility,
      isTimerRunning,
      setIsTimerRunning,

      // Settings
      isSettingsOpen,
      setIsSettingsOpen,
      handleOpenSettings,
      handleCloseSettings,
      handleToggleSettings,
      showClockSeconds,
      handleToggleClockSeconds,
      isClock12Hour,
      handleToggleClock12Hour,
      showStopwatchMilliseconds,
      handleToggleStopwatchMilliseconds,
      pomodoroDurations,
      handleSavePomodoroDurations,
      soundEnabled,
      handleToggleSound,
      soundType,
      handleSelectSoundType,
      keepAwake,
      handleToggleKeepAwake,
      wakeLockSupported,

      // Widgets
      isTasksOpen,
      setIsTasksOpen,
      handleToggleTasks,

      isNotesOpen,
      setIsNotesOpen,
      handleToggleNotes,

      isScenesOpen,
      setIsScenesOpen,
      handleToggleScenes,

      isMixerOpen,
      setIsMixerOpen,
      handleToggleMixer,
      handleCloseMixer,

      isEmbedPlayerOpen,
      setIsEmbedPlayerOpen,
      handleToggleEmbed,
      handleOpenEmbedRoot,
      handleCloseEmbed,

      isExternalStreamActive,
      setIsExternalStreamActive,
      externalActiveItem,
      setExternalActiveItem,
      handleStopExternalStream,

      isPipActive,
      setIsPipActive,

      isShortcutsHelpOpen,
      setIsShortcutsHelpOpen,
      handleToggleShortcutsHelp,

      isTourOpen,
      setIsTourOpen,

      isCommandOpen,
      setIsCommandOpen,
      commandActions,

      systemFlags,

      isRoomsOpen,
      setIsRoomsOpen: setRoomsOpenGated,

      isChatOpen,
      setIsChatOpen: setChatOpenGated,

      isStatsOpen,
      setIsStatsOpen,

      // Mobile Navigation & Sheets
      isMoreOpen,
      setIsMoreOpen,
      mobileCurrentScreen,
      mobileCanGoBack,
      mobilePrevScreen,
      mobilePush,
      mobilePop,
      mobileOpenRoot,
      handleMobileBack,
      handleMobileCloseAllSheets,
      handleOpenTasksDetail,
      handleOpenNotesDetail,
      handleCloseDetail,
      handleOpenChatRoot,
      handleOpenScenesRoot,
      handleOpenRoomsRoot,
      handleOpenRadioRoot,
      handleOpenStatsRoot,
      handleMobileNavSelect,
      handleMoreSelect,
      activeNavTab,
    }),
    [
      currentScene,
      pendingScene,
      isPreloadingScene,
      handleSelectScene,
      setCurrentSceneDirectly,
      isSlideshowOn,
      slideshowIntervalMin,
      slideshowPool,
      isSlideshowPoolFavorites,
      handleToggleSlideshow,
      handleCycleSlideshowInterval,
      isFullscreen,
      toggleFullscreen,
      isGlobalMuted,
      toggleGlobalMute,
      setGlobalMute,
      isZenMode,
      setIsZenMode,
      isMobile,
      isAnyModalOpen,
      isPomodoroVisible,
      setIsPomodoroVisible,
      centerTab,
      setCenterTab,
      handleToggleClock,
      handleTogglePomodoroVisibility,
      handleWidgetToggleVisibility,
      isTimerRunning,
      setIsTimerRunning,
      isSettingsOpen,
      setIsSettingsOpen,
      handleOpenSettings,
      handleCloseSettings,
      handleToggleSettings,
      showClockSeconds,
      handleToggleClockSeconds,
      isClock12Hour,
      handleToggleClock12Hour,
      showStopwatchMilliseconds,
      handleToggleStopwatchMilliseconds,
      pomodoroDurations,
      handleSavePomodoroDurations,
      soundEnabled,
      handleToggleSound,
      soundType,
      handleSelectSoundType,
      keepAwake,
      handleToggleKeepAwake,
      wakeLockSupported,
      isTasksOpen,
      setIsTasksOpen,
      handleToggleTasks,
      isNotesOpen,
      setIsNotesOpen,
      handleToggleNotes,
      isScenesOpen,
      setIsScenesOpen,
      handleToggleScenes,
      isMixerOpen,
      setIsMixerOpen,
      handleToggleMixer,
      handleCloseMixer,
      isEmbedPlayerOpen,
      setIsEmbedPlayerOpen,
      handleToggleEmbed,
      handleOpenEmbedRoot,
      handleCloseEmbed,
      isExternalStreamActive,
      setIsExternalStreamActive,
      externalActiveItem,
      setExternalActiveItem,
      handleStopExternalStream,
      isPipActive,
      setIsPipActive,
      isShortcutsHelpOpen,
      setIsShortcutsHelpOpen,
      handleToggleShortcutsHelp,
      isTourOpen,
      setIsTourOpen,
      isCommandOpen,
      setIsCommandOpen,
      commandActions,
      systemFlags,
      isRoomsOpen,
      setRoomsOpenGated,
      isChatOpen,
      setChatOpenGated,
      isStatsOpen,
      setIsStatsOpen,
      isMoreOpen,
      setIsMoreOpen,
      mobileCurrentScreen,
      mobileCanGoBack,
      mobilePrevScreen,
      mobilePush,
      mobilePop,
      mobileOpenRoot,
      handleMobileBack,
      handleMobileCloseAllSheets,
      handleOpenTasksDetail,
      handleOpenNotesDetail,
      handleCloseDetail,
      handleOpenChatRoot,
      handleOpenScenesRoot,
      handleOpenRoomsRoot,
      handleOpenRadioRoot,
      handleOpenStatsRoot,
      handleMobileNavSelect,
      handleMoreSelect,
      activeNavTab,
    ]
  );
}

export type StudySpaceState = ReturnType<typeof useStudySpaceState>;
