"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { STUDY_SCENES, StudyEmbedItem } from "@/components/study/study-types";
import { useScenePreloader } from "@/lib/use-scene-preloader";
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
import { StudySeoSemanticContent } from "@/components/study/seo/StudySeoSemanticContent";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { useStudySettings } from "@/lib/use-study-settings";
import { useGlobalHorizontalScroll } from "@/lib/use-horizontal-scroll";
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

export default function StudySpacePage() {
  useGlobalHorizontalScroll();
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

  // Unified Settings Modal State (Default: Tắt giây đồng hồ, Tắt .00 stopwatch, Bật chuông Pomodoro 25-5-15)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [savedTabBeforeSettings, setSavedTabBeforeSettings] = useState<TimerTab | null>(null);
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
  } = useStudySettings();

  // Phục hồi Background Scene & Cài đặt cá nhân từ LocalStorage khi vào lại trang
  useEffect(() => {
    try {
      const savedSceneId = localStorage.getItem(STORAGE_KEYS.sceneId);
      if (savedSceneId) {
        const found = STUDY_SCENES.find((s) => s.id === savedSceneId);
        if (found) setCurrentSceneDirectly(found);
      }
      const savedMute = localStorage.getItem(STORAGE_KEYS.globalMute);
      if (savedMute !== null) {
        setIsGlobalMuted(savedMute === "true");
      }
      const savedPomoVis = localStorage.getItem(STORAGE_KEYS.pomoVisible);
      if (savedPomoVis !== null) {
        setIsPomodoroVisible(savedPomoVis === "true");
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

  const handleOpenSettings = () => {
    setSavedTabBeforeSettings(centerTab);
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
    if (savedTabBeforeSettings) {
      setCenterTab(savedTabBeforeSettings);
      setSavedTabBeforeSettings(null);
    }
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

  const handleActiveSectionChange = (section: TimerTab) => {
    setIsPomodoroVisible(true);
    setCenterTab(section);
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
  });

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
        onActiveSectionChange={handleActiveSectionChange}
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
      />

      {/* Main Center Area: Ambient Centerpiece Pomodoro & Stopwatch hòa vào background */}
      <main className="relative z-10 w-full h-full flex flex-col items-center justify-center pointer-events-none px-4 pb-14">
        <StudySeoSemanticContent />
        <StudyPomodoroWidget 
          isVisible={isPomodoroVisible}
          activeTab={centerTab}
          onTabChange={setCenterTab}
          onToggleVisibility={() => setIsPomodoroVisible(!isPomodoroVisible)}
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

      {/* First-time Onboarding Tour & Interactive Spotlight Walkthrough */}
      <StudyOnboardingTour
        isOpen={isTourOpen ? true : undefined}
        onClose={() => setIsTourOpen(false)}
      />
    </div>
  );
}
