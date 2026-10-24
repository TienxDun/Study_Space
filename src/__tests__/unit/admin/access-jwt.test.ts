import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetAccessCertsCache,
  normalizeTeamDomain,
  verifyAccessJwt,
} from "../../../../admin-worker/_worker";
import {
  AUD,
  CERT_URL,
  TEAM,
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

function stubCerts(keys: JsonWebKey[] = [jwk]) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url !== CERT_URL) throw new Error(`fetch ngoài dự kiến: ${url}`);
    return certsResponse(keys);
  });
}

describe("normalizeTeamDomain", () => {
  it("nhận domain trần và bỏ dấu / cuối", () => {
    expect(normalizeTeamDomain("team.cloudflareaccess.com/")).toBe(TEAM);
  });

  it("từ chối giá trị rỗng hoặc không phải https", () => {
    expect(normalizeTeamDomain("")).toBe("");
    expect(normalizeTeamDomain("http://team.cloudflareaccess.com")).toBe("");
  });
});

describe("verifyAccessJwt", () => {
  it("thiếu header thì từ chối và không gọi mạng", async () => {
    const fetchMock = stubCerts();
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifyAccessJwt(accessRequest(), baseEnv());

    expect(result).toEqual({ ok: false, reason: "missing_token" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("token hợp lệ trả email trong claim", async () => {
    vi.stubGlobal("fetch", stubCerts());
    const token = await makeToken(pair.privateKey, validClaims());

    const result = await verifyAccessJwt(accessRequest(token), baseEnv());

    expect(result).toEqual({ ok: true, email: "admin@example.com" });
  });

  it("từ chối token hết hạn", async () => {
    vi.stubGlobal("fetch", stubCerts());
    const now = Math.floor(Date.now() / 1000);
    const token = await makeToken(
      pair.privateKey,
      validClaims({ exp: now - 600 }),
    );

    const result = await verifyAccessJwt(accessRequest(token), baseEnv());

    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("từ chối sai audience", async () => {
    vi.stubGlobal("fetch", stubCerts());
    const token = await makeToken(
      pair.privateKey,
      validClaims({ aud: `${AUD}-khac` }),
    );

    const result = await verifyAccessJwt(accessRequest(token), baseEnv());

    expect(result).toEqual({ ok: false, reason: "bad_audience" });
  });

  it("từ chối sai issuer", async () => {
    vi.stubGlobal("fetch", stubCerts());
    const token = await makeToken(
      pair.privateKey,
      validClaims({ iss: "https://evil.cloudflareaccess.com" }),
    );

    const result = await verifyAccessJwt(accessRequest(token), baseEnv());

    expect(result).toEqual({ ok: false, reason: "bad_issuer" });
  });

  it("từ chối chữ ký không khớp khóa trong certs", async () => {
    vi.stubGlobal("fetch", stubCerts());
    const otherPair = await createKeyPair();
    const token = await makeToken(otherPair.privateKey, validClaims());

    const result = await verifyAccessJwt(accessRequest(token), baseEnv());

    expect(result).toEqual({ ok: false, reason: "bad_signature" });
  });

  it('từ chối thuật toán "none"', async () => {
    const fetchMock = stubCerts();
    vi.stubGlobal("fetch", fetchMock);
    const token = await makeToken(pair.privateKey, validClaims(), {
      alg: "none",
    });

    const result = await verifyAccessJwt(accessRequest(token), baseEnv());

    expect(result).toEqual({ ok: false, reason: "bad_alg" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("khóa lạ thì tải lại certs một lần rồi mới từ chối", async () => {
    const fetchMock = stubCerts();
    vi.stubGlobal("fetch", fetchMock);
    const token = await makeToken(pair.privateKey, validClaims(), {
      kid: "kid-khong-co",
    });

    const result = await verifyAccessJwt(accessRequest(token), baseEnv());

    expect(result).toEqual({ ok: false, reason: "unknown_kid" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("không tải được certs thì fail closed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("mạng hỏng");
      }),
    );
    const token = await makeToken(pair.privateKey, validClaims());

    const result = await verifyAccessJwt(accessRequest(token), baseEnv());

    expect(result).toEqual({ ok: false, reason: "certs_unavailable" });
  });

  it("thiếu cấu hình team domain hoặc audience thì từ chối", async () => {
    const fetchMock = stubCerts();
    vi.stubGlobal("fetch", fetchMock);
    const token = await makeToken(pair.privateKey, validClaims());

    const noAud = await verifyAccessJwt(
      accessRequest(token),
      baseEnv({ ACCESS_AUD: "" }),
    );
    const noTeam = await verifyAccessJwt(
      accessRequest(token),
      baseEnv({ ACCESS_TEAM_DOMAIN: "" }),
    );

    expect(noAud).toEqual({ ok: false, reason: "missing_config" });
    expect(noTeam).toEqual({ ok: false, reason: "missing_config" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("token không đủ ba phần thì từ chối", async () => {
    vi.stubGlobal("fetch", stubCerts());

    const result = await verifyAccessJwt(
      accessRequest("khong-phai-jwt"),
      baseEnv(),
    );

    expect(result).toEqual({ ok: false, reason: "malformed_token" });
  });

  it("chấp nhận aud dạng mảng", async () => {
    vi.stubGlobal("fetch", stubCerts());
    const token = await makeToken(
      pair.privateKey,
      validClaims({ aud: ["khac", AUD] }),
    );

    const result = await verifyAccessJwt(accessRequest(token), baseEnv());

    expect(result).toEqual({ ok: true, email: "admin@example.com" });
  });

  it("cache certs dùng lại cho request sau", async () => {
    const fetchMock = stubCerts();
    vi.stubGlobal("fetch", fetchMock);
    const token = await makeToken(pair.privateKey, validClaims());

    await verifyAccessJwt(accessRequest(token), baseEnv());
    await verifyAccessJwt(accessRequest(token), baseEnv());

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
