"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
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
import { StudyBackground } from "@/components/study/StudyBackground";
import { useStudyKeyboard } from "@/lib/use-study-keyboard";
import { StudyTopBar } from "@/components/study/StudyTopBar";
import { StudyLeftDock } from "@/components/study/StudyLeftDock";
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

  const handleToggleSlideshow = () => {
    setIsSlideshowOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.slideshowEnabled, String(next));
      } catch {}
      return next;
    });
  };

  const handleCycleSlideshowInterval = () => {
    setSlideshowIntervalMin((prev) => {
      const idx = SLIDESHOW_INTERVALS_MIN.indexOf(prev);
      const next =
        SLIDESHOW_INTERVALS_MIN[(idx + 1) % SLIDESHOW_INTERVALS_MIN.length];
      try {
        localStorage.setItem(STORAGE_KEYS.slideshowIntervalMin, String(next));
      } catch {}
      return next;
    });
  };

  // Unified Settings Modal State (Default: Tắt giây đồng hồ, Tắt .00 stopwatch, Bật chuông Pomodoro 25-5-15)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
      setIsTasksOpen(false);
    };

    window.addEventListener("study_space_start_focus", handleStartFocus);
    return () => {
      window.removeEventListener("study_space_start_focus", handleStartFocus);
    };
  }, []);

  // Mở thẳng UI Pomodoro (từ CTA trong modal Thống kê khi chưa có dữ liệu)
  useEffect(() => {
    const handleOpenPomodoro = () => {
      setIsPomodoroVisible(true);
      setCenterTab("pomodoro");
    };

    window.addEventListener("study_space_open_pomodoro", handleOpenPomodoro);
    return () => {
      window.removeEventListener("study_space_open_pomodoro", handleOpenPomodoro);
    };
  }, []);

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

  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
    setIsMixerOpen(false);
    setIsTasksOpen(false);
    setIsNotesOpen(false);
    setIsScenesOpen(false);
    setIsEmbedPlayerOpen(false);
    setIsShortcutsHelpOpen(false);
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
  };

  const handleToggleClock = () => {
    if (isPomodoroVisible && centerTab === "clock") {
      setIsPomodoroVisible(false);
    } else {
      setIsPomodoroVisible(true);
      setCenterTab("clock");
    }
  };

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

  const handleTogglePomodoroVisibility = () => {
    setIsPomodoroVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.pomoVisible, String(next));
      } catch {}
      return next;
    });
  };

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

  const toggleGlobalMute = () => {
    setIsGlobalMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.globalMute, String(next));
      } catch {}
      return next;
    });
  };

  const setGlobalMute = (muted: boolean) => {
    setIsGlobalMuted(muted);
    try {
      localStorage.setItem(STORAGE_KEYS.globalMute, String(muted));
    } catch {}
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };



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
  });

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
    setter(true);
  };

  const commandActions = useMemo<CommandAction[]>(
    () => [
      { id: "nav-pomodoro", group: "Mở nhanh", label: "Đồng hồ Pomodoro", hint: "T", run: () => handleTogglePomodoroVisibility() },
      { id: "nav-tasks", group: "Mở nhanh", label: "Kế hoạch học tập", hint: "K", run: () => openPanelOnly(setIsTasksOpen) },
      { id: "nav-notes", group: "Mở nhanh", label: "Ghi chép nhanh", hint: "N", run: () => openPanelOnly(setIsNotesOpen) },
      { id: "nav-scenes", group: "Mở nhanh", label: "Không gian làm việc", hint: "B", run: () => openPanelOnly(setIsScenesOpen) },
      { id: "nav-embed", group: "Mở nhanh", label: "Đài phát YouTube & Spotify", hint: "E", run: () => openPanelOnly(setIsEmbedPlayerOpen) },
      { id: "nav-mixer", group: "Mở nhanh", label: "Bộ trộn âm thanh", hint: "P", run: () => openPanelOnly(setIsMixerOpen) },
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
    isTasksOpen ||
    isScenesOpen ||
    (isEmbedPlayerOpen && !isPipActive) ||
    isMixerOpen ||
    isShortcutsHelpOpen;

  return (
    <div className="relative w-screen h-dvh overflow-hidden bg-slate-950 text-white select-none font-sans">
      <StudyBackground scene={currentScene} isBlurActive={isAnyModalOpen} />

      {/* Top Navigation Bar */}
      <StudyTopBar
        isZenMode={isZenMode}
        isPomodoroVisible={isPomodoroVisible}
        centerTab={centerTab}
        isGlobalMuted={isGlobalMuted}
        isSettingsOpen={isSettingsOpen}
        isFullscreen={isFullscreen}
        showClockSeconds={showClockSeconds}
        isClock12Hour={isClock12Hour}
        onToggleClock={handleToggleClock}
        onToggleShortcuts={handleToggleShortcutsHelp}
        onEnterZen={() => setIsZenMode(true)}
        onExitZen={() => setIsZenMode(false)}
        onToggleMute={toggleGlobalMute}
        onToggleSettings={handleToggleSettings}
        onToggleFullscreen={toggleFullscreen}
      />

      {/* Floating Left Dock Control Bar (Tasks, Notes, Scenes) */}
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

      {/* Popout Widgets */}
      <StudyTasksWidget isOpen={isTasksOpen} onClose={() => setIsTasksOpen(false)} />
      <StudyNotesWidget 
        isOpen={isNotesOpen} 
        onClose={() => setIsNotesOpen(false)} 
      />
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
            <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-music-glow shrink-0" />
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
        onClose={() => setIsEmbedPlayerOpen(false)} 
        onOpen={() => {
          handleCloseSettings();
          setIsTasksOpen(false);
          setIsNotesOpen(false);
          setIsScenesOpen(false);
          setIsMixerOpen(false);
          setIsEmbedPlayerOpen(true);
          setIsPipActive(false);
        }}
        onPipModeChange={setIsPipActive}
        activeItem={externalActiveItem}
        onStreamActiveChange={setIsExternalStreamActive}
        onActiveItemChange={setExternalActiveItem}
        isZenMode={isZenMode}
      />

      {/* Unified Study Settings Modal */}
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
      {/* Main Center Area: Ambient Centerpiece Pomodoro & Stopwatch hòa vào background */}
      <main className="relative z-10 w-full h-full flex flex-col items-center justify-center pointer-events-none px-4 pb-14">
        <StudySeoSemanticContent />
        <StudyPomodoroWidget 
          isVisible={isPomodoroVisible}
          activeTab={centerTab}
          onTabChange={setCenterTab}
          onToggleVisibility={() => setIsPomodoroVisible(!isPomodoroVisible)}
          onRunningChange={setIsTimerRunning}
          showClockSeconds={showClockSeconds}
          isClock12Hour={isClock12Hour}
          showStopwatchMilliseconds={showStopwatchMilliseconds}
          durations={pomodoroDurations}
          soundEnabled={soundEnabled}
          soundType={soundType}
        />
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
        onExpandExternalStream={() => {
          handleCloseSettings();
          setIsTasksOpen(false);
          setIsNotesOpen(false);
          setIsScenesOpen(false);
          setIsMixerOpen(false);
          setIsEmbedPlayerOpen(true);
          setIsPipActive(false);
        }}
        onStopExternalStream={() => {
          setIsExternalStreamActive(false);
          setExternalActiveItem(null);
          sendYouTubeCommand("pauseVideo");
          try {
            localStorage.removeItem(STORAGE_KEYS.activeEmbed);
          } catch {}
        }}
        onToggleMixer={() => {
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
        }}
        onCloseMixer={() => setIsMixerOpen(false)}
      />

      {/* Keyboard Shortcuts Cheat Sheet Modal */}
      <StudyShortcutsModal
        isOpen={isShortcutsHelpOpen}
        onClose={() => setIsShortcutsHelpOpen(false)}
        onOpenTour={() => setIsTourOpen(true)}
      />

      {/* Phòng học nhóm (video call) */}
      <StudyRoomsWidget isOpen={isRoomsOpen} onClose={() => setIsRoomsOpen(false)} />

      {/* First-time Onboarding Tour & Interactive Spotlight Walkthrough */}      <StudyOnboardingTour
        isOpen={isTourOpen ? true : undefined}
        onClose={() => setIsTourOpen(false)}
      />

      {/* Command Palette mở nhanh (Cmd/Ctrl+K) */}
      <StudyCommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        actions={commandActions}
      />
    </div>
  );
}
