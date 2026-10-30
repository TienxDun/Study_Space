"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  PomodoroMode,
  PomodoroDurations,
  PomodoroSoundType,
  PomodoroSessionResult,
  FocusSpanInfo,
} from "../types";
import { playPomodoroSound } from "../../study-sound";
import { trackEvent } from "@/lib/analytics";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { computeSpanDelta, getNextBreakType } from "../utils/timer-formatters";
import { EVENT_START_FOCUS } from "@/lib/use-focus-task";

interface UsePomodoroCountdownOptions {
  durations: PomodoroDurations;
  soundEnabled: boolean;
  soundType?: PomodoroSoundType;
  onSessionComplete?: (result: PomodoroSessionResult) => void;
  /** Bắn mỗi khi 1 đoạn chạy focus dừng (pause/skip/reset/hết giờ/tắt tab) để ghi log thầm lặng. */
  onFocusSpan?: (span: FocusSpanInfo) => void;
}

/** Giờ đang chạy dở, lưu xuống máy để F5 vẫn nhớ. Tính theo giờ thật
 *  (endAt) nên tắt trang bao lâu mở lại vẫn đúng, không bị chạy nhanh/chậm. */
interface PersistedPomoState {
  mode: PomodoroMode;
  timeLeft: number;
  isRunning: boolean;
  endAt: number;
  savedAt: number;
  plannedSeconds: number;
  flushedSeconds: number;
  sessionStartedAt: number;
  durationsSnapshot?: PomodoroDurations;
}

const POMO_STATE_KEY = STORAGE_KEYS.pomoRunningState;

function readPersistedPomoState(): PersistedPomoState | null {
  try {
    const raw = localStorage.getItem(POMO_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedPomoState;
    if (
      parsed.mode !== "focus" &&
      parsed.mode !== "short_break" &&
      parsed.mode !== "long_break"
    ) {
      return null;
    }
    if (typeof parsed.timeLeft !== "number" || Number.isNaN(parsed.timeLeft)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writePersistedPomoState(state: PersistedPomoState) {
  try {
    localStorage.setItem(POMO_STATE_KEY, JSON.stringify(state));
  } catch {}
}

export function usePomodoroCountdown({
  durations,
  soundEnabled,
  soundType = "classic_clock",
  onSessionComplete,
  onFocusSpan,
}: UsePomodoroCountdownOptions) {
  const [pomoMode, setPomoMode] = useState<PomodoroMode>("focus");
  const [timeLeft, setTimeLeft] = useState(durations.focus * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);

  // Chốt thông tin phiên lúc BẮT ĐẦU chạy (đổi duration giữa chừng không
  // làm sai số liệu). flushedSeconds = số giây đã flush qua các lần pause
  // trước — resume không đếm trùng.
  const sessionRef = useRef<{
    startedAt: number;
    plannedSeconds: number;
    flushedSeconds: number;
  } | null>(null);
  // Mốc bắt đầu của ĐOẠN chạy hiện tại (set mỗi lần bấm chạy, clear khi dừng).
  const spanStartRef = useRef<number | null>(null);
  const timeLeftRef = useRef(timeLeft);
  const pomoModeRef = useRef(pomoMode);
  const isRunningRef = useRef(isRunning);
  const onFocusSpanRef = useRef(onFocusSpan);

  // Đồng bộ ref sau render (không gán lúc render để khỏi lỗi lint):
  // vòng đếm + flush log đọc qua ref nên luôn thấy số mới nhất.
  const durationsRef = useRef(durations);
  useEffect(() => {
    timeLeftRef.current = timeLeft;
    pomoModeRef.current = pomoMode;
    isRunningRef.current = isRunning;
    onFocusSpanRef.current = onFocusSpan;
    durationsRef.current = durations;
  });

  // Giữ bản cài đặt giờ lúc nhớ lại giờ cũ. Khi phần cài đặt nạp xong
  // mà trùng đúng bản này thì giữ nguyên giờ, không reset về giờ đầy.
  const restoredDurationsRef = useRef<PomodoroDurations | null>(null);

  const ensureSession = useCallback((plannedSeconds: number) => {
    if (!sessionRef.current) {
      sessionRef.current = {
        startedAt: Date.now(),
        plannedSeconds,
        flushedSeconds: 0,
      };
    }
  }, []);

  /**
   * Flush đoạn chạy hiện tại: tính số giây MỚI phát sinh kể từ lần flush
   * trước, emit để ghi log. Gọi khi pause/skip/reset/đổi mode/hết giờ/tắt
   * tab — kể cả 1 giây cũng ghi, không mất thời gian tích lũy.
   */
  const flushSpan = useCallback((completed: boolean): FocusSpanInfo | null => {
    const mode = pomoModeRef.current;
    const startedAt = spanStartRef.current;
    spanStartRef.current = null;
    if (mode !== "focus") return null;
    const sess = sessionRef.current;
    if (!sess) return null;
    const delta = computeSpanDelta(
      sess.plannedSeconds,
      timeLeftRef.current,
      sess.flushedSeconds
    );
    if (delta < 1) return null;
    sess.flushedSeconds += delta;
    const endedAt = Date.now();
    const span: FocusSpanInfo = {
      mode,
      completed,
      startedAt: startedAt ?? endedAt - delta * 1000,
      endedAt,
      seconds: delta,
      plannedSeconds: sess.plannedSeconds,
    };
    try {
      onFocusSpanRef.current?.(span);
    } catch {}
    return span;
  }, []);

  // Tắt / tải lại trang giữa chừng: chốt đoạn đang chạy để ghi log,
  // đồng thời ghi nhớ giờ để mở lại chạy tiếp đúng chỗ.
  // Lưu ý: chỉ ghi lúc trình duyệt báo sắp tắt (beforeunload). Không ghi
  // trong hàm dọn dẹp vì lúc chạy thử trình duyệt gọi dọn dẹp giả 1 lần,
  // ghi lúc đó sẽ đè mất số giờ vừa nhớ.
  useEffect(() => {
    const saveNow = () => {
      try {
        const sess = sessionRef.current;
        const left = timeLeftRef.current;
        const running = isRunningRef.current;
        const d = durationsRef.current;
        writePersistedPomoState({
          mode: pomoModeRef.current,
          timeLeft: left,
          isRunning: running,
          endAt: running ? Date.now() + Math.max(0, left) * 1000 : 0,
          savedAt: Date.now(),
          plannedSeconds: sess?.plannedSeconds ?? d[pomoModeRef.current] * 60,
          flushedSeconds: sess?.flushedSeconds ?? 0,
          sessionStartedAt: sess?.startedAt ?? Date.now(),
          durationsSnapshot: d,
        });
      } catch {}
    };
    const onUnload = () => {
      flushSpan(false);
      saveNow();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      flushSpan(false);
    };
  }, [flushSpan]);

  // Mở trang lên: nhớ lại giờ trước khi tải lại. Đang chạy thì chạy tiếp
  // theo giờ thật (trừ đúng số giây lúc tắt). Tạm dừng thì giữ nguyên.
  useEffect(() => {
    const saved = readPersistedPomoState();
    if (!saved) return;
    const snap = saved.durationsSnapshot;
    const fullOf = (m: PomodoroMode) =>
      Math.max(1, Math.round((snap?.[m] ?? durations[m]) * 60));
    const clampedLeft = Math.min(
      Math.max(0, Math.floor(saved.timeLeft)),
      fullOf(saved.mode)
    );

    // Nhớ bản cài đặt đi kèm giờ cũ để lát cài đặt nạp xong mà trùng
    // thì giữ nguyên giờ (không reset oan về giờ đầy).
    restoredDurationsRef.current = snap
      ? { focus: snap.focus, short_break: snap.short_break, long_break: snap.long_break }
      : null;

    if (saved.isRunning) {
      const remaining = Math.round((saved.endAt - Date.now()) / 1000);
      if (remaining > 0) {
        // Còn giờ: chạy tiếp ngay, không tính lại từ đầu.
        sessionRef.current = {
          startedAt: saved.sessionStartedAt || Date.now(),
          plannedSeconds: saved.plannedSeconds || clampedLeft,
          flushedSeconds: Math.max(0, saved.flushedSeconds || 0),
        };
        spanStartRef.current = Date.now();
        setPomoMode(saved.mode);
        setTimeLeft(Math.min(remaining, fullOf(saved.mode)));
        setIsRunning(true);
        return;
      }
      // Hết giờ luôn lúc đang tắt trang: tự coi như xong 1 phiên (không kêu
      // chuông làm giật mình), lặng lẽ chuyển sang giờ nghỉ / giờ mới.
      try {
        if (saved.mode === "focus") {
          const rawCount = localStorage.getItem(STORAGE_KEYS.pomoCount);
          const count = parseInt(rawCount || "0", 10) || 0;
          const nextCount = count + 1;
          localStorage.setItem(STORAGE_KEYS.pomoCount, String(nextCount));
          setCompletedSessions(nextCount);
          const nextBreak = getNextBreakType(nextCount);
          setPomoMode(nextBreak);
          setTimeLeft(fullOf(nextBreak));
          setIsRunning(false);
        } else {
          setPomoMode("focus");
          setTimeLeft(fullOf("focus"));
          setIsRunning(false);
        }
      } catch {
        setPomoMode(saved.mode);
        setTimeLeft(clampedLeft);
        setIsRunning(false);
      }
      sessionRef.current = null;
      spanStartRef.current = null;
      return;
    }

    // Đang tạm dừng trước khi tải lại: giữ nguyên số giờ đó.
    sessionRef.current = saved.plannedSeconds
      ? {
          startedAt: saved.sessionStartedAt || Date.now(),
          plannedSeconds: saved.plannedSeconds,
          flushedSeconds: Math.max(0, saved.flushedSeconds || 0),
        }
      : null;
    spanStartRef.current = null;
    setPomoMode(saved.mode);
    setTimeLeft(clampedLeft);
    setIsRunning(false);
  }, []);

  // Giờ thay đổi mỗi giây là ghi nhớ ngay để F5 lúc nào cũng còn số mới nhất.
  // Bỏ qua lần đầu lúc mới mở trang: lúc đó số trên màn hình chưa phải số
  // thật (số thật đang chờ nhớ lại), ghi lúc này sẽ đè mất số đúng.
  const isFirstPersistRunRef = useRef(true);
  useEffect(() => {
    if (isFirstPersistRunRef.current) {
      isFirstPersistRunRef.current = false;
      return;
    }
    try {
      const sess = sessionRef.current;
      writePersistedPomoState({
        mode: pomoMode,
        timeLeft,
        isRunning,
        endAt: isRunning ? Date.now() + Math.max(0, timeLeft) * 1000 : 0,
        savedAt: Date.now(),
        plannedSeconds: sess?.plannedSeconds ?? durations[pomoMode] * 60,
        flushedSeconds: sess?.flushedSeconds ?? 0,
        sessionStartedAt: sess?.startedAt ?? Date.now(),
        durationsSnapshot: durations,
      });
    } catch {}
  }, [pomoMode, timeLeft, isRunning, durations]);

  // Tự động kích hoạt đếm ngược chế độ Focus khi người dùng bấm Bắt đầu tập trung vào Task
  useEffect(() => {
    const handleStartFocus = () => {
      flushSpan(false); // flush phiên dở trước khi bắt đầu phiên mới
      sessionRef.current = {
        startedAt: Date.now(),
        plannedSeconds: durations.focus * 60,
        flushedSeconds: 0,
      };
      spanStartRef.current = Date.now();
      setPomoMode("focus");
      setTimeLeft(durations.focus * 60);
      setIsRunning(true);
      trackEvent("focus-start");
    };

    window.addEventListener(EVENT_START_FOCUS, handleStartFocus);
    return () => {
      window.removeEventListener(EVENT_START_FOCUS, handleStartFocus);
    };
  }, [durations.focus, flushSpan]);

  // Khôi phục số phiên hoàn thành từ LocalStorage
  useEffect(() => {
    try {
      const savedCount = localStorage.getItem(STORAGE_KEYS.pomoCount);
      if (savedCount) setCompletedSessions(parseInt(savedCount, 10) || 0);
    } catch {}
  }, []);

  // Chỉ cập nhật lại timeLeft khi user ĐỔI thời gian cài đặt (lúc đang
  // tạm dừng). So sánh giá trị từng field để object durations bị tạo lại
  // mỗi render cũng không reset oan đồng hồ.
  const prevDurationsRef = useRef(durations);
  useEffect(() => {
    // Cài đặt vừa nạp xong mà trùng đúng bản lúc nhớ giờ cũ: giữ nguyên
    // giờ đó, không reset về giờ đầy. Xong thì thôi để lần sau đổi thật vẫn reset.
    const snap = restoredDurationsRef.current;
    if (
      snap &&
      snap.focus === durations.focus &&
      snap.short_break === durations.short_break &&
      snap.long_break === durations.long_break
    ) {
      restoredDurationsRef.current = null;
      prevDurationsRef.current = durations;
      return;
    }
    const prev = prevDurationsRef.current;
    prevDurationsRef.current = durations;
    const changed =
      prev.focus !== durations.focus ||
      prev.short_break !== durations.short_break ||
      prev.long_break !== durations.long_break;
    if (changed && !isRunning) {
      setTimeLeft(durations[pomoMode] * 60);
    }
  }, [durations, pomoMode, isRunning]);

  const playChime = useCallback(() => {
    playPomodoroSound(soundType, soundEnabled);
  }, [soundType, soundEnabled]);

  // Bắt đầu phiên mới và chạy ngay (dùng khi hết giờ: học xong tự nghỉ,
  // nghỉ xong tự học tiếp, khỏi bấm tay).
  const startFreshMode = useCallback(
    (mode: PomodoroMode) => {
      const full = durations[mode] * 60;
      sessionRef.current = {
        startedAt: Date.now(),
        plannedSeconds: full,
        flushedSeconds: 0,
      };
      spanStartRef.current = Date.now();
      setPomoMode(mode);
      setTimeLeft(full);
      setIsRunning(true);
    },
    [durations]
  );

  const finishSession = useCallback(
    (natural: boolean) => {
      setIsRunning(false);
      playChime();

      const latched = sessionRef.current;
      const plannedSeconds =
        latched?.plannedSeconds ?? durations[pomoMode] * 60;
      const sessionStartedAt = latched?.startedAt ?? Date.now();
      // Flush đoạn cuối để ghi log (kể cả skip — 10 phút chạy dở vẫn ghi 10 phút).
      const span = flushSpan(natural);
      sessionRef.current = null;
      const endedAt = span?.endedAt ?? Date.now();
      const completed = natural;
      const focusSeconds =
        completed && pomoMode === "focus" ? plannedSeconds : 0;
      const result: PomodoroSessionResult = {
        mode: pomoMode,
        completed,
        startedAt: sessionStartedAt,
        endedAt,
        plannedSeconds,
        focusSeconds,
      };

      if (pomoMode === "focus") {
        if (completed) {
          const nextCount = completedSessions + 1;
          setCompletedSessions(nextCount);
          try {
            localStorage.setItem(STORAGE_KEYS.pomoCount, String(nextCount));
          } catch {}
        }
        if (onSessionComplete) onSessionComplete(result);

        // Đếm cả slot hiện tại (kể cả skip) để chu kỳ nghỉ ngắn/dài
        // không lệch — còn dots thì chỉ tính phiên chạy hết giờ.
        const nextBreak = getNextBreakType(completedSessions + 1);
        startFreshMode(nextBreak);
      } else {
        if (onSessionComplete) onSessionComplete(result);
        startFreshMode("focus");
      }
    },
    [
      completedSessions,
      durations,
      flushSpan,
      onSessionComplete,
      playChime,
      pomoMode,
      startFreshMode,
    ]
  );

  // Vòng lặp đếm ngược: 1 vòng duy nhất, chốt mốc giờ wall-clock nên
  // ẩn tab lâu hay tick trễ cũng không trôi giờ; hết giờ là chốt ngay.
  useEffect(() => {
    if (!isRunning) return;
    const endAt = Date.now() + timeLeftRef.current * 1000;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      if (remaining <= 0) {
        finishSession(true);
      } else {
        setTimeLeft((prev) => (prev === remaining ? prev : remaining));
      }
    }, 250);
    return () => clearInterval(interval);
  }, [isRunning, finishSession]);

  const toggleRunning = useCallback(() => {
    if (isRunningRef.current) {
      flushSpan(false); // pause → chốt đoạn vừa chạy, không mất giây nào
      setIsRunning(false);
    } else {
      const startingNewSession = sessionRef.current === null;
      ensureSession(timeLeftRef.current);
      spanStartRef.current = Date.now();
      setIsRunning(true);
      if (startingNewSession && pomoMode === "focus") trackEvent("focus-start");
    }
  }, [ensureSession, flushSpan, pomoMode]);

  const resetPomodoro = useCallback(() => {
    flushSpan(false); // giữ lại số phút đã chạy trước khi reset
    sessionRef.current = null;
    setIsRunning(false);
    setTimeLeft(durations[pomoMode] * 60);
  }, [durations, flushSpan, pomoMode]);

  const skipSession = useCallback(() => {
    finishSession(false);
  }, [finishSession]);

  return {
    pomoMode,
    timeLeft,
    isRunning,
    completedSessions,
    toggleRunning,
    resetPomodoro,
    skipSession,
  };
}
