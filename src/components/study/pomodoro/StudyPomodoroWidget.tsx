"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X } from "lucide-react";
import { useFocusTask, EVENT_START_FOCUS } from "@/lib/use-focus-task";
import {
  TimerTab,
  StudyPomodoroWidgetProps,
  PomodoroDurations,
  PomodoroSessionResult,
  FocusSpanInfo,
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
import { FocusStatsLine } from "./components/FocusStatsLine";
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
  onRunningChange,
}: StudyPomodoroWidgetProps) => {
  const [internalTab, setInternalTab] = useState<TimerTab>("clock");
  const currentTab = externalTab !== undefined ? externalTab : internalTab;
  const { focusTask, clearFocus, completeSession, logFocusTime } = useFocusTask();

  // Mirror để handler ghi log (kể cả beforeunload) luôn thấy task mới nhất.
  const focusTaskRef = useRef(focusTask);
  useEffect(() => {
    focusTaskRef.current = focusTask;
  }, [focusTask]);

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
    (result: PomodoroSessionResult) => {
      if (result.mode === "focus" && result.completed && focusTask) {
        completeSession(focusTask, result);
      }
      if (externalOnSessionComplete) {
        externalOnSessionComplete(result);
      }
    },
    [focusTask, completeSession, externalOnSessionComplete]
  );

  // Mỗi đoạn chạy focus dừng (pause/skip/reset/hết giờ/tắt tab) → ghi log
  // thầm lặng, KHÔNG toast để khỏi spam. Toast chỉ bắn khi hết phiên.
  const handleFocusSpan = useCallback(
    (span: FocusSpanInfo) => {
      logFocusTime(focusTaskRef.current, span);
    },
    [logFocusTime]
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
    toggleRunning: togglePomoRunning,
    resetPomodoro,
    skipSession,
  } = usePomodoroCountdown({
    durations,
    soundEnabled,
    soundType: externalSoundType,
    onSessionComplete: handleSessionComplete,
    onFocusSpan: handleFocusSpan,
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

  // Báo lên cha khi bắt đầu/dừng chạy để giữ màn hình sáng lúc đang học
  useEffect(() => {
    onRunningChange?.(isPomoRunning || isStopwatchRunning);
  }, [isPomoRunning, isStopwatchRunning, onRunningChange]);

  if (!isVisible) return null;

  return (
    <div
      id="tour-pomodoro-widget"
      className="group relative flex flex-col items-center justify-start text-white select-none pointer-events-auto w-full max-w-xl min-h-[300px] sm:min-h-[320px]"
    >
      {/* 1. Sleek Floating Mode Pill Bar */}
      <TimerTabPillBar currentTab={currentTab} onSelectTab={switchTab} />

      {/* 2. Vòng tròn focus: mục tiêu + số đếm + phase xếp đều 1 cột giữa vòng */}
      {currentTab === "pomodoro" ? (
        <div className="relative flex items-center justify-center w-[340px] h-[340px] mb-2 shrink-0">
          {(() => {
            const total = durations[pomoMode] * 60;
            const progress = total > 0 ? 1 - timeLeft / total : 0;
            return <PomoProgressRing progress={progress} size={340} />;
          })()}
          <div className="relative z-10 flex flex-col items-center justify-center gap-3">
            {focusTask && (
              <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 rounded-xl text-xs select-none transition-all drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] animate-in fade-in zoom-in-95 duration-200 pointer-events-auto max-w-[300px]">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-semibold text-amber-400 shrink-0 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
                    Mục tiêu:
                  </span>
                <span className="font-semibold text-slate-100 truncate max-w-[150px] sm:max-w-[200px] drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] tracking-tight text-sm">
                  {focusTask.title}
                </span>
                </div>
                {/* Nút hủy liên kết tự ẩn khi đang chạy để khỏi gán nhầm giờ */}
                {!isPomoRunning && (
                  <button
                    type="button"
                    onClick={clearFocus}
                    className="p-1 rounded-lg text-slate-300 hover:text-rose-400 hover:bg-white/10 transition-all active:scale-90 cursor-pointer drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] shrink-0"
                    title="Hủy liên kết nhiệm vụ này"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            <GiantDigitsDisplay
              currentTab={currentTab}
              clockDigits={clockDigits}
              clockPeriod={clockPeriod}
              timeLeft={timeLeft}
              stopwatchTime={stopwatchTime}
              showStopwatchMilliseconds={showStopwatchMilliseconds}
            />
            <SubmodeBar
              currentTab={currentTab}
              pomoMode={pomoMode}
              clockFullDate={clockFullDate}
              lapsCount={laps.length}
              isLapsOpen={isLapsOpen}
              onToggleLaps={toggleLapsDrawer}
              isRunning={isPomoRunning}
            />
          </div>
          <PaginationDots
            completedSessions={completedSessions}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-1.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
          />
        </div>
      ) : (
        <div className="relative flex items-center justify-center">
          <GiantDigitsDisplay
            currentTab={currentTab}
            clockDigits={clockDigits}
            clockPeriod={clockPeriod}
            timeLeft={timeLeft}
            stopwatchTime={stopwatchTime}
            showStopwatchMilliseconds={showStopwatchMilliseconds}
          />
        </div>
      )}

      {/* 3. Subtitle Area: ngày / laps (tab Đồng hồ & Stopwatch).
          Tab Pomodoro đã hiện trạng thái phase trong vòng tròn. */}
      {currentTab !== "pomodoro" && (
        <SubmodeBar
          currentTab={currentTab}
          pomoMode={pomoMode}
          clockFullDate={clockFullDate}
          lapsCount={laps.length}
          isLapsOpen={isLapsOpen}
          onToggleLaps={toggleLapsDrawer}
          isRunning={isPomoRunning}
        />
      )}

      {/* 4. Minimalist Floating Controls (chỉ giữ Play/Pause khi đang chạy) */}
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

      {/* 5b. Thống kê focus hôm nay / tuần này */}
      {currentTab === "pomodoro" && <FocusStatsLine />}

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
