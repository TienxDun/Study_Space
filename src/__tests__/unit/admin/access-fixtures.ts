import type { AdminEnv } from "../../../../admin-worker/_worker";

export const TEAM = "https://team.cloudflareaccess.com";
export const CERT_URL = `${TEAM}/cdn-cgi/access/certs`;
export const AUD = "test-aud-tag";
export const KID = "test-kid";
export const ADMIN_EMAIL = "admin@example.com";

export async function createKeyPair(): Promise<CryptoKeyPair> {
  return (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
}

export type AccessJwk = JsonWebKey & { kid?: string; alg?: string; use?: string };

export async function exportJwk(
  pair: CryptoKeyPair,
  kid = KID,
): Promise<AccessJwk> {
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return { ...jwk, kid, alg: "RS256", use: "sig" };
}

export function certsResponse(keys: AccessJwk[]): Response {
  return new Response(JSON.stringify({ keys }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function b64url(input: string | Uint8Array): string {
  return Buffer.from(input).toString("base64url");
}

export function validClaims(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  return {
    aud: AUD,
    iss: TEAM,
    email: ADMIN_EMAIL,
    sub: "user-1",
    iat: now,
    nbf: now - 10,
    exp: now + 300,
    ...overrides,
  };
}

export async function makeToken(
  privateKey: CryptoKey,
  claims: Record<string, unknown>,
  options: { kid?: string; alg?: string; signKey?: CryptoKey } = {},
): Promise<string> {
  const header = {
    alg: options.alg ?? "RS256",
    kid: options.kid ?? KID,
    typ: "JWT",
  };
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  if (options.alg === "none") return `${data}.`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    options.signKey ?? privateKey,
    new TextEncoder().encode(data),
  );
  return `${data}.${b64url(new Uint8Array(signature))}`;
}

export function accessRequest(
  token?: string,
  path = "/api/admin/ping",
): Request {
  return new Request(`https://admin.zenstudy.space${path}`, {
    headers: token ? { "Cf-Access-Jwt-Assertion": token } : {},
  });
}

export function localRequest(): Request {
  return new Request("http://localhost:8787/api/admin/ping");
}

export function baseEnv(overrides: Partial<AdminEnv> = {}): AdminEnv {
  return {
    ACCESS_TEAM_DOMAIN: TEAM,
    ACCESS_AUD: AUD,
    ADMIN_TOKEN: "super-secret-token",
    CHAT_PROXY_URL: "https://chat.example.com",
    DATA_API_URL: "https://data.example.com",
    LIVEKIT_URL: "https://livekit.example.com",
    R2: { list: async () => ({ objects: [], truncated: false }) },
    FLAGS: fakeKv().kv,
    ...overrides,
  };
}

export type FakeKv = {
  kv: NonNullable<AdminEnv["FLAGS"]>;
  store: Map<string, string>;
  puts: Array<{ key: string; value: string }>;
  deletes: string[];
};

export function fakeKv(
  initial: Record<string, string> = {},
  options: { failGet?: boolean; failPut?: boolean; onPut?: () => void } = {},
): FakeKv {
  const store = new Map(Object.entries(initial));
  const puts: Array<{ key: string; value: string }> = [];
  const deletes: string[] = [];
  const kv = {
    async get(key: string) {
      if (options.failGet) throw new Error("KV lỗi");
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      options.onPut?.();
      if (options.failPut) throw new Error("KV lỗi");
      puts.push({ key, value });
      store.set(key, value);
    },
    async delete(key: string) {
      deletes.push(key);
      store.delete(key);
    },
  };
  return { kv, store, puts, deletes };
}
