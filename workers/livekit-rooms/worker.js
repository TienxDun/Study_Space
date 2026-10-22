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
  const payload = {
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
  };
  if (cfg.attributes) {
    payload.attributes = cfg.attributes;
  }
  return signJwt(env.LIVEKIT_API_SECRET, payload);
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
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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

export async function hashRoomPassword(password, salt = "zenstudy-salt-v1") {
  const str = String(password || "").trim();
  if (!str) return null;
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${str}`);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function parseCoHosts(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function logAudit(db, room, action, actorUid, targetIdentity = null) {
  if (!db) return;
  try {
    const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = Math.floor(Date.now() / 1000);
    await db.prepare(
      "INSERT INTO meet_audit_logs (id, room, action, actor_uid, target_identity, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(id, room, action, actorUid, targetIdentity, now).run();
  } catch (e) {
    console.error("Audit log error:", e);
  }
}

export async function kickParticipant(env, httpBase, room, targetIdentity) {
  const now = Math.floor(Date.now() / 1000);
  const twirpToken = await signJwt(env.LIVEKIT_API_SECRET, {
    exp: now + 60,
    nbf: now - 60,
    iss: env.LIVEKIT_API_KEY,
    sub: "room-moderator",
    video: { roomAdmin: true, room },
  });
  const res = await fetch(`${httpBase}/twirp/livekit.RoomService/RemoveParticipant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${twirpToken}`,
    },
    body: JSON.stringify({ room, identity: targetIdentity }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `Lỗi mời rời phòng từ máy chủ: ${text.slice(0, 100)}` };
  }
  return { ok: true };
}

export async function muteParticipantTrack(env, httpBase, room, targetIdentity) {
  const now = Math.floor(Date.now() / 1000);
  const twirpToken = await signJwt(env.LIVEKIT_API_SECRET, {
    exp: now + 60,
    nbf: now - 60,
    iss: env.LIVEKIT_API_KEY,
    sub: "room-moderator",
    video: { roomAdmin: true, room },
  });

  // 1. List participants để tìm track audio của targetIdentity
  const listRes = await fetch(`${httpBase}/twirp/livekit.RoomService/ListParticipants`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${twirpToken}`,
    },
    body: JSON.stringify({ room }),
  });
  if (!listRes.ok) return { ok: false, error: "Không lấy được danh sách người tham gia." };
  const listData = await listRes.json().catch(() => ({}));
  const participants = Array.isArray(listData.participants)
    ? listData.participants
    : Array.isArray(listData.Participants)
    ? listData.Participants
    : [];
  const target = participants.find((p) => (p.identity ?? p.Identity) === targetIdentity);
  if (!target) return { ok: false, error: "Không tìm thấy người tham gia trong phòng." };

  const tracks = Array.isArray(target.tracks) ? target.tracks : Array.isArray(target.Tracks) ? target.Tracks : [];
  const audioTrack = tracks.find((t) => {
    const type = t.type ?? t.Type;
    const source = t.source ?? t.Source;
    return type === 0 || type === "AUDIO" || source === 1 || source === "MICROPHONE";
  });

  const trackSid = audioTrack?.sid ?? audioTrack?.Sid;
  if (!trackSid) {
    return { ok: false, error: "Người tham gia hiện chưa bật micro." };
  }

  // 2. Tắt micro
  const muteRes = await fetch(`${httpBase}/twirp/livekit.RoomService/MutePublishedTrack`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${twirpToken}`,
    },
    body: JSON.stringify({
      room,
      identity: targetIdentity,
      track_sid: trackSid,
      muted: true,
    }),
  });
  if (!muteRes.ok) {
    const text = await muteRes.text().catch(() => "");
    return { ok: false, error: `Lỗi tắt micro từ máy chủ: ${text.slice(0, 100)}` };
  }
  return { ok: true };
}

export async function updateParticipantRole(env, httpBase, room, targetIdentity, role) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const twirpToken = await signJwt(env.LIVEKIT_API_SECRET, {
      exp: now + 60,
      nbf: now - 60,
      iss: env.LIVEKIT_API_KEY,
      sub: "room-moderator",
      video: { roomAdmin: true, room },
    });
    await fetch(`${httpBase}/twirp/livekit.RoomService/UpdateParticipant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${twirpToken}`,
      },
      body: JSON.stringify({
        room,
        identity: targetIdentity,
        attributes: { "zen.role": role },
      }),
    });
  } catch (e) {
    console.warn("UpdateParticipant role error (ignored):", e);
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

    // --- GET /usage và GET /admin/usage (quản trị, không trả uid hay email) ---
    if ((url.pathname === "/usage" || url.pathname === "/admin/usage") && req.method === "GET") {
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

      // Danh tính lấy từ uid: vào lại thì LiveKit tự ngắt kết nối cũ
      const identity = `user-${checked.uid}`;
      let role = "member";
      let isHost = false;
      let isCoHost = false;
      let roomHasPassword = false;
      let roomIsLocked = false;

      // 2. Kiểm tra hoặc khởi tạo thông tin phòng trong D1 meet_rooms
      if (env.DB) {
        try {
          const roomRow = await env.DB.prepare(
            "SELECT host_uid, host_identity, co_host_uids, locked, password_hash FROM meet_rooms WHERE name = ?"
          ).bind(room).first();

          if (!roomRow) {
            // Phòng mới: người tạo đầu tiên là Trưởng phòng (Host)
            const nowSec = Math.floor(Date.now() / 1000);
            const initialPassword = body.password ? String(body.password).trim() : "";
            const initialPassHash = initialPassword ? await hashRoomPassword(initialPassword) : null;

            await env.DB.prepare(
              "INSERT INTO meet_rooms (name, host_uid, host_identity, co_host_uids, locked, password_hash, created_at) VALUES (?, ?, ?, '[]', 0, ?, ?)"
            ).bind(room, checked.uid, identity, initialPassHash, nowSec).run();
            role = "host";
            isHost = true;
            roomHasPassword = Boolean(initialPassHash);
            roomIsLocked = false;
          } else {
            const coHosts = parseCoHosts(roomRow.co_host_uids);
            isHost = roomRow.host_uid === checked.uid;
            isCoHost = coHosts.includes(checked.uid);
            role = isHost ? "host" : isCoHost ? "co-host" : "member";
            roomHasPassword = Boolean(roomRow.password_hash);
            roomIsLocked = Number(roomRow.locked) === 1;

            // Kiểm tra mật khẩu nếu phòng có đặt bảo vệ
            if (roomRow.password_hash) {
              const providedPassword = body.password ? String(body.password).trim() : "";
              if (!providedPassword) {
                return json(
                  { error: "Phòng này yêu cầu mật khẩu.", code: "ROOM_PASSWORD_REQUIRED" },
                  401
                );
              }
              const providedHash = await hashRoomPassword(providedPassword);
              if (providedHash !== roomRow.password_hash) {
                return json(
                  { error: "Mật khẩu phòng không đúng.", code: "INVALID_PASSWORD" },
                  403
                );
              }
            }

            // Kiểm tra khóa phòng (chỉ Trưởng phòng hoặc Phó phòng mới được vào khi phòng đang khóa)
            if (Number(roomRow.locked) === 1 && !isHost && !isCoHost) {
              return json(
                { error: "Phòng đang bị khóa bởi trưởng phòng.", code: "ROOM_LOCKED" },
                403
              );
            }
          }
        } catch (dbErr) {
          console.error("D1 meet_rooms error in /token:", dbErr);
        }
      }

      // 3. Chặn phòng đầy ở server qua Twirp ListParticipants
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

      // 4. Fallback: gọi CreateRoom để thiết lập max_participants và empty_timeout
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

      const token = await mintRoomToken(env, identity, displayName, room, {
        ...cfg,
        attributes: { "zen.role": role },
      });

      return json({
        token,
        url: LIVEKIT_URL,
        room,
        role,
        isHost,
        isCoHost,
        hasPassword: roomHasPassword,
        isLocked: roomIsLocked,
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

        // Nạp cờ locked & hasPassword từ D1
        const roomMetaMap = new Map();
        if (env.DB) {
          try {
            const allRooms = await env.DB.prepare(
              "SELECT name, locked, password_hash FROM meet_rooms"
            ).all();
            const list = Array.isArray(allRooms?.results) ? allRooms.results : [];
            for (const rm of list) {
              roomMetaMap.set(rm.name, {
                isLocked: Number(rm.locked) === 1,
                hasPassword: !!rm.password_hash,
              });
            }
          } catch (e) {
            console.error("D1 query meet_rooms in /rooms error:", e);
          }
        }

        return json({
          rooms: rooms.map((rm) => {
            const rName = rm.name ?? rm.Name ?? "";
            const meta = roomMetaMap.get(rName);
            return {
              name: rName,
              count: Number(rm.numParticipants ?? rm.num_participants ?? 0),
              isLocked: meta?.isLocked ?? false,
              hasPassword: meta?.hasPassword ?? false,
            };
          }),
          maxParticipants: cfg.maxParticipants,
          remainingMinutes: quota.remainingMinutes,
          quotaStatus: quota.quotaStatus,
        });
      } catch (e) {
        return json({ error: `Không lấy được danh sách: ${String(e).slice(0, 300)}` }, 502);
      }
    }

    // --- API Điều hành phòng học (Moderation: Lock, Unlock, Password, Co-host, Kick, Mute) ---
    const roomRouteMatch = url.pathname.match(
      /^\/rooms\/([a-zA-Z0-9_-]+)\/(lock|unlock|password|co-host|kick|mute)$/
    );
    if (roomRouteMatch) {
      const roomName = cleanRoom(roomRouteMatch[1], 32);
      const action = roomRouteMatch[2];

      const verifyToken = env._verifyToken || verifyFirebaseToken;
      const checked = await verifyToken(env, bearerToken(req));
      if (!checked.uid) {
        return json({ error: "Yêu cầu đăng nhập." }, 401);
      }

      if (!env.DB) {
        return json({ error: "Cơ sở dữ liệu chưa sẵn sàng." }, 500);
      }

      const roomRow = await env.DB.prepare(
        "SELECT host_uid, host_identity, co_host_uids, locked, password_hash FROM meet_rooms WHERE name = ?"
      ).bind(roomName).first();

      if (!roomRow) {
        return json({ error: "Phòng không tồn tại." }, 404);
      }

      const isHost = roomRow.host_uid === checked.uid;
      const coHosts = parseCoHosts(roomRow.co_host_uids);
      const isCoHost = coHosts.includes(checked.uid);

      if (!isHost && !isCoHost) {
        return json(
          { error: "Chỉ Trưởng phòng hoặc Phó phòng mới có quyền thực hiện.", code: "NOT_HOST" },
          403
        );
      }

      let body = {};
      try {
        body = await req.json();
      } catch {}

      // 1. Khóa / Mở phòng (Host & Co-host)
      if (action === "lock" && req.method === "POST") {
        await env.DB.prepare("UPDATE meet_rooms SET locked = 1 WHERE name = ?")
          .bind(roomName)
          .run();
        await logAudit(env.DB, roomName, "lock", checked.uid);
        return json({ ok: true, locked: true });
      }
      if (action === "unlock" && req.method === "POST") {
        await env.DB.prepare("UPDATE meet_rooms SET locked = 0 WHERE name = ?")
          .bind(roomName)
          .run();
        await logAudit(env.DB, roomName, "unlock", checked.uid);
        return json({ ok: true, locked: false });
      }

      // 2. Cài đặt / Xóa mật khẩu phòng (Chỉ Host)
      if (action === "password") {
        if (!isHost) {
          return json(
            { error: "Chỉ Trưởng phòng mới có quyền cài đặt mật khẩu.", code: "NOT_HOST" },
            403
          );
        }
        if (req.method === "POST") {
          const pass = String(body.password || "").trim();
          if (!pass) return json({ error: "Mật khẩu không được để trống." }, 400);
          const hash = await hashRoomPassword(pass);
          await env.DB.prepare("UPDATE meet_rooms SET password_hash = ? WHERE name = ?")
            .bind(hash, roomName)
            .run();
          await logAudit(env.DB, roomName, "set_password", checked.uid);
          return json({ ok: true, hasPassword: true });
        }
        if (req.method === "DELETE") {
          await env.DB.prepare("UPDATE meet_rooms SET password_hash = NULL WHERE name = ?")
            .bind(roomName)
            .run();
          await logAudit(env.DB, roomName, "remove_password", checked.uid);
          return json({ ok: true, hasPassword: false });
        }
      }

      // 3. Quản lý Phó phòng (Chỉ Host)
      if (action === "co-host") {
        if (!isHost) {
          return json(
            { error: "Chỉ Trưởng phòng mới có quyền quản lý Phó phòng.", code: "NOT_HOST" },
            403
          );
        }
        const targetUid = String(body.targetUid || "").trim();
        const targetIdentity = String(body.targetIdentity || "").trim();
        if (!targetUid) return json({ error: "Thiếu targetUid." }, 400);

        if (req.method === "POST") {
          if (!coHosts.includes(targetUid)) {
            coHosts.push(targetUid);
            await env.DB.prepare("UPDATE meet_rooms SET co_host_uids = ? WHERE name = ?")
              .bind(JSON.stringify(coHosts), roomName)
              .run();
          }
          if (targetIdentity) {
            await updateParticipantRole(env, httpBase, roomName, targetIdentity, "co-host");
          }
          await logAudit(env.DB, roomName, "add_cohost", checked.uid, targetIdentity || targetUid);
          return json({ ok: true, coHosts });
        }
        if (req.method === "DELETE") {
          const nextCoHosts = coHosts.filter((u) => u !== targetUid);
          await env.DB.prepare("UPDATE meet_rooms SET co_host_uids = ? WHERE name = ?")
            .bind(JSON.stringify(nextCoHosts), roomName)
            .run();
          if (targetIdentity) {
            await updateParticipantRole(env, httpBase, roomName, targetIdentity, "");
          }
          await logAudit(
            env.DB,
            roomName,
            "remove_cohost",
            checked.uid,
            targetIdentity || targetUid
          );
          return json({ ok: true, coHosts: nextCoHosts });
        }
      }

      // 4. Mời người ra khỏi phòng (Host & Co-host)
      if (action === "kick" && req.method === "POST") {
        const targetIdentity = String(body.identity || "").trim();
        if (!targetIdentity) return json({ error: "Thiếu identity người cần mời rời phòng." }, 400);
        if (targetIdentity === `user-${checked.uid}` || targetIdentity === roomRow.host_identity) {
          return json({ error: "Không thể mời Trưởng phòng hoặc chính mình rời phòng." }, 400);
        }
        const targetUid = targetIdentity.replace(/^user-/, "");
        if (isCoHost && coHosts.includes(targetUid)) {
          return json({ error: "Phó phòng không thể mời Phó phòng khác rời phòng." }, 403);
        }

        const kickRes = await kickParticipant(env, httpBase, roomName, targetIdentity);
        if (!kickRes.ok) {
          return json({ error: kickRes.error }, 502);
        }
        await logAudit(env.DB, roomName, "kick", checked.uid, targetIdentity);
        return json({ ok: true });
      }

      // 5. Tắt micro từ xa (Host & Co-host)
      if (action === "mute" && req.method === "POST") {
        const targetIdentity = String(body.identity || "").trim();
        if (!targetIdentity) return json({ error: "Thiếu identity người cần tắt micro." }, 400);

        const muteRes = await muteParticipantTrack(env, httpBase, roomName, targetIdentity);
        if (!muteRes.ok) {
          return json({ error: muteRes.error }, 502);
        }
        await logAudit(env.DB, roomName, "mute", checked.uid, targetIdentity);
        return json({ ok: true });
      }

      return json({ error: "Hành động không được hỗ trợ." }, 400);
    }

    // --- GET /history (Lịch sử các phiên học tổng hợp của phòng) ---
    if (url.pathname === "/history" && req.method === "GET") {
      const verifyToken = env._verifyToken || verifyFirebaseToken;
      const checked = await verifyToken(env, bearerToken(req));
      if (!checked.uid) {
        return json({ error: "Yêu cầu đăng nhập." }, 401);
      }

      const room = cleanRoom(url.searchParams.get("room") || "", 32);
      const month = url.searchParams.get("month") || monthKeyUtc();

      if (!room) {
        return json({ error: "Thiếu tên phòng." }, 400);
      }

      if (!env.DB) {
        return json({
          room,
          month,
          totalMinutes: 0,
          totalSessions: 0,
          uniqueParticipants: 0,
          sessions: [],
        });
      }

      try {
        const rows = await env.DB.prepare(
          "SELECT id, joined_at, left_at, duration_seconds FROM meet_sessions WHERE room = ? AND billing_month = ? ORDER BY joined_at DESC"
        ).bind(room, month).all();

        const list = Array.isArray(rows?.results) ? rows.results : [];
        let totalDurationSec = 0;
        const sessions = [];

        for (const s of list) {
          const dur = Number(s.duration_seconds || 0);
          totalDurationSec += dur;
          const joinedAt = Number(s.joined_at || 0);
          const dateStr = joinedAt > 0 ? new Date(joinedAt * 1000).toISOString().slice(0, 10) : "";
          sessions.push({
            id: s.id,
            date: dateStr,
            startTime: joinedAt,
            durationMinutes: Math.round(dur / 60),
          });
        }

        const uniqueCount = await env.DB.prepare(
          "SELECT COUNT(DISTINCT identity) as count FROM meet_sessions WHERE room = ? AND billing_month = ?"
        ).bind(room, month).first();

        return json({
          room,
          month,
          totalMinutes: Math.floor(totalDurationSec / 60),
          totalSessions: list.length,
          uniqueParticipants: Number(uniqueCount?.count || 0),
          sessions: sessions.slice(0, 50),
        });
      } catch (err) {
        console.error("GET /history error:", err);
        return json({ error: "Lỗi truy vấn lịch sử phòng học." }, 500);
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
