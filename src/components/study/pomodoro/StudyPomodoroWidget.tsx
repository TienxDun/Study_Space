"use client";

import { useState, useEffect, useCallback, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  XIcon,
} from "@phosphor-icons/react";
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
import { MobileTimerTabBar } from "@/components/study/mobile/pomodoro/MobileTimerTabBar";
import { useIsMobile } from "@/components/study/mobile/hooks/useIsMobile";
import { GiantDigitsDisplay } from "./components/GiantDigitsDisplay";
import { PomoProgressRing } from "./components/PomoProgressRing";
import { SubmodeBar } from "./components/SubmodeBar";
import { TimerActionControls } from "./components/TimerActionControls";
import { PaginationDots } from "./components/PaginationDots";
import { FocusStatsLine } from "./components/FocusStatsLine";
import { StopwatchLapsDrawer } from "./components/StopwatchLapsDrawer";
import { yieldToPaint } from "@/components/study/mobile/perf/yieldToPaint";

export const StudyPomodoroWidget = memo(function StudyPomodoroWidget({
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
}: StudyPomodoroWidgetProps) {
  const [internalTab, setInternalTab] = useState<TimerTab>("clock");
  const currentTab = externalTab !== undefined ? externalTab : internalTab;
  const { focusTask, clearFocus, completeSession, logFocusTime } = useFocusTask();

  // Hàng nút chuyển chế độ tự ẩn sau 4 giây không đụng tới.
  // Chạm vào cụm đồng hồ là hiện lại ngay.
  const [tabsVisible, setTabsVisible] = useState(true);
  const tabsTimer = useRef(0);
  const pokeTabs = useCallback(() => {
    setTabsVisible(true);
    if (tabsTimer.current) window.clearTimeout(tabsTimer.current);
    tabsTimer.current = window.setTimeout(() => setTabsVisible(false), 4000);
  }, []);
  useEffect(() => {
    pokeTabs();
    return () => {
      if (tabsTimer.current) window.clearTimeout(tabsTimer.current);
    };
  }, [pokeTabs]);

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

const TIMER_TABS: TimerTab[] = ["clock", "pomodoro", "stopwatch"];

  const switchTab = useCallback(
    (tab: TimerTab) => {
      setInternalTab(tab);
      if (onTabChange) {
        yieldToPaint(() => {
          onTabChange(tab);
        });
      }
    },
    [onTabChange]
  );

  // Handler ổn định cho thanh tab mobile (tránh tạo closure mới mỗi tick → phá memo con)
  const handleSelectTabMobile = useCallback(
    (tab: TimerTab) => {
      switchTab(tab);
      setTabsVisible(true);
      if (tabsTimer.current) window.clearTimeout(tabsTimer.current);
      tabsTimer.current = window.setTimeout(() => setTabsVisible(false), 4000);
    },
    [switchTab]
  );

  // Vuốt sang trái: chuyển chế độ tiếp theo (Đồng hồ -> Pomodoro -> Stopwatch -> Đồng hồ)
  const handleNextTab = useCallback(() => {
    const currentIndex = TIMER_TABS.indexOf(currentTab);
    const nextTab = TIMER_TABS[(currentIndex + 1) % TIMER_TABS.length];
    switchTab(nextTab);
    pokeTabs();
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(10);
      } catch {}
    }
  }, [currentTab, switchTab, pokeTabs]);

  // Vuốt sang phải: chuyển chế độ trước đó (Stopwatch -> Pomodoro -> Đồng hồ -> Stopwatch)
  const handlePrevTab = useCallback(() => {
    const currentIndex = TIMER_TABS.indexOf(currentTab);
    const prevTab = TIMER_TABS[(currentIndex - 1 + TIMER_TABS.length) % TIMER_TABS.length];
    switchTab(prevTab);
    pokeTabs();
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(10);
      } catch {}
    }
  }, [currentTab, switchTab, pokeTabs]);

  // Nhận diện cử chỉ quẹt ngang trên màn hình cảm ứng
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    // Không nhận vuốt chuyển tab nếu chạm vào các nút điều khiển (Play/Pause, Reset, Skip, Laps...)
    if (target.closest("button") || target.closest("a") || target.closest(".custom-study-scroll")) {
      return;
    }
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Ngưỡng vuốt ngang dứt khoát: khoảng cách ngang > 35px và góc ngang trội hơn dọc
    if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      if (deltaX < 0) {
        handleNextTab();
      } else {
        handlePrevTab();
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const handleTouchCancel = () => {
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Clock internal options (lazy initialization to avoid extra re-renders on mount)
  const [internalShowClockSeconds] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const savedSec = localStorage.getItem(CLOCK_SECONDS_KEY);
      return savedSec !== null ? savedSec === "true" : false;
    } catch {
      return false;
    }
  });
  const [internalIsClock12Hour] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const saved12h = localStorage.getItem(CLOCK_12HOUR_KEY);
      return saved12h !== null ? saved12h === "true" : false;
    } catch {
      return false;
    }
  });
  const showClockSeconds =
    externalShowSeconds !== undefined ? externalShowSeconds : internalShowClockSeconds;
  const isClock12Hour =
    external12Hour !== undefined ? external12Hour : internalIsClock12Hour;

  // Stopwatch internal options
  const [internalShowStopwatchMs] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const savedMs = localStorage.getItem(STOPWATCH_MS_KEY);
      return savedMs !== null ? savedMs === "true" : false;
    } catch {
      return false;
    }
  });
  const showStopwatchMilliseconds =
    externalShowMs !== undefined ? externalShowMs : internalShowStopwatchMs;

  // Durations & Sound
  const [internalDurations] = useState<PomodoroDurations>(() => {
    if (typeof window === "undefined") return DEFAULT_DURATIONS;
    try {
      const savedDurations = localStorage.getItem(POMO_DURATIONS_KEY);
      if (savedDurations) return JSON.parse(savedDurations);
    } catch {}
    return DEFAULT_DURATIONS;
  });
  const durations = externalDurations !== undefined ? externalDurations : internalDurations;

  const [internalSoundEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const savedSound = localStorage.getItem(SOUND_KEY);
      return savedSound !== null ? savedSound === "true" : true;
    } catch {
      return true;
    }
  });
  const soundEnabled =
    externalSound !== undefined ? externalSound : internalSoundEnabled;

  // Clock hook
  const { clockDigits, clockPeriod, clockFullDate } = useRealtimeClock({
    showClockSeconds,
    isClock12Hour,
    enabled: currentTab === "clock",
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
    enabled: currentTab === "pomodoro",
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
  } = useStopwatchTimer(showStopwatchMilliseconds, currentTab === "stopwatch");

  // Báo lên cha khi bắt đầu/dừng chạy để giữ màn hình sáng lúc đang học
  useEffect(() => {
    onRunningChange?.(isPomoRunning || isStopwatchRunning);
  }, [isPomoRunning, isStopwatchRunning, onRunningChange]);

  // Mobile tab Stopwatch: bảng vòng luôn giữ chỗ để đồng hồ không nhảy
  const isMobileScreen = useIsMobile();

  return (
    <AnimatePresence>
      {isVisible && (
    <motion.div
      key="pomodoro-widget"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12, transition: { duration: 0.15, ease: "easeIn" } }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      id="tour-pomodoro-widget"
      className="group relative flex flex-col items-center justify-start text-white select-none pointer-events-auto w-full max-w-xl min-h-[300px] sm:min-h-[320px] touch-pan-y"
      onPointerDown={pokeTabs}
      onPointerEnter={pokeTabs}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      {/* 1. Hàng nút chuyển chế độ: desktop bản cũ, mobile bản kính riêng */}
      <div className="hidden sm:block">
        <TimerTabPillBar currentTab={currentTab} onSelectTab={switchTab} />
      </div>
      <MobileTimerTabBar
        currentTab={currentTab}
        onSelectTab={handleSelectTabMobile}
        visible={tabsVisible}
      />

      {/* 2. Vòng tròn focus: mục tiêu + số đếm + phase xếp đều 1 cột giữa vòng */}
      {currentTab === "pomodoro" ? (
        <div className="relative flex items-center justify-center w-[min(76vw,340px)] h-[min(76vw,340px)] min-[380px]:w-[min(80vw,340px)] min-[380px]:h-[min(80vw,340px)] sm:w-[340px] sm:h-[340px] mb-2 shrink-0">
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
                    <XIcon className="w-3.5 h-3.5" />
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
          persistent={isMobileScreen}
        />
      )}
    </motion.div>
      )}
    </AnimatePresence>
  );
});
