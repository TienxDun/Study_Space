// Thu thập + xác minh metadata model chat v2.
// Chạy: node scripts/refresh-chat-v2-models.mjs [--free-only] [--probe-paid] [--only=id1,id2]
// Mặc định: chỉ gọi thử các model free; model trả phí lấy metadata từ catalog.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_FILE = path.join(ROOT, "workers/chat-v2/model-catalog.json");
const MOTAPIS_BASE = "https://motapis.com/v1";
const MODELS_JS = "https://motapis.com/models.js";
const MODELS_DEV = "https://models.dev/api.json";
const DELAY_MS = Number(process.env.PROBE_DELAY_MS || 2000);
const PING_TIMEOUT = 40000;

const argv = new Set(process.argv.slice(2));
const probePaid = argv.has("--probe-paid");
const freeOnly = argv.has("--free-only") || !probePaid;
const onlyArg = process.argv.slice(2).find((a) => a.startsWith("--only="));
const onlyIds = onlyArg ? new Set(onlyArg.slice("--only=".length).split(",").map((s) => s.trim()).filter(Boolean)) : null;

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    const v = m[2].replace(/^["']|["']$/g, "");
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv(path.join(ROOT, "workers/chat-v2/.dev.vars"));

const freeKey = String(process.env.MOTAPIS_API_KEY_FREE || "").trim();
const paidKey = String(process.env.MOTAPIS_API_KEY || "").trim();
if (!freeKey && !paidKey) {
  console.error("Thiếu MOTAPIS_API_KEY_FREE / MOTAPIS_API_KEY trong workers/chat-v2/.dev.vars");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, key) {
  const res = await fetch(url, {
    headers: key ? { Authorization: `Bearer ${key}` } : {},
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

function normName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/^[a-z0-9_.-]+\//, "")
    .replace(/-\d{4}$/, "")
    .replace(/[^a-z0-9]/g, "");
}

// Bỏ model không phải chat (sinh ảnh/video, âm thanh, embedding…).
const NON_CHAT_RE = /(image|video|tts|whisper|transcribe|embed|moderation)/i;

// ---------- gọi chat, tuần tự, có chờ khi bị giới hạn ----------
async function chatCall({ model, messages, maxTokens, timeout, key }) {
  const started = Date.now();
  try {
    const res = await fetch(`${MOTAPIS_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(timeout),
    });
    const text = await res.text();
    let payload = null;
    try {
      payload = JSON.parse(text);
    } catch {}
    return {
      status: res.status,
      model: payload?.model || null,
      text: payload?.choices?.[0]?.message?.content || "",
      usage: payload?.usage || null,
      errorCode: payload?.error?.code || payload?.error?.type || null,
      errorDetail: payload?.error?.message || text.slice(0, 160),
      ms: Date.now() - started,
    };
  } catch (e) {
    return {
      status: 0,
      model: null,
      text: "",
      errorCode: null,
      errorDetail: String(e?.message || e).slice(0, 160),
      ms: Date.now() - started,
    };
  }
}

async function chatWithRetry(opts) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await chatCall(opts);
    const limited = r.status === 429;
    if (!limited || attempt === 3) return r;
    // Khoá free giới hạn số request đồng thời; chờ lâu hơn rồi mới thử lại.
    console.log(`    bị 429 (${r.errorCode || "rate"}), chờ 20s rồi thử lại (${attempt}/2)`);
    await sleep(20000);
  }
}

// ---------- nguồn dữ liệu ----------
function parseModelsJs(raw) {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end < start) return [];
  return JSON.parse(raw.slice(start, end + 1));
}

function buildModelsDevIndex(catalog) {
  const index = new Map();
  const add = (key, entry) => {
    const k = normName(key);
    if (!k) return;
    if (!index.has(k)) index.set(k, []);
    index.get(k).push(entry);
  };
  for (const [providerId, provider] of Object.entries(catalog || {})) {
    for (const [modelId, model] of Object.entries(provider?.models || {})) {
      const entry = { providerId, modelId, model };
      add(modelId, entry);
      add(model?.id, entry);
      add(model?.name, entry);
    }
  }
  return index;
}

function matchModelsDev(index, id, displayName, upstreamName) {
  for (const candidate of [upstreamName, id, displayName]) {
    if (!candidate) continue;
    const hits = index.get(normName(candidate));
    if (hits && hits.length) {
      const preferred = hits.find((h) => /anthropic|openai|deepseek|google|alibaba|meta|xai|x-ai|mistral|moonshot/i.test(h.providerId));
      return preferred || hits[0];
    }
  }
  return null;
}

// ---------- thu thập ----------
console.log("1/4 Lấy danh sách model từ MộtAPI…");
const freeList = freeKey
  ? (await getJson(`${MOTAPIS_BASE}/models`, freeKey)).data.map((m) => m.id).filter((id) => !NON_CHAT_RE.test(id))
  : [];
const freeSet = new Set(freeList);
let fullList = freeList.slice();
if (paidKey) {
  try {
    const paid = await getJson(`${MOTAPIS_BASE}/models`, paidKey);
    const ids = paid.data.map((m) => m.id).filter((id) => !NON_CHAT_RE.test(id));
    fullList = Array.from(new Set([...ids, ...freeList]));
  } catch (e) {
    console.log("   không lấy được danh sách bằng khoá trả phí:", e.message);
  }
}

console.log("2/4 Lấy bảng giá models.js…");
let priceRows = [];
try {
  const res = await fetch(MODELS_JS, { signal: AbortSignal.timeout(60000) });
  priceRows = parseModelsJs(await res.text());
} catch (e) {
  console.log("   không lấy được models.js:", e.message);
}
const priceIndex = new Map(priceRows.map((r) => [normName(r.name), r]));
// Bảng giá liệt kê cả model trả phí mà /models không trả về: đưa vào danh mục
// ở trạng thái chưa xác minh, để giao diện biết mà khoá chọn.
const quotedIds = priceRows.map((r) => r.name).filter((id) => typeof id === "string" && !NON_CHAT_RE.test(id));
fullList = Array.from(new Set([...fullList, ...quotedIds]));

console.log("3/4 Lấy catalog models.dev…");
let devIndex = new Map();
try {
  devIndex = buildModelsDevIndex(await getJson(MODELS_DEV));
} catch (e) {
  console.log("   không lấy được models.dev:", e.message);
}

const now = new Date().toISOString();
const models = [];
const targetIds = onlyIds ? fullList.filter((id) => onlyIds.has(id)) : fullList;

console.log(
  `4/4 Kiểm tra ${targetIds.length}/${fullList.length} model (free: ${freeSet.size})${freeOnly ? " — chỉ gọi thử model free" : ""}…`
);
let i = 0;
for (const id of targetIds) {
  i += 1;
  const isFree = freeSet.has(id);
  const priceRow = priceIndex.get(normName(id));
  const devHit = matchModelsDev(devIndex, id, priceRow?.name, null);
  const entry = {
    id,
    displayName: priceRow?.name || null,
    provider: priceRow?.provider || devHit?.providerId || null,
    tier: priceRow?.tier || null,
    free: isFree,
    endpoints: null,
    priceIn: priceRow?.in ?? null,
    priceOut: priceRow?.out ?? null,
    priceSource: priceRow ? "motapis-models.js" : null,
    contextTokens: devHit?.model?.limit?.context ?? null,
    maxOutputTokens: devHit?.model?.limit?.output ?? null,
    baselinePromptTokens: null,
    specSource: devHit ? `models.dev:${devHit.providerId}/${devHit.modelId}` : null,
    upstreamModel: null,
    available: null,
    lastError: null,
    checkedAt: null,
  };

  const shouldProbe = isFree || probePaid;
  if (shouldProbe) {
    if (i > 1) await sleep(DELAY_MS);
    const key = isFree ? freeKey || paidKey : paidKey;
    console.log(`  [${i}/${targetIds.length}] ${id} (${isFree ? "free" : "paid"})`);
    const ping = await chatWithRetry({
      model: id,
      messages: [{ role: "user", content: "ping" }],
      maxTokens: 8,
      timeout: PING_TIMEOUT,
      key,
    });
    entry.checkedAt = new Date().toISOString();
    entry.available = ping.status === 200 && !ping.errorCode;
    entry.upstreamModel = ping.status === 200 ? ping.model || id : null;
    entry.baselinePromptTokens =
      ping.usage && Number.isFinite(Number(ping.usage.prompt_tokens)) ? Number(ping.usage.prompt_tokens) : null;
    entry.lastError = entry.available ? null : `${ping.status} ${ping.errorCode || ""} ${ping.errorDetail || ""}`.trim().slice(0, 200);
    console.log(`      -> ${ping.status} ${entry.available ? "OK" : "LỖI"} ${entry.upstreamModel || ""} (${ping.ms}ms)`);

    // Model đổi tên ngầm khi chạy thật: tra lại catalog theo tên thật.
    if (entry.available && entry.upstreamModel && normName(entry.upstreamModel) !== normName(id)) {
      const realHit = matchModelsDev(devIndex, entry.upstreamModel, null, entry.upstreamModel);
      if (realHit) {
        entry.contextTokens = realHit.model?.limit?.context ?? entry.contextTokens;
        entry.maxOutputTokens = realHit.model?.limit?.output ?? entry.maxOutputTokens;
        entry.specSource = `models.dev:${realHit.providerId}/${realHit.modelId} (theo tên thật)`;
      }
    }
  }
  models.push(entry);
}

models.sort((a, b) => Number(b.free) - Number(a.free) || a.id.localeCompare(b.id));

// Chạy --only thì chỉ thay các model vừa kiểm, giữ nguyên phần còn lại của file cũ.
let merged = models;
if (onlyIds && fs.existsSync(OUT_FILE)) {
  try {
    const previous = JSON.parse(fs.readFileSync(OUT_FILE, "utf8"));
    const fresh = new Map(models.map((m) => [m.id, m]));
    for (const old of previous.models || []) if (!fresh.has(old.id)) fresh.set(old.id, old);
    merged = [...fresh.values()].sort((a, b) => Number(b.free) - Number(a.free) || a.id.localeCompare(b.id));
  } catch {}
}

const output = {
  generatedAt: now,
  sources: { motapisModels: `${MOTAPIS_BASE}/models`, modelsJs: MODELS_JS, modelsDev: MODELS_DEV },
  counts: {
    total: merged.length,
    free: merged.filter((m) => m.free).length,
    paid: merged.filter((m) => !m.free).length,
    probed: merged.filter((m) => m.checkedAt).length,
    available: merged.filter((m) => m.available === true).length,
  },
  models: merged,
};

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2) + "\n");
console.log(`\nĐã ghi ${OUT_FILE}`);
console.log(JSON.stringify(output.counts));
