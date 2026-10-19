/**
 * Worker phát vé + danh sách phòng học nhóm (LiveKit) cho ZenStudy.
 *
 * Cài 1 lần trên Cloudflare Dashboard (Workers & Pages -> Create Worker
 * -> dán file này -> Deploy), rồi khai báo ở Settings → Variables:
 *   LIVEKIT_URL        = wss://xxxx.livekit.cloud          (Secret)
 *   LIVEKIT_API_KEY    = API...                            (Secret)
 *   LIVEKIT_API_SECRET = ... (giữ kín, không đưa vào web)   (Secret)
 *   FIREBASE_PROJECT_ID = zenspace-d10m13y26                (Text, BẮT BUỘC)
 *   ALLOWED_ORIGINS    = https://zenstudy.space,http://localhost:3001   (Text)
 *   ADMIN_TOKEN        = chuỗi khó đoán (Secret, không bắt buộc):
 *                        chỉ để xem danh sách phòng bằng GET /rooms?token=...
 *
 * Web gọi kèm vé Firebase: header `Authorization: Bearer <idToken>`.
 * Vé hợp lệ mới phát vé LiveKit, và danh tính lấy từ uid trong vé — nên người
 * dùng không cần khai userId, cũng không thể giả danh người khác.
 *
 * Xong copy địa chỉ worker (vd https://zenstudy-rooms.xxx.workers.dev)
 * bỏ vào repo Variable NEXT_PUBLIC_LIVEKIT_TOKEN_URL rồi đăng web lại.
 *
 *  POST /token { room, name } -> { token, url, room }
 *  GET  /rooms               -> { rooms: [{ name, count }] }   (cần đăng nhập)
 */

// Tên phòng/tên người gọn lại: chữ, số, gạch ngang
function cleanRoom(v, max) {
  return String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
}

function b64url(bytes) {
  let s = "";
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signJwt(secret, payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const enc = new TextEncoder();
  const unsigned =
    b64url(enc.encode(JSON.stringify(header))) +
    "." +
    b64url(enc.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(unsigned));
  return unsigned + "." + b64url(sig);
}

// Vé vào 1 phòng, hiệu lực 2 tiếng
async function mintRoomToken(env, identity, displayName, room) {
  const now = Math.floor(Date.now() / 1000);
  return signJwt(env.LIVEKIT_API_SECRET, {
    exp: now + 2 * 60 * 60,
    nbf: now - 60,
    iss: env.LIVEKIT_API_KEY,
    sub: identity,
    name: displayName,
    video: { roomJoin: true, room, canPublish: true, canSubscribe: true },
  });
}

// Vé quản trị chỉ để xem danh sách phòng
async function mintAdminToken(env) {
  const now = Math.floor(Date.now() / 1000);
  return signJwt(env.LIVEKIT_API_SECRET, {
    exp: now + 60,
    nbf: now - 60,
    iss: env.LIVEKIT_API_KEY,
    sub: "studio-admin",
    video: { roomList: true },
  });
}

// ---------- Kiểm vé Firebase (copy từ data-api, giữ y nguyên) ----------
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
const RSA_OID = "42,134,72,134,247,13,1,1,1";
function certSpkiBytes(certDer) {
  const c0 = readTlv(certDer, 0);
  if (c0.tag !== 0x30) throw new Error("cert");
  const tbs = readTlv(certDer, c0.valuePos);
  if (tbs.tag !== 0x30) throw new Error("tbs");
  const first = readTlv(certDer, tbs.valuePos);
  const spkiIndex = first.tag === 0xa0 ? 6 : 5;
  let off = tbs.valuePos,
    spki = null;
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
  const r = await fetch(CERT_URL);
  if (!r.ok) throw new Error("cert");
  mem.certs = await r.json();
  mem.certAt = Date.now();
  return mem.certs;
}
async function verifyFirebaseToken(env, token) {
  const fail = (code) => ({ code });
  try {
    const pid = String(env.FIREBASE_PROJECT_ID || "").trim();
    if (!pid) return fail("NO_PID");
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return fail("BAD_FORMAT");
    const [h, p, s] = parts;
    let header, payload;
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
    if (!payload.sub || typeof payload.sub !== "string" || payload.sub.length > 128)
      return fail("NO_SUB");
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

function bearerToken(req) {
  const auth = req.headers.get("Authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}

// ALLOWED_ORIGINS để trống = cho mọi nơi gọi (tiện lúc thử, chặn lại khi web đông).
function corsHeaders(req, env) {
  const origin = req.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowAll = allowed.length === 0 || allowed.includes("*");
  return {
    "Access-Control-Allow-Origin": allowAll || allowed.includes(origin) ? origin || "*" : "null",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

const worker = {
  async fetch(req, env) {
    const cors = corsHeaders(req, env);
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), {
        status,
        headers: { "Content-Type": "application/json", ...cors },
      });

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(req.url);
    const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = env;
    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return json({ error: "Worker thiếu key LiveKit (Secrets)." }, 500);
    }
    if (!String(env.FIREBASE_PROJECT_ID || "").trim()) {
      return json({ error: "Worker thiếu FIREBASE_PROJECT_ID (Settings → Variables)." }, 500);
    }
    const httpBase = LIVEKIT_URL.replace(/^wss:/, "https:").replace(/\/$/, "");

    // --- Phát vé vào phòng (cần vé Firebase hợp lệ) ---
    if (url.pathname === "/token" && req.method === "POST") {
      const checked = await verifyFirebaseToken(env, bearerToken(req));
      if (!checked.uid) {
        return json({ error: "Đăng nhập rồi mới vào phòng học nhóm được." }, 401);
      }
      let body = {};
      try {
        body = await req.json();
      } catch {}
      const room = cleanRoom(body.room, 32);
      const displayName = String(body.name || "").trim().slice(0, 30);
      if (!room) return json({ error: "Nhập tên phòng." }, 400);
      if (!displayName) return json({ error: "Nhập tên của bạn." }, 400);

      // Danh tính lấy từ uid: vào lại thì LiveKit tự ngắt kết nối cũ,
      // không để lại người "ma" chiếm chỗ, và đá được theo uid.
      const identity = `user-${checked.uid}`;
      const token = await mintRoomToken(env, identity, displayName, room);
      return json({ token, url: LIVEKIT_URL, room });
    }

    // --- Danh sách phòng đang có người (cần đăng nhập, hoặc ADMIN_TOKEN) ---
    if (url.pathname === "/rooms" && req.method === "GET") {
      const admin = String(env.ADMIN_TOKEN || "");
      let allowed = !!admin && url.searchParams.get("token") === admin;
      if (!allowed) {
        const checked = await verifyFirebaseToken(env, bearerToken(req));
        allowed = !!checked.uid;
      }
      if (!allowed) {
        return json({ error: "Đăng nhập rồi mới xem được danh sách phòng." }, 401);
      }
      try {
        const adminToken = await mintAdminToken(env);
        const r = await fetch(`${httpBase}/twirp/livekit.RoomService/ListRooms`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: "{}",
        });
        if (!r.ok) {
          const text = await r.text().catch(() => "");
          return json({ error: `LiveKit báo lỗi ${r.status}: ${text.slice(0, 200)}` }, 502);
        }
        const data = await r.json().catch(() => ({}));
        const rooms = Array.isArray(data.rooms) ? data.rooms : [];
        return json({
          rooms: rooms.map((rm) => ({
            name: rm.name ?? rm.Name ?? "",
            count: Number(rm.numParticipants ?? rm.num_participants ?? 0),
          })),
        });
      } catch (e) {
        return json({ error: `Không lấy được danh sách: ${String(e).slice(0, 300)}` }, 502);
      }
    }

    return json({ error: "Dùng POST /token hoặc GET /rooms." }, 404);
  },
};

export default worker;
