// Hạn mức chat dùng chung với chat-proxy v1:
//   - D1 `chat_usage` khoá (uid, day): hai Worker cùng đọc/ghi một bộ đếm.
//   - Giới hạn lấy từ KV `cfg:flags.chatDailyLimit` (admin sửa), dự phòng
//     env USER_DAILY_LIMIT, cuối cùng 30.
//   - Ngày chốt theo giờ Thái Bình Dương, giống v1, để mốc "mai" khớp nhau.

const FLAGS_KEY = "cfg:flags";
const FLAGS_TTL_MS = 30 * 1000;
const DAILY_LIMIT_DEFAULT = 30;
const DAILY_LIMIT_MIN = 1;
const DAILY_LIMIT_MAX = 1000;
const DAY_TTL_SECONDS = 86400 + 3600;

let flagsCache = { at: 0, value: null };

export function pacificDay() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function d1(env) {
  return env && env.DB && typeof env.DB.prepare === "function" ? env.DB : null;
}

function kv(env) {
  return env && env.CHAT_QUOTA && typeof env.CHAT_QUOTA.get === "function" ? env.CHAT_QUOTA : null;
}

function validLimit(value) {
  return Number.isInteger(value) && value >= DAILY_LIMIT_MIN && value <= DAILY_LIMIT_MAX ? value : null;
}

async function readFlags(env) {
  if (flagsCache.value && Date.now() - flagsCache.at < FLAGS_TTL_MS) return flagsCache.value;
  let parsed = null;
  const store = kv(env);
  if (store) {
    const raw = await store.get(FLAGS_KEY).catch(() => null);
    if (raw) {
      try {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === "object") parsed = obj;
      } catch {
        // JSON hỏng: coi như chưa cấu hình.
      }
    }
  }
  flagsCache = { at: Date.now(), value: { chatDailyLimit: validLimit(parsed && parsed.chatDailyLimit) } };
  return flagsCache.value;
}

export async function getDailyLimit(env) {
  const flags = await readFlags(env);
  if (flags.chatDailyLimit) return flags.chatDailyLimit;
  const envLimit = validLimit(Number.parseInt(String((env && env.USER_DAILY_LIMIT) || ""), 10));
  return envLimit || DAILY_LIMIT_DEFAULT;
}

export async function getCount(env, uid, day) {
  const db = d1(env);
  if (db) {
    try {
      const row = await db
        .prepare("SELECT count FROM chat_usage WHERE uid = ? AND day = ?")
        .bind(uid, day)
        .first();
      return Number(row && row.count) || 0;
    } catch {
      // D1 lỗi -> dùng KV dự phòng bên dưới.
    }
  }
  const store = kv(env);
  if (store) return Number((await store.get(`user:${uid}:${day}`).catch(() => null)) || 0);
  return 0;
}

export async function incrCount(env, uid, day) {
  const db = d1(env);
  if (db) {
    try {
      await db
        .prepare(
          "INSERT INTO chat_usage (uid, day, count) VALUES (?, ?, 1) ON CONFLICT(uid, day) DO UPDATE SET count = count + 1"
        )
        .bind(uid, day)
        .run();
      return;
    } catch {
      // D1 lỗi -> dùng KV dự phòng bên dưới.
    }
  }
  const store = kv(env);
  if (!store) return;
  const key = `user:${uid}:${day}`;
  const current = (Number(await store.get(key).catch(() => 0)) || 0) + 1;
  await store.put(key, String(current), { expirationTtl: DAY_TTL_SECONDS }).catch(() => {});
}

// Admin khoá trợ lý AI của tài khoản: lỗi đọc không được khoá chat của mọi người.
export async function isAiRestricted(env, uid) {
  const db = d1(env);
  if (!db) return false;
  try {
    const row = await db
      .prepare("SELECT ai_disabled FROM user_restrictions WHERE uid = ?")
      .bind(uid)
      .first();
    return !!(row && Number(row.ai_disabled) === 1);
  } catch {
    return false;
  }
}

// Chặn trước khi gọi AI. Trả {} để đi tiếp, hoặc { status, code?, error }.
export async function checkQuota(env, gate) {
  if (gate.dev) return {};
  if (await isAiRestricted(env, gate.uid)) {
    return {
      status: 403,
      code: "AI_RESTRICTED",
      error: "Tài khoản của bạn đang bị tạm khóa trợ lý AI. Liên hệ quản trị viên ZenStudy nhé.",
    };
  }
  const limit = await getDailyLimit(env);
  const used = await getCount(env, gate.uid, pacificDay());
  if (used >= limit) {
    return { status: 429, error: `Hôm nay bạn đã dùng hết ${limit} câu, mai quay lại nhé.` };
  }
  return {};
}

export function resetQuotaCache() {
  flagsCache = { at: 0, value: null };
}
