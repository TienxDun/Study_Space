"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";

/**
 * Đảm bảo đường dẫn YouTube embed luôn có enablejsapi=1 để có thể điều khiển qua postMessage
 */
export function ensureYouTubeJsApi(url: string | undefined | null): string {
  if (!url) return "";
  if (!url.includes("youtube.com") && !url.includes("youtube-nocookie.com")) {
    return url;
  }
  if (url.includes("enablejsapi=1")) {
    return url;
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}enablejsapi=1`;
}

/**
 * Gửi lệnh điều khiển trực tiếp tới tất cả iframe YouTube đang hiển thị trên trang
 */
export function sendYouTubeCommand(
  func: "playVideo" | "pauseVideo" | "stopVideo" | "mute" | "unMute"
): boolean {
  if (typeof document === "undefined") return false;
  const iframes = document.querySelectorAll<HTMLIFrameElement>("iframe");
  let found = false;

  iframes.forEach((iframe) => {
    const src = iframe.src || "";
    if (src.includes("youtube.com") || src.includes("youtube-nocookie.com")) {
      found = true;
      try {
        iframe.contentWindow?.postMessage(
          JSON.stringify({
            event: "command",
            func,
            args: [],
          }),
          "*"
        );
      } catch {}
    }
  });

  return found;
}

/**
 * Hook quản lý trạng thái phát/tạm dừng của luồng YouTube ngoài
 */
export function useYouTubeRemote(
  isExternalActive: boolean,
  isYouTubePlatform: boolean,
  onPlaying?: () => void
) {
  const [isPaused, setIsPaused] = useState(false);
  const onPlayingRef = useRef(onPlaying);
  useEffect(() => {
    onPlayingRef.current = onPlaying;
  });

  // Lắng nghe sự kiện phản hồi từ YouTube iframe nếu có
  useEffect(() => {
    if (!isExternalActive || !isYouTubePlatform) return;

    const handleMessage = (e: MessageEvent) => {
      // Chỉ nghe phản hồi từ YouTube, bỏ qua tin nhắn từ nơi khác
      // (iframe lạ/extension) để khỏi đổi trạng thái oan.
      try {
        const origin = typeof e.origin === "string" ? e.origin : "";
        const host = origin.replace(/^https?:\/\//, "").toLowerCase();
        const isYouTube =
          host === "www.youtube.com" ||
          host === "www.youtube-nocookie.com" ||
          host.endsWith(".youtube.com") ||
          host.endsWith(".youtube-nocookie.com");
        if (!isYouTube) return;
      } catch {
        return;
      }
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data && data.event === "onStateChange") {
          // 1: PLAYING, 2: PAUSED, 0: ENDED, 3: BUFFERING
          if (data.info === 1) {
            setIsPaused(false);
            onPlayingRef.current?.();
          }
          if (data.info === 2) setIsPaused(true);
        }
      } catch {}
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isExternalActive, isYouTubePlatform]);

  // Reset về trạng thái đang phát khi đổi sang stream mới
  useEffect(() => {
    if (isExternalActive) {
      setIsPaused(false);
    }
  }, [isExternalActive]);

  const toggleExternalPlay = useCallback(() => {
    if (!isYouTubePlatform) return;

    if (isPaused) {
      sendYouTubeCommand("playVideo");
      setIsPaused(false);
      toast.success("Tiếp tục phát YouTube (Space)", { duration: 2500 });
    } else {
      sendYouTubeCommand("pauseVideo");
      setIsPaused(true);
      toast.info("Đã tạm dừng YouTube (Space)", { duration: 2500 });
    }
  }, [isPaused, isYouTubePlatform]);

  return {
    isPaused,
    setIsPaused,
    toggleExternalPlay,
  };
}
