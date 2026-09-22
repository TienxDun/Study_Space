"use client";

import { useEffect, useState } from "react";
import type { PomodoroSoundType } from "@/components/study/study-sound";
import { STORAGE_KEYS } from "./storage-keys";

export interface PomodoroDurations {
  focus: number;
  short_break: number;
  long_break: number;
}

/** Settings không gian học tập: state + persist localStorage. */
export const useStudySettings = () => {
  const [showClockSeconds, setShowClockSeconds] = useState(false);
  const [isClock12Hour, setIsClock12Hour] = useState(false);
  const [showStopwatchMilliseconds, setShowStopwatchMilliseconds] =
    useState(false);
  const [pomodoroDurations, setPomodoroDurations] =
    useState<PomodoroDurations>({
      focus: 25,
      short_break: 5,
      long_break: 15,
    });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundType, setSoundType] =
    useState<PomodoroSoundType>("classic_clock");

  useEffect(() => {
    try {
      const savedSec = localStorage.getItem(STORAGE_KEYS.clockSeconds);
      if (savedSec !== null) setShowClockSeconds(savedSec === "true");

      const saved12h = localStorage.getItem(STORAGE_KEYS.clock12Hour);
      if (saved12h !== null) setIsClock12Hour(saved12h === "true");

      const savedMs = localStorage.getItem(STORAGE_KEYS.stopwatchMs);
      if (savedMs !== null) setShowStopwatchMilliseconds(savedMs === "true");

      const savedDurations = localStorage.getItem(STORAGE_KEYS.pomoDurations);
      if (savedDurations) setPomodoroDurations(JSON.parse(savedDurations));

      const savedSound = localStorage.getItem(STORAGE_KEYS.soundEnabled);
      if (savedSound !== null) setSoundEnabled(savedSound === "true");

      const savedSoundType = localStorage.getItem(
        STORAGE_KEYS.pomoSoundType
      ) as PomodoroSoundType;
      const validSounds: PomodoroSoundType[] = [
        "classic_clock",
        "zen_bell",
        "birds",
        "digital",
      ];
      if (savedSoundType && validSounds.includes(savedSoundType)) {
        setSoundType(savedSoundType);
      } else {
        setSoundType("classic_clock");
      }
    } catch {}
  }, []);

  const toggleClockSeconds = () => {
    setShowClockSeconds((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.clockSeconds, String(next));
      } catch {}
      return next;
    });
  };

  const toggleClock12Hour = () => {
    setIsClock12Hour((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.clock12Hour, String(next));
      } catch {}
      return next;
    });
  };

  const toggleStopwatchMilliseconds = () => {
    setShowStopwatchMilliseconds((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.stopwatchMs, String(next));
      } catch {}
      return next;
    });
  };

  const savePomodoroDurations = (d: PomodoroDurations) => {
    setPomodoroDurations(d);
    try {
      localStorage.setItem(STORAGE_KEYS.pomoDurations, JSON.stringify(d));
    } catch {}
  };

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.soundEnabled, String(next));
      } catch {}
      return next;
    });
  };

  const selectSoundType = (type: PomodoroSoundType) => {
    setSoundType(type);
    try {
      localStorage.setItem(STORAGE_KEYS.pomoSoundType, type);
    } catch {}
  };

  return {
    showClockSeconds,
    isClock12Hour,
    showStopwatchMilliseconds,
    pomodoroDurations,
    soundEnabled,
    soundType,
    toggleClockSeconds,
    toggleClock12Hour,
    toggleStopwatchMilliseconds,
    savePomodoroDurations,
    toggleSound,
    selectSoundType,
  };
};
