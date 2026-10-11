"use client";

/**
 * Ghi nhớ + khôi phục vị trí phát YouTube khi chuyển Studio ↔ PiP.
 *
 * Vấn đề: Studio và PiP render 2 <iframe> khác nhau nên mỗi lần chuyển mode
 * là player load lại từ đầu. Module này dùng YouTube IFrame Player API để
 * đọc `getCurrentTime()` trước khi switch và `seekTo()` sau khi frame mới
 * sẵn sàng — xem dở tới đâu, qua mode kia tiếp tục từ đó.
 *
 * Lưu ý trung thực:
 * - Chỉ áp dụng cho YouTube VOD (không live, không Spotify — không có API).
 * - Lần chuyển ĐẦU TIÊN sau khi mở web có thể chưa kịp warm API (quá timeout
 *   800ms) thì fallback về hành vi cũ (phát từ đầu). Từ lần 2 trở đi là tức thì.
 * - Đang phát quảng cáo thì thời gian đọc được là của quảng cáo (sai số nhỏ).
 */

interface YTPlayerInstance {
  getCurrentTime(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
}

interface YTNamespace {
  Player: new (
    el: HTMLIFrameElement,
    opts?: {
      events?: {
        onReady?: () => void;
        onError?: () => void;
      };
    }
  ) => YTPlayerInstance;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: (() => void) | undefined;
  }
}

const API_SRC = "https://www.youtube.com/iframe_api";
let apiPromise: Promise<void> | null = null;

/** Nạp YouTube IFrame API 1 lần duy nhất, resolve khi ready. */
export function ensureYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no-window"));
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("youtube-api-timeout"));
    }, 10000);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try {
        prev?.();
      } catch {}
      window.clearTimeout(timeout);
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = API_SRC;
    tag.async = true;
    tag.onerror = () => {
      window.clearTimeout(timeout);
      apiPromise = null;
      reject(new Error("youtube-api-load-failed"));
    };
    document.head.appendChild(tag);
  });
  return apiPromise;
}

export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(`${label}-timeout`)),
      ms
    );
    p.then(
      (v) => {
        window.clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(timer);
        reject(e);
      }
    );
  });
}

const playerCache = new WeakMap<HTMLIFrameElement, Promise<YTPlayerInstance>>();

/** Bind YT.Player vào iframe (cache theo element), resolve khi ready. */
export function bindYouTubePlayer(
  iframe: HTMLIFrameElement
): Promise<YTPlayerInstance> {
  const cached = playerCache.get(iframe);
  if (cached) return cached;
  const task = (async (): Promise<YTPlayerInstance> => {
    await ensureYouTubeIframeApi();
    const YT = window.YT;
    if (!YT?.Player) throw new Error("youtube-api-missing");
    return await new Promise<YTPlayerInstance>((resolve, reject) => {
      let instance: YTPlayerInstance | null = null;
      const timer = window.setTimeout(() => {
        // Handshake onReady không về (cookie/ads/chặn 3rd-party) thì vẫn
        // trả instance để caller thử best-effort.
        if (instance) resolve(instance);
        else reject(new Error("youtube-player-not-ready"));
      }, 4000);
      try {
        instance = new YT.Player(iframe, {
          events: {
            onReady: () => {
              window.clearTimeout(timer);
              resolve(instance as YTPlayerInstance);
            },
            onError: () => {
              window.clearTimeout(timer);
              reject(new Error("youtube-player-error"));
            },
          },
        });
      } catch (e) {
        window.clearTimeout(timer);
        reject(e);
      }
    });
  })();
  playerCache.set(iframe, task);
  task.catch(() => {
    playerCache.delete(iframe);
  });
  return task;
}

/** Đọc vị trí phát hiện tại (giây). null khi chưa sẵn sàng. */
export async function getYouTubeTime(
  iframe: HTMLIFrameElement
): Promise<number | null> {
  try {
    const player = await bindYouTubePlayer(iframe);
    const t = player.getCurrentTime();
    return typeof t === "number" && isFinite(t) && t > 0 ? t : null;
  } catch {
    return null;
  }
}

/** Tua tới vị trí cho trước (best-effort, không throw). */
export async function seekYouTubeTime(
  iframe: HTMLIFrameElement,
  seconds: number
): Promise<void> {
  if (!(seconds > 0)) return;
  try {
    const player = await bindYouTubePlayer(iframe);
    player.seekTo(seconds, true);
    return;
  } catch {}
  // Fallback: lệnh postMessage (chỉ có tác dụng khi player trong đã init).
  try {
    iframe.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: "seekTo", args: [seconds, true] }),
      "*"
    );
  } catch {}
}

/* ---------------- Bộ nhớ vị trí theo video ---------------- */

export interface SeekMemoryOptions {
  /** Quá tuổi này thì bỏ (mở lại video cũ hôm sau phải phát từ đầu). */
  ttlMs?: number;
  maxEntries?: number;
  now?: () => number;
}

export function createSeekMemory(options: SeekMemoryOptions = {}) {
  const { ttlMs = 10 * 60 * 1000, maxEntries = 10, now = () => Date.now() } = options;
  const map = new Map<string, { seconds: number; at: number }>();

  return {
    remember(key: string, seconds: number) {
      if (!key || !(seconds > 2)) return;
      map.set(key, { seconds: Math.floor(seconds), at: now() });
      while (map.size > maxEntries) {
        const oldest = map.keys().next().value;
        if (oldest === undefined) break;
        map.delete(oldest);
      }
    },
    consume(key: string): number | null {
      const entry = map.get(key);
      map.delete(key);
      if (!entry) return null;
      if (now() - entry.at > ttlMs) return null;
      return entry.seconds;
    },
    peek(key: string): number | null {
      const entry = map.get(key);
      if (!entry || now() - entry.at > ttlMs) return null;
      return entry.seconds;
    },
    size() {
      return map.size;
    },
  };
}

export type SeekMemory = ReturnType<typeof createSeekMemory>;

/** Singleton dùng chung cho chuyển mode Studio ↔ PiP trong phiên. */
export const seekMemory: SeekMemory = createSeekMemory();
