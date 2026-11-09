/**
 * P1a/P1b/P1c — Số liệu sức khỏe và sử dụng: probe 3 worker, hạn mức chat
 * trong ngày (D1), snapshot đồng bộ (D1), phút LiveKit, dung lượng R2,
 * nhật ký lỗi và cờ hệ thống, gộp thành payload `/api/admin/overview`.
 */

import { readErrors, logAdminError } from "./errors";
import { readFlags } from "./flags";
import {
  PROBE_TIMEOUT_MS,
  R2_CACHE_TTL_MS,
  R2_LIST_MAX_PAGES,
  R2_LIST_PAGE,
  trimUrl,
  type AdminEnv,
} from "./shared";

const DEFAULT_CHAT_DAILY = 30;
const SNAPSHOT_MAX_BYTES = 2_000_000;
// Cloudflare tính hạn mức R2 theo GB thập phân (10 GB), không phải GiB.
const R2_LIMIT_BYTES = 10 * 1000 ** 3;
const R2_LIMIT_LABEL = `${R2_LIMIT_BYTES / 1000 ** 3} GB`;

type Probe = { name: string; url: string; headers?: Record<string, string> };

export type CheckResult = { name: string; ok: boolean; ms: number };

export async function probeCheck(probe: Probe): Promise<CheckResult> {
  if (!probe.url) return { name: probe.name, ok: false, ms: 0 };

  const started = Date.now();
  try {
    const res = await fetch(probe.url, {
      method: "GET",
      headers: { Accept: "application/json", ...probe.headers },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const ms = Date.now() - started;

    let healthy = res.ok;
    if (healthy) {
      const body = await res.json().catch(() => null);
      if (body && body.ok === false) healthy = false;
    }
    if (!healthy) {
      console.warn(`admin ping: ${probe.name} không đạt`, { status: res.status });
    }
    return { name: probe.name, ok: healthy, ms };
  } catch {
    console.warn(`admin ping: ${probe.name} không gọi được`);
    return { name: probe.name, ok: false, ms: Date.now() - started };
  }
}

export function pingProbes(env: AdminEnv): Probe[] {
  const chat = trimUrl(env.CHAT_PROXY_URL);
  const data = trimUrl(env.DATA_API_URL);
  const livekit = trimUrl(env.LIVEKIT_URL);
  const token = String(env.ADMIN_TOKEN || "").trim();

  return [
    { name: "chat-proxy", url: chat ? `${chat}/health` : "" },
    { name: "data-api", url: data ? `${data}/health` : "" },
    {
      name: "livekit",
      url: livekit && token ? `${livekit}/usage` : "",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  ];
}

type SourceResult<T> = { ok: true; data: T } | { ok: false; error: string };

interface ChatStatusBody {
  dayPacific?: string;
  auth?: { userDailyLimit?: number };
}

interface LivekitUsageBody {
  month?: string;
  usedMinutes?: number;
  limitMinutes?: number;
  roomsOpen?: number;
  participants?: number;
}

async function fetchJson<T>(
  url: string,
  headers?: Record<string, string>,
): Promise<SourceResult<T>> {
  if (!url) return { ok: false, error: "missing_url" };
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", ...headers },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, error: `http_${res.status}` };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, error: "unreachable" };
  }
}

export function pacificDay(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function readChatUsage(
  env: AdminEnv,
  day: string,
): Promise<{ ok: true; total: number; users: number } | { ok: false; error: string }> {
  if (!env.DB) return { ok: false, error: "d1_unavailable" };
  try {
    const row = await env.DB.prepare(
      "SELECT COALESCE(SUM(count), 0) AS total, COUNT(*) AS users FROM chat_usage WHERE day = ?",
    )
      .bind(day)
      .first<{ total: number; users: number }>();
    return { ok: true, total: Number(row?.total) || 0, users: Number(row?.users) || 0 };
  } catch {
    return { ok: false, error: "d1_error" };
  }
}

async function readSyncUsage(
  env: AdminEnv,
): Promise<
  | { ok: true; users: number; lastAt: number | null; maxBytes: number }
  | { ok: false; error: string }
> {
  if (!env.DB) return { ok: false, error: "d1_unavailable" };
  try {
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS users, MAX(updated_at) AS lastAt, MAX(LENGTH(data_json)) AS maxBytes FROM user_data",
    ).first<{ users: number; lastAt: number | null; maxBytes: number | null }>();
    return {
      ok: true,
      users: Number(row?.users) || 0,
      lastAt: row?.lastAt == null ? null : Number(row.lastAt),
      maxBytes: Number(row?.maxBytes) || 0,
    };
  } catch {
    return { ok: false, error: "d1_error" };
  }
}

type R2Usage =
  | { ok: true; bytes: number; objects: number; partial: boolean }
  | { ok: false; error: string };

let r2Cache: { at: number; value: R2Usage } | null = null;

/** Test dùng để xóa cache dung lượng R2 giữa các ca. */
export function __resetR2Cache(): void {
  r2Cache = null;
}

/**
 * Tổng dung lượng và số object trong bucket. Trang tự làm mới 30 giây nhưng
 * list R2 tốn Class A, nên cache 60 giây cho cả kết quả lỗi.
 */
async function readR2Usage(env: AdminEnv): Promise<R2Usage> {
  const now = Date.now();
  if (r2Cache && now - r2Cache.at < R2_CACHE_TTL_MS) return r2Cache.value;

  let result: R2Usage;
  if (!env.R2) {
    result = { ok: false, error: "missing_binding" };
  } else {
    let bytes = 0;
    let objects = 0;
    let cursor: string | undefined;
    let partial = false;
    try {
      for (let page = 1; ; page += 1) {
        const res = await env.R2.list({ limit: R2_LIST_PAGE, cursor });
        for (const object of res?.objects || []) {
          bytes += Number(object?.size) || 0;
          objects += 1;
        }
        if (!res?.truncated) break;
        // Tránh treo request nếu bucket quá lớn hoặc cursor rỗng.
        if (!res.cursor || page >= R2_LIST_MAX_PAGES) {
          partial = true;
          break;
        }
        cursor = res.cursor;
      }
      result = { ok: true, bytes, objects, partial };
    } catch {
      result = { ok: false, error: "r2_error" };
    }
  }

  r2Cache = { at: now, value: result };
  return result;
}

export async function buildOverview(env: AdminEnv, email: string) {
  const day = pacificDay();
  const token = String(env.ADMIN_TOKEN || "").trim();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;
  const chatUrl = trimUrl(env.CHAT_PROXY_URL);
  const livekitUrl = trimUrl(env.LIVEKIT_URL);
  const probes = pingProbes(env);

  const [probeResults, chatStatus, livekitUsage, chatUsage, syncUsage, errorsRead, r2, flagsRead] =
    await Promise.all([
      Promise.allSettled(probes.map((probe) => probeCheck(probe))),
      chatUrl
        ? fetchJson<ChatStatusBody>(`${chatUrl}/status`, authHeaders)
        : Promise.resolve<SourceResult<ChatStatusBody>>({ ok: false, error: "missing_url" }),
      livekitUrl && token
        ? fetchJson<LivekitUsageBody>(`${livekitUrl}/usage`, authHeaders)
        : Promise.resolve<SourceResult<LivekitUsageBody>>({
            ok: false,
            error: livekitUrl ? "missing_token" : "missing_url",
          }),
      readChatUsage(env, day),
      readSyncUsage(env),
      readErrors(env),
      readR2Usage(env),
      readFlags(env),
    ]);

  const checks: CheckResult[] = probeResults.map((result, index) =>
    result.status === "fulfilled"
      ? result.value
      : { name: probes[index].name, ok: false, ms: 0 },
  );
  const healthOk = checks.length > 0 && checks.every((check) => check.ok);

  const dailyLimit =
    Number(chatStatus.ok ? chatStatus.data.auth?.userDailyLimit : NaN) || DEFAULT_CHAT_DAILY;

  let chat: Record<string, unknown>;
  if (!chatUsage.ok) {
    chat = { ok: false, error: chatUsage.error };
  } else if (!chatStatus.ok) {
    chat = { ok: false, error: chatStatus.error };
  } else {
    chat = {
      ok: true,
      day: chatStatus.data.dayPacific || day,
      total: chatUsage.total,
      users: chatUsage.users,
      dailyLimit,
    };
  }

  const sync = syncUsage.ok
    ? {
        ok: true,
        users: syncUsage.users,
        lastAt: syncUsage.lastAt,
        maxBytes: syncUsage.maxBytes,
      }
    : { ok: false, error: syncUsage.error };

  const livekit = livekitUsage.ok
    ? {
        ok: true,
        month: livekitUsage.data.month || "",
        usedMinutes: Number(livekitUsage.data.usedMinutes) || 0,
        limitMinutes: Number(livekitUsage.data.limitMinutes) || 0,
        roomsOpen: Number(livekitUsage.data.roomsOpen) || 0,
        participants: Number(livekitUsage.data.participants) || 0,
      }
    : { ok: false, error: livekitUsage.error };

  const errors = errorsRead.ok
    ? { ok: true, items: errorsRead.items }
    : { ok: false, error: errorsRead.error };

  // Chưa ai đặt hạn mức trong KV thì hiện hạn mức hiệu lực mà chat-proxy đang dùng.
  const flags = flagsRead.ok
    ? {
        ok: true,
        ...flagsRead.flags,
        chatDailyLimit: flagsRead.flags.chatDailyLimit ?? dailyLimit,
      }
    : { ok: false, error: flagsRead.error };

  const limits = {
    chatDaily: dailyLimit,
    snapshotMaxBytes: SNAPSHOT_MAX_BYTES,
    r2: R2_LIMIT_LABEL,
    r2Bytes: R2_LIMIT_BYTES,
  };

  const degraded =
    !healthOk ||
    chat.ok !== true ||
    sync.ok !== true ||
    livekit.ok !== true ||
    errors.ok !== true ||
    r2.ok !== true ||
    flags.ok !== true;

  // Ghi lỗi cấu hình/D1 để mở trang là thấy, không ghi health (trang tự làm mới 30 giây).
  await Promise.all([
    chat.ok === true ? null : logAdminError(env, "chat", String(chat.error)),
    sync.ok === true ? null : logAdminError(env, "sync", String(sync.error)),
    livekit.ok === true ? null : logAdminError(env, "livekit", String(livekit.error)),
    errors.ok === true ? null : logAdminError(env, "errors", String(errors.error)),
    r2.ok === true ? null : logAdminError(env, "r2", String(r2.error)),
    flags.ok === true ? null : logAdminError(env, "flags", String(flags.error)),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    email,
    degraded,
    health: { ok: healthOk, checks },
    chat,
    sync,
    livekit,
    errors,
    r2,
    flags,
    limits,
  };
}
