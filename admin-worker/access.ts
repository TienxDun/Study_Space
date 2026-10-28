/**
 * Xác thực Cloudflare Access JWT: tải JWKS của team, kiểm chữ ký RS256,
 * `aud`/`iss`, hạn `exp`/`nbf` rồi trả email người dùng.
 */

import { PROBE_TIMEOUT_MS, type AdminEnv } from "./shared";

const CERT_TTL_MS = 60 * 60 * 1000;
const CLOCK_SKEW_SEC = 60;
const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

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
