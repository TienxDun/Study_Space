export interface SystemFlags {
  chatEnabled: boolean;
  roomsEnabled: boolean;
  maintenance: boolean;
  banner: string;
}

// Mặc định bật để web không tự khóa tính năng khi chat-proxy chưa kịp trả lời.
export const SYSTEM_FLAGS_DEFAULT: SystemFlags = {
  chatEnabled: true,
  roomsEnabled: true,
  maintenance: false,
  banner: "",
};

const CACHE_TTL_MS = 60 * 1000;
const FETCH_TIMEOUT_MS = 3 * 1000;
const BANNER_MAX = 140;
const CHAT_URL = process.env.NEXT_PUBLIC_CHAT_API_URL || "";

let cache: { at: number; value: SystemFlags } | null = null;
let inflight: Promise<SystemFlags> | null = null;

function readBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function parseSystemFlags(input: unknown): SystemFlags {
  const data = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const banner =
    typeof data.banner === "string"
      ? data.banner.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, BANNER_MAX)
      : "";

  return {
    chatEnabled: readBool(data.chatEnabled, true),
    roomsEnabled: readBool(data.roomsEnabled, true),
    maintenance: readBool(data.maintenance, false),
    banner,
  };
}

// Banner chỉ hiện khi bảo trì hoặc có nội dung; phần hiển thị luôn là text thuần.
export function resolveBannerText(flags: SystemFlags): string | null {
  const text = flags.banner.trim();
  if (text) return text;
  return flags.maintenance ? "Hệ thống đang bảo trì. Một số tiện ích có thể tạm tắt." : null;
}

export async function fetchSystemFlags(): Promise<SystemFlags> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.value;
  if (!CHAT_URL) return SYSTEM_FLAGS_DEFAULT;
  if (inflight) return inflight;

  inflight = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${CHAT_URL.replace(/\/+$/, "")}/config`, {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`http_${res.status}`);
      const flags = parseSystemFlags(await res.json());
      cache = { at: Date.now(), value: flags };
      return flags;
    } catch {
      return SYSTEM_FLAGS_DEFAULT;
    } finally {
      clearTimeout(timer);
      inflight = null;
    }
  })();

  return inflight;
}

export function resetSystemFlagsCache(): void {
  cache = null;
  inflight = null;
}
