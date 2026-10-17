/**
 * Worker phát vé + danh sách phòng học nhóm (LiveKit) cho ZenStudy.
 *
 * Cài 1 lần trên Cloudflare Dashboard (Workers & Pages -> Create Worker
 * -> dán file này -> Deploy), rồi thêm 3 Secret:
 *   LIVEKIT_URL     = wss://xxxx.livekit.cloud
 *   LIVEKIT_API_KEY = API...
 *   LIVEKIT_API_SECRET = ... (giữ kín, không đưa vào web)
 *
 * Xong copy địa chỉ worker (vd https://zenstudy-rooms.xxx.workers.dev)
 * bỏ vào repo Variable NEXT_PUBLIC_LIVEKIT_TOKEN_URL rồi đăng web lại.
 *
 *  POST /token { room, name } -> { token, url, room }
 *  GET  /rooms               -> { rooms: [{ name, count }] }
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

// Biến môi trường đọc thêm (không bắt buộc, khai báo trong Dashboard):
//   ALLOWED_ORIGINS = "https://zenstudy.space,http://localhost:3001"
// Để trống = cho mọi nơi gọi (tiện lúc thử, chặn lại khi web đông).

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
    "Access-Control-Allow-Headers": "Content-Type",
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
    const httpBase = LIVEKIT_URL.replace(/^wss:/, "https:").replace(/\/$/, "");

    // --- Phát vé vào phòng ---
    if (url.pathname === "/token" && req.method === "POST") {
      let body = {};
      try {
        body = await req.json();
      } catch {}
      const room = cleanRoom(body.room, 32);
      const displayName = String(body.name || "").trim().slice(0, 30);
      if (!room) return json({ error: "Nhập tên phòng." }, 400);
      if (!displayName) return json({ error: "Nhập tên của bạn." }, 400);

      const identity = `u-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const token = await mintRoomToken(env, identity, displayName, room);
      return json({ token, url: LIVEKIT_URL, room });
    }

    // --- Danh sách phòng đang có người ---
    if (url.pathname === "/rooms" && req.method === "GET") {
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

