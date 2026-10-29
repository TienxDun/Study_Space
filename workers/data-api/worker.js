/**
 * ZenStudy — Worker Lưu Trữ Đám Mây Tinh Gọn (Cloud Save Snapshot)
 * Endpoint:
 *   GET  /health  -> kiểm tra trạng thái
 *   GET  /content -> catalog nội dung công khai (cảnh / âm thanh / nhạc), không cần token
 *   GET    /data    -> tải toàn bộ dữ liệu của người dùng
 *   POST   /data    -> lưu toàn bộ dữ liệu của người dùng
 *   DELETE /account -> xoá toàn bộ dữ liệu của tài khoản (kèm dữ liệu phòng học)
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
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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

// ---------- Hỗ trợ xoá tài khoản ----------
async function tableExists(db, name) {
  try {
    const row = await db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .bind(name)
      .first();
    return !!row;
  } catch {
    return false;
  }
}

// Tài khoản đã xoá thì chặn hẳn, kể cả khi thiết bị khác còn ID token cũ
// (token còn hạn tới ~1 giờ nên vẫn gọi được API nếu không có chốt này).
async function isAccountDeleted(db, uid) {
  try {
    const row = await db
      .prepare("SELECT uid FROM deleted_accounts WHERE uid = ?")
      .bind(uid)
      .first();
    return !!row;
  } catch {
    return false;
  }
}

async function deleteAccountData(db, uid) {
  const deleted = {
    userData: 0,
    chatUsage: 0,
    meetSessions: 0,
    meetRooms: 0,
    meetCohosts: 0,
    meetAudit: 0,
  };

  const base = await db.batch([
    db.prepare("DELETE FROM user_data WHERE uid = ?").bind(uid),
    db.prepare("DELETE FROM chat_usage WHERE uid = ?").bind(uid),
  ]);
  deleted.userData = Number(base?.[0]?.meta?.changes || 0);
  deleted.chatUsage = Number(base?.[1]?.meta?.changes || 0);

  // Bảng LiveKit chỉ tồn tại khi đã cài livekit-schema.sql
  if (await tableExists(db, "meet_sessions")) {
    const res = await db
      .prepare("DELETE FROM meet_sessions WHERE identity = ?")
      .bind(`user-${uid}`)
      .run();
    deleted.meetSessions = Number(res?.meta?.changes || 0);
  }

  if (await tableExists(db, "meet_rooms")) {
    const hosted = await db
      .prepare("DELETE FROM meet_rooms WHERE host_uid = ?")
      .bind(uid)
      .run();
    deleted.meetRooms = Number(hosted?.meta?.changes || 0);

    const coRows = await db
      .prepare("SELECT name, co_host_uids FROM meet_rooms WHERE co_host_uids LIKE ?")
      .bind(`%${uid}%`)
      .all();
    const rows = Array.isArray(coRows?.results) ? coRows.results : [];
    for (const row of rows) {
      let list = [];
      try {
        list = JSON.parse(String(row?.co_host_uids || "[]"));
      } catch {
        list = [];
      }
      // LIKE có thể khớp chuỗi con của uid khác, nên kiểm tra lại cho chắc
      if (!Array.isArray(list) || !list.includes(uid)) continue;
      const next = list.filter((item) => item !== uid);
      await db
        .prepare("UPDATE meet_rooms SET co_host_uids = ? WHERE name = ?")
        .bind(JSON.stringify(next), row.name)
        .run();
      deleted.meetCohosts += 1;
    }
  }

  if (await tableExists(db, "meet_audit_logs")) {
    const res = await db
      .prepare(
        "DELETE FROM meet_audit_logs WHERE actor_uid = ? OR target_identity = ? OR target_identity = ?"
      )
      .bind(uid, uid, `user-${uid}`)
      .run();
    deleted.meetAudit = Number(res?.meta?.changes || 0);
  }

  // Tạo tại chỗ để DB cũ chưa chạy lại schema.sql vẫn dùng được
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS deleted_accounts (uid TEXT PRIMARY KEY, deleted_at INTEGER NOT NULL)"
    )
    .run();

  return deleted;
}

// ---------- Xoá tài khoản Firebase bằng service account ----------
// Client SDK bắt buộc reauth khi phiên cũ; Admin API thì không. Khoá service
// account nằm trong Worker secret, UID luôn lấy từ vé Firebase đã verify.
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const IDENTITY_SCOPE = "https://www.googleapis.com/auth/identitytoolkit";

let adminTokenCache = { email: "", token: "", exp: 0 };

function readServiceAccount(env) {
  const raw = String(env.FIREBASE_SERVICE_ACCOUNT || "").trim();
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw);
    const email = String(sa?.client_email || "").trim();
    const privateKey = String(sa?.private_key || "").replace(/\\n/g, "\n").trim();
    const projectId = String(sa?.project_id || "").trim();
    const expectedProject = String(env.FIREBASE_PROJECT_ID || "").trim();
    if (!email || !privateKey) return null;
    // Sai project thì xoá nhầm dự án khác; coi như chưa cấu hình.
    if (expectedProject && projectId && projectId !== expectedProject) return null;
    return { email, privateKey };
  } catch {
    return null;
  }
}

function b64urlEncode(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlJson(obj) {
  return b64urlEncode(new TextEncoder().encode(JSON.stringify(obj)));
}

async function getAdminAccessToken(env) {
  const sa = readServiceAccount(env);
  if (!sa) throw new Error("NO_SERVICE_ACCOUNT");

  const now = Math.floor(Date.now() / 1000);
  if (adminTokenCache.email === sa.email && adminTokenCache.exp > now + 60) {
    return adminTokenCache.token;
  }

  const header = b64urlJson({ alg: "RS256", typ: "JWT" });
  const claims = b64urlJson({
    iss: sa.email,
    scope: IDENTITY_SCOPE,
    aud: OAUTH_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  });
  const unsigned = `${header}.${claims}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDerBytes(sa.privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );
  const assertion = `${unsigned}.${b64urlEncode(new Uint8Array(signature))}`;

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });
  if (!res.ok) throw new Error(`AUTH_TOKEN_${res.status}`);

  const data = await res.json().catch(() => null);
  const token = String(data?.access_token || "");
  if (!token) throw new Error("AUTH_TOKEN_EMPTY");
  const ttl = Number(data?.expires_in) || 3600;
  adminTokenCache = { email: sa.email, token, exp: now + ttl };
  return token;
}

async function deleteFirebaseAuthUser(env, uid) {
  const projectId = String(env.FIREBASE_PROJECT_ID || "").trim();
  if (!projectId) throw new Error("NO_PROJECT_ID");

  const token = await getAdminAccessToken(env);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:delete`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ localId: uid }),
    }
  );

  if (res.ok) return;

  let code = "";
  try {
    const data = await res.json();
    code = String(data?.error?.message || "");
  } catch {
    /* body không phải JSON */
  }
  // Đã xoá từ trước (ví dụ client retry) thì coi như xong.
  if (res.status === 404 || code === "USER_NOT_FOUND") return;
  throw new Error(`AUTH_DELETE_${res.status}${code ? `_${code}` : ""}`);
}

async function markAccountDeleted(db, uid) {
  await db
    .prepare(
      "INSERT INTO deleted_accounts (uid, deleted_at) VALUES (?, ?) ON CONFLICT(uid) DO UPDATE SET deleted_at = excluded.deleted_at"
    )
    .bind(uid, Date.now())
    .run();
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
        {
          ok: true,
          db: !!env.DB,
          authAdmin: !!readServiceAccount(env),
          time: Date.now(),
        },
        200,
        cors
      );
    }

    // 2. GET /content — catalog công khai, không cần token.
    // Nội dung do admin phát hành (bảng content_manifest, mỗi lần lưu là một version).
    if (url.pathname === "/content") {
      if (req.method !== "GET") {
        return json({ error: "Chỉ hỗ trợ GET." }, 405, cors);
      }
      if (!env.DB) {
        return json(
          { ok: false, error: "missing_binding" },
          500,
          { ...cors, "Cache-Control": "no-store" }
        );
      }
      const cache = {
        ...cors,
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      };
      try {
        const res = await env.DB.prepare(
          `SELECT version, kind, json, created_at
             FROM content_manifest
            WHERE version = (SELECT MAX(version) FROM content_manifest)`
        ).all();
        const rows = Array.isArray(res?.results) ? res.results : [];

        const catalog = { scenes: [], sounds: [], tracks: { lofi: [], jazz: [], relax: [] } };
        let version = 0;
        let updatedAt = 0;
        for (const row of rows) {
          const kind = String(row?.kind || "");
          let parsed = null;
          try {
            parsed = JSON.parse(String(row?.json || ""));
          } catch {
            parsed = null;
          }
          if (!parsed) {
            return json(
              { ok: false, error: "invalid_json" },
              500,
              { ...cors, "Cache-Control": "no-store" }
            );
          }
          version = Math.max(version, Number(row?.version) || 0);
          updatedAt = Math.max(updatedAt, Number(row?.created_at) || 0);
          if (kind === "scenes" && Array.isArray(parsed)) catalog.scenes = parsed;
          else if (kind === "sounds" && Array.isArray(parsed)) catalog.sounds = parsed;
          else if (kind === "tracks" && parsed && typeof parsed === "object") {
            for (const mood of ["lofi", "jazz", "relax"]) {
              if (Array.isArray(parsed[mood])) catalog.tracks[mood] = parsed[mood];
            }
          }
        }

        return json(
          {
            ok: true,
            version,
            updatedAt,
            counts: {
              scenes: catalog.scenes.length,
              sounds: catalog.sounds.length,
              tracks:
                catalog.tracks.lofi.length +
                catalog.tracks.jazz.length +
                catalog.tracks.relax.length,
            },
            ...catalog,
          },
          200,
          cache
        );
      } catch (err) {
        return json(
          { ok: false, error: "d1_error", detail: String(err?.message || err) },
          500,
          { ...cors, "Cache-Control": "no-store" }
        );
      }
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

    // Tài khoản đã xoá: chặn đọc/ghi để thiết bị còn token cũ không đẩy dữ liệu trở lại.
    if (
      url.pathname === "/data" &&
      (req.method === "GET" || req.method === "POST") &&
      (await isAccountDeleted(db, uid))
    ) {
      return json({ error: "Tài khoản này đã bị xoá." }, 403, cors);
    }

    // 3. GET /data — Tải toàn bộ dữ liệu của người dùng
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

    // 4. POST /data — Lưu toàn bộ dữ liệu của người dùng
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

    // 5. DELETE /account — xoá dữ liệu D1 rồi xoá tài khoản Firebase bằng Admin API
    if (req.method === "DELETE" && url.pathname === "/account") {
      // Thiếu secret thì dừng trước khi xoá bất cứ thứ gì, tránh cảnh dữ liệu mất mà tài khoản còn.
      if (!readServiceAccount(env)) {
        return json(
          {
            error:
              "Máy chủ chưa cấu hình xoá tài khoản (thiếu FIREBASE_SERVICE_ACCOUNT).",
            code: "NO_SERVICE_ACCOUNT",
          },
          503,
          cors
        );
      }
      try {
        const deleted = await deleteAccountData(db, uid);
        try {
          await deleteFirebaseAuthUser(env, uid);
        } catch (err) {
          return json(
            {
              error: "Đã xoá dữ liệu nhưng chưa xoá được tài khoản Firebase.",
              code: String(err?.message || "AUTH_DELETE_FAILED"),
            },
            502,
            cors
          );
        }
        await markAccountDeleted(db, uid);
        return json({ ok: true, authDeleted: true, deleted }, 200, cors);
      } catch (err) {
        return json(
          { error: "Không thể xoá tài khoản.", detail: String(err?.message || err) },
          500,
          cors
        );
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
