/**
 * data-api — Kho dữ liệu học tập trên Cloudflare D1 cho ZenStudy.
 * ------------------------------------------------------------------
 * Nhiệm vụ: nhận/trả dữ liệu của từng người (cài đặt, board kanban, ghi chú,
 * phiên tập trung...) để web đồng bộ qua mạng. Máy vẫn là bản chính khi mất
 * mạng; D1 là bản sao trên mạng.
 *
 * Gắn cần thiết (Settings → Bindings):
 *   DB                 = D1 database (bảng tạo từ workers/schema.sql)
 *   FIREBASE_PROJECT_ID = "zenspace-d10m13y26"  (Text)
 *   ALLOWED_ORIGINS     = "https://zenstudy.space,http://localhost:3001"  (Text)
 *
 * Endpoints (đều cần vé Firebase: header `Authorization: Bearer <idToken>`):
 *   GET    /health            -> trạng thái (không cần đăng nhập)
 *   GET    /me                -> { uid, settings: { key: value, ... } }
 *   GET    /settings          -> { uid, settings }
 *   PUT    /settings          -> body { settings: { key: value } }  (lưu nhiều key)
 *   DELETE /settings          -> body { keys: ["a","b"] }
 *   GET    /focus?from=&to=   -> { sessions: [...] }
 *   POST   /focus             -> body { session: {...} } hoặc chính object phiên
 *   DELETE /focus             -> xóa hết phiên của người này
 *
 * Chi tiết triển khai: docs/d1-backend.md
 */

const CERT_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const MAX_KEY_LEN = 100;
const MAX_VALUE_LEN = 1_500_000; // < trần 2MB/ô của D1, chừa biên an toàn
const MAX_SETTINGS_PER_CALL = 200;

const mem = { certAt: 0, certs: {} };

function d1(env) {
  return env && env.DB && typeof env.DB.prepare === "function" ? env.DB : null;
}

function corsHeaders(req, env) {
  const origin = req.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const allowAll = allowed.length === 0 || allowed.includes("*");
  const ok = allowAll || allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin || "*" : "null",
    "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

// ---------- Kiểm vé Firebase (copy từ chat-proxy, giữ y nguyên) ----------
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
  let off = tbs.valuePos, spki = null;
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
    try { header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h))); } catch { return fail("BAD_H_PART"); }
    try { payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p))); } catch { return fail("BAD_P_PART"); }
    if (header.alg !== "RS256") return fail("BAD_ALG");
    if (payload.aud !== pid) return fail("BAD_AUD");
    if (payload.iss !== `https://securetoken.google.com/${pid}`) return fail("BAD_ISS");
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp < now - 30) return fail("EXPIRED");
    if (typeof payload.iat === "number" && payload.iat > now + 30) return fail("FUTURE_IAT");
    if (!payload.sub || typeof payload.sub !== "string" || payload.sub.length > 128) return fail("NO_SUB");
    let certs;
    try { certs = await getGoogleCerts(); } catch { return fail("CERT_FETCH"); }
    let pem = certs[header.kid];
    if (!pem) {
      mem.certAt = 0;
      try { pem = (await getGoogleCerts())[header.kid]; } catch { return fail("CERT_FETCH"); }
    }
    if (!pem) return fail("NO_CERT_FOR_KID");
    let spki;
    try { spki = certSpkiBytes(pemToDerBytes(pem)); } catch { return fail("NON_RSA"); }
    let key;
    try {
      key = await crypto.subtle.importKey("spki", spki, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    } catch { return fail("IMPORT_KEY"); }
    let ok = false;
    try {
      ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`));
    } catch { return fail("VERIFY_CALL"); }
    return ok ? { uid: payload.sub } : fail("BAD_SIG");
  } catch {
    return fail("EXCEPTION");
  }
}

// ---------- Truy vấn ----------
async function ensureUser(db, uid, profile) {
  const name = profile && typeof profile.display_name === "string" ? profile.display_name.slice(0, 200) : null;
  const photo = profile && typeof profile.photo_url === "string" ? profile.photo_url.slice(0, 500) : null;
  // Đọc trước để không ghi lại mỗi lần web gọi API (ghi là hạn mức khan hiếm nhất).
  const existing = await db.prepare("SELECT 1 AS ok FROM users WHERE uid = ?").bind(uid).first();
  if (!existing) {
    const now = Date.now();
    await db.prepare(
      `INSERT INTO users (uid, display_name, photo_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(uid) DO NOTHING`
    ).bind(uid, name, photo, now, now).run();
    return;
  }
  if (name !== null || photo !== null) {
    await db.prepare(
      `UPDATE users SET display_name = COALESCE(?, display_name),
         photo_url = COALESCE(?, photo_url), updated_at = ? WHERE uid = ?`
    ).bind(name, photo, Date.now(), uid).run();
  }
}

async function readSettings(db, uid) {
  const res = await db.prepare("SELECT key, value, updated_at FROM user_settings WHERE uid = ?").bind(uid).all();
  const rows = (res && res.results) || [];
  const settings = {};
  const updated = {};
  for (const r of rows) {
    settings[r.key] = r.value; // trả chuỗi thô để web ghi lại nguyên vẹn
    updated[r.key] = Number(r.updated_at) || 0;
  }
  return { settings, updated };
}

function mapFocusRow(r) {
  return {
    id: r.id,
    taskId: r.task_id,
    taskTitle: r.task_title || "",
    boardId: r.board_id || undefined,
    startedAt: Number(r.started_at),
    endedAt: Number(r.ended_at),
    focusSeconds: Number(r.focus_seconds),
    plannedSeconds: Number(r.planned_seconds),
  };
}

function cleanFocusInput(raw) {
  if (!raw || typeof raw !== "object") return null;
  const taskId = typeof raw.taskId === "string" ? raw.taskId.slice(0, 200) : "";
  const focusSeconds = Math.floor(Number(raw.focusSeconds) || 0);
  if (!taskId || focusSeconds <= 0) return null;
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id.slice(0, 100) : crypto.randomUUID(),
    taskId,
    taskTitle: typeof raw.taskTitle === "string" ? raw.taskTitle.slice(0, 500) : "",
    boardId: typeof raw.boardId === "string" && raw.boardId ? raw.boardId.slice(0, 200) : null,
    startedAt: Math.floor(Number(raw.startedAt) || 0),
    endedAt: Math.floor(Number(raw.endedAt) || 0),
    focusSeconds,
    plannedSeconds: Math.max(0, Math.floor(Number(raw.plannedSeconds) || 0)),
  };
}

const worker = {
  async fetch(req, env) {
    const cors = corsHeaders(req, env);
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors } });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(req.url);

    if (url.pathname === "/health" && req.method === "GET") {
      const db = d1(env);
      let schema = false;
      if (db) {
        try {
          const r = await db.prepare(
            "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN ('users','user_settings','focus_sessions','chat_usage','cf_usage')"
          ).first();
          schema = (Number(r && r.n) || 0) === 5;
        } catch { schema = false; }
      }
      return json({
        ok: true,
        db: !!db,
        schema,
        pid: !!env.FIREBASE_PROJECT_ID,
        projectId: String(env.FIREBASE_PROJECT_ID || ""),
        origins: String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean).length,
        time: new Date().toISOString(),
      });
    }

    const db = d1(env);
    if (!db) return json({ error: "Worker chưa gắn D1 (binding DB)." }, 500);

    const auth = req.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const checked = await verifyFirebaseToken(env, token);
    if (!checked.uid) {
      const hint = {
        NO_PID: "Worker chưa đặt FIREBASE_PROJECT_ID.",
        BAD_AUD: "FIREBASE_PROJECT_ID của Worker không khớp project của vé.",
        BAD_ISS: "FIREBASE_PROJECT_ID của Worker không khớp project của vé.",
        EXPIRED: "Vé đã hết hạn, đăng nhập lại giúp mình.",
        BAD_FORMAT: "Thiếu vé đăng nhập.",
      }[checked.code];
      return json({ error: hint || "Bạn đăng nhập lại nhé.", code: checked.code }, 401);
    }
    const uid = checked.uid;

    try {
      await ensureUser(db, uid, null);

      // ---- Cài đặt / dữ liệu nhỏ ----
      if (url.pathname === "/me" && req.method === "GET") {
        const { settings, updated } = await readSettings(db, uid);
        return json({ uid, settings, updated });
      }
      if (url.pathname === "/settings" && req.method === "GET") {
        const { settings, updated } = await readSettings(db, uid);
        return json({ uid, settings, updated });
      }
      if (url.pathname === "/settings" && req.method === "PUT") {
        let body = null;
        try { body = await req.json(); } catch { return json({ error: "Body phải là JSON." }, 400); }
        const incoming = body && body.settings;
        if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
          return json({ error: "Thiếu `settings` (object)." }, 400);
        }
        const entries = Object.entries(incoming);
        if (entries.length > MAX_SETTINGS_PER_CALL) return json({ error: "Gửi quá nhiều key một lần." }, 413);
        const now = Date.now();
        const stmts = [];
        for (const [key, val] of entries) {
          if (typeof key !== "string" || !key || key.length > MAX_KEY_LEN) continue;
          let raw;
          if (typeof val === "string") {
            raw = val; // web gửi chuỗi thô -> lưu nguyên vẹn, khôi phục đúng từng byte
          } else {
            try { raw = JSON.stringify(val); } catch { continue; }
          }
          if (typeof raw !== "string") continue;
          if (raw.length > MAX_VALUE_LEN) return json({ error: `Giá trị "${key}" quá lớn.` }, 413);
          stmts.push(db.prepare(
            `INSERT INTO user_settings (uid, key, value, updated_at) VALUES (?, ?, ?, ?)
             ON CONFLICT(uid, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
          ).bind(uid, key, raw, now));
        }
        if (stmts.length) await db.batch(stmts);
        return json({ ok: true, saved: stmts.length, at: now });
      }
      if (url.pathname === "/settings" && req.method === "DELETE") {
        let body = null;
        try { body = await req.json(); } catch { return json({ error: "Body phải là JSON." }, 400); }
        const keys = Array.isArray(body && body.keys) ? body.keys.filter((k) => typeof k === "string" && k).slice(0, MAX_SETTINGS_PER_CALL) : [];
        if (!keys.length) return json({ error: "Thiếu `keys`." }, 400);
        const stmts = keys.map((k) => db.prepare("DELETE FROM user_settings WHERE uid = ? AND key = ?").bind(uid, k));
        await db.batch(stmts);
        return json({ ok: true, deleted: keys.length });
      }

      // ---- Phiên tập trung ----
      if (url.pathname === "/focus" && req.method === "GET") {
        const from = Number(url.searchParams.get("from")) || 0;
        const to = Number(url.searchParams.get("to")) || Number.MAX_SAFE_INTEGER;
        const res = await db.prepare(
          `SELECT id, task_id, task_title, board_id, started_at, ended_at, focus_seconds, planned_seconds
           FROM focus_sessions WHERE uid = ? AND started_at >= ? AND started_at < ?
           ORDER BY started_at DESC`
        ).bind(uid, from, to).all();
        const sessions = ((res && res.results) || []).map(mapFocusRow);
        return json({ sessions });
      }
      if (url.pathname === "/focus" && req.method === "POST") {
        let body = null;
        try { body = await req.json(); } catch { return json({ error: "Body phải là JSON." }, 400); }
        const input = cleanFocusInput(body && body.session ? body.session : body);
        if (!input) return json({ error: "Phiên không hợp lệ." }, 400);
        await db.prepare(
          `INSERT INTO focus_sessions
             (id, uid, task_id, task_title, board_id, started_at, ended_at, focus_seconds, planned_seconds, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO NOTHING`
        ).bind(input.id, uid, input.taskId, input.taskTitle, input.boardId, input.startedAt, input.endedAt, input.focusSeconds, input.plannedSeconds, Date.now()).run();
        return json({ ok: true, id: input.id });
      }
      if (url.pathname === "/focus" && req.method === "DELETE") {
        await db.prepare("DELETE FROM focus_sessions WHERE uid = ?").bind(uid).run();
        return json({ ok: true });
      }
    } catch (err) {
      return json({ error: "Lỗi kho dữ liệu.", detail: String((err && err.message) || err).slice(0, 300) }, 500);
    }

    return json({ error: "Không có đường này." }, 404);
  },
};

export default worker;
