import { PomodoroSoundType } from "../study-sound";

export type TimerTab = "clock" | "pomodoro" | "stopwatch";
export type PomodoroMode = "focus" | "short_break" | "long_break";

export interface PomodoroDurations {
  focus: number;
  short_break: number;
  long_break: number;
}

export interface StudyPomodoroWidgetProps {
  isVisible: boolean;
  activeTab?: TimerTab;
  onTabChange?: (tab: TimerTab) => void;
  onToggleVisibility?: () => void;
  onSessionComplete?: (mode: PomodoroMode) => void;
  // External Settings
  showClockSeconds?: boolean;
  isClock12Hour?: boolean;
  durations?: PomodoroDurations;
  soundEnabled?: boolean;
  soundType?: PomodoroSoundType;
  showStopwatchMilliseconds?: boolean;
}

export type { PomodoroSoundType };
