/**
 * ZenStudy Admin Worker (P0/P1a)
 *
 * - `/api/admin/*`: xác thực Cloudflare Access JWT rồi mới xử lý.
 * - `GET /api/admin/ping`: sức khỏe 3 worker.
 * - `GET /api/admin/overview`: snapshot sức khỏe + sử dụng (P1a).
 * - Mọi path khác: trả static asset trong `dist-admin/` qua binding `ASSETS`.
 *
 * Biến môi trường (chỉ Production, không đặt ở Preview):
 *   ACCESS_TEAM_DOMAIN  Text   https://<team>.cloudflareaccess.com
 *   ACCESS_AUD          Text   Application Audience Tag
 *   ADMIN_TOKEN         Secret trùng token của worker livekit
 *   CHAT_PROXY_URL      Text   https://chat-proxy...workers.dev
 *   DATA_API_URL        Text   https://data-api...workers.dev
 *   LIVEKIT_URL         Text   https://livekit...workers.dev
 *
 * Chỉ riêng `.dev.vars` (local, gitignored):
 *   ENVIRONMENT         Text   "development" — bỏ qua Access khi chạy localhost.
 *                              Không bao giờ đặt biến này trong Production.
 */

const API_PREFIX = "/api/admin";
const CERT_TTL_MS = 60 * 60 * 1000;
const CLOCK_SKEW_SEC = 60;
const PROBE_TIMEOUT_MS = 3000;
const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const DEFAULT_CHAT_DAILY = 30;
const SNAPSHOT_MAX_BYTES = 2_000_000;
const R2_LIMIT_LABEL = "10 GiB";

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<unknown>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
}

interface D1DatabaseLike {
  prepare(query: string): D1Statement;
}

export interface AdminEnv {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ADMIN_TOKEN?: string;
  CHAT_PROXY_URL?: string;
  DATA_API_URL?: string;
  LIVEKIT_URL?: string;
  ENVIRONMENT?: string;
  ASSETS?: { fetch(request: Request): Promise<Response> };
  DB?: D1DatabaseLike;
}

export type VerifyResult =
  | { ok: true; email: string }
  | { ok: false; reason: string };

let keyCache = new Map<string, CryptoKey>();
let certsExpiresAt = 0;

export function __resetAccessCertsCache() {
  keyCache = new Map();
  certsExpiresAt = 0;
}

export function normalizeTeamDomain(raw: string | undefined): string {
  const value = String(raw || "").trim().replace(/\/+$/, "");
  if (!value) return "";
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:") return "";
    return `https://${url.host}`;
  } catch {
    return "";
  }
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJsonPart(part: string): any {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)));
}

async function loadAccessKeys(env: AdminEnv, force = false): Promise<boolean> {
  const now = Date.now();
  if (!force && certsExpiresAt > now && keyCache.size > 0) return true;

  const team = normalizeTeamDomain(env.ACCESS_TEAM_DOMAIN);
  if (!team) return false;

  try {
    const res = await fetch(`${team}/cdn-cgi/access/certs`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!res.ok) return false;

    const data = (await res.json()) as {
      keys?: Array<JsonWebKey & { kid?: string }>;
    };
    const jwks = Array.isArray(data?.keys) ? data.keys : [];

    const next = new Map<string, CryptoKey>();
    for (const jwk of jwks) {
      if (!jwk || !jwk.kid) continue;
      try {
        const key = await crypto.subtle.importKey(
          "jwk",
          jwk,
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
          false,
          ["verify"],
        );
        next.set(jwk.kid, key);
      } catch {
        // Bỏ khóa hỏng, giữ các khóa còn lại.
      }
    }
    if (next.size === 0) return false;

    keyCache = next;
    certsExpiresAt = now + CERT_TTL_MS;
    return true;
  } catch {
    return false;
  }
}

export async function verifyAccessJwt(
  request: Request,
  env: AdminEnv,
): Promise<VerifyResult> {
  // Bỏ qua Access chỉ khi chạy wrangler dev (ENVIRONMENT=development trong .dev.vars)
  // và request đến từ localhost. Production không đặt ENVIRONMENT nên vẫn fail closed,
  // và hostname thật cũng không bao giờ khớp danh sách local.
  if (env.ENVIRONMENT === "development") {
    try {
      if (LOCAL_DEV_HOSTS.has(new URL(request.url).hostname)) {
        return { ok: true, email: "local-dev@localhost" };
      }
    } catch {
      // URL hỏng thì rơi xuống nhánh xác thực bình thường.
    }
  }

  const token = String(request.headers.get("Cf-Access-Jwt-Assertion") || "").trim();
  if (!token) return { ok: false, reason: "missing_token" };

  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed_token" };

  let header: any;
  let claims: any;
  try {
    header = decodeJsonPart(parts[0]);
    claims = decodeJsonPart(parts[1]);
  } catch {
    return { ok: false, reason: "malformed_token" };
  }

  // Chỉ nhận RS256; từ chối "alg": "none" và mọi thuật toán khác.
  if (header?.alg !== "RS256") return { ok: false, reason: "bad_alg" };
  const kid = String(header?.kid || "");
  if (!kid) return { ok: false, reason: "missing_kid" };

  const audience = String(env.ACCESS_AUD || "").trim();
  const team = normalizeTeamDomain(env.ACCESS_TEAM_DOMAIN);
  if (!audience || !team) return { ok: false, reason: "missing_config" };

  if (!(await loadAccessKeys(env))) return { ok: false, reason: "certs_unavailable" };

  let key = keyCache.get(kid);
  if (!key) {
    // Có thể khóa vừa xoay vòng: tải lại một lần trước khi từ chối.
    if (!(await loadAccessKeys(env, true))) {
      return { ok: false, reason: "certs_unavailable" };
    }
    key = keyCache.get(kid);
  }
  if (!key) return { ok: false, reason: "unknown_kid" };

  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      base64UrlToBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, reason: "bad_signature" };

  const now = Math.floor(Date.now() / 1000);
  if (typeof claims?.exp !== "number" || claims.exp + CLOCK_SKEW_SEC < now) {
    return { ok: false, reason: "expired" };
  }
  if (typeof claims?.nbf === "number" && claims.nbf - CLOCK_SKEW_SEC > now) {
    return { ok: false, reason: "not_yet_valid" };
  }

  const audOk = Array.isArray(claims?.aud)
    ? claims.aud.includes(audience)
    : claims?.aud === audience;
  if (!audOk) return { ok: false, reason: "bad_audience" };
  if (claims?.iss !== team) return { ok: false, reason: "bad_issuer" };

  const email = typeof claims?.email === "string" ? claims.email.trim() : "";
  if (!email) return { ok: false, reason: "missing_email" };

  return { ok: true, email };
}

export type AuditEntry = {
  actor: string;
  action: string;
  target?: string;
  detail?: unknown;
};

/**
 * Endpoint ghi phải dừng hành động khi hàm này trả `false` (fail closed).
 */
export async function logAudit(
  env: AdminEnv,
  entry: AuditEntry,
): Promise<boolean> {
  if (!env.DB) {
    console.error("admin audit: thiếu binding DB");
    return false;
  }

  try {
    await env.DB.prepare(
      "INSERT INTO admin_audit (actor_email, action, target, detail_json, created_at) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(
        entry.actor,
        entry.action,
        entry.target ?? null,
        entry.detail === undefined ? null : JSON.stringify(entry.detail),
        Date.now(),
      )
      .run();
    return true;
  } catch {
    console.error("admin audit: ghi thất bại");
    return false;
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function trimUrl(raw: string | undefined): string {
  return String(raw || "").trim().replace(/\/+$/, "");
}

type Probe = { name: string; url: string; headers?: Record<string, string> };

type CheckResult = { name: string; ok: boolean; ms: number };

async function probeCheck(probe: Probe): Promise<CheckResult> {
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

function pingProbes(env: AdminEnv): Probe[] {
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

function pacificDay(): string {
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

async function buildOverview(env: AdminEnv, email: string) {
  const day = pacificDay();
  const token = String(env.ADMIN_TOKEN || "").trim();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;
  const chatUrl = trimUrl(env.CHAT_PROXY_URL);
  const livekitUrl = trimUrl(env.LIVEKIT_URL);
  const probes = pingProbes(env);

  const [probeResults, chatStatus, livekitUsage, chatUsage, syncUsage] = await Promise.all([
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

  const limits = {
    chatDaily: dailyLimit,
    snapshotMaxBytes: SNAPSHOT_MAX_BYTES,
    r2: R2_LIMIT_LABEL,
  };

  const degraded = !healthOk || chat.ok !== true || sync.ok !== true || livekit.ok !== true;

  return {
    generatedAt: new Date().toISOString(),
    email,
    degraded,
    health: { ok: healthOk, checks },
    chat,
    sync,
    livekit,
    limits,
  };
}

async function handleApi(
  request: Request,
  env: AdminEnv,
  pathname: string,
): Promise<Response> {
  const identity = await verifyAccessJwt(request, env);
  if (!identity.ok) {
    console.warn("admin api: từ chối", { reason: identity.reason, path: pathname });
    return json({ error: "Cần đăng nhập Cloudflare Access." }, 401);
  }

  if (pathname === `${API_PREFIX}/overview`) {
    if (request.method !== "GET") {
      return json({ error: "Chỉ hỗ trợ GET." }, 405);
    }
    return json(await buildOverview(env, identity.email));
  }

  if (pathname === `${API_PREFIX}/ping`) {
    if (request.method !== "GET") {
      return json({ error: "Chỉ hỗ trợ GET." }, 405);
    }
    const checks = await Promise.all(pingProbes(env).map(probeCheck));
    return json({
      ok: checks.every((check) => check.ok),
      email: identity.email,
      checks,
      time: new Date().toISOString(),
    });
  }

  return json({ error: "Không có endpoint này." }, 404);
}

const worker = {
  async fetch(request: Request, env: AdminEnv): Promise<Response> {
    const url = new URL(request.url);

    if (
      url.pathname === API_PREFIX ||
      url.pathname.startsWith(`${API_PREFIX}/`)
    ) {
      return handleApi(request, env, url.pathname);
    }

    if (!env.ASSETS) return new Response("Not found", { status: 404 });
    return env.ASSETS.fetch(request);
  },
};

export default worker;
