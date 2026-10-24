import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import worker, { __resetAccessCertsCache } from "../../../../admin-worker/_worker";
import {
  ADMIN_EMAIL,
  CERT_URL,
  accessRequest,
  baseEnv,
  certsResponse,
  createKeyPair,
  exportJwk,
  makeToken,
  validClaims,
} from "./access-fixtures";

let pair: CryptoKeyPair;
let jwk: JsonWebKey;

beforeAll(async () => {
  pair = await createKeyPair();
  jwk = await exportJwk(pair);
});

beforeEach(() => {
  __resetAccessCertsCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type FetchCall = { url: string; headers: Headers };

function stubBackend(): FetchCall[] {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, headers: new Headers(init?.headers) });
      if (url === CERT_URL) return certsResponse([jwk]);
      if (url.endsWith("/health")) return jsonResponse({ ok: true });
      if (url.endsWith("/usage")) return jsonResponse({ usedMinutes: 12 });
      throw new Error(`fetch ngoài dự kiến: ${url}`);
    }),
  );
  return calls;
}

describe("admin worker", () => {
  it("chuyển request không phải API cho ASSETS", async () => {
    const assetsFetch = vi.fn(async () => new Response("vo-shell"));
    const res = await worker.fetch(
      new Request("https://admin.zenstudy.space/admin/"),
      baseEnv({ ASSETS: { fetch: assetsFetch } }),
    );

    expect(await res.text()).toBe("vo-shell");
    expect(assetsFetch).toHaveBeenCalledTimes(1);
  });

  it("thiếu JWT thì trả 401 và không gọi backend", async () => {
    const calls = stubBackend();
    const res = await worker.fetch(accessRequest(), baseEnv());
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({ error: "Cần đăng nhập Cloudflare Access." });
    expect(calls).toHaveLength(0);
  });

  it("ping trả email, ba check và không lộ token", async () => {
    const calls = stubBackend();
    const token = await makeToken(pair.privateKey, validClaims());

    const res = await worker.fetch(accessRequest(token), baseEnv());
    const body = (await res.json()) as {
      ok: boolean;
      email: string;
      checks: Array<{ name: string; ok: boolean; ms: number }>;
      time: string;
    };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.email).toBe(ADMIN_EMAIL);
    expect(body.checks.map((check) => check.name)).toEqual([
      "chat-proxy",
      "data-api",
      "livekit",
    ]);
    expect(body.checks.every((check) => check.ok)).toBe(true);
    expect(typeof body.time).toBe("string");

    const livekitCall = calls.find((call) => call.url.endsWith("/usage"));
    expect(livekitCall?.url).toBe("https://livekit.example.com/usage");
    expect(livekitCall?.url).not.toContain("token=");
    expect(livekitCall?.headers.get("Authorization")).toBe(
      "Bearer super-secret-token",
    );

    const raw = JSON.stringify(body);
    expect(raw).not.toContain("super-secret-token");
    expect(raw).not.toContain(CERT_URL);
  });

  it("thiếu URL hoặc token thì check tương ứng fail, không gọi mạng", async () => {
    const calls = stubBackend();
    const token = await makeToken(pair.privateKey, validClaims());

    const res = await worker.fetch(
      accessRequest(token),
      baseEnv({ LIVEKIT_URL: "", CHAT_PROXY_URL: "" }),
    );
    const body = (await res.json()) as {
      ok: boolean;
      checks: Array<{ name: string; ok: boolean }>;
    };

    expect(body.ok).toBe(false);
    expect(body.checks.find((c) => c.name === "chat-proxy")?.ok).toBe(false);
    expect(body.checks.find((c) => c.name === "livekit")?.ok).toBe(false);
    expect(calls.some((call) => call.url === "https://livekit.example.com/usage")).toBe(
      false,
    );
  });

  it("backend trả 500 thì check fail nhưng API vẫn 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === CERT_URL) return certsResponse([jwk]);
        return jsonResponse({ error: "hỏng" }, 500);
      }),
    );
    const token = await makeToken(pair.privateKey, validClaims());

    const res = await worker.fetch(accessRequest(token), baseEnv());
    const body = (await res.json()) as {
      ok: boolean;
      checks: Array<{ name: string; ok: boolean }>;
    };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.checks.every((check) => !check.ok)).toBe(true);
  });

  it("ping chỉ nhận GET", async () => {
    stubBackend();
    const token = await makeToken(pair.privateKey, validClaims());
    const res = await worker.fetch(
      new Request("https://admin.zenstudy.space/api/admin/ping", {
        method: "POST",
        headers: { "Cf-Access-Jwt-Assertion": token },
      }),
      baseEnv(),
    );

    expect(res.status).toBe(405);
  });

  it("endpoint admin lạ trả 404 sau khi xác thực", async () => {
    stubBackend();
    const token = await makeToken(pair.privateKey, validClaims());
    const res = await worker.fetch(
      new Request("https://admin.zenstudy.space/api/admin/khong-co", {
        headers: { "Cf-Access-Jwt-Assertion": token },
      }),
      baseEnv(),
    );

    expect(res.status).toBe(404);
  });

  it("không có binding ASSETS thì trả 404 thay vì crash", async () => {
    const res = await worker.fetch(
      new Request("https://admin.zenstudy.space/admin/"),
      baseEnv(),
    );

    expect(res.status).toBe(404);
  });
});
