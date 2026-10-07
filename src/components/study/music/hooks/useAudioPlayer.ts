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
}

export function useAudioPlayer({
  isGlobalMuted = false,
  onToggleMute,
  onMuteChange,
  isExternalStreamActive = false,
  externalStreamItem = null,
  toggleExternalPlay,
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

  const currentTrack = tracks[currentTrackIndex] || tracks[0];
  const effectiveVolume = isGlobalMuted ? 0 : volume;

  // Auto-pause internal music when external stream becomes active
  useEffect(() => {
    if (isExternalStreamActive && isPlaying) {
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  }, [isExternalStreamActive, isPlaying]);

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
      // eslint-disable-next-line react-hooks/immutability -- sync DOM media prop
      audio.volume = effectiveVolume;
    }
  }, [effectiveVolume]);

  // Tự động phát nhạc ngay khi vào trang StudySpace (kèm fallback interaction)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const attemptAutoplay = () => {
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          const onFirstInteraction = () => {
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

  const togglePlay = useCallback(() => {
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
  }, [isPlaying]);

  const handleNextTrack = useCallback(() => {
    const nextIdx = getNextTrackIndex(currentTrackIndex, tracks.length, isShuffle);
    setCurrentTrackIndex(nextIdx);
    setIsPlaying(true);
    try {
      if (tracks[nextIdx]) {
        localStorage.setItem(STORAGE_KEYS.trackId, tracks[nextIdx].id);
      }
    } catch {}
  }, [currentTrackIndex, isShuffle, tracks]);

  const handlePrevTrack = useCallback(() => {
    const prevIdx = getPrevTrackIndex(currentTrackIndex, tracks.length);
    setCurrentTrackIndex(prevIdx);
    setIsPlaying(true);
    try {
      if (tracks[prevIdx]) {
        localStorage.setItem(STORAGE_KEYS.trackId, tracks[prevIdx].id);
      }
    } catch {}
  }, [currentTrackIndex, tracks]);

  const handleSelectMood = useCallback((mood: MoodType) => {
    setCurrentMood(mood);
    const newTracks = STUDY_TRACKS_BY_MOOD[mood] || [];
    setTracks(newTracks);
    setCurrentTrackIndex(0);
    setCurrentTime(0);
    setIsPlaying(true);
    try {
      localStorage.setItem(STORAGE_KEYS.mood, mood);
      if (newTracks[0]) {
        localStorage.setItem(STORAGE_KEYS.trackId, newTracks[0].id);
      }
    } catch {}
  }, []);

  const handleSelectTrack = useCallback((track: Track) => {
    const idx = tracks.findIndex((t) => t.id === track.id);
    if (idx !== -1) {
      setCurrentTrackIndex(idx);
    }
    setIsPlaying(true);
    try {
      localStorage.setItem(STORAGE_KEYS.trackId, track.id);
    } catch {}
  }, [tracks]);

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
    setCurrentTime(time);
    const audio = audioRef.current;
    if (audio && isFinite(audio.duration)) {
      // eslint-disable-next-line react-hooks/immutability -- sync DOM media prop
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
      setCurrentTime(audioRef.current.currentTime);
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
