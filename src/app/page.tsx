"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  CircleNotchIcon,
} from "@phosphor-icons/react";
import { STUDY_SCENES, StudyEmbedItem } from "@/components/study/study-types";
import { useScenePreloader } from "@/lib/use-scene-preloader";
import {
  useSceneSlideshow,
  SLIDESHOW_INTERVALS_MIN,
  DEFAULT_SLIDESHOW_INTERVAL_MIN,
} from "@/lib/use-scene-slideshow";
import { useFavoriteScenes } from "@/lib/use-favorites";
import { StudyMusicPlayer } from "@/components/study/music/StudyMusicPlayer";
import { StudyPomodoroWidget } from "@/components/study/pomodoro/StudyPomodoroWidget";
import type { TimerTab } from "@/components/study/pomodoro/types";
import { StudySettingsModal } from "@/components/study/StudySettingsModal";
import { MobileSettingsSheet } from "@/components/study/mobile/sheets/MobileSettingsSheet";
import { StudyBackground } from "@/components/study/StudyBackground";
import { useStudyKeyboard } from "@/lib/use-study-keyboard";
import { StudyTopBar } from "@/components/study/StudyTopBar";
import { StudyLeftDock } from "@/components/study/StudyLeftDock";
import { MobileTopBar } from "@/components/study/mobile/top/MobileTopBar";
import { StudyMobileNav } from "@/components/study/mobile/navigation/StudyMobileNav";
import { MobileMoreSheet } from "@/components/study/mobile/sheets/MobileMoreSheet";
import { MobileSceneSheet } from "@/components/study/mobile/sheets/MobileSceneSheet";
import { MobileTasksSheet } from "@/components/study/mobile/sheets/MobileTasksSheet";
import { MobileNotesSheet } from "@/components/study/mobile/sheets/MobileNotesSheet";
import { MobileFocusStatsSheet } from "@/components/study/mobile/sheets/MobileFocusStatsSheet";
import { FocusStatsModal } from "@/components/study/stats/FocusStatsModal";
import { MobileRadialBubbleMenu } from "@/components/study/mobile/navigation/MobileRadialBubbleMenu";
import { MobilePomodoroView } from "@/components/study/mobile/pomodoro/MobilePomodoroView";
import type { MobileNavId } from "@/components/study/mobile/navigation/types";
import type { MobilePanelId } from "@/components/study/mobile/types";
import { useMobileStack, type MobileStackItem } from "@/components/study/mobile/navigation/useMobileStack";
import { StudyShortcutsModal } from "@/components/study/StudyShortcutsModal";
import { StudyOnboardingTour } from "@/components/study/tour/StudyOnboardingTour";
import {
  StudyCommandPalette,
  type CommandAction,
} from "@/components/study/command/StudyCommandPalette";
import { StudySeoSemanticContent } from "@/components/study/seo/StudySeoSemanticContent";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { useStudySettings } from "@/lib/use-study-settings";
import { useWakeLock } from "@/lib/use-wake-lock";
import { sendYouTubeCommand } from "@/lib/youtube-remote";
import { useIsMobile } from "@/components/study/mobile/hooks/useIsMobile";

// Lazy Load heavy widgets with code-splitting to optimize First Contentful Paint & bundle size
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

const StudyEmbedPlayerWidget = dynamic(
  () => import("@/components/study/embed/StudyEmbedPlayerWidget").then((mod) => mod.StudyEmbedPlayerWidget),
  { ssr: false }
);

// Phòng LiveKit nặng (livekit-client + styles): chỉ tải khi bấm mở phòng
const StudyRoomsWidget = dynamic(
  () => import("@/components/study/rooms/StudyRoomsWidget").then((mod) => mod.StudyRoomsWidget),
  { ssr: false }
);

// Chat AI (firebase + fetch Worker): chỉ chạy ở trình duyệt
const StudyChatWidget = dynamic(
  () => import("@/components/study/chat/StudyChatWidget").then((mod) => mod.StudyChatWidget),
  { ssr: false }
);

const MobileChatSheet = dynamic(
  () => import("@/components/study/mobile/sheets/MobileChatSheet").then((mod) => mod.MobileChatSheet),
  { ssr: false }
);

export default function StudySpacePage() {
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
  const [isPomodoroVisible, setIsPomodoroVisible] = useState(true);
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

  const handleToggleChat = () => {
    setIsChatOpen((prev) => !prev);
  };

  // Đồng bộ mở đúng Sheet theo màn hình đỉnh stack
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

  // Stack navigation cho mobile với đồng bộ hai chiều (Back button cứng & giao diện)
  const {
    currentScreen: mobileCurrentScreen,
    canGoBack: mobileCanGoBack,
    previousScreen: mobilePrevScreen,
    push: mobilePush,
    pop: mobilePop,
    closeAll: mobileCloseAll,
    openRoot: mobileOpenRoot,
  } = useMobileStack({
    onStackChange: (current) => {
      syncScreenToStates(current);
    },
  });

  const handleMobileCloseAllSheets = useCallback(() => {
    mobileCloseAll();
    syncScreenToStates(null);
  }, [mobileCloseAll, syncScreenToStates]);

  const handleMobileBack = useCallback(() => {
    if (mobileCanGoBack) {
      mobilePop();
    } else {
      handleMobileCloseAllSheets();
    }
  }, [mobileCanGoBack, mobilePop, handleMobileCloseAllSheets]);

  // Slideshow tự xoay bối cảnh (mặc định bật 5 phút, nhớ lựa chọn vào LocalStorage)
  const [isSlideshowOn, setIsSlideshowOn] = useState(true);
  const [slideshowIntervalMin, setSlideshowIntervalMin] = useState(
    DEFAULT_SLIDESHOW_INTERVAL_MIN
  );
  const { favoriteIds } = useFavoriteScenes();
  const slideshowPool = useMemo(() => {
    const favs = STUDY_SCENES.filter((s) => favoriteIds.includes(s.id));
    return favs.length >= 2 ? favs : STUDY_SCENES;
  }, [favoriteIds]);
  const isSlideshowPoolFavorites =
    slideshowPool.length < STUDY_SCENES.length;
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

  // Unified Settings Modal State (Default: Tắt giây đồng hồ, Tắt .00 stopwatch, Bật chuông Pomodoro 25-5-15)
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

  // Phục hồi Background Scene & Cài đặt cá nhân từ LocalStorage khi vào lại trang.
  // Chưa từng chọn cảnh → mở cảnh ngẫu nhiên (không lưu để lần sau random tiếp).
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
  }, []);

  // Lắng nghe sự kiện Bắt đầu tập trung vào Task (tự động bật Pomodoro & đóng modal Tasks)
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

  // Mở thẳng UI Pomodoro (từ CTA trong modal Thống kê khi chưa có dữ liệu)
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

  // Giữ màn hình sáng khi đang học: chạy giờ / phát nhạc / phát đài
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

  // Làm nóng sẵn bảng Không gian (phím B) lúc máy rảnh sau khi vào trang.
  // Lần bấm đầu tiên sẽ mở ngay, không phải vừa tải code vừa chạy hình.
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

  const handleToggleShortcutsHelp = () => {
    setIsShortcutsHelpOpen((prev) => {
      const next = !prev;
      if (next) handleCloseSettings();
      return next;
    });
    setIsMixerOpen(false);
  };

  const handleToggleSettings = () => {
    if (isSettingsOpen) {
      handleCloseSettings();
    } else {
      handleOpenSettings();
    }
  };

  const handleTogglePomodoroVisibility = useCallback(() => {
    setIsPomodoroVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.pomoVisible, String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleToggleTasks = () => {
    setIsTasksOpen(!isTasksOpen);
    if (!isTasksOpen) handleCloseSettings();
    setIsNotesOpen(false);
    setIsScenesOpen(false);
    setIsMixerOpen(false);
  };

  const handleToggleNotes = () => {
    setIsNotesOpen(!isNotesOpen);
    if (!isNotesOpen) handleCloseSettings();
    setIsTasksOpen(false);
    setIsScenesOpen(false);
    setIsMixerOpen(false);
  };

  const handleToggleScenes = () => {
    setIsScenesOpen(!isScenesOpen);
    if (!isScenesOpen) handleCloseSettings();
    setIsTasksOpen(false);
    setIsNotesOpen(false);
    setIsMixerOpen(false);
    setIsEmbedPlayerOpen(false);
  };

  const handleToggleEmbed = () => {
    if (isPipActive) {
      setIsEmbedPlayerOpen(true);
      setIsPipActive(false);
    } else {
      setIsEmbedPlayerOpen(!isEmbedPlayerOpen);
    }
    if (!isEmbedPlayerOpen) handleCloseSettings();
    setIsTasksOpen(false);
    setIsNotesOpen(false);
    setIsScenesOpen(false);
    setIsMixerOpen(false);
  };

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

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
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
    setRoomsOpen: setIsRoomsOpen,
    setChatOpen: setIsChatOpen,
  });

  // Lắng nghe sự kiện mở Takenote từ các component khác (như nút Lưu note từ Chatbot)
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

  // Lắng nghe sự kiện gửi ghi chú sang Trợ lý AI (như nút Hỏi AI từ Takenote)
  useEffect(() => {
    const handleSendToChat = () => {
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
  }, [isMobile, mobileCurrentScreen, mobilePush, mobileOpenRoot]);

  // Mở 1 panel duy nhất (đóng settings + các panel khác)
  const openPanelOnly = (
    setter: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    handleCloseSettings();
    setIsTasksOpen(false);
    setIsNotesOpen(false);
    setIsScenesOpen(false);
    setIsMixerOpen(false);
    setIsEmbedPlayerOpen(false);
    setIsRoomsOpen(false);
    setIsChatOpen(false);
    setter(true);
  };

  // ---- Handler ổn định (identity không đổi giữa các lần render) ----
  // Truyền cho các component đã React.memo để memo không bị vô hiệu.
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
    () => mobileOpenRoot("chat", "Trợ lý AI"),
    [mobileOpenRoot]
  );
  const handleOpenScenesRoot = useCallback(
    () => mobileOpenRoot("scenes", "Không gian"),
    [mobileOpenRoot]
  );
  const handleOpenRoomsRoot = useCallback(
    () => mobileOpenRoot("rooms", "Phòng học nhóm"),
    [mobileOpenRoot]
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
          return;
        }
        handleTogglePomodoroVisibility();
        return;
      }

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
        mobilePush("rooms", "Phòng học nhóm");
      } else if (id === "chat") {
        mobilePush("chat", "Trợ lý AI");
      } else if (id === "settings") {
        mobilePush("settings", "Cài đặt");
      } else if (id === "stats") {
        mobilePush("stats", "Thống kê");
      } else if (id === "pomodoro") {
        handleMobileCloseAllSheets();
        setIsZenMode(true);
      }
    },
    [mobilePush, handleMobileCloseAllSheets]
  );

  const handleWidgetToggleVisibility = useCallback(() => {
    setIsPomodoroVisible((prev) => !prev);
  }, []);

  // Mở đài phát (dùng cho cả nút mở rộng stream lẫn onOpen của widget)
  const handleOpenEmbedRoot = useCallback(() => {
    if (isMobile) {
      // Đài phát đang mở sẵn (ví dụ vừa bấm phát một đài -> onPlaySuccess gọi onOpen)
      // thì giữ nguyên ngăn xếp. openRoot ở đây sẽ reset về [embed], nuốt mất nút
      // "Quay lại <màn trước>" (khi mở từ bảng Thêm) làm nút lúc hiện lúc mất.
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
      { id: "nav-chat", group: "Mở nhanh", label: "Trợ lý học tập AI", hint: "C", run: () => openPanelOnly(setIsChatOpen) },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleSelectScene]
  );

  const isAnyModalOpen =
    isSettingsOpen ||
    isStatsOpen ||
    isTasksOpen ||
    isNotesOpen ||
    isScenesOpen ||
    (isEmbedPlayerOpen && !isPipActive) ||
    isMixerOpen ||
    isShortcutsHelpOpen;

  // Xác định tab đang sáng trên thanh điều hướng mobile trực tiếp theo đỉnh ngăn xếp
  const activeNavTab = useMemo<MobileNavId>(() => {
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
    return "pomodoro";
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
  ]);

  return (
    <div className="fixed inset-0 sm:relative sm:w-screen sm:h-dvh overflow-hidden bg-slate-950 text-white select-none font-sans">
      <StudyBackground scene={currentScene} isBlurActive={isAnyModalOpen} />

      {/* Top Navigation Bar: desktop giữ nguyên, mobile dùng bản gọn */}
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
            setIsSettingsOpen(false);
            setIsStatsOpen(false);
          }}
          onExitZen={() => setIsZenMode(false)}
          onToggleMute={toggleGlobalMute}
          onToggleSettings={handleToggleSettings}
          onToggleFullscreen={toggleFullscreen}
        />
      </div>
      <MobileTopBar
        isZenMode={isZenMode}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      {/* Floating Left Dock: chỉ hiện trên máy tính, mobile dùng thanh dưới */}
      {!isMobile && (
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
      )}

      {/* Tasks Widget: Phân ly rõ ràng Mobile & Desktop */}
      {!isMobile && <StudyTasksWidget isOpen={isTasksOpen} onClose={() => setIsTasksOpen(false)} />}
      {isMobile && (
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

      {/* Notes Widget: Phân ly rõ ràng Mobile & Desktop */}
      {!isMobile && (
        <StudyNotesWidget 
          isOpen={isNotesOpen} 
          onClose={() => setIsNotesOpen(false)} 
        />
      )}
      {isMobile && (
        <MobileNotesSheet
          isOpen={isNotesOpen}
          onClose={handleMobileCloseAllSheets}
          onBack={mobileCanGoBack ? handleMobileBack : undefined}
          backLabel={mobileCanGoBack ? mobilePrevScreen?.title : undefined}
          isEditingDetail={mobileCurrentScreen?.id === "notes-detail"}
          onOpenDetail={handleOpenNotesDetail}
        />
      )}

      {/* Desktop Scene Selector */}
      {!isMobile && (
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
      )}

      {/* Mobile Scene Selector Sheet */}
      {isMobile && (
        <MobileSceneSheet
          isOpen={isScenesOpen}
          onClose={handleMobileCloseAllSheets}
          onBack={mobileCanGoBack ? handleMobileBack : undefined}
          backLabel={mobileCanGoBack ? mobilePrevScreen?.title : undefined}
          currentScene={currentScene}
          pendingScene={pendingScene}
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
      )}

      {/* Floating Scene Preload Status Capsule (Hiển thị khi nạp bối cảnh mới lúc mạng yếu) */}
      <AnimatePresence>
        {isPreloadingScene && pendingScene && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 px-4 py-2 rounded-full bg-black/85 backdrop-blur-2xl border border-white/20 text-white text-xs shadow-[0_12px_40px_rgba(0,0,0,0.8)] pointer-events-none select-none"
          >
            <CircleNotchIcon className="w-3.5 h-3.5 animate-spin text-accent-music-glow shrink-0" />
            <span className="text-slate-200">
              Đang tải bối cảnh <strong className="text-white font-semibold">{pendingScene.name}</strong>...
            </span>
            <span className="text-[10px] text-accent-music-bright font-mono bg-white/10 px-1.5 py-0.5 rounded border border-white/10">
              {pendingScene.type === "VIDEO" ? "Video" : "Ảnh"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      <StudyEmbedPlayerWidget 
        isOpen={isEmbedPlayerOpen} 
        onClose={handleCloseEmbed}
        onBack={isMobile && mobileCanGoBack ? handleMobileBack : undefined}
        backLabel={isMobile && mobileCanGoBack ? mobilePrevScreen?.title : undefined}
        onOpen={handleOpenEmbedRoot}
        onPipModeChange={setIsPipActive}
        activeItem={externalActiveItem}
        onStreamActiveChange={setIsExternalStreamActive}
        onActiveItemChange={setExternalActiveItem}
        isZenMode={isZenMode}
      />

      {/* Unified Study Settings Modal: Phân ly rõ ràng Mobile & Desktop */}
      {!isMobile && (
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
      )}
      {isMobile && (
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

      {/* Focus Stats: Phân ly rõ ràng Mobile Sheet & Desktop Modal */}
      {!isMobile && (
        <FocusStatsModal
          isOpen={isStatsOpen}
          onClose={() => setIsStatsOpen(false)}
        />
      )}
      {isMobile && (
        <MobileFocusStatsSheet
          isOpen={isStatsOpen}
          onClose={handleMobileCloseAllSheets}
          onBack={mobileCanGoBack ? handleMobileBack : undefined}
          backLabel={mobileCanGoBack ? mobilePrevScreen?.title : undefined}
        />
      )}
      {/* Main Center Area: Ambient Centerpiece Pomodoro & Stopwatch hòa vào background */}
      <main className="relative z-10 w-full h-full flex flex-col items-center justify-center pointer-events-none px-4 pb-14 mobile-content-safe">
        <StudySeoSemanticContent />
        <MobilePomodoroView
          className={centerTab === "stopwatch" ? "stopwatch-pin-top" : undefined}
        >
          <StudyPomodoroWidget
            isVisible={isPomodoroVisible}
            activeTab={centerTab}
            onTabChange={setCenterTab}
            onToggleVisibility={handleWidgetToggleVisibility}
            onRunningChange={setIsTimerRunning}
            showClockSeconds={showClockSeconds}
            isClock12Hour={isClock12Hour}
            showStopwatchMilliseconds={showStopwatchMilliseconds}
            durations={pomodoroDurations}
            soundEnabled={soundEnabled}
            soundType={soundType}
          />
        </MobilePomodoroView>
      </main>

      {/* Bottom Floating Music Player & Controls (Giữ luôn mounted để nhạc không bao giờ bị dừng khi Ẩn UI) */}
      <StudyMusicPlayer 
        isGlobalMuted={isGlobalMuted} 
        onToggleMute={toggleGlobalMute}
        onMuteChange={setGlobalMute}
        isZenMode={isZenMode}
        isMixerOpen={isMixerOpen}
        isExternalStreamActive={isExternalStreamActive}
        externalStreamItem={externalActiveItem}
        onExpandExternalStream={handleOpenEmbedRoot}
        onStopExternalStream={handleStopExternalStream}
        onToggleMixer={handleToggleMixer}
        onCloseMixer={handleCloseMixer}
        onBack={isMobile && mobileCanGoBack ? handleMobileBack : undefined}
        backLabel={isMobile && mobileCanGoBack ? mobilePrevScreen?.title : undefined}
      />

      {/* Keyboard Shortcuts Cheat Sheet Modal */}
      <StudyShortcutsModal
        isOpen={isShortcutsHelpOpen}
        onClose={() => setIsShortcutsHelpOpen(false)}
        onOpenTour={() => setIsTourOpen(true)}
      />

      {/* Phòng học nhóm (video call) */}
      <StudyRoomsWidget
        isOpen={isRoomsOpen}
        onClose={isMobile ? handleMobileCloseAllSheets : () => setIsRoomsOpen(false)}
        onOpen={() => {
          if (isMobile) {
            mobileOpenRoot("rooms", "Phòng học nhóm");
          } else {
            setIsRoomsOpen(true);
          }
        }}
        onBack={isMobile && mobileCanGoBack ? handleMobileBack : undefined}
        backLabel={isMobile && mobileCanGoBack ? mobilePrevScreen?.title : undefined}
      />

      {/* Trợ lý chat AI: Phân ly rõ ràng Mobile Sheet & Desktop Widget */}
      {!isMobile && (
        <StudyChatWidget
          isOpen={isChatOpen}
          onOpenChange={setIsChatOpen}
          onClose={() => setIsChatOpen(false)}
          isZenMode={isZenMode}
        />
      )}
      {isMobile && (
        <MobileChatSheet
          isOpen={isChatOpen}
          onClose={handleMobileCloseAllSheets}
          onBack={mobileCanGoBack ? handleMobileBack : undefined}
          backLabel={mobileCanGoBack ? mobilePrevScreen?.title : undefined}
        />
      )}

      {/* First-time Onboarding Tour & Interactive Spotlight Walkthrough */}
      <StudyOnboardingTour
        isOpen={isTourOpen ? true : undefined}
        onClose={() => setIsTourOpen(false)}
      />

      {/* Command Palette mở nhanh (Cmd/Ctrl+K) - Chỉ dành cho Máy tính */}
      {!isMobile && (
        <StudyCommandPalette
          isOpen={isCommandOpen}
          onClose={() => setIsCommandOpen(false)}
          actions={commandActions}
        />
      )}

      {/* Mobile: thanh dưới 5 nút luôn luôn hiển thị */}
      {isMobile && !isZenMode && (
        <StudyMobileNav active={activeNavTab} onSelect={handleMobileNavSelect} />
      )}

      {/* Mobile: bảng Thêm 3 cụm */}
      {isMobile && (
        <MobileMoreSheet
          isOpen={isMoreOpen}
          onClose={handleMobileCloseAllSheets}
          onSelect={handleMoreSelect}
        />
      )}

      {/* Mobile: bong bóng menu tròn kéo tự do, bấm mở full.
          Ẩn khi có bảng nào đang mở để khỏi đè lên nội dung. */}
      {isMobile &&
        !isZenMode &&
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
    </div>
  );
}
