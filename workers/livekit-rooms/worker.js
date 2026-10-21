/**
 * Worker phát vé + danh sách phòng học nhóm (LiveKit) cho ZenStudy.
 *
 * Cài 1 lần trên Cloudflare Dashboard (Workers & Pages -> Create Worker
 * -> dán file này -> Deploy), rồi khai báo ở Settings → Variables:
 *   LIVEKIT_URL             = wss://xxxx.livekit.cloud          (Secret)
 *   LIVEKIT_API_KEY         = API...                            (Secret)
 *   LIVEKIT_API_SECRET      = ... (giữ kín, không đưa vào web)   (Secret)
 *   FIREBASE_PROJECT_ID     = zenspace-d10m13y26                (Text, BẮT BUỘC)
 *   ALLOWED_ORIGINS         = https://zenstudy.space,http://localhost:3001   (Text)
 *   ADMIN_TOKEN             = chuỗi khó đoán (Secret, không bắt buộc):
 *                             để xem GET /rooms?token=... và GET /usage
 *   MAX_ROOM_PARTICIPANTS   = 6                                 (Text, mặc định 6)
 *   LIVEKIT_MONTHLY_MINUTES = 4500                              (Text, mặc định 4500)
 *   QUOTA_ENFORCE           = true                              (Text, mặc định true)
 *   ROOM_EMPTY_TIMEOUT_SEC  = 300                               (Text, mặc định 300)
 *   SESSION_MAX_MINUTES     = 120                               (Text, mặc định 120)
 *
 * D1 Database Binding:
 *   DB                      = Database D1 zenspace (chạy workers/livekit-schema.sql)
 *
 * Web gọi kèm vé Firebase: header `Authorization: Bearer <idToken>`.
 * Vé hợp lệ mới phát vé LiveKit, và danh tính lấy từ uid trong vé — nên người
 * dùng không cần khai userId, cũng không thể giả danh người khác.
 *
 *  POST /token            -> { token, url, room, maxParticipants, remainingMinutes, sessionMaxMinutes, quotaStatus }
 *  GET  /rooms            -> { rooms: [{ name, count }], maxParticipants, remainingMinutes, quotaStatus }
 *  GET  /usage            -> { month, usedMinutes, limitMinutes, remainingMinutes, roomsOpen, participants }
 *  POST /webhook/livekit  -> Nhận webhook điểm danh và tính thời lượng học nhóm
 */

export function clampInt(val, def, min, max) {
  const n = parseInt(String(val), 10);
  if (Number.isNaN(n)) return def;
  return Math.min(Math.max(n, min), max);
}

// Tên phòng/tên người gọn lại: chữ, số, gạch ngang
export function cleanRoom(v, max) {
  return String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
}

export function monthKeyUtc(d = new Date()) {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function computeQuota({ usedSeconds = 0, limitMinutes = 4500, enforceQuota = true }) {
  const usedMinutes = Math.floor(Math.max(0, usedSeconds) / 60);
  const remainingMinutes = Math.max(0, limitMinutes - usedMinutes);
  if (!enforceQuota) {
    return {
      usedMinutes,
      remainingMinutes,
      isExceeded: false,
      quotaStatus: "disabled",
    };
  }
  const isExceeded = remainingMinutes <= 0;
  return {
    usedMinutes,
    remainingMinutes,
    isExceeded,
    quotaStatus: isExceeded ? "exceeded" : "ok",
  };
}

function b64url(bytes) {
  let s = "";
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function b64urlToBytes(s) {
  s = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}

export async function signJwt(secret, payload) {
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
export async function mintRoomToken(env, identity, displayName, room, cfg = {}) {
  const now = Math.floor(Date.now() / 1000);
  return signJwt(env.LIVEKIT_API_SECRET, {
    exp: now + 2 * 60 * 60,
    nbf: now - 60,
    iss: env.LIVEKIT_API_KEY,
    sub: identity,
    name: displayName,
    video: {
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true,
    },
    roomConfig: {
      maxParticipants: cfg.maxParticipants ?? 6,
      emptyTimeout: cfg.emptyTimeoutSec ?? 300,
    },
  });
}

// Vé quản trị chỉ để xem danh sách phòng
export async function mintAdminToken(env) {
  const now = Math.floor(Date.now() / 1000);
  return signJwt(env.LIVEKIT_API_SECRET, {
    exp: now + 60,
    nbf: now - 60,
    iss: env.LIVEKIT_API_KEY,
    sub: "studio-admin",
    video: { roomList: true },
  });
}

export async function verifyWebhookJwt(secret, authHeader, rawBody, expectedIss) {
  if (!secret || !authHeader || typeof rawBody !== "string") return false;
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [h, p, s] = parts;

  const enc = new TextEncoder();
  let key;
  try {
    key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
  } catch {
    return false;
  }

  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlToBytes(s),
      enc.encode(`${h}.${p}`)
    );
  } catch {
    return false;
  }
  if (!valid) return false;

  let header, payload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
  } catch {
    return false;
  }

  if (header.alg !== "HS256") return false;
  if (expectedIss && payload.iss !== expectedIss) return false;

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp < now - 60) return false;

  // Verify sha256 claim: standard base64(sha256(rawBody))
  const hashBuf = await crypto.subtle.digest("SHA-256", enc.encode(rawBody));
  const hashBytes = new Uint8Array(hashBuf);
  let binary = "";
  for (let i = 0; i < hashBytes.length; i++) binary += String.fromCharCode(hashBytes[i]);
  const expectedSha256 = btoa(binary);

  if (payload.sha256 !== expectedSha256) return false;

  return true;
}

// ---------- Kiểm vé Firebase (copy từ data-api, giữ y nguyên) ----------
const CERT_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const mem = { certAt: 0, certs: {} };

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

function getConfig(env) {
  return {
    maxParticipants: clampInt(env.MAX_ROOM_PARTICIPANTS, 6, 2, 20),
    monthlyMinutes: clampInt(env.LIVEKIT_MONTHLY_MINUTES, 4500, 100, 5000),
    enforceQuota: String(env.QUOTA_ENFORCE ?? "true") !== "false",
    emptyTimeoutSec: clampInt(env.ROOM_EMPTY_TIMEOUT_SEC, 300, 60, 3600),
    sessionMaxMinutes: clampInt(env.SESSION_MAX_MINUTES, 120, 15, 240),
  };
}

async function resolveMonthQuota(env, cfg) {
  const currentMonth = monthKeyUtc();
  if (!cfg.enforceQuota) {
    return computeQuota({ usedSeconds: 0, limitMinutes: cfg.monthlyMinutes, enforceQuota: false });
  }
  if (!env.DB) {
    console.error("D1 DB binding missing; failing open with quotaStatus: unknown");
    return {
      usedMinutes: 0,
      remainingMinutes: cfg.monthlyMinutes,
      isExceeded: false,
      quotaStatus: "unknown",
    };
  }
  try {
    const row = await env.DB.prepare(
      "SELECT participant_seconds FROM meet_usage_month WHERE month = ?"
    ).bind(currentMonth).first();
    const usedSeconds = Number(row?.participant_seconds || 0);
    return computeQuota({ usedSeconds, limitMinutes: cfg.monthlyMinutes, enforceQuota: true });
  } catch (err) {
    console.error("D1 error querying meet_usage_month; failing open with quotaStatus: unknown", err);
    return {
      usedMinutes: 0,
      remainingMinutes: cfg.monthlyMinutes,
      isExceeded: false,
      quotaStatus: "unknown",
    };
  }
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
    const cfg = getConfig(env);

    // --- Webhook điểm danh từ LiveKit Cloud ---
    if (url.pathname === "/webhook/livekit" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization") || "";
      const rawBody = await req.text();
      const valid = await verifyWebhookJwt(
        env.LIVEKIT_API_SECRET,
        authHeader,
        rawBody,
        env.LIVEKIT_API_KEY
      );
      if (!valid) {
        return json({ error: "Unauthorized webhook request." }, 401);
      }

      let event;
      try {
        event = JSON.parse(rawBody);
      } catch {
        return json({ error: "Bad JSON payload." }, 400);
      }

      if (!env.DB) {
        console.error("Webhook received but DB binding is missing.");
        return json({ error: "Database binding missing." }, 500);
      }

      const eventId = String(event.id || "");
      let eventTime = Number(event.createdAt || event.created_at || Math.floor(Date.now() / 1000));
      if (eventTime > 1e11) eventTime = Math.floor(eventTime / 1000);

      // Kiểm tra idempotent: Nếu event đã lưu thành công trước đó thì không xử lý lại
      if (eventId) {
        try {
          const existing = await env.DB.prepare(
            "SELECT id FROM meet_events WHERE id = ?"
          ).bind(eventId).first();
          if (existing) {
            return json({ ok: true, duplicate: true });
          }
        } catch (err) {
          console.error("meet_events lookup error:", err);
          return json({ error: "Database error" }, 500);
        }
      }

      const eventType = String(event.event || "");
      const room = cleanRoom(event.room?.name || "", 32);

      try {
        if (eventType === "participant_joined") {
          const identity = String(event.participant?.identity || "");
          const displayName = String(event.participant?.name || "").slice(0, 30);
          const billingMonth = monthKeyUtc(new Date(eventTime * 1000));
          const sessionId = event.id ? `sess-${event.id}` : `sess-${room}-${identity}-${eventTime}`;

          // Kiểm tra xem sessionId đã tồn tại chưa (phòng hờ lần trước insert session xong nhưng insert meet_events bị lỗi, LiveKit retry)
          const existingSession = await env.DB.prepare(
            "SELECT id FROM meet_sessions WHERE id = ?"
          ).bind(sessionId).first();

          if (!existingSession) {
            // Reconnect guard: Đóng mọi session cũ còn đang mở của cùng phòng + cùng user
            const openOldSessions = await env.DB.prepare(
              "SELECT id, joined_at FROM meet_sessions WHERE room = ? AND identity = ? AND left_at IS NULL"
            ).bind(room, identity).all();

            const oldList = Array.isArray(openOldSessions?.results) ? openOldSessions.results : [];
            for (const oldSess of oldList) {
              const joinedAt = Number(oldSess.joined_at);
              const durationSeconds = Math.max(0, eventTime - joinedAt);
              await env.DB.prepare(
                "UPDATE meet_sessions SET left_at = ?, duration_seconds = ? WHERE id = ?"
              ).bind(eventTime, durationSeconds, oldSess.id).run();
            }

            // Tạo session mới
            await env.DB.prepare(
              "INSERT INTO meet_sessions (id, room, identity, display_name, joined_at, billing_month) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING"
            ).bind(sessionId, room, identity, displayName, eventTime, billingMonth).run();
          }
        } else if (eventType === "participant_left") {
          const identity = String(event.participant?.identity || "");
          const openSession = await env.DB.prepare(
            "SELECT id, joined_at FROM meet_sessions WHERE room = ? AND identity = ? AND left_at IS NULL ORDER BY joined_at DESC LIMIT 1"
          ).bind(room, identity).first();

          if (openSession) {
            const joinedAt = Number(openSession.joined_at);
            const durationSeconds = Math.max(0, eventTime - joinedAt);

            // Cập nhật session; trigger SQLite trg_meet_sessions_close sẽ tự động cộng participant_seconds vào meet_usage_month
            await env.DB.prepare(
              "UPDATE meet_sessions SET left_at = ?, duration_seconds = ? WHERE id = ?"
            ).bind(eventTime, durationSeconds, openSession.id).run();
          } else {
            console.warn(`participant_left without open session: room=${room}, identity=${identity}`);
            const fallbackSessionId = `orphan-${event.id || `${room}-${identity}-${eventTime}`}`;
            const fallbackMonth = monthKeyUtc(new Date(eventTime * 1000));
            await env.DB.prepare(
              "INSERT INTO meet_sessions (id, room, identity, display_name, joined_at, left_at, duration_seconds, billing_month) VALUES (?, ?, ?, ?, ?, ?, 0, ?) ON CONFLICT(id) DO NOTHING"
            ).bind(fallbackSessionId, room, identity, event.participant?.name || "", eventTime, eventTime, fallbackMonth).run();
          }
        } else if (eventType === "room_finished") {
          const openSessions = await env.DB.prepare(
            "SELECT id, joined_at FROM meet_sessions WHERE room = ? AND left_at IS NULL"
          ).bind(room).all();

          const sessionsList = Array.isArray(openSessions?.results) ? openSessions.results : [];
          for (const sess of sessionsList) {
            const joinedAt = Number(sess.joined_at);
            const durationSeconds = Math.max(0, eventTime - joinedAt);

            await env.DB.prepare(
              "UPDATE meet_sessions SET left_at = ?, duration_seconds = ? WHERE id = ?"
            ).bind(eventTime, durationSeconds, sess.id).run();
          }
        }

        // CHỈ ghi nhận event là "đã xử lý" khi các bước điểm danh và đóng session thành công 100%
        if (eventId) {
          await env.DB.prepare(
            "INSERT INTO meet_events (id, created_at) VALUES (?, ?) ON CONFLICT(id) DO NOTHING"
          ).bind(eventId, eventTime).run();
        }

        return json({ ok: true });
      } catch (err) {
        console.error("Webhook processing error in DB:", err);
        return json({ error: "Failed to persist webhook event." }, 500);
      }
    }

    const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = env;
    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return json({ error: "Worker thiếu key LiveKit (Secrets)." }, 500);
    }
    if (!String(env.FIREBASE_PROJECT_ID || "").trim()) {
      return json({ error: "Worker thiếu FIREBASE_PROJECT_ID (Settings → Variables)." }, 500);
    }
    const httpBase = LIVEKIT_URL.replace(/^wss:/, "https:").replace(/\/$/, "");

    // --- GET /usage (quản trị, không trả uid hay email) ---
    if (url.pathname === "/usage" && req.method === "GET") {
      const adminSecret = String(env.ADMIN_TOKEN || "").trim();
      const authH = bearerToken(req);
      const queryToken = url.searchParams.get("token") || "";
      const authorized = adminSecret && (authH === adminSecret || queryToken === adminSecret);
      if (!authorized) {
        return json({ error: "Yêu cầu quyền quản trị (ADMIN_TOKEN)." }, 401);
      }

      const currentMonth = monthKeyUtc();
      let usedSeconds = 0;
      if (env.DB) {
        try {
          const row = await env.DB.prepare(
            "SELECT participant_seconds FROM meet_usage_month WHERE month = ?"
          ).bind(currentMonth).first();
          usedSeconds = Number(row?.participant_seconds || 0);
        } catch (e) {
          console.error("D1 error in /usage:", e);
        }
      }

      const usedMinutes = Math.floor(usedSeconds / 60);
      const limitMinutes = cfg.monthlyMinutes;
      const remainingMinutes = Math.max(0, limitMinutes - usedMinutes);

      let roomsOpen = 0;
      let participants = 0;
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
        if (r.ok) {
          const data = await r.json().catch(() => ({}));
          const list = Array.isArray(data.rooms) ? data.rooms : [];
          roomsOpen = list.length;
          participants = list.reduce(
            (sum, rm) => sum + Number(rm.numParticipants ?? rm.num_participants ?? 0),
            0
          );
        }
      } catch (e) {
        console.error("Twirp ListRooms error in /usage:", e);
      }

      return json({
        month: currentMonth,
        usedMinutes,
        limitMinutes,
        remainingMinutes,
        roomsOpen,
        participants,
      });
    }

    // --- Phát vé vào phòng (cần vé Firebase hợp lệ) ---
    if (url.pathname === "/token" && req.method === "POST") {
      const verifyToken = env._verifyToken || verifyFirebaseToken;
      const checked = await verifyToken(env, bearerToken(req));
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

      // 1. Quota guard check
      const quota = await resolveMonthQuota(env, cfg);
      if (quota.isExceeded) {
        return json(
          {
            error: "Phòng học nhóm đã hết hạn mức tháng này. Vui lòng quay lại đầu tháng sau.",
            code: "QUOTA_EXCEEDED",
          },
          429
        );
      }

      // 2. Chặn phòng đầy ở server qua Twirp ListParticipants
      try {
        const now = Math.floor(Date.now() / 1000);
        const guardToken = await signJwt(env.LIVEKIT_API_SECRET, {
          exp: now + 60,
          nbf: now - 60,
          iss: env.LIVEKIT_API_KEY,
          sub: "room-guard",
          video: { roomAdmin: true, room },
        });
        const partRes = await fetch(`${httpBase}/twirp/livekit.RoomService/ListParticipants`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${guardToken}`,
          },
          body: JSON.stringify({ room }),
        });
        if (partRes.ok) {
          const partData = await partRes.json().catch(() => ({}));
          const participants = Array.isArray(partData.participants)
            ? partData.participants
            : Array.isArray(partData.Participants)
            ? partData.Participants
            : [];
          if (participants.length >= cfg.maxParticipants) {
            return json(
              { error: "Phòng đã đủ người. Thử phòng khác nhé.", code: "ROOM_FULL" },
              409
            );
          }
        }
      } catch (err) {
        console.error("Twirp ListParticipants error (fail-open):", err);
      }

      // 3. Fallback: gọi CreateRoom để thiết lập max_participants và empty_timeout
      try {
        const now = Math.floor(Date.now() / 1000);
        const createToken = await signJwt(env.LIVEKIT_API_SECRET, {
          exp: now + 60,
          nbf: now - 60,
          iss: env.LIVEKIT_API_KEY,
          sub: "room-creator",
          video: { roomCreate: true },
        });
        await fetch(`${httpBase}/twirp/livekit.RoomService/CreateRoom`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${createToken}`,
          },
          body: JSON.stringify({
            name: room,
            max_participants: cfg.maxParticipants,
            empty_timeout: cfg.emptyTimeoutSec,
          }),
        });
      } catch {}

      // Danh tính lấy từ uid: vào lại thì LiveKit tự ngắt kết nối cũ,
      // không để lại người "ma" chiếm chỗ, và đá được theo uid.
      const identity = `user-${checked.uid}`;
      const token = await mintRoomToken(env, identity, displayName, room, cfg);

      return json({
        token,
        url: LIVEKIT_URL,
        room,
        maxParticipants: cfg.maxParticipants,
        remainingMinutes: quota.remainingMinutes,
        sessionMaxMinutes: cfg.sessionMaxMinutes,
        quotaStatus: quota.quotaStatus,
      });
    }

    // --- Danh sách phòng đang có người (cần đăng nhập, hoặc ADMIN_TOKEN) ---
    if (url.pathname === "/rooms" && req.method === "GET") {
      const admin = String(env.ADMIN_TOKEN || "");
      let allowed = !!admin && url.searchParams.get("token") === admin;
      if (!allowed) {
        const verifyToken = env._verifyToken || verifyFirebaseToken;
        const checked = await verifyToken(env, bearerToken(req));
        allowed = !!checked.uid;
      }
      if (!allowed) {
        return json({ error: "Đăng nhập rồi mới xem được danh sách phòng." }, 401);
      }

      const quota = await resolveMonthQuota(env, cfg);

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
          maxParticipants: cfg.maxParticipants,
          remainingMinutes: quota.remainingMinutes,
          quotaStatus: quota.quotaStatus,
        });
      } catch (e) {
        return json({ error: `Không lấy được danh sách: ${String(e).slice(0, 300)}` }, 502);
      }
    }

    return json({ error: "Dùng POST /token hoặc GET /rooms." }, 404);
  },
};

export function createWorker(deps = {}) {
  return {
    fetch(req, env) {
      return worker.fetch(req, { ...env, ...deps });
    },
  };
}

export default worker;
