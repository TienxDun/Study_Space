// Xác thực vé Firebase cho chat-v2 (chép từ workers/chat-proxy, không chia sẻ module).
// Vé là JWT RS256 do Google ký: Worker tải chứng thư công khai, kiểm chữ ký,
// đúng project và còn hạn rồi trả uid.
//
// Chế độ local: đặt ENVIRONMENT=development trong .dev.vars thì dùng
// CHAT_V2_DEV_TOKEN thay vé. Production không được đặt ENVIRONMENT.

const CERT_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

const mem = { certAt: 0, certs: {} };

function b64urlToBytes(s) {
  s = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}

function pemToDerBytes(pem) {
  const b64 = String(pem || "").replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  return b64urlToBytes(b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""));
}

// Đọc 1 ô TLV của DER (tag + độ dài + giá trị), trả vị trí tuyệt đối.
function readTlv(buf, pos) {
  const start = pos;
  const tag = buf[pos++];
  let len = buf[pos++];
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4) throw new Error("len");
    len = 0;
    for (let i = 0; i < n; i++) len = (len << 8) | buf[pos++];
  }
  return { tag, start, valuePos: pos, end: pos + len };
}

// Chứng thư Google là X.509 nguyên cái, còn WebCrypto chỉ nhận chìa trần
// (SPKI). Hàm này lách vào trong: cert -> tbs -> con thứ 7 (SPKI).
const RSA_OID = "42,134,72,134,247,13,1,1,1"; // rsaEncryption
function certSpkiBytes(certDer) {
  const c0 = readTlv(certDer, 0);
  if (c0.tag !== 0x30) throw new Error("cert");
  const tbs = readTlv(certDer, c0.valuePos);
  if (tbs.tag !== 0x30) throw new Error("tbs");
  const first = readTlv(certDer, tbs.valuePos);
  const spkiIndex = first.tag === 0xa0 ? 6 : 5;
  let off = tbs.valuePos;
  let spki = null;
  for (let i = 0; i <= spkiIndex; i++) {
    const t = readTlv(certDer, off);
    if (i === spkiIndex) spki = t;
    off = t.end;
  }
  if (!spki || spki.tag !== 0x30) throw new Error("spki");
  const alg = readTlv(certDer, spki.valuePos);
  const oid = readTlv(certDer, alg.valuePos);
  if (oid.tag !== 0x06 || [...certDer.slice(oid.valuePos, oid.end)].join(",") !== RSA_OID) {
    throw new Error("rsa");
  }
  return certDer.slice(spki.start, spki.end);
}

async function getGoogleCerts() {
  if (Date.now() - mem.certAt < 30 * 60 * 1000 && Object.keys(mem.certs).length) return mem.certs;
  const res = await fetch(CERT_URL);
  if (!res.ok) throw new Error("cert");
  mem.certs = await res.json();
  mem.certAt = Date.now();
  return mem.certs;
}

export async function verifyFirebaseToken(env, token) {
  const shape = String(token || "").split(".").map((x) => x.length);
  const fail = (code) => ({ code, shape });
  try {
    const pid = String(env.FIREBASE_PROJECT_ID || "").trim();
    if (!pid) return fail("NO_PID");
    if (!token || shape.length !== 3) return fail("BAD_FORMAT");
    const [h, p, s] = token.split(".");
    let header;
    let payload;
    try {
      header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
    } catch {
      return fail("BAD_H_PART");
    }
    try {
      payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
    } catch {
      return fail("BAD_P_PART");
    }
    if (header.alg !== "RS256") return fail("BAD_ALG");
    if (payload.aud !== pid) return fail("BAD_AUD");
    if (payload.iss !== `https://securetoken.google.com/${pid}`) return fail("BAD_ISS");
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp < now - 30) return fail("EXPIRED");
    if (typeof payload.iat === "number" && payload.iat > now + 30) return fail("FUTURE_IAT");
    if (!payload.sub || typeof payload.sub !== "string" || payload.sub.length > 128) return fail("NO_SUB");
    let certs;
    try {
      certs = await getGoogleCerts();
    } catch {
      return fail("CERT_FETCH");
    }
    let pem = certs[header.kid];
    if (!pem) {
      mem.certAt = 0;
      try {
        pem = (await getGoogleCerts())[header.kid];
      } catch {
        return fail("CERT_FETCH");
      }
    }
    if (!pem) return fail("NO_CERT_FOR_KID");
    let spki;
    try {
      spki = certSpkiBytes(pemToDerBytes(pem));
    } catch {
      return fail("NON_RSA");
    }
    let key;
    try {
      key = await crypto.subtle.importKey(
        "spki",
        spki,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"]
      );
    } catch {
      return fail("IMPORT_KEY");
    }
    let ok = false;
    try {
      ok = await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        key,
        b64urlToBytes(s),
        new TextEncoder().encode(`${h}.${p}`)
      );
    } catch {
      return fail("VERIFY_CALL");
    }
    return ok ? { uid: payload.sub } : fail("BAD_SIG");
  } catch {
    return fail("EXCEPTION");
  }
}

export function devMode(env) {
  return String((env && env.ENVIRONMENT) || "").trim() === "development";
}

// Trả { uid, dev } hoặc { error, status } để nơi gọi trả JSON ngay.
export async function authenticate(req, env) {
  if (devMode(env)) {
    const expected = String(env.CHAT_V2_DEV_TOKEN || "");
    if (!expected) {
      return { error: "Chưa cấu hình CHAT_V2_DEV_TOKEN khi chạy local.", status: 503 };
    }
    const got = req.headers.get("X-Chat-V2-Token") || "";
    if (got !== expected) return { error: "Sai dev token.", status: 401 };
    return { uid: "", dev: true };
  }

  const auth = req.headers.get("Authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const verify = env._verifyToken || verifyFirebaseToken;
  const checked = await verify(env, bearer);
  if (!checked.uid) return { error: "Bạn đăng nhập lại để chat nhé.", status: 401 };
  return { uid: checked.uid, dev: false };
}
