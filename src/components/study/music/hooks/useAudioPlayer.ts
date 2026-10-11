"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Track, MoodType, STUDY_TRACKS_BY_MOOD, StudyEmbedItem } from "../types";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { toast } from "sonner";
import { clampVolume, getNextTrackIndex, getPrevTrackIndex } from "../utils/time-format";

interface UseAudioPlayerOptions {
  isGlobalMuted?: boolean;
  onToggleMute?: () => void;
  onMuteChange?: (muted: boolean) => void;
  isExternalStreamActive?: boolean;
  externalStreamItem?: StudyEmbedItem | null;
  toggleExternalPlay?: () => void;
  onStopExternalStream?: () => void;
}

export function useAudioPlayer({
  isGlobalMuted = false,
  onToggleMute,
  onMuteChange,
  isExternalStreamActive = false,
  externalStreamItem = null,
  toggleExternalPlay,
  onStopExternalStream,
}: UseAudioPlayerOptions) {
  const [currentMood, setCurrentMood] = useState<MoodType>("lofi");
  const [tracks, setTracks] = useState<Track[]>(STUDY_TRACKS_BY_MOOD.lofi);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isLooping, setIsLooping] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Mốc thời gian đã báo lên state — timeupdate bắn ~4Hz nên chỉ setState
  // khi lệch đủ 250ms để cây player không re-render liên tục.
  const lastReportedTimeRef = useRef(0);

  const currentTrack = tracks[currentTrackIndex] || tracks[0];
  const effectiveVolume = isGlobalMuted ? 0 : volume;

  // Auto-pause internal music ONLY when external stream transitions from inactive to active
  const prevExternalStreamActiveRef = useRef(isExternalStreamActive);
  // Trạng thái đài ngoài mới nhất cho autoplay mồi (effect mount chạy 1 lần nên phải đọc qua ref)
  const externalActiveRef = useRef(isExternalStreamActive);
  useEffect(() => {
    externalActiveRef.current = isExternalStreamActive;
  });
  useEffect(() => {
    if (!prevExternalStreamActiveRef.current && isExternalStreamActive) {
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
    prevExternalStreamActiveRef.current = isExternalStreamActive;
  }, [isExternalStreamActive]);

  // Phục hồi cài đặt Nhạc từ LocalStorage khi mount
  useEffect(() => {
    try {
      const savedMood = localStorage.getItem(STORAGE_KEYS.mood) as MoodType;
      const validMoods: MoodType[] = ["lofi", "jazz", "relax"];
      const moodToUse = validMoods.includes(savedMood) ? savedMood : "lofi";

      const moodTracks = STUDY_TRACKS_BY_MOOD[moodToUse] || [];
      if (savedMood && validMoods.includes(savedMood)) {
        setCurrentMood(moodToUse);
        setTracks(moodTracks);
      }

      const savedTrackId = localStorage.getItem(STORAGE_KEYS.trackId);
      if (savedTrackId) {
        const trackIdx = moodTracks.findIndex((t: Track) => t.id === savedTrackId);
        if (trackIdx !== -1) {
          setCurrentTrackIndex(trackIdx);
        }
      }

      const savedVol = localStorage.getItem(STORAGE_KEYS.volume);
      if (savedVol !== null && !isNaN(parseFloat(savedVol))) {
        setVolume(parseFloat(savedVol));
      }

      const savedShuffle = localStorage.getItem(STORAGE_KEYS.shuffle);
      if (savedShuffle !== null) {
        setIsShuffle(savedShuffle === "true");
      }

      const savedLoop = localStorage.getItem(STORAGE_KEYS.loop);
      if (savedLoop !== null) {
        setIsLooping(savedLoop === "true");
      }
    } catch {}
  }, []);

  // Sync volume to audio element DOM prop
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = effectiveVolume;
    }
  }, [effectiveVolume]);

  // Tự động phát nhạc ngay khi vào trang StudySpace (kèm fallback interaction)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const attemptAutoplay = () => {
      // Đài ngoài đang chiếm sóng thì không tự phát nhạc nội bộ
      if (externalActiveRef.current) return;
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          const onFirstInteraction = () => {
            if (externalActiveRef.current) return;
            if (audioRef.current && audioRef.current.paused) {
              audioRef.current
                .play()
                .then(() => setIsPlaying(true))
                .catch(() => {});
            }
          };
          window.addEventListener("click", onFirstInteraction, { once: true });
          window.addEventListener("touchstart", onFirstInteraction, { once: true });
          window.addEventListener("keydown", onFirstInteraction, { once: true });
        });
    };

    attemptAutoplay();
  }, []);

  const stopExternalStreamIfActive = useCallback(() => {
    if (onStopExternalStream) {
      onStopExternalStream();
    }
  }, [onStopExternalStream]);

  const togglePlay = useCallback(() => {
    if (isExternalStreamActive || externalStreamItem) {
      stopExternalStreamIfActive();
      if (audioRef.current) {
        audioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
      return;
    }

    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, [isPlaying, isExternalStreamActive, externalStreamItem, stopExternalStreamIfActive]);

  const handleNextTrack = useCallback(() => {
    stopExternalStreamIfActive();
    const nextIdx = getNextTrackIndex(currentTrackIndex, tracks.length, isShuffle);
    setCurrentTrackIndex(nextIdx);
    setIsPlaying(true);
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
    try {
      if (tracks[nextIdx]) {
        localStorage.setItem(STORAGE_KEYS.trackId, tracks[nextIdx].id);
      }
    } catch {}
  }, [currentTrackIndex, isShuffle, tracks, stopExternalStreamIfActive]);

  const handlePrevTrack = useCallback(() => {
    stopExternalStreamIfActive();
    const prevIdx = getPrevTrackIndex(currentTrackIndex, tracks.length);
    setCurrentTrackIndex(prevIdx);
    setIsPlaying(true);
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
    try {
      if (tracks[prevIdx]) {
        localStorage.setItem(STORAGE_KEYS.trackId, tracks[prevIdx].id);
      }
    } catch {}
  }, [currentTrackIndex, tracks, stopExternalStreamIfActive]);

  const handleSelectMood = useCallback((mood: MoodType) => {
    stopExternalStreamIfActive();
    setCurrentMood(mood);
    const newTracks = STUDY_TRACKS_BY_MOOD[mood] || [];
    setTracks(newTracks);
    setCurrentTrackIndex(0);
    lastReportedTimeRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(true);
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
    try {
      localStorage.setItem(STORAGE_KEYS.mood, mood);
      if (newTracks[0]) {
        localStorage.setItem(STORAGE_KEYS.trackId, newTracks[0].id);
      }
    } catch {}
  }, [stopExternalStreamIfActive]);

  const handleSelectTrack = useCallback((track: Track) => {
    const wasExternalActive = isExternalStreamActive;
    stopExternalStreamIfActive();
    const idx = tracks.findIndex((t) => t.id === track.id);
    if (idx !== -1) {
      setCurrentTrackIndex(idx);
    }
    lastReportedTimeRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(true);
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
    try {
      localStorage.setItem(STORAGE_KEYS.trackId, track.id);
    } catch {}

    if (wasExternalActive) {
      toast.success(`Đang phát: ${track.title}`, {
        description: "Đã dừng luồng ngoài để chuyển sang nhạc playlist",
      });
    }
  }, [tracks, isExternalStreamActive, stopExternalStreamIfActive]);

  const handleVolumeChange = useCallback((newVol: number) => {
    const clamped = clampVolume(newVol);
    setVolume(clamped);
    if (clamped > 0 && isGlobalMuted) {
      if (onMuteChange) onMuteChange(false);
      else if (onToggleMute) onToggleMute();
    } else if (clamped === 0 && !isGlobalMuted) {
      if (onMuteChange) onMuteChange(true);
      else if (onToggleMute) onToggleMute();
    }
    try {
      localStorage.setItem(STORAGE_KEYS.volume, String(clamped));
    } catch {}
  }, [isGlobalMuted, onMuteChange, onToggleMute]);

  const handleToggleMute = useCallback(() => {
    if (isGlobalMuted) {
      if (volume === 0) {
        setVolume(0.5);
        try {
          localStorage.setItem(STORAGE_KEYS.volume, "0.5");
        } catch {}
      }
      if (onMuteChange) onMuteChange(false);
      else if (onToggleMute) onToggleMute();
    } else {
      if (onMuteChange) onMuteChange(true);
      else if (onToggleMute) onToggleMute();
    }
  }, [isGlobalMuted, onMuteChange, onToggleMute, volume]);

  const handleToggleShuffle = useCallback(() => {
    setIsShuffle((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.shuffle, String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleToggleLoop = useCallback(() => {
    setIsLooping((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.loop, String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleSeek = useCallback((time: number) => {
    lastReportedTimeRef.current = time;
    setCurrentTime(time);
    const audio = audioRef.current;
    if (audio && isFinite(audio.duration)) {
      audio.currentTime = time;
    }
  }, []);

  const syncDuration = useCallback(() => {
    if (audioRef.current && isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
      setDuration(audioRef.current.duration);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      const t = audioRef.current.currentTime;
      if (Math.abs(t - lastReportedTimeRef.current) >= 0.25) {
        lastReportedTimeRef.current = t;
        setCurrentTime(t);
      }
      if (isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
        setDuration(audioRef.current.duration);
      }
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    syncDuration();
    if (isPlaying && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  }, [isPlaying, syncDuration]);

  const handleAudioError = useCallback(() => {
    console.warn(`[StudyMusicPlayer] Gián đoạn bài "${currentTrack?.title}". Tự động chuyển bài...`);
    setTimeout(() => {
      handleNextTrack();
    }, 1000);
  }, [currentTrack?.title, handleNextTrack]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable);
      if (isInput) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (isExternalStreamActive && externalStreamItem) {
          if (externalStreamItem.platform === "youtube") {
            toggleExternalPlay?.();
          } else if (externalStreamItem.platform === "spotify") {
            toast.info(
              "Spotify không hỗ trợ phím tắt từ xa do giới hạn sandbox bảo mật. Hãy nhấp trực tiếp vào widget Spotify!"
            );
          }
        } else {
          togglePlay();
        }
      } else if (e.key === "ArrowRight" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleNextTrack();
      } else if (e.key === "ArrowLeft" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handlePrevTrack();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        handleVolumeChange(clampVolume(volume + 0.05));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        handleVolumeChange(clampVolume(volume - 0.05));
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        handleToggleMute();
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        handleToggleShuffle();
      } else if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        handleToggleLoop();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    togglePlay,
    handleNextTrack,
    handlePrevTrack,
    handleVolumeChange,
    handleToggleMute,
    handleToggleShuffle,
    handleToggleLoop,
    volume,
    isExternalStreamActive,
    externalStreamItem,
    toggleExternalPlay,
  ]);

  return {
    audioRef,
    currentMood,
    tracks,
    currentTrackIndex,
    currentTrack,
    isPlaying,
    volume,
    effectiveVolume,
    isLooping,
    isShuffle,
    currentTime,
    duration,
    togglePlay,
    handleNextTrack,
    handlePrevTrack,
    handleSelectMood,
    handleSelectTrack,
    handleVolumeChange,
    handleToggleMute,
    handleToggleShuffle,
    handleToggleLoop,
    handleSeek,
    syncDuration,
    handleTimeUpdate,
    handleLoadedMetadata,
    handleAudioError,
  };
}
