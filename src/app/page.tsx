"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Scene, STUDY_SCENES, StudyEmbedItem } from "@/components/study/study-types";
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
  const [currentScene, setCurrentScene] = useState<Scene>(STUDY_SCENES[0]);
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
        if (found) setCurrentScene(found);
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

  const handleSelectScene = (scene: Scene) => {
    setCurrentScene(scene);
    try {
      localStorage.setItem(STORAGE_KEYS.sceneId, scene.id);
    } catch {}
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
        onSelectScene={handleSelectScene}
      />
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

      {/* Bottom Floating Music Player (Giữ luôn mounted để nhạc không bao giờ bị dừng khi Ẩn UI) */}
      <motion.div 
        animate={{ 
          opacity: isZenMode ? 0 : 1, 
          y: isZenMode ? 32 : 0,
          pointerEvents: isZenMode ? "none" : "auto" 
        }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="absolute bottom-4 left-4 right-4 z-40 flex justify-center will-change-transform"
      >
        <div className="w-full flex justify-center">
          <StudyMusicPlayer 
            isGlobalMuted={isGlobalMuted} 
            onToggleMute={toggleGlobalMute}
            onMuteChange={setGlobalMute}
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
        </div>
      </motion.div>

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
