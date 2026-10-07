import { STORAGE_KEYS } from "@/lib/storage-keys";
import { PomodoroDurations } from "./types";

export const CLOCK_SECONDS_KEY = STORAGE_KEYS.clockSeconds;
export const CLOCK_12HOUR_KEY = STORAGE_KEYS.clock12Hour;
export const STOPWATCH_MS_KEY = STORAGE_KEYS.stopwatchMs;
export const POMO_DURATIONS_KEY = STORAGE_KEYS.pomoDurations;
export const SOUND_KEY = STORAGE_KEYS.soundEnabled;

export const DEFAULT_DURATIONS: PomodoroDurations = {
  focus: 25,
  short_break: 5,
  long_break: 15,
};
