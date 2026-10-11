"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Target } from "lucide-react";
import { useFocusTask, EVENT_START_FOCUS } from "@/lib/use-focus-task";
import {
  TimerTab,
  StudyPomodoroWidgetProps,
  PomodoroDurations,
  PomodoroMode,
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
import { PomoProgressRing } from "./components/PomoProgressRing";
import { SubmodeBar } from "./components/SubmodeBar";
import { TimerActionControls } from "./components/TimerActionControls";
import { PaginationDots } from "./components/PaginationDots";
import { StopwatchLapsDrawer } from "./components/StopwatchLapsDrawer";

export const StudyPomodoroWidget = ({
  isVisible,
  activeTab: externalTab,
  onTabChange,
  onSessionComplete: externalOnSessionComplete,
  showClockSeconds: externalShowSeconds,
  isClock12Hour: external12Hour,
  durations: externalDurations,
  soundEnabled: externalSound,
  soundType: externalSoundType,
  showStopwatchMilliseconds: externalShowMs,
}: StudyPomodoroWidgetProps) => {
  const [internalTab, setInternalTab] = useState<TimerTab>("clock");
  const currentTab = externalTab !== undefined ? externalTab : internalTab;
  const { focusTask, clearFocus, completeSession } = useFocusTask();

  // Đồng bộ tab sang Pomodoro khi có sự kiện Bắt đầu tập trung
  useEffect(() => {
    const handleStartFocus = () => {
      setInternalTab("pomodoro");
    };
    window.addEventListener(EVENT_START_FOCUS, handleStartFocus);
    return () => {
      window.removeEventListener(EVENT_START_FOCUS, handleStartFocus);
    };
  }, []);

  const handleSessionComplete = useCallback(
    (mode: PomodoroMode) => {
      if (mode === "focus" && focusTask) {
        completeSession(focusTask);
      }
      if (externalOnSessionComplete) {
        externalOnSessionComplete(mode);
      }
    },
    [focusTask, completeSession, externalOnSessionComplete]
  );

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
    onSessionComplete: handleSessionComplete,
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
  } = useStopwatchTimer(showStopwatchMilliseconds);

  if (!isVisible) return null;

  return (
    <div
      id="tour-pomodoro-widget"
      className="group relative flex flex-col items-center justify-start text-white select-none pointer-events-auto w-full max-w-xl h-[300px] sm:h-[320px]"
    >
      {/* 1. Sleek Floating Mode Pill Bar */}
      <TimerTabPillBar currentTab={currentTab} onSelectTab={switchTab} />

      {/* 2. Giant Clean Digits + vòng tiến trình phiên */}
      <div className="relative flex items-center justify-center">
        {currentTab === "pomodoro" &&
          (() => {
            const total = durations[pomoMode] * 60;
            const progress = total > 0 ? 1 - timeLeft / total : 0;
            return <PomoProgressRing progress={progress} />;
          })()}
        <GiantDigitsDisplay
          currentTab={currentTab}
          clockDigits={clockDigits}
          clockPeriod={clockPeriod}
          timeLeft={timeLeft}
          stopwatchTime={stopwatchTime}
          showStopwatchMilliseconds={showStopwatchMilliseconds}
        />
      </div>

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

      {/* Focus Task - Floating Ghost HUD (Không background, không viền) */}
      {currentTab === "pomodoro" && focusTask && (
        <div className="mt-1 mb-1 flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 rounded-xl text-xs select-none transition-all drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
          <div className="flex items-center gap-1.5 min-w-0">
            <Target className="w-3.5 h-3.5 text-amber-400 shrink-0 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-pulse" />
            <span className="text-xs font-semibold text-amber-400 shrink-0 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
              Mục tiêu:
            </span>
            <span className="font-semibold text-slate-100 truncate max-w-[170px] sm:max-w-[240px] drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] tracking-tight">
              {focusTask.title}
            </span>
          </div>
          <button
            type="button"
            onClick={clearFocus}
            className="p-1 rounded-lg text-slate-300 hover:text-rose-400 hover:bg-white/10 transition-all active:scale-90 cursor-pointer drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
            title="Hủy liên kết nhiệm vụ này"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
