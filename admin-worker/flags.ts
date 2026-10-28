/**
 * P2a — Cờ hệ thống. Đọc/ghi JSON ở KV CHAT_QUOTA, key `cfg:flags`
 * (dùng chung với chat-proxy, nơi thực thi hạn mức chat hằng ngày).
 */

import type { AdminEnv } from "./shared";

export const FLAGS_KEY = "cfg:flags";
const FLAG_BANNER_MAX = 140;
const FLAG_LIMIT_MIN = 1;
const FLAG_LIMIT_MAX = 200;

export type SystemFlags = {
  chatEnabled: boolean;
  roomsEnabled: boolean;
  maintenance: boolean;
  banner: string;
  chatDailyLimit: number;
  updatedAt: number;
  updatedBy: string;
};

/** Cờ đọc từ KV; `chatDailyLimit: null` nghĩa là chưa ai đặt, nơi hiển thị tự lấy hạn mức hiệu lực. */
type StoredFlags = Omit<SystemFlags, "chatDailyLimit"> & { chatDailyLimit: number | null };

type FlagsRead =
  | { ok: true; flags: StoredFlags }
  | { ok: false; error: string };

const DEFAULT_FLAGS: StoredFlags = {
  chatEnabled: true,
  roomsEnabled: true,
  maintenance: false,
  banner: "",
  chatDailyLimit: null,
  updatedAt: 0,
  updatedBy: "",
};

function cleanBannerText(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, FLAG_BANNER_MAX);
}

function validFlagLimit(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= FLAG_LIMIT_MIN &&
    value <= FLAG_LIMIT_MAX
    ? value
    : null;
}

/**
 * Đọc cờ hệ thống. Thiếu binding hoặc JSON hỏng thì báo lỗi rõ ràng để
 * trang admin hiện panel đỏ và khóa công tắc, không âm thầm ghi đè.
 */
export async function readFlags(env: AdminEnv): Promise<FlagsRead> {
  if (!env.FLAGS) return { ok: false, error: "missing_binding" };

  let raw: string | null = null;
  try {
    raw = await env.FLAGS.get(FLAGS_KEY);
  } catch {
    return { ok: false, error: "kv_error" };
  }
  if (!raw) return { ok: true, flags: { ...DEFAULT_FLAGS } };

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "invalid_json" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "invalid_json" };
  }

  const source = parsed as Record<string, unknown>;
  return {
    ok: true,
    flags: {
      chatEnabled: typeof source.chatEnabled === "boolean" ? source.chatEnabled : DEFAULT_FLAGS.chatEnabled,
      roomsEnabled: typeof source.roomsEnabled === "boolean" ? source.roomsEnabled : DEFAULT_FLAGS.roomsEnabled,
      maintenance: typeof source.maintenance === "boolean" ? source.maintenance : DEFAULT_FLAGS.maintenance,
      banner: cleanBannerText(source.banner),
      chatDailyLimit: validFlagLimit(source.chatDailyLimit),
      updatedAt: Number(source.updatedAt) > 0 ? Number(source.updatedAt) : 0,
      updatedBy: typeof source.updatedBy === "string" ? source.updatedBy.slice(0, 200) : "",
    },
  };
}

type FlagsInput = {
  chatEnabled: boolean;
  roomsEnabled: boolean;
  maintenance: boolean;
  banner: string;
  chatDailyLimit: number;
};

export function parseFlagsBody(body: unknown): FlagsInput | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const raw = body as Record<string, unknown>;
  if (
    typeof raw.chatEnabled !== "boolean" ||
    typeof raw.roomsEnabled !== "boolean" ||
    typeof raw.maintenance !== "boolean" ||
    typeof raw.banner !== "string"
  ) {
    return null;
  }
  if (/[\u0000-\u001F\u007F]/.test(raw.banner) || raw.banner.length > FLAG_BANNER_MAX) {
    return null;
  }
  const limit = validFlagLimit(raw.chatDailyLimit);
  if (limit === null) return null;
  return {
    chatEnabled: raw.chatEnabled,
    roomsEnabled: raw.roomsEnabled,
    maintenance: raw.maintenance,
    banner: raw.banner,
    chatDailyLimit: limit,
  };
}
