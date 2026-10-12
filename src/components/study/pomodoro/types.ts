import { PomodoroSoundType } from "../study-sound";

export type TimerTab = "clock" | "pomodoro" | "stopwatch";
export type PomodoroMode = "focus" | "short_break" | "long_break";

export interface PomodoroDurations {
  focus: number;
  short_break: number;
  long_break: number;
}

/**
 * Kết quả 1 phiên Pomodoro.
 * - completed=true: phiên chạy hết giờ tự nhiên (được ghi nhận thời gian).
 * - completed=false: user bấm Bỏ qua (skip) — KHÔNG ghi nhận, không tính phiên.
 */
export interface PomodoroSessionResult {
  mode: PomodoroMode;
  completed: boolean;
  /** Epoch ms lúc phiên bắt đầu chạy. */
  startedAt: number;
  /** Epoch ms lúc phiên kết thúc/bị bỏ qua. */
  endedAt: number;
  /** Số giây của phiên lúc bắt đầu (chốt trước khi chạy). */
  plannedSeconds: number;
  /** Số giây tập trung thực tế (> 0 chỉ khi focus + completed). */
  focusSeconds: number;
}

/**
 * 1 đoạn chạy liên tục của đồng hồ focus (từ lúc bấm chạy tới lúc
 * pause/skip/reset/hết giờ/tắt tab). Ghi từng đoạn nên pause giữa chừng
 * cũng không mất giây nào. Tổng các đoạn = thời gian focus thực tế.
 */
export interface FocusSpanInfo {
  mode: PomodoroMode;
  /** true khi đoạn này kết thúc vì chạy hết giờ. */
  completed: boolean;
  /** Epoch ms lúc đoạn này bắt đầu chạy. */
  startedAt: number;
  /** Epoch ms lúc đoạn này dừng. */
  endedAt: number;
  /** Số giây focus của đoạn này (>= 1 mới emit). */
  seconds: number;
  /** Số giây của phiên chứa đoạn này (chốt lúc bắt đầu). */
  plannedSeconds: number;
}

export interface StudyPomodoroWidgetProps {
  isVisible: boolean;
  activeTab?: TimerTab;
  onTabChange?: (tab: TimerTab) => void;
  onToggleVisibility?: () => void;
  onSessionComplete?: (result: PomodoroSessionResult) => void;
  // Báo lên cha mỗi khi bắt đầu/dừng chạy (Pomodoro hoặc bấm giờ)
  onRunningChange?: (running: boolean) => void;
  // External Settings
  showClockSeconds?: boolean;
  isClock12Hour?: boolean;
  durations?: PomodoroDurations;
  soundEnabled?: boolean;
  soundType?: PomodoroSoundType;
  showStopwatchMilliseconds?: boolean;
}

export type { PomodoroSoundType };
