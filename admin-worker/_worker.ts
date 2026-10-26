/**
 * ZenStudy Admin Worker (P0/P1a)
 *
 * - `/api/admin/*`: xác thực Cloudflare Access JWT rồi mới xử lý.
 * - `GET /api/admin/ping`: sức khỏe 3 worker.
 * - `GET /api/admin/overview`: snapshot sức khỏe + sử dụng (P1a) + nhật ký lỗi (P1b) + kho R2 (P1c).
 * - `POST /api/admin/flags`: đổi cờ hệ thống (P2a), audit trước khi ghi KV.
 * - Mọi path khác: trả static asset trong `dist-admin/` qua binding `ASSETS`.
 *
 * Binding: `DB` → D1, `R2` → bucket study-space, `FLAGS` → KV CHAT_QUOTA
 * (khai trong `wrangler.admin.jsonc`).
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
const PROBE_TIMEOUT_MS = 10_000;
const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const DEFAULT_CHAT_DAILY = 30;
const SNAPSHOT_MAX_BYTES = 2_000_000;
// Cloudflare tính hạn mức R2 theo GB thập phân (10 GB), không phải GiB.
const R2_LIMIT_BYTES = 10 * 1000 ** 3;
const R2_LIMIT_LABEL = `${R2_LIMIT_BYTES / 1000 ** 3} GB`;
const R2_LIST_PAGE = 1000;
const R2_LIST_MAX_PAGES = 30;
const R2_CACHE_TTL_MS = 60 * 1000;
// P1b: nhật ký lỗi D1 (bảng admin_error_log).
const ERROR_ROWS_LIMIT = 20;
const ERROR_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
const ERROR_THROTTLE_MS = 60 * 60 * 1000;
const ERROR_MESSAGE_MAX = 200;
// P2a: cờ hệ thống nằm ở KV CHAT_QUOTA, key `cfg:flags` (dùng chung với chat-proxy).
const FLAGS_KEY = "cfg:flags";
const FLAG_BANNER_MAX = 140;
const FLAG_LIMIT_MIN = 1;
const FLAG_LIMIT_MAX = 200;
const FLAG_WRITE_LIMIT = 10;
const FLAG_WRITE_WINDOW_MS = 60 * 1000;
// P2b: cấu hình trợ lý chat đọc/ghi qua API của chat-proxy, nơi duy nhất giữ
// luật giữ key cũ và lọc chain; Worker admin chỉ validate, audit rồi chuyển tiếp.
const CHAT_CFG_WRITE_LIMIT = 10;
const CHAT_CFG_WRITE_WINDOW_MS = 60 * 1000;
const CHAT_CFG_TIMEOUT_MS = 12 * 1000;
const CHAT_TEST_TIMEOUT_MS = 30 * 1000;
const CHAT_PROMPT_MAX = 4000;
const CHAT_CHAIN_MAX = 5;
const CHAT_PROVIDERS_MAX = 10;
const CHAT_TEMP_MAX = 2;
const CHAT_TOKENS_MIN = 256;
const CHAT_TOKENS_MAX = 8000;
const CHAT_PROVIDER_ID_RE = /^[a-z0-9][a-z0-9-_]{0,39}$/i;

type ChatCfgKind = "model" | "gen" | "prompt" | "chain" | "providers";
const CHAT_CFG_TARGETS: Record<ChatCfgKind, string> = {
  model: "cfg:cfModel",
  gen: "cfg:gen",
  prompt: "cfg:prompt",
  chain: "cfg:chain",
  providers: "cfg:providers",
};

type ChatProvider = {
  id: string;
  type: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
};

type ChatChainEntry = { provider: string; modelId: string };
type ChatGen = { temperature: number; max_tokens: number };

type ChatConfig = {
  current: string;
  available: Array<{ key: string; label: string; context?: number }>;
  chain: ChatChainEntry[];
  maxChain: number;
  providers: ChatProvider[];
  presets: Record<string, { label?: string; baseUrl?: string }>;
  prompt: string;
  gen: ChatGen;
};

type ChatCfgChange = {
  kind: ChatCfgKind;
  payload: Record<string, unknown>;
  auditDetail: unknown;
};

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<unknown>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
}

interface D1DatabaseLike {
  prepare(query: string): D1Statement;
}

interface R2ObjectLike {
  key?: string;
  size?: number;
}

interface R2ListPage {
  objects?: R2ObjectLike[];
  truncated?: boolean;
  cursor?: string;
}

interface R2BucketLike {
  list(options?: { limit?: number; cursor?: string }): Promise<R2ListPage>;
}

interface KvNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
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
  R2?: R2BucketLike;
  FLAGS?: KvNamespaceLike;
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

const ERROR_SOURCE_LABELS: Record<string, string> = {
  chat: "Số liệu chat",
  sync: "Số liệu đồng bộ",
  livekit: "Số liệu phòng học nhóm",
  errors: "Nhật ký lỗi",
  r2: "Kho tệp",
  flags: "Cờ hệ thống",
};

const errorLogThrottle = new Map<string, number>();
let errorCleanupAt = 0;

/** Test dùng để xóa bộ nhớ đệm giới hạn tần suất giữa các ca. */
export function __resetErrorLogThrottle(): void {
  errorLogThrottle.clear();
  errorCleanupAt = 0;
}

/**
 * Ghi một dòng lỗi cho trang admin. Cùng `source:code` chỉ ghi tối đa 1 dòng/giờ.
 * Map trong RAM chỉ chặn trong một isolate, nên phải đọc dòng mới nhất trong D1
 * trước khi chèn để các isolate khác cũng thấy giới hạn này.
 * Không chứa câu hỏi, uid, email hay key; D1 lỗi thì bỏ qua, không làm hỏng request chính.
 */
export async function logAdminError(
  env: AdminEnv,
  source: string,
  code: string,
): Promise<boolean> {
  if (!env.DB) return false;

  const key = `${source}:${code}`;
  const now = Date.now();
  const lastInMemory = errorLogThrottle.get(key) || 0;
  if (now - lastInMemory < ERROR_THROTTLE_MS) return false;

  const message = `${ERROR_SOURCE_LABELS[source] || source} không lấy được (${code}).`;
  try {
    const recent = await env.DB.prepare(
      "SELECT created_at FROM admin_error_log WHERE source = ? AND code = ? ORDER BY created_at DESC LIMIT 1",
    )
      .bind(source, code)
      .first<{ created_at: number }>();
    const lastAt = Math.max(lastInMemory, Number(recent?.created_at) || 0);
    if (now - lastAt < ERROR_THROTTLE_MS) {
      if (recent) errorLogThrottle.set(key, lastAt);
      return false;
    }
    errorLogThrottle.set(key, now);

    await env.DB.prepare(
      "INSERT INTO admin_error_log (source, code, message, created_at) VALUES (?, ?, ?, ?)",
    )
      .bind(source, code, message.slice(0, ERROR_MESSAGE_MAX), now)
      .run();

    // Dọn bản ghi quá 14 ngày, tối đa 1 lần/giờ, chỉ ở đường ghi.
    if (now - errorCleanupAt >= ERROR_THROTTLE_MS) {
      errorCleanupAt = now;
      await env.DB.prepare("DELETE FROM admin_error_log WHERE created_at < ?")
        .bind(now - ERROR_RETENTION_MS)
        .run();
    }
    return true;
  } catch {
    return false;
  }
}

type ErrorRow = {
  id: number;
  source: string;
  code: string;
  message: string;
  created_at: number;
};

async function readErrors(env: AdminEnv): Promise<
  | { ok: true; items: Array<Record<string, unknown>> }
  | { ok: false; error: string }
> {
  if (!env.DB) return { ok: false, error: "d1_unavailable" };
  try {
    const res = await env.DB.prepare(
      "SELECT id, source, code, message, created_at FROM admin_error_log ORDER BY created_at DESC LIMIT ?",
    )
      .bind(ERROR_ROWS_LIMIT)
      .all<ErrorRow>();
    const items = (res?.results || []).map((row) => ({
      id: Number(row.id) || 0,
      source: String(row.source || ""),
      code: String(row.code || ""),
      message: String(row.message || "").slice(0, ERROR_MESSAGE_MAX),
      createdAt: Number(row.created_at) || 0,
    }));
    return { ok: true, items };
  } catch {
    return { ok: false, error: "d1_error" };
  }
}

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

function parseFlagsBody(body: unknown): FlagsInput | null {
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

async function logAudit(
  env: AdminEnv,
  entry: { actorEmail: string; action: string; target: string; detail: unknown },
): Promise<boolean> {
  if (!env.DB) return false;
  try {
    await env.DB.prepare(
      "INSERT INTO admin_audit (actor_email, action, target, detail_json, created_at) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(
        entry.actorEmail.slice(0, 200),
        entry.action,
        entry.target,
        JSON.stringify(entry.detail).slice(0, 4000),
        Date.now(),
      )
      .run();
    return true;
  } catch {
    return false;
  }
}

const flagWriteLog = new Map<string, number[]>();

/** Test dùng để xóa bộ đếm giới hạn ghi giữa các ca. */
export function __resetFlagWriteLog(): void {
  flagWriteLog.clear();
}

function allowFlagWrite(email: string): boolean {
  const now = Date.now();
  const hits = (flagWriteLog.get(email) || []).filter((at) => now - at < FLAG_WRITE_WINDOW_MS);
  if (hits.length >= FLAG_WRITE_LIMIT) {
    flagWriteLog.set(email, hits);
    return false;
  }
  hits.push(now);
  flagWriteLog.set(email, hits);
  return true;
}

const chatWriteLog = new Map<string, number[]>();

/** Test dùng để xóa bộ đếm giới hạn ghi cấu hình chat giữa các ca. */
export function __resetChatWriteLog(): void {
  chatWriteLog.clear();
}

function allowChatWrite(email: string): boolean {
  const now = Date.now();
  const hits = (chatWriteLog.get(email) || []).filter((at) => now - at < CHAT_CFG_WRITE_WINDOW_MS);
  if (hits.length >= CHAT_CFG_WRITE_LIMIT) {
    chatWriteLog.set(email, hits);
    return false;
  }
  hits.push(now);
  chatWriteLog.set(email, hits);
  return true;
}

export function mapChatConfig(raw: Record<string, unknown>): ChatConfig {
  const providersRaw = Array.isArray(raw.providers) ? raw.providers : [];
  const providers: ChatProvider[] = [];
  for (const item of providersRaw) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const id = typeof entry.id === "string" ? entry.id : "";
    if (!id) continue;
    const masked = typeof entry.apiKey === "string" ? entry.apiKey : "";
    providers.push({
      id,
      type: typeof entry.type === "string" ? entry.type : "custom",
      label: typeof entry.label === "string" && entry.label ? entry.label : id,
      baseUrl: typeof entry.baseUrl === "string" ? entry.baseUrl : "",
      // Chỉ chuyển tiếp mặt nạ; nếu chat-proxy lỡ trả key thật thì bỏ hẳn.
      apiKey: masked.startsWith("***") ? masked : "",
      enabled: entry.enabled !== false,
    });
  }

  const chainRaw = Array.isArray(raw.chain) ? raw.chain : [];
  const chain: ChatChainEntry[] = [];
  for (const item of chainRaw) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    if (typeof entry.provider !== "string" || typeof entry.modelId !== "string") continue;
    chain.push({ provider: entry.provider, modelId: entry.modelId });
  }

  const availableRaw = Array.isArray(raw.available) ? raw.available : [];
  const available: ChatConfig["available"] = [];
  for (const item of availableRaw) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    if (typeof entry.key !== "string" || !entry.key) continue;
    available.push({
      key: entry.key,
      label: typeof entry.label === "string" ? entry.label : entry.key,
      ...(typeof entry.context === "number" ? { context: entry.context } : {}),
    });
  }

  const presets: ChatConfig["presets"] = {};
  if (raw.presets && typeof raw.presets === "object" && !Array.isArray(raw.presets)) {
    for (const [key, value] of Object.entries(raw.presets as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const preset = value as Record<string, unknown>;
      presets[key] = {
        ...(typeof preset.label === "string" ? { label: preset.label } : {}),
        ...(typeof preset.baseUrl === "string" ? { baseUrl: preset.baseUrl } : {}),
      };
    }
  }

  const genRaw = raw.gen && typeof raw.gen === "object" ? (raw.gen as Record<string, unknown>) : {};
  const maxChain = typeof raw.maxChain === "number" && raw.maxChain > 0 ? raw.maxChain : CHAT_CHAIN_MAX;

  return {
    current: typeof raw.current === "string" ? raw.current : "",
    available,
    chain,
    maxChain,
    providers,
    presets,
    prompt: typeof raw.prompt === "string" ? raw.prompt : "",
    gen: {
      temperature: typeof genRaw.temperature === "number" ? genRaw.temperature : 0.7,
      max_tokens: typeof genRaw.max_tokens === "number" ? genRaw.max_tokens : 1200,
    },
  };
}

type ChatProxyResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; status: number; error: string };

function chatProxyCall(
  env: AdminEnv,
  path: string,
  options: {
    method?: string;
    body?: unknown;
    timeoutMs?: number;
    bearer?: boolean;
  } = {},
): Promise<ChatProxyResult> {
  const base = trimUrl(env.CHAT_PROXY_URL);
  const token = String(env.ADMIN_TOKEN || "").trim();
  if (!base || !token) return Promise.resolve({ ok: false, status: 503, error: "missing_config" });

  const url = options.bearer
    ? `${base}${path}`
    : `${base}${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;

  return fetch(url, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(options.bearer ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(options.timeoutMs || CHAT_CFG_TIMEOUT_MS),
  })
    .then(async (res) => {
      let data: Record<string, unknown> = {};
      try {
        const parsed = await res.json();
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          data = parsed as Record<string, unknown>;
        }
      } catch {
        data = {};
      }
      if (!res.ok) {
        return {
          ok: false as const,
          status: res.status,
          error:
            typeof data.error === "string" && data.error
              ? data.error
              : `chat_proxy_http_${res.status}`,
        };
      }
      return { ok: true as const, data };
    })
    .catch(() => ({ ok: false as const, status: 502, error: "chat_proxy_unreachable" }));
}

function stripProviderSecrets(list: ChatProvider[]) {
  return list.map((p) => ({ id: p.id, type: p.type, baseUrl: p.baseUrl, enabled: p.enabled }));
}

function chainLabels(list: ChatChainEntry[]): string[] {
  return list.map((entry) => `${entry.provider}:${entry.modelId}`);
}

/** Validate một nhóm thay đổi và dựng phần audit không chứa key hay nội dung prompt. */
export function parseChatCfgBody(body: unknown, cfg: ChatConfig): ChatCfgChange | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const raw = body as Record<string, unknown>;

  if (raw.kind === "model") {
    const pick = typeof raw.cfModel === "string" ? raw.cfModel : "";
    if (!cfg.available.some((model) => model.key === pick)) return null;
    return {
      kind: "model",
      payload: { cfModel: pick },
      auditDetail: { before: cfg.current, after: pick },
    };
  }

  if (raw.kind === "gen") {
    const temperature = raw.temperature;
    const maxTokens = raw.max_tokens;
    if (
      typeof temperature !== "number" ||
      !Number.isFinite(temperature) ||
      temperature < 0 ||
      temperature > CHAT_TEMP_MAX
    ) {
      return null;
    }
    if (
      typeof maxTokens !== "number" ||
      !Number.isInteger(maxTokens) ||
      maxTokens < CHAT_TOKENS_MIN ||
      maxTokens > CHAT_TOKENS_MAX
    ) {
      return null;
    }
    const next = { temperature, max_tokens: maxTokens };
    return {
      kind: "gen",
      payload: { gen: next },
      auditDetail: { before: cfg.gen, after: next },
    };
  }

  if (raw.kind === "prompt") {
    const prompt = typeof raw.prompt === "string" ? raw.prompt : "";
    if (
      !prompt.trim() ||
      prompt.length > CHAT_PROMPT_MAX ||
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(prompt)
    ) {
      return null;
    }
    // Không ghi nội dung prompt vào audit, chỉ ghi độ dài.
    return {
      kind: "prompt",
      payload: { prompt },
      auditDetail: { beforeChars: cfg.prompt.length, afterChars: prompt.length },
    };
  }

  if (raw.kind === "chain") {
    if (!Array.isArray(raw.chain) || raw.chain.length === 0 || raw.chain.length > cfg.maxChain) {
      return null;
    }
    const providerIds = new Set(
      cfg.providers.filter((p) => p.enabled).map((p) => p.id),
    );
    const cfKeys = new Set(cfg.available.map((model) => model.key));
    const chain: ChatChainEntry[] = [];
    for (const item of raw.chain) {
      if (!item || typeof item !== "object") return null;
      const entry = item as Record<string, unknown>;
      const provider = typeof entry.provider === "string" ? entry.provider : "";
      const modelId = typeof entry.modelId === "string" ? entry.modelId.trim() : "";
      if (!modelId || modelId.length > 200) return null;
      if (provider === "cf") {
        if (!cfKeys.has(modelId)) return null;
      } else if (!providerIds.has(provider)) {
        return null;
      }
      chain.push({ provider, modelId });
    }
    return {
      kind: "chain",
      payload: { chain },
      auditDetail: { before: chainLabels(cfg.chain), after: chainLabels(chain) },
    };
  }

  if (raw.kind === "providers") {
    if (!Array.isArray(raw.providers) || raw.providers.length > CHAT_PROVIDERS_MAX) return null;
    const current = new Map(cfg.providers.map((p) => [p.id, p]));
    const next: ChatProvider[] = [];
    for (const item of raw.providers) {
      if (!item || typeof item !== "object") return null;
      const entry = item as Record<string, unknown>;
      const id = typeof entry.id === "string" ? entry.id : "";
      if (!CHAT_PROVIDER_ID_RE.test(id)) return null;
      const type =
        typeof entry.type === "string" && cfg.presets[entry.type] ? entry.type : "custom";
      const baseUrl =
        typeof entry.baseUrl === "string" ? entry.baseUrl.trim().replace(/\/$/, "") : "";
      if (!/^https:\/\/.+/.test(baseUrl) || baseUrl.length > 200) return null;
      const label =
        typeof entry.label === "string" && entry.label.trim()
          ? entry.label.trim().slice(0, 60)
          : id;
      const apiKey = typeof entry.apiKey === "string" ? entry.apiKey.trim() : "";
      if (apiKey.startsWith("***")) {
        // Mặt nạ: chat-proxy giữ key cũ, nhưng hãng phải đang tồn tại.
        if (!current.has(id)) return null;
      } else if (!apiKey || apiKey.length > 500) {
        return null;
      }
      if (next.some((p) => p.id === id)) return null;
      next.push({ id, type, label, baseUrl, apiKey, enabled: entry.enabled !== false });
    }
    return {
      kind: "providers",
      payload: { providers: next },
      auditDetail: {
        before: stripProviderSecrets(cfg.providers),
        after: stripProviderSecrets(next),
      },
    };
  }

  return null;
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

async function buildOverview(env: AdminEnv, email: string) {
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

  if (pathname === `${API_PREFIX}/flags`) {
    if (request.method !== "POST") {
      return json({ error: "Chỉ hỗ trợ POST." }, 405);
    }
    if (!env.FLAGS) {
      return json({ error: "kv_error" }, 500);
    }
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_body" }, 400);
    }
    const next = parseFlagsBody(body);
    if (!next) {
      return json({ error: "invalid_body" }, 400);
    }
    if (!allowFlagWrite(identity.email)) {
      return json({ error: "rate_limited" }, 429);
    }

    const before = await readFlags(env);
    const record: SystemFlags = {
      ...next,
      updatedAt: Date.now(),
      updatedBy: identity.email,
    };
    const audited = await logAudit(env, {
      actorEmail: identity.email,
      action: "flags.update",
      target: FLAGS_KEY,
      detail: { before: before.ok ? before.flags : null, after: record },
    });
    if (!audited) {
      return json({ error: "audit_failed" }, 500);
    }
    try {
      await env.FLAGS.put(FLAGS_KEY, JSON.stringify(record));
    } catch {
      return json({ error: "kv_error" }, 500);
    }
    return json({ ok: true, flags: record });
  }

  if (pathname === `${API_PREFIX}/chat/config`) {
    if (request.method === "GET") {
      const current = await chatProxyCall(env, "/models");
      if (!current.ok) return json({ error: current.error }, 502);
      return json({ ok: true, config: mapChatConfig(current.data) });
    }
    if (request.method !== "POST") {
      return json({ error: "Chỉ hỗ trợ GET hoặc POST." }, 405);
    }
    if (!allowChatWrite(identity.email)) {
      return json({ error: "rate_limited" }, 429);
    }
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_body" }, 400);
    }
    // Đọc trạng thái hiện tại để validate và ghi before/after vào audit.
    const current = await chatProxyCall(env, "/models");
    if (!current.ok) return json({ error: current.error }, 502);
    const change = parseChatCfgBody(body, mapChatConfig(current.data));
    if (!change) return json({ error: "invalid_body" }, 400);

    const audited = await logAudit(env, {
      actorEmail: identity.email,
      action: "chat.config.update",
      target: CHAT_CFG_TARGETS[change.kind],
      detail: change.auditDetail,
    });
    if (!audited) return json({ error: "audit_failed" }, 500);

    const written = await chatProxyCall(env, "/models", {
      method: "POST",
      body: change.payload,
    });
    if (!written.ok) return json({ error: written.error }, 502);
    return json({ ok: true });
  }

  if (pathname === `${API_PREFIX}/chat/check-key`) {
    if (request.method !== "POST") {
      return json({ error: "Chỉ hỗ trợ POST." }, 405);
    }
    if (!allowChatWrite(identity.email)) {
      return json({ error: "rate_limited" }, 429);
    }
    let body: Record<string, unknown> = {};
    try {
      const parsed = await request.json();
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      return json({ error: "invalid_body" }, 400);
    }
    const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    if (!/^https:\/\/.+/.test(baseUrl) || !apiKey || apiKey.length > 500) {
      return json({ error: "invalid_body" }, 400);
    }
    const checked = await chatProxyCall(env, "/providers/check", {
      method: "POST",
      body: { type: body.type, baseUrl, apiKey },
    });
    if (!checked.ok) {
      const status = checked.status === 401 || checked.status === 403 ? 502 : checked.status;
      return json({ error: checked.error }, status);
    }
    const models = Array.isArray(checked.data.models) ? checked.data.models : [];
    return json({
      ok: true,
      count: typeof checked.data.count === "number" ? checked.data.count : models.length,
      models,
    });
  }

  if (pathname === `${API_PREFIX}/chat/provider-models`) {
    if (request.method !== "GET") {
      return json({ error: "Chỉ hỗ trợ GET." }, 405);
    }
    const id = new URL(request.url).searchParams.get("id") || "";
    if (!CHAT_PROVIDER_ID_RE.test(id)) return json({ error: "invalid_body" }, 400);
    const listed = await chatProxyCall(env, `/providers/models?id=${encodeURIComponent(id)}`);
    if (!listed.ok) {
      const status = listed.status === 401 || listed.status === 403 ? 502 : listed.status;
      return json({ error: listed.error }, status);
    }
    const models = Array.isArray(listed.data.models) ? listed.data.models : [];
    return json({ ok: true, models });
  }

  if (pathname === `${API_PREFIX}/chat/test`) {
    if (request.method !== "POST") {
      return json({ error: "Chỉ hỗ trợ POST." }, 405);
    }
    if (!allowChatWrite(identity.email)) {
      return json({ error: "rate_limited" }, 429);
    }
    let body: Record<string, unknown> = {};
    try {
      const parsed = await request.json();
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      return json({ error: "invalid_body" }, 400);
    }
    const provider = typeof body.provider === "string" ? body.provider : "";
    const modelId = typeof body.modelId === "string" ? body.modelId : "";
    if (!provider || provider.length > 40 || !modelId || modelId.length > 200) {
      return json({ error: "invalid_body" }, 400);
    }
    const started = Date.now();
    // /chat với Bearer ADMIN_TOKEN + strict: chạy đúng model đã chọn,
    // không trừ lượt của người dùng và không lưu lịch sử.
    const tested = await chatProxyCall(env, "/chat", {
      method: "POST",
      bearer: true,
      timeoutMs: CHAT_TEST_TIMEOUT_MS,
      body: {
        text: "Xin chào! Hãy trả lời đúng một câu ngắn để kiểm tra kết nối.",
        strict: true,
        provider,
        modelId,
      },
    });
    if (!tested.ok) {
      const status = tested.status === 401 || tested.status === 403 ? 502 : tested.status;
      return json({ error: tested.error }, status);
    }
    return json({
      ok: true,
      text: typeof tested.data.text === "string" ? tested.data.text : "",
      provider: typeof tested.data.provider === "string" ? tested.data.provider : provider,
      model: typeof tested.data.model === "string" ? tested.data.model : modelId,
      ms: Date.now() - started,
    });
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
