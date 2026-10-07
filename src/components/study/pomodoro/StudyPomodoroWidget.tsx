"use client";

import { useState, useEffect } from "react";
import {
  TimerTab,
  StudyPomodoroWidgetProps,
  PomodoroDurations,
} from "./types";
import {
  DEFAULT_DURATIONS,
  CLOCK_SECONDS_KEY,
  CLOCK_12HOUR_KEY,
  STOPWATCH_MS_KEY,
  POMO_DURATIONS_KEY,
  SOUND_KEY,
} from "./constants";
import { useRealtimeClock } from "./hooks/useRealtimeClock";
import { usePomodoroCountdown } from "./hooks/usePomodoroCountdown";
import { useStopwatchTimer } from "./hooks/useStopwatchTimer";
import { TimerTabPillBar } from "./components/TimerTabPillBar";
import { GiantDigitsDisplay } from "./components/GiantDigitsDisplay";
import { SubmodeBar } from "./components/SubmodeBar";
import { TimerActionControls } from "./components/TimerActionControls";
import { PaginationDots } from "./components/PaginationDots";
import { StopwatchLapsDrawer } from "./components/StopwatchLapsDrawer";

export const StudyPomodoroWidget = ({
  isVisible,
  activeTab: externalTab,
  onTabChange,
  onSessionComplete,
  showClockSeconds: externalShowSeconds,
  isClock12Hour: external12Hour,
  durations: externalDurations,
  soundEnabled: externalSound,
  soundType: externalSoundType,
  showStopwatchMilliseconds: externalShowMs,
}: StudyPomodoroWidgetProps) => {
  const [internalTab, setInternalTab] = useState<TimerTab>("clock");
  const currentTab = externalTab !== undefined ? externalTab : internalTab;

  const switchTab = (tab: TimerTab) => {
    if (onTabChange) onTabChange(tab);
    setInternalTab(tab);
  };

  // Clock internal options
  const [internalShowClockSeconds, setInternalShowClockSeconds] = useState(false);
  const [internalIsClock12Hour, setInternalIsClock12Hour] = useState(false);
  const showClockSeconds =
    externalShowSeconds !== undefined ? externalShowSeconds : internalShowClockSeconds;
  const isClock12Hour =
    external12Hour !== undefined ? external12Hour : internalIsClock12Hour;

  // Stopwatch internal options
  const [internalShowStopwatchMs, setInternalShowStopwatchMs] = useState(false);
  const showStopwatchMilliseconds =
    externalShowMs !== undefined ? externalShowMs : internalShowStopwatchMs;

  // Durations & Sound
  const [internalDurations, setInternalDurations] = useState<PomodoroDurations>(DEFAULT_DURATIONS);
  const durations = externalDurations !== undefined ? externalDurations : internalDurations;

  const [internalSoundEnabled, setInternalSoundEnabled] = useState(true);
  const soundEnabled =
    externalSound !== undefined ? externalSound : internalSoundEnabled;

  // Restore preferences from LocalStorage
  useEffect(() => {
    try {
      const savedDurations = localStorage.getItem(POMO_DURATIONS_KEY);
      if (savedDurations) setInternalDurations(JSON.parse(savedDurations));

      const savedSound = localStorage.getItem(SOUND_KEY);
      if (savedSound !== null) setInternalSoundEnabled(savedSound === "true");

      const savedSec = localStorage.getItem(CLOCK_SECONDS_KEY);
      if (savedSec !== null) setInternalShowClockSeconds(savedSec === "true");

      const saved12h = localStorage.getItem(CLOCK_12HOUR_KEY);
      if (saved12h !== null) setInternalIsClock12Hour(saved12h === "true");

      const savedMs = localStorage.getItem(STOPWATCH_MS_KEY);
      if (savedMs !== null) setInternalShowStopwatchMs(savedMs === "true");
    } catch {}
  }, []);

  // Clock hook
  const { clockDigits, clockPeriod, clockFullDate } = useRealtimeClock({
    showClockSeconds,
    isClock12Hour,
  });

  // Pomodoro countdown hook
  const {
    pomoMode,
    timeLeft,
    isRunning: isPomoRunning,
    completedSessions,
    switchPomoMode,
    toggleRunning: togglePomoRunning,
    resetPomodoro,
    skipSession,
  } = usePomodoroCountdown({
    durations,
    soundEnabled,
    soundType: externalSoundType,
    onSessionComplete,
  });

  // Stopwatch hook
  const {
    stopwatchTime,
    isStopwatchRunning,
    laps,
    isLapsOpen,
    setIsLapsOpen,
    toggleStopwatch,
    resetStopwatch,
    addLap,
    toggleLapsDrawer,
    clearLaps,
  } = useStopwatchTimer();

  if (!isVisible) return null;

  return (
    <div className="group relative flex flex-col items-center justify-start text-white select-none pointer-events-auto w-full max-w-xl h-[300px] sm:h-[320px]">
      {/* 1. Sleek Floating Mode Pill Bar */}
      <TimerTabPillBar currentTab={currentTab} onSelectTab={switchTab} />

      {/* 2. Giant Clean Digits */}
      <GiantDigitsDisplay
        currentTab={currentTab}
        clockDigits={clockDigits}
        clockPeriod={clockPeriod}
        timeLeft={timeLeft}
        stopwatchTime={stopwatchTime}
        showStopwatchMilliseconds={showStopwatchMilliseconds}
      />

      {/* 3. Subtitle Area: Submodes / Date / Laps count */}
      <SubmodeBar
        currentTab={currentTab}
        pomoMode={pomoMode}
        onSwitchPomoMode={switchPomoMode}
        clockFullDate={clockFullDate}
        lapsCount={laps.length}
        isLapsOpen={isLapsOpen}
        onToggleLaps={toggleLapsDrawer}
      />

      {/* 4. Minimalist Floating Controls */}
      <TimerActionControls
        currentTab={currentTab}
        isPomoRunning={isPomoRunning}
        onTogglePomoRunning={togglePomoRunning}
        onResetPomo={resetPomodoro}
        onSkipPomo={skipSession}
        isStopwatchRunning={isStopwatchRunning}
        onToggleStopwatch={toggleStopwatch}
        onResetStopwatch={resetStopwatch}
        onAddLap={addLap}
      />

      {/* 5. Minimalist Pagination Dots */}
      {currentTab === "pomodoro" && (
        <PaginationDots completedSessions={completedSessions} />
      )}

      {/* 6. Stopwatch Laps Drawer */}
      {currentTab === "stopwatch" && (
        <StopwatchLapsDrawer
          isOpen={isLapsOpen}
          laps={laps}
          onClose={() => setIsLapsOpen(false)}
          onClearLaps={clearLaps}
          showStopwatchMilliseconds={showStopwatchMilliseconds}
        />
      )}
    </div>
  );
};
