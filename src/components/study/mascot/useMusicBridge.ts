"use client";

import { useCallback, useEffect, useState } from "react";

// Cầu nối nhỏ giữa trình nhạc và mèo: trình nhạc báo trạng thái,
// mèo nhờ bật/tắt giúp. Hai bên nhắn qua cửa sổ, khỏi đụng chỗ khác.
export const useMusicBridge = () => {
  // null = chưa biết nhạc đang ra sao, true = đang chạy, false = đang dừng
  const [musicPlaying, setMusicPlaying] = useState<boolean | null>(null);

  useEffect(() => {
    const onState = (e: Event) => {
      const playing = (e as CustomEvent)?.detail?.isPlaying;
      if (typeof playing === "boolean") setMusicPlaying(playing);
    };
    window.addEventListener("zenstudy:music-state", onState);
    return () => window.removeEventListener("zenstudy:music-state", onState);
  }, []);

  const toggleMusic = useCallback(() => {
    window.dispatchEvent(new Event("zenstudy:music-toggle"));
  }, []);

  return { musicPlaying, toggleMusic };
};
