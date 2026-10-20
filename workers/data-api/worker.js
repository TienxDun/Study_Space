/**
 * ZenStudy — Worker Lưu Trữ Đám Mây Tinh Gọn (Cloud Save Snapshot)
 * Endpoint:
 *   GET  /health -> kiểm tra trạng thái
 *   GET  /data   -> tải toàn bộ dữ liệu của người dùng
 *   POST /data   -> lưu toàn bộ dữ liệu của người dùng
 */

const CERT_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

const mem = { certs: {}, certAt: 0 };

function corsHeaders(req, env) {
  const origin = req.headers.get("Origin") || "";
  const rawAllowed = String(env.ALLOWED_ORIGINS || "").trim();
  const allowList = rawAllowed
    ? rawAllowed.split(",").map((s) => s.trim().toLowerCase())
    : [];
  const isAllowed =
    allowList.length === 0 || allowList.includes(origin.toLowerCase());

  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
  if (isAllowed) {
    headers["Access-Control-Allow-Origin"] = origin || "*";
  }
  return headers;
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

// ---------- Xác thực Firebase Auth ID Token ----------
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
  if (Date.now() - mem.certAt < 30 * 60 * 1000 && Object.keys(mem.certs).length) {
    return mem.certs;
  }
  const r = await fetch(CERT_URL);
  if (!r.ok) throw new Error("cert");
  mem.certs = await r.json();
  mem.certAt = Date.now();
  return mem.certs;
}

async function verifyFirebaseToken(env, token) {
  try {
    const pid = String(env.FIREBASE_PROJECT_ID || "").trim();
    if (!pid) return { error: "NO_PID" };
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return { error: "BAD_FORMAT" };
    const [h, p, s] = parts;

    let header, payload;
    try {
      header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
      payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
    } catch {
      return { error: "BAD_JSON" };
    }

    if (header.alg !== "RS256" || payload.aud !== pid) return { error: "BAD_AUD" };
    if (payload.iss !== `https://securetoken.google.com/${pid}`) return { error: "BAD_ISS" };

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp < now - 30) return { error: "EXPIRED" };
    if (!payload.sub || typeof payload.sub !== "string") return { error: "NO_SUB" };

    const certs = await getGoogleCerts();
    const pem = certs[header.kid];
    if (!pem) return { error: "NO_KID" };

    const spki = certSpkiBytes(pemToDerBytes(pem));
    const key = await crypto.subtle.importKey(
      "spki",
      spki,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      b64urlToBytes(s),
      new TextEncoder().encode(`${h}.${p}`)
    );
    return valid ? { uid: payload.sub } : { error: "INVALID_SIG" };
  } catch {
    return { error: "VERIFY_FAILED" };
  }
}

// ---------- Handler Chính Của Worker ----------
const workerHandler = {
  async fetch(req, env) {
    const cors = corsHeaders(req, env);

    // Xử lý Preflight OPTIONS
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(req.url);

    // 1. Kiểm tra trạng thái máy chủ
    if (url.pathname === "/health") {
      return json(
        { ok: true, db: !!env.DB, time: Date.now() },
        200,
        cors
      );
    }

    // Kiểm tra Authorization Header
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Cần đăng nhập để sử dụng tính năng này." }, 401, cors);
    }
    const token = authHeader.slice(7).trim();
    const tokenVerifier = (env && env._verifyToken) || verifyFirebaseToken;
    const auth = await tokenVerifier(env, token);
    if (auth.error || !auth.uid) {
      return json({ error: "Phiên đăng nhập hết hạn hoặc không hợp lệ.", detail: auth.error }, 401, cors);
    }

    const uid = auth.uid;
    const db = env.DB;
    if (!db) {
      return json({ error: "Lỗi kết nối cơ sở dữ liệu." }, 500, cors);
    }

    // 2. GET /data — Tải toàn bộ dữ liệu của người dùng
    if (req.method === "GET" && url.pathname === "/data") {
      try {
        const row = await db
          .prepare("SELECT data_json, updated_at FROM user_data WHERE uid = ?")
          .bind(uid)
          .first();

        if (!row || !row.data_json) {
          return json({ ok: true, data: null, updatedAt: 0 }, 200, cors);
        }

        let parsedData = null;
        try {
          parsedData = JSON.parse(row.data_json);
        } catch {
          parsedData = row.data_json;
        }

        return json(
          {
            ok: true,
            data: parsedData,
            updatedAt: Number(row.updated_at) || 0,
          },
          200,
          cors
        );
      } catch (err) {
        return json({ error: "Không thể đọc dữ liệu.", detail: String(err?.message || err) }, 500, cors);
      }
    }

    // 3. POST /data — Lưu toàn bộ dữ liệu của người dùng
    if (req.method === "POST" && url.pathname === "/data") {
      try {
        const body = await req.json().catch(() => null);
        if (!body || typeof body !== "object" || body.data === undefined) {
          return json({ error: "Dữ liệu gửi lên không đúng định dạng." }, 400, cors);
        }

        const dataStr = typeof body.data === "string" ? body.data : JSON.stringify(body.data);

        // Giới hạn trần 2MB UTF-8
        if (new TextEncoder().encode(dataStr).byteLength > 2_000_000) {
          return json({ error: "Dung lượng dữ liệu vượt quá 2MB." }, 413, cors);
        }

        const now = Date.now();
        await db
          .prepare(
            `INSERT INTO user_data (uid, data_json, updated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(uid) DO UPDATE SET
               data_json = excluded.data_json,
               updated_at = excluded.updated_at`
          )
          .bind(uid, dataStr, now)
          .run();

        return json({ ok: true, updatedAt: now }, 200, cors);
      } catch (err) {
        return json({ error: "Không thể lưu dữ liệu.", detail: String(err?.message || err) }, 500, cors);
      }
    }

    return json({ error: "Đường dẫn không tồn tại." }, 404, cors);
  },
};

export function createWorker(deps) {
  if (deps && deps.verifyToken) {
    return {
      fetch(req, env) {
        return workerHandler.fetch(req, { ...env, _verifyToken: deps.verifyToken });
      },
    };
  }
  return workerHandler;
}

export default workerHandler;
