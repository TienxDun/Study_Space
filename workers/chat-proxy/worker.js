/**
 * Chat Proxy — Cloudflare Workers AI (free, không key) + hãng ngoài nhập key ở admin.
 * Dạng module: mỗi hãng 1 cục riêng, chung 1 chân cắm runProvider.
 * Key hãng ngoài nằm ở KV (cfg:providers), nhập ở trang admin, không sửa code.
 *
 * Deploy: Dashboard -> Workers & Pages -> mở Worker cũ -> Edit code ->
 * dán đè file này -> Save and deploy.
 *
 * Secrets (Settings -> Variables, loại Secret):
 *   ALLOWED_ORIGINS  = domain web, vd "https://zenstudy.space,http://localhost:3001"
 *   ADMIN_TOKEN      = xem /status, quản lý /models + /providers
 *   FIREBASE_PROJECT_ID = "zenspace-d10m13y26" (để kiểm vé đăng nhập, loại Text là được)
 *
 * Luồng /chat: bắt buộc vé Firebase (header Authorization: Bearer <idToken>)
 * -> đúng người mới cho qua -> mỗi người 30 câu/ngày (sổ user:{uid}:{ngày}).
 *
 * Bindings (Settings -> Bindings -> Add):
 *   AI: Workers AI -> tên biến đúng "AI"
 *   KV: namespace "CHAT_QUOTA" -> tên biến đúng "CHAT_QUOTA"
 *
 *  POST /chat   { text, history?, images?[{name,data}], files?[{name,text}] } -> { text, provider, model }
 *  GET  /status?token=... -> lượt dùng + chain
 *  GET  /models?token=... -> list CF + hãng ngoài + chain + câu hướng dẫn
 *  POST /models?token=... -> lưu chain, câu hướng dẫn, nhiệt độ, hãng
 *  POST /providers/check?token=... { type, baseUrl, apiKey } -> thử key, trả list model
 *  GET  /health -> { ok:true }
 *
 * Cách chạy: khách hỏi -> chạy theo thứ tự chain do admin xếp.
 * Chỉ lấy chữ về (text), không xin ảnh/nhạc.
 */

// Máy Workers AI được duyệt (mới + khỏe + free, không đòi thẻ).
// label + context + giá + điểm mạnh để trang admin hiện cho dễ chọn.
const CF_MODELS = {
  "qwen3-30b": { id: "@cf/qwen/qwen3-30b-a3b-fp8", label: "Qwen3 30B — khỏe + rẻ", estPerDay: 500, context: 32768, price: "vào $0.05 / ra $0.34", good: "Rẻ nhất lúc hỏi, làm việc lặt vặt tốt" },
  "sea-lion": { id: "@cf/aisingapore/gemma-sea-lion-v4-27b-it", label: "Sea-Lion 27B — giỏi tiếng Việt", estPerDay: 175, context: 128000, price: "vào $0.35 / ra $0.56", good: "Tiếng Việt tốt nhất, nhớ 128k" },
  "gpt-oss-20b": { id: "@cf/openai/gpt-oss-20b", label: "GPT-OSS 20B (OpenAI mở)", estPerDay: 315, context: 128000, price: "vào $0.20 / ra $0.30", good: "Nhanh nhẹ, có suy luận, dự phòng tốt" },
  "llama-70b": { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", label: "Llama 70B — khỏe nhất, tốn nhất", estPerDay: 77, context: 24000, price: "vào $0.29 / ra $2.25", good: "Khôn nhất câu khó, gọi hàm được, tốn nhất" },
};
const DEFAULT_CF = "qwen3-30b";
const CFG_TTL_MS = 60 * 1000; // nhớ cấu hình admin trong 60s để đỡ đọc KV
const MAX_CHAIN = 5; // thứ tự tối đa 5 đường gọi
const MAX_PROVIDERS = 10; // tối đa 10 hãng ngoài
const CF_NEURON_LIMIT = 10000; // free Cloudflare/ngày
const CF_COOLDOWN_MS = 10 * 60 * 1000; // Workers AI kẹt thì nghỉ 10 phút

// Hãng ngoài: OpenAI (Groq/OpenRouter/OpenAI) chung 1 cách gọi,
// Gemini (AI Studio) cách gọi riêng (X-goog-api-key + contents).
// Admin chọn loại -> tự điền địa chỉ, chỉ cần dán key.
const PROVIDER_PRESETS = {
  groq: { label: "Groq", baseUrl: "https://api.groq.com/openai/v1" },
  openrouter: { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" },
  openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  gemini: { label: "Google Gemini (AI Studio)", baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
  custom: { label: "Tự nhập địa chỉ", baseUrl: "" },
};
const isGeminiBase = (baseUrl) => String(baseUrl || "").includes("generativelanguage.googleapis.com");
// Giá neurons chính thức của Cloudflare (tính trên 1M tokens, bảng giá 10/2026).
// Dùng để ước tính lượt dùng thật (Cloudflare tính theo neurons, không theo số câu).
const NEURON_RATES = {
  "qwen3-30b": { in: 4625, out: 30475 },
  "sea-lion": { in: 31876, out: 50488 },
  "gpt-oss-20b": { in: 18182, out: 27273 },
  "llama-70b": { in: 26668, out: 204805 },
};
// ---------- Sổ đếm quota: ưu tiên D1, tự lùi về KV nếu chưa gắn D1 ----------
// Quy ước key:
//   user:{uid}:{yyyy-mm-dd}  -> số câu của 1 người trong ngày
//   cf:rpd:{yyyy-mm-dd}      -> số lượt Workers AI trong ngày (toàn hệ thống)
//   cfn:rpd:{yyyy-mm-dd}     -> số neurons Workers AI trong ngày (toàn hệ thống)
// Lý do chuyển: KV free chỉ 1.000 ghi/ngày (~330 câu) và ghi không nguyên tử;
// D1 free cho 100.000 dòng ghi/ngày và mỗi câu chỉ tốn 2 dòng ghi.
function d1(env) {
  return env && env.DB && typeof env.DB.prepare === "function" ? env.DB : null;
}
const RE_USER_COUNT = /^user:(.+):(\d{4}-\d{2}-\d{2})$/;
const RE_CF_REQ = /^cf:rpd:(\d{4}-\d{2}-\d{2})$/;
const RE_CF_NEURONS = /^cfn:rpd:(\d{4}-\d{2}-\d{2})$/;

async function addFloat(env, key, val, ttlSeconds) {
  const db = d1(env);
  if (db) {
    try {
      const m = RE_CF_NEURONS.exec(key);
      if (m) {
        await db.prepare(
          "INSERT INTO cf_usage (day, requests, neurons) VALUES (?, 0, ?) ON CONFLICT(day) DO UPDATE SET neurons = neurons + ?"
        ).bind(m[1], val, val).run();
        return 0;
      }
    } catch { /* D1 lỗi -> dùng KV dự phòng bên dưới */ }
  }
  const store = kv(env);
  if (!store) return 0;
  const cur = (Number(await store.get(key).catch(() => 0)) || 0) + val;
  const rounded = Math.round(cur * 100) / 100;
  await store.put(key, String(rounded), { expirationTtl: Math.max(ttlSeconds, 60) }).catch(() => {});
  return rounded;
}
// 1 câu tốn bao nhiêu neurons ≈ số ký tự vào/ra ÷ 4 ra tokens rồi nhân giá.
// Chỉ là ước tính (không thay được số của dashboard Cloudflare), nhưng đúng
// đơn vị hơn nhiều so với đếm số câu (câu dài tốn gấp chục lần câu ngắn).
async function noteNeurons(env, day, cfKey, messages, outText) {
  const rate = NEURON_RATES[cfKey];
  if (!rate) return 0;
  let inChars = 0;
  for (const m of Array.isArray(messages) ? messages : []) {
    const c = m && typeof m.content === "string" ? m.content : "";
    inChars += c.length;
  }
  const neurons = (inChars / 4 / 1e6) * rate.in + (String(outText || "").length / 4 / 1e6) * rate.out;
  return addFloat(env, `cfn:rpd:${day}`, neurons, 86400 + 3600);
}

const MAX_TEXT = 8000;
const MAX_HISTORY = 10;
const MAX_IMAGES = 3; // tối đa 3 ảnh một câu
const MAX_IMAGE_DATA = 10 * 1024 * 1024; // chữ dài dataURL tối đa ~10M ký tự (ảnh gốc ~7MB)
const MAX_FILES = 3; // tối đa 3 file chữ một câu
const MAX_FILE_TEXT = 20000; // chữ trong 1 file tối đa 20000 ký tự
const CERT_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

// Hướng dẫn chung cho trợ lý học tập (admin sửa ở web, nhớ ở KV).
// Rút ra từ lỗi thực tế: ví dụ cũ (Twitter), bịa ví dụ, thiếu cấu trúc.
const DEFAULT_SYSTEM_VN = [
  "Bạn là trợ lý học tập, trả lời bằng tiếng Việt, từ ngữ dễ hiểu.",
  "1. Ví dụ phải còn đúng ở hiện tại (tên công ty, sản phẩm đã đổi tên thì dùng tên mới).",
  "2. Không bịa ví dụ cụ thể (tên API, số liệu, ngày tháng): không chắc thì nói chung chung hoặc ghi rõ là chưa kiểm chứng.",
  "3. Trả lời có cấu trúc: định nghĩa gọn 1-2 câu trước, rồi mới liệt kê, cuối có câu chốt hoặc gợi ý bước tiếp theo.",
  "4. Câu nào không chắc thì nói rõ là chưa chắc, đừng khẳng định.",
].join("\n");
const DEFAULT_GEN = { temperature: 0.7, max_tokens: 2048 };

const mem = { cfCooldownUntil: 0, lastError: null, certAt: 0, certs: {} };

function pacificDay() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}
function currentMinute() {
  return Math.floor(Date.now() / 60000);
}
function kv(env) {
  return env.CHAT_QUOTA && typeof env.CHAT_QUOTA.get === "function" ? env.CHAT_QUOTA : null;
}
async function getCount(env, key) {
  const db = d1(env);
  if (db) {
    try {
      let m = RE_USER_COUNT.exec(key);
      if (m) {
        const row = await db.prepare("SELECT count FROM chat_usage WHERE uid = ? AND day = ?").bind(m[1], m[2]).first();
        return Number(row && row.count) || 0;
      }
      m = RE_CF_REQ.exec(key);
      if (m) {
        const row = await db.prepare("SELECT requests FROM cf_usage WHERE day = ?").bind(m[1]).first();
        return Number(row && row.requests) || 0;
      }
      m = RE_CF_NEURONS.exec(key);
      if (m) {
        const row = await db.prepare("SELECT neurons FROM cf_usage WHERE day = ?").bind(m[1]).first();
        return Number(row && row.neurons) || 0;
      }
    } catch { /* D1 lỗi -> dùng KV dự phòng bên dưới */ }
  }
  const store = kv(env);
  if (store) return Number((await store.get(key).catch(() => null)) || 0);
  return 0;
}
async function incrCount(env, key, ttlSeconds) {
  const db = d1(env);
  if (db) {
    try {
      let m = RE_USER_COUNT.exec(key);
      if (m) {
        await db.prepare(
          "INSERT INTO chat_usage (uid, day, count) VALUES (?, ?, 1) ON CONFLICT(uid, day) DO UPDATE SET count = count + 1"
        ).bind(m[1], m[2]).run();
        return 0;
      }
      m = RE_CF_REQ.exec(key);
      if (m) {
        await db.prepare(
          "INSERT INTO cf_usage (day, requests, neurons) VALUES (?, 1, 0) ON CONFLICT(day) DO UPDATE SET requests = requests + 1"
        ).bind(m[1]).run();
        return 0;
      }
    } catch { /* D1 lỗi -> dùng KV dự phòng bên dưới */ }
  }
  const store = kv(env);
  if (!store) return 0;
  const cur = (Number(await store.get(key).catch(() => 0)) || 0) + 1;
  await store.put(key, String(cur), { expirationTtl: Math.max(ttlSeconds, 60) }).catch(() => {});
  return cur;
}

// Giữ min trong ctx để sau này hãng mới cần giới hạn theo phút thì dùng ngay.

// Model mặc định do admin chọn (sổ chung KV), nhớ tạm 60s để đỡ đọc KV.
async function getCfModel(env) {
  const now = Date.now();
  if (mem.cfgModel && now - (mem.cfgAt || 0) < CFG_TTL_MS) return mem.cfgModel;
  let saved = null;
  if (kv(env)) saved = await kv(env).get("cfg:cfModel").catch(() => null);
  mem.cfgModel = CF_MODELS[saved] ? saved : DEFAULT_CF;
  mem.cfgAt = now;
  return mem.cfgModel;
}
const CF_CATALOG_VERIFIED = "2026-10-14"; // Workers AI không có API danh sách chính thức (cần token riêng) nên giữ list chọn tay, kiểm lại theo docs định kỳ.
function cfModelList() {
  return Object.entries(CF_MODELS).map(([key, m]) => ({ key, id: m.id, label: m.label, estPerDay: m.estPerDay, context: m.context, price: m.price, good: m.good, input: "chữ", output: "chữ", source: "curated", verified: CF_CATALOG_VERIFIED }));
}

// ---------- Hãng ngoài nhập ở admin (key nằm ở KV, không sửa code) ----------
// Mỗi hãng: { id, type, label, baseUrl, apiKey, enabled }.
// id do admin đặt, vd "groq-1". type để tự điền địa chỉ: groq/openrouter/openai/custom.
function cleanProvider(p) {
  if (!p || typeof p !== "object") return null;
  const id = String(p.id || "").trim().slice(0, 40);
  if (!/^[a-z0-9][a-z0-9-_]*$/i.test(id)) return null;
  const type = PROVIDER_PRESETS[p.type] ? p.type : "custom";
  const baseUrl = String(p.baseUrl || PROVIDER_PRESETS[type].baseUrl || "").trim().replace(/\/$/, "").slice(0, 200);
  if (!/^https:\/\/.+/.test(baseUrl)) return null;
  const apiKey = String(p.apiKey || "").trim().slice(0, 500);
  if (!apiKey) return null;
  return { id, type, label: String(p.label || PROVIDER_PRESETS[type].label || id).slice(0, 60), baseUrl, apiKey, enabled: p.enabled !== false };
}
async function getProviders(env) {
  const now = Date.now();
  if (mem.providers && now - (mem.providersAt || 0) < CFG_TTL_MS) return mem.providers;
  let list = [];
  if (kv(env)) {
    try {
      const raw = await kv(env).get("cfg:providers").catch(() => null);
      const arr = raw ? JSON.parse(raw) : null;
      if (Array.isArray(arr)) list = arr.map(cleanProvider).filter(Boolean).slice(0, MAX_PROVIDERS);
    } catch { /* bỏ qua */ }
  }
  // Key cũ ở Secrets tự chuyển vào KV 1 lần để admin thấy (không xóa Secrets).
  if (list.length === 0 && env.GROQ_API_KEY) {
    const legacy = cleanProvider({ id: "groq-1", type: "groq", label: "Groq (cũ)", baseUrl: PROVIDER_PRESETS.groq.baseUrl, apiKey: env.GROQ_API_KEY });
    if (legacy) list = [legacy];
  }
  mem.providers = list;
  mem.providersAt = now;
  return list;
}
function maskProviders(list) {
  return list.map((p) => ({ ...p, apiKey: p.apiKey ? `***${p.apiKey.slice(-4)}` : "" }));
}
async function getPrompt(env) {
  const now = Date.now();
  if (mem.prompt && now - (mem.promptAt || 0) < CFG_TTL_MS) return mem.prompt;
  let saved = null;
  if (kv(env)) saved = await kv(env).get("cfg:prompt").catch(() => null);
  mem.prompt = typeof saved === "string" && saved.trim() ? saved.slice(0, 4000) : DEFAULT_SYSTEM_VN;
  mem.promptAt = now;
  return mem.prompt;
}
async function getGen(env) {
  const now = Date.now();
  if (mem.gen && now - (mem.genAt || 0) < CFG_TTL_MS) return mem.gen;
  let saved = null;
  if (kv(env)) {
    try {
      const raw = await kv(env).get("cfg:gen").catch(() => null);
      saved = raw ? JSON.parse(raw) : null;
    } catch { saved = null; }
  }
  const t = Number(saved && saved.temperature);
  const m = Number(saved && saved.max_tokens);
  mem.gen = {
    temperature: Number.isFinite(t) ? Math.min(2, Math.max(0, t)) : DEFAULT_GEN.temperature,
    max_tokens: Number.isFinite(m) ? Math.min(8000, Math.max(256, Math.floor(m))) : DEFAULT_GEN.max_tokens,
  };
  mem.genAt = now;
  return mem.gen;
}
// Gọi Gemini AI Studio: dịch messages kiểu OpenAI sang contents kiểu Google.
// messages: [{ role: system/user/assistant, content }] -> { systemInstruction, contents }.
async function callGemini(baseUrl, apiKey, modelId, messages, gen, images) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const base = String(baseUrl || "").replace(/\/$/, "");
    const mid = String(modelId || "").replace(/^models\//, "");
    const systemTexts = [];
    const contents = [];
    const imgs = Array.isArray(images) ? images : [];
    const list = Array.isArray(messages) ? messages : [];
    list.forEach((m, idx) => {
      const isLast = idx === list.length - 1;
      const text = String(m?.content || "").slice(0, 8000);
      if (m?.role === "system") {
        if (text) systemTexts.push(text);
        return;
      }
      // Giữ lại câu hỏi mới dù chữ trống (hỏi bằng ảnh không chữ).
      if (!text && !isLast) return;
      contents.push({ role: m?.role === "assistant" || m?.role === "model" ? "model" : "user", parts: text ? [{ text }] : [] });
    });
    // Ảnh đính vào câu hỏi cuối của user.
    for (let i = contents.length - 1; i >= 0; i--) {
      if (contents[i].role === "user") {
        for (const im of imgs) contents[i].parts.push({ inlineData: { mimeType: im.mime, data: im.data } });
        break;
      }
    }
    if (contents.length === 0) return { ok: false, error: "Thiếu câu hỏi." };
    const body = { contents, generationConfig: { temperature: gen.temperature, maxOutputTokens: gen.max_tokens } };
    if (systemTexts.length) body.systemInstruction = { parts: [{ text: systemTexts.join("\n") }] };
    const r = await fetch(`${base}/models/${encodeURIComponent(mid)}:generateContent`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
      body: JSON.stringify(body),
    });
    const bodyText = await r.text().catch(() => "");
    if (!r.ok) return { ok: false, status: r.status, error: bodyText.slice(0, 300) };
    let data = null;
    try { data = JSON.parse(bodyText); } catch { data = null; }
    const parts = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts) ? parts.map((p) => String(p?.text || "")).join("").trim() : "";
    if (!text) return { ok: false, status: r.status, error: "Gemini trả về rỗng." };
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e).slice(0, 300) };
  } finally {
    clearTimeout(timer);
  }
}
// Gọi hãng kiểu OpenAI: Groq/OpenRouter/OpenAI chung 1 cách.
async function callOpenAICompatible(baseUrl, apiKey, modelId, messages, gen, images) {
  if (isGeminiBase(baseUrl)) return callGemini(baseUrl, apiKey, modelId, messages, gen, images);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const imgs = Array.isArray(images) ? images : [];
    let outMessages = messages;
    if (imgs.length > 0) {
      outMessages = (Array.isArray(messages) ? messages : []).map((m, idx, arr) => {
        if (idx !== arr.length - 1 || m?.role === "system") return m;
        return {
          role: "user",
          content: [
            ...(String(m?.content || "") ? [{ type: "text", text: String(m.content).slice(0, 8000) }] : []),
            ...imgs.map((im) => ({ type: "image_url", image_url: { url: `data:${im.mime};base64,${im.data}` } })),
          ],
        };
      });
    }
    const r = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: modelId, messages: outMessages, temperature: gen.temperature, max_tokens: gen.max_tokens }),
    });
    const bodyText = await r.text().catch(() => "");
    if (!r.ok) return { ok: false, status: r.status, error: bodyText.slice(0, 300) };
    let data = null;
    try { data = JSON.parse(bodyText); } catch { data = null; }
    const text = String(data?.choices?.[0]?.message?.content || "").trim();
    if (!text) return { ok: false, status: r.status, error: "Hãng ngoài trả về rỗng." };
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e).slice(0, 300) };
  } finally {
    clearTimeout(timer);
  }
}
// Hỏi hãng: key này dùng được model nào. Gemini list kiểu riêng, còn lại kiểu OpenAI.
async function fetchOpenAIModels(baseUrl, apiKey) {
  if (isGeminiBase(baseUrl)) return fetchGeminiModels(baseUrl, apiKey);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(`${baseUrl}/models`, {
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const bodyText = await r.text().catch(() => "");
    if (!r.ok) throw new Error(bodyText.slice(0, 200) || `HTTP ${r.status}`);
    let j = null;
    try { j = JSON.parse(bodyText); } catch { j = null; }
    const arr = Array.isArray(j?.data) ? j.data : [];
    const NONCHAT = /whisper|guard|safeguard|orpheus|tts|transcribe|embed/i;
    // Model vẽ ảnh/video đọc chữ không chat được, giữ lại để thấy nhưng gắn nhãn ảnh.
    const IMAGE = /image|img|flux|dall|midjourney|imagine|draw|paint|photo|video|veo|kling|sora|runway/i;
    return arr
      .filter((m) => m && typeof m.id === "string" && !NONCHAT.test(m.id))
      .map((m) => ({
        id: m.id,
        context: Number(m.context_length || m.context_window || m.max_context) || 0,
        ownedBy: String(m.owned_by || m.ownedBy || m.owner || "").slice(0, 40),
        created: Number(m.created) || 0,
        kind: IMAGE.test(m.id) ? "image" : "chat",
      }))
      .sort((a, b) => b.created - a.created)
      .slice(0, 200);
  } finally {
    clearTimeout(timer);
  }
}
// List model Gemini: GET {base}/models, key ở header X-goog-api-key.
async function fetchGeminiModels(baseUrl, apiKey) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const base = String(baseUrl || "").replace(/\/$/, "");
    const r = await fetch(`${base}/models?pageSize=200`, {
      signal: ctrl.signal,
      headers: { "X-goog-api-key": apiKey },
    });
    const bodyText = await r.text().catch(() => "");
    if (!r.ok) throw new Error(bodyText.slice(0, 200) || `HTTP ${r.status}`);
    let j = null;
    try { j = JSON.parse(bodyText); } catch { j = null; }
    const arr = Array.isArray(j?.models) ? j.models : [];
    const IMAGE = /image|img|flux|dall|midjourney|imagine|draw|paint|photo|video|veo|kling|sora|runway|tts|whisper|transcribe|embed/i;
    return arr
      .filter((m) => {
        if (!m || typeof m.name !== "string") return false;
        const methods = Array.isArray(m.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
        return methods.includes("generateContent");
      })
      .map((m) => ({
        id: String(m.name).replace(/^models\//, ""),
        context: Number(m.inputTokenLimit) || 0,
        ownedBy: "google",
        created: 0,
        kind: IMAGE.test(String(m.name)) ? "image" : "chat",
        label: String(m.displayName || "").slice(0, 60),
      }))
      .slice(0, 200);
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Kiểm vé Firebase (không cần server riêng) ----------
// Vé là JWT RS256 do Google ký. Worker tải chứng thư công khai của Google,
// kiểm chữ ký + đúng project + còn hạn -> trả về uid, sai trả null.
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
  const spkiIndex = first.tag === 0xa0 ? 6 : 5; // có [0]version thì SPKI là con thứ 7
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
  // Trả về { uid } hoặc { code } để /status hiện lý do (không lộ nội dung vé).
  const shape = String(token || "").split(".").map((x) => x.length);
  const fail = (code) => ({ code, shape });
  try {
    const pid = String(env.FIREBASE_PROJECT_ID || "").trim();
    if (!pid) return fail("NO_PID");
    if (!token || shape.length !== 3) return fail("BAD_FORMAT");
    const [h, p, s] = token.split(".");
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
    if (!payload.sub || typeof payload.sub !== "string" || payload.sub.length > 128) return fail("NO_SUB");
    let certs;
    try {
      certs = await getGoogleCerts();
    } catch {
      return fail("CERT_FETCH");
    }
    let pem = certs[header.kid];
    if (!pem) {
      mem.certAt = 0; // khóa mới xoay vòng -> tải lại 1 lần
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
        "spki", spki,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
      );
    } catch {
      return fail("IMPORT_KEY");
    }
    let ok = false;
    try {
      ok = await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5", key, b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`)
      );
    } catch {
      return fail("VERIFY_CALL");
    }
    return ok ? { uid: payload.sub } : fail("BAD_SIG");
  } catch {
    return fail("EXCEPTION");
  }
}
function toMessages(text, history, systemPrompt) {
  const msgs = [{ role: "system", content: systemPrompt || DEFAULT_SYSTEM_VN }];
  for (const m of Array.isArray(history) ? history.slice(-MAX_HISTORY) : []) {
    if (m && m.role && m.text) {
      msgs.push({ role: m.role === "system" ? "system" : (m.role === "model" || m.role === "assistant" ? "assistant" : "user"), content: String(m.text).slice(0, MAX_TEXT) });
    }
  }
  msgs.push({ role: "user", content: text });
  return msgs;
}

// Đọc ảnh + file chữ gửi kèm. Trả { images, files } hoặc { error } để báo ngay.
// File chữ nối thẳng vào câu hỏi nên hãng nào cũng đọc được.
// Ảnh chỉ hãng có mắt đọc được (Gemini, hãng ngoài vision), Cloudflare free thì không.
function parseAttachments(body) {
  const images = [];
  const files = [];
  if (body.images !== undefined) {
    if (!Array.isArray(body.images)) return { error: "Ảnh gửi kèm phải là danh sách." };
    if (body.images.length > MAX_IMAGES) return { error: `Tối đa ${MAX_IMAGES} ảnh một câu nhé.` };
    for (const im of body.images) {
      const data = String((im && im.data) || "");
      const name = String((im && im.name) || "ảnh").slice(0, 80);
      const m = /^data:(image\/(png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(data);
      if (!m) return { error: `Ảnh ${name} không đúng dạng png/jpg/webp.` };
      if (data.length > MAX_IMAGE_DATA) return { error: `Ảnh ${name} quá 7MB, gửi ảnh nhỏ hơn nhé.` };
      images.push({ name, mime: m[1], data: m[3] });
    }
  }
  if (body.files !== undefined) {
    if (!Array.isArray(body.files)) return { error: "File gửi kèm phải là danh sách." };
    if (body.files.length > MAX_FILES) return { error: `Tối đa ${MAX_FILES} file một câu nhé.` };
    for (const f of body.files) {
      const text = String((f && f.text) || "");
      const name = String((f && f.name) || "file").slice(0, 80);
      if (!text.trim()) return { error: `File ${name} rỗng.` };
      if (text.length > MAX_FILE_TEXT) return { error: `File ${name} dài quá, copy từng phần dán vào ô chat nhé.` };
      files.push({ name, text: text.slice(0, MAX_FILE_TEXT) });
    }
  }
  return { images, files };
}

// Đường Cloudflare: chạy ngay trong nhà Cloudflare, không cần key ngoài.
// Model cũ trả { response }, model mới (Sea-Lion...) trả kiểu OpenAI { choices[0].message.content }.
async function callWorkersAI(env, modelKey, messages) {
  if (!env.AI || typeof env.AI.run !== "function") {
    return { ok: false, error: "Worker chưa gắn AI binding (Settings -> Bindings -> AI)." };
  }
  try {
    const out = await env.AI.run(CF_MODELS[modelKey].id, { messages });
    const fromChoices = out && Array.isArray(out.choices) ? out.choices[0]?.message?.content : "";
    const text = String(out?.response || fromChoices || out?.result || out?.text || out?.output || "").trim();
    if (!text) return { ok: false, error: `Workers AI trả về rỗng (${CF_MODELS[modelKey].id}).` };
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e).slice(0, 300) };
  }
}

// Thứ tự đường gọi do admin xếp (sổ chung KV). Mặc định: Cloudflare trước.
function defaultChain() {
  return [
    { provider: "cf", modelId: DEFAULT_CF },
    { provider: "cf", modelId: "sea-lion" },
  ];
}
function validChainEntry(e, providers) {
  if (!e || typeof e !== "object") return null;
  if (e.provider === "cf" && CF_MODELS[e.modelId]) return { provider: "cf", modelId: e.modelId };
  // Hãng ngoài: provider là id hãng (vd groq-1), modelId là tên model.
  if (typeof e.provider === "string" && typeof e.modelId === "string" && e.modelId.length > 0 && e.modelId.length <= 200) {
    const list = providers || mem.providers || [];
    if (list.some((p) => p.id === e.provider && p.enabled !== false)) return { provider: e.provider, modelId: e.modelId };
  }
  return null;
}
async function getChain(env) {
  const now = Date.now();
  const providers = await getProviders(env);
  if (mem.chain && now - (mem.chainAt || 0) < CFG_TTL_MS) return mem.chain;
  let list = null;
  if (kv(env)) {
    try {
      const raw = await kv(env).get("cfg:chain").catch(() => null);
      const arr = raw ? JSON.parse(raw) : null;
      if (Array.isArray(arr) && arr.length) {
        const clean = arr.map((e) => validChainEntry(e, providers)).filter(Boolean).slice(0, MAX_CHAIN);
        if (clean.length) list = clean;
      }
    } catch { /* bỏ qua */ }
  }
  mem.chain = list || defaultChain();
  mem.chainAt = now;
  return mem.chain;
}

// ---------- Providers: mỗi hãng 1 cục riêng, chung 1 chân cắm ----------
// cf: Cloudflare free, không key. Hãng ngoài: đọc key ở KV, gọi kiểu OpenAI.
// Thêm hãng mới không sửa code: nhập ở admin là xong.
const PROVIDERS = {
  cf: {
    id: "workers-ai",
    async prepare(env) {
      if (!env.AI || typeof env.AI.run !== "function") {
        return { ok: false, signal: "fatal", status: 500, error: "Worker chưa gắn AI binding (Settings -> Bindings -> AI)." };
      }
      if (Date.now() < mem.cfCooldownUntil) return { ok: false, signal: "skip" };
      return { ok: true };
    },
    send(env, ctx, modelId, messages) {
      return callWorkersAI(env, modelId, messages);
    },
    async countLate(env, ctx, extra) {
      await incrCount(env, `cf:rpd:${ctx.day}`, 86400 + 3600);
      if (extra) await noteNeurons(env, ctx.day, extra.modelId, extra.messages, extra.text);
    },
    noteFail(r) {
      mem.lastError = { time: new Date().toISOString(), error: r.error };
      mem.cfCooldownUntil = Date.now() + CF_COOLDOWN_MS; // kẹt quota/lỗi -> nghỉ 10 phút
    },
  },
  // Hãng ngoài nhập key ở admin. providerId là id hãng (vd groq-1).
  ext: {
    id: "ext",
    async prepare(env, ctx, providerId) {
      const list = await getProviders(env);
      const p = list.find((x) => x.id === providerId && x.enabled !== false);
      if (!p) return { ok: false, signal: "skip" };
      if (!p.apiKey) return { ok: false, signal: "noKey" };
      return { ok: true, provider: p };
    },
    async send(env, ctx, modelId, messages, providerId, images) {
      const list = await getProviders(env);
      const p = list.find((x) => x.id === providerId);
      if (!p) return { ok: false, error: "Hãng đã bị xóa." };
      const gen = await getGen(env);
      let r = await callOpenAICompatible(p.baseUrl, p.apiKey, modelId, messages, gen, images);
      if (!r.ok && r.status === 429) {
        await new Promise((res) => setTimeout(res, 2000));
        r = await callOpenAICompatible(p.baseUrl, p.apiKey, modelId, messages, gen, images);
      }
      return r;
    },
  },
};

// Chạy 1 đường trong chain. a = { provider, modelId }.
// provider "cf" là Cloudflare (chỉ đọc chữ), còn lại là id hãng ngoài (vd groq-1).
// images: câu có ảnh mà đường này không đọc được thì báo noVision, không tự đổi đường.
async function runChainEntry(a, env, ctx, messages, images) {
  const hasImages = Array.isArray(images) && images.length > 0;
  if (a.provider === "cf") {
    if (hasImages) return { noVision: true, provider: a.provider, model: a.modelId };
    const p = PROVIDERS.cf;
    const pre = await p.prepare(env, ctx);
    if (!pre.ok) {
      const out = { [pre.signal]: true };
      if (pre.status) out.status = pre.status;
      if (pre.error) out.error = pre.error;
      return out;
    }
    const r = await p.send(env, ctx, a.modelId, messages);
    if (r.ok) {
      if (p.countLate) await p.countLate(env, ctx, { modelId: a.modelId, messages, text: r.text });
      return { text: r.text, provider: p.id, model: a.modelId };
    }
    if (p.noteFail) p.noteFail(r);
    return { error: r.error };
  }
  const p = PROVIDERS.ext;
  const pre = await p.prepare(env, ctx, a.provider);
  if (!pre.ok) {
    const out = { [pre.signal]: true };
    if (pre.error) out.error = pre.error;
    return out;
  }
  const r = await p.send(env, ctx, a.modelId, messages, a.provider, images);
  if (r.ok) return { text: r.text, provider: a.provider, model: a.modelId };
  if (r.status === 401 || r.status === 403) return { badKey: true, provider: a.provider };
  return { error: r.error };
}

function corsHeaders(req, env) {
  const origin = req.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const allowAll = allowed.length === 0 || allowed.includes("*");
  const ok = allowAll || allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin || "*" : "null",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

const worker = {
  async fetch(req, env) {
    const cors = corsHeaders(req, env);
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors } });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(req.url);
    const day = pacificDay();
    const min = currentMinute();

    if (url.pathname === "/health" && req.method === "GET") {
      const db = d1(env);
      let schema = false;
      if (db) {
        try {
          const r = await db.prepare(
            "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN ('chat_usage','cf_usage')"
          ).first();
          schema = (Number(r && r.n) || 0) === 2;
        } catch { schema = false; }
      }
      return json({ ok: true, aiBinding: !!env.AI, kv: !!kv(env), db: !!db, schema, pid: !!env.FIREBASE_PROJECT_ID, time: new Date().toISOString() });
    }

    if (url.pathname === "/status" && req.method === "GET") {
      if (env.ADMIN_TOKEN && url.searchParams.get("token") !== env.ADMIN_TOKEN) {
        return json({ error: "Sai token xem bảng." }, 401);
      }
      const [cfRpd, cfNeurons, lastAuthRaw, chain, providers] = await Promise.all([
        getCount(env, `cf:rpd:${day}`),
        getCount(env, `cfn:rpd:${day}`),
        kv(env) ? kv(env).get("auth:lastErr").catch(() => null) : null,
        getChain(env),
        getProviders(env),
      ]);
      let lastAuthError = mem.lastAuthError || null;
      try { if (lastAuthRaw) lastAuthError = JSON.parse(lastAuthRaw); } catch { /* bỏ qua */ }
      return json({
        dayPacific: day,
        auth: { required: true, userDailyLimit: Number(env.USER_DAILY_LIMIT) || 30, projectIdSet: !!env.FIREBASE_PROJECT_ID, lastAuthError },
        workersAI: { requestsToday: cfRpd, neuronsToday: cfNeurons, neuronLimit: CF_NEURON_LIMIT, coolingDownUntil: mem.cfCooldownUntil, lastError: mem.lastError, currentModel: await getCfModel(env) },
        providers: maskProviders(providers),
        chain: chain.map((e) => `${e.provider}:${e.modelId}`),
      });
    }

    // Thử key hãng ngoài: dán key là thấy list model, chưa lưu.
    if (url.pathname === "/providers/check" && req.method === "POST") {
      const isAdmin = !!env.ADMIN_TOKEN && url.searchParams.get("token") === env.ADMIN_TOKEN;
      if (!isAdmin) return json({ error: "Sai token xem bảng." }, 401);
      let body = {};
      try { body = await req.json(); } catch { return json({ error: "Body phải là JSON." }, 400); }
      const type = PROVIDER_PRESETS[body.type] ? body.type : "custom";
      const baseUrl = String(body.baseUrl || PROVIDER_PRESETS[type].baseUrl || "").trim().replace(/\/$/, "");
      const apiKey = String(body.apiKey || "").trim();
      if (!/^https:\/\/.+/.test(baseUrl)) return json({ error: "Thiếu địa chỉ gọi (https://...)." }, 400);
      if (!apiKey) return json({ error: "Chưa nhập key." }, 400);
      try {
        const models = await fetchOpenAIModels(baseUrl, apiKey);
        return json({ ok: true, type, baseUrl, count: models.length, models });
      } catch (e) {
        return json({ error: `Key không dùng được: ${String((e && e.message) || e).slice(0, 200)}` }, 502);
      }
    }

    // List model của hãng đã lưu (dùng key ở KV, không cần dán lại).
    if (url.pathname === "/providers/models" && req.method === "GET") {
      const isAdmin = !!env.ADMIN_TOKEN && url.searchParams.get("token") === env.ADMIN_TOKEN;
      if (!isAdmin) return json({ error: "Sai token xem bảng." }, 401);
      const id = String(url.searchParams.get("id") || "").trim();
      if (!id) return json({ error: "Thiếu id hãng." }, 400);
      const list = await getProviders(env);
      const p = list.find((x) => x.id === id);
      if (!p) return json({ error: "Không thấy hãng này (đã xóa?)." }, 404);
      try {
        const models = await fetchOpenAIModels(p.baseUrl, p.apiKey);
        return json({ ok: true, id: p.id, label: p.label, count: models.length, models });
      } catch (e) {
        return json({ error: `Không lấy được list (key sai hoặc hãng bận): ${String((e && e.message) || e).slice(0, 200)}` }, 502);
      }
    }

    // Quản lý model (cần ADMIN_TOKEN cho POST; GET công khai phần cho người dùng).
    if (url.pathname === "/models" && (req.method === "GET" || req.method === "POST")) {
      const isAdmin = !!env.ADMIN_TOKEN && url.searchParams.get("token") === env.ADMIN_TOKEN;
      const [chain, providers, prompt, gen] = await Promise.all([getChain(env), getProviders(env), getPrompt(env), getGen(env)]);
      const current = await getCfModel(env);
      if (req.method === "GET") {
        if (!isAdmin) return json({ default: current }); // web/app đọc cái này
        return json({ current, available: cfModelList(), chain, maxChain: MAX_CHAIN, providers: maskProviders(providers), presets: PROVIDER_PRESETS, prompt, gen });
      }
      if (!isAdmin) return json({ error: "Sai token xem bảng." }, 401);
      let body = {};
      try { body = await req.json(); } catch { return json({ error: "Body phải là JSON." }, 400); }
      if (body.cfModel !== undefined) {
        const pick = String(body.cfModel || "");
        if (!CF_MODELS[pick]) return json({ error: "Model không có trong danh sách." }, 400);
        if (kv(env)) await kv(env).put("cfg:cfModel", pick).catch(() => {});
        mem.cfgModel = pick;
        mem.cfgAt = Date.now();
      }
      if (body.prompt !== undefined) {
        const p = String(body.prompt || "").slice(0, 4000);
        if (!p.trim()) return json({ error: "Câu hướng dẫn không được trống." }, 400);
        if (kv(env)) await kv(env).put("cfg:prompt", p).catch(() => {});
        mem.prompt = p;
        mem.promptAt = Date.now();
      }
      if (body.gen !== undefined) {
        const t = Number(body.gen && body.gen.temperature);
        const m = Number(body.gen && body.gen.max_tokens);
        const clean = {
          temperature: Number.isFinite(t) ? Math.min(2, Math.max(0, t)) : DEFAULT_GEN.temperature,
          max_tokens: Number.isFinite(m) ? Math.min(8000, Math.max(256, Math.floor(m))) : DEFAULT_GEN.max_tokens,
        };
        if (kv(env)) await kv(env).put("cfg:gen", JSON.stringify(clean)).catch(() => {});
        mem.gen = clean;
        mem.genAt = Date.now();
      }
      if (body.providers !== undefined) {
        if (!Array.isArray(body.providers) || body.providers.length > MAX_PROVIDERS) {
          return json({ error: `Tối đa ${MAX_PROVIDERS} hãng.` }, 400);
        }
        // Giữ key cũ khi admin gửi "***abcd" (chỉ đổi khi dán key mới).
        const oldList = await getProviders(env);
        const clean = [];
        for (const e of body.providers) {
          let entry = e;
          if (typeof e.apiKey === "string" && e.apiKey.startsWith("***")) {
            const old = oldList.find((x) => x.id === e.id);
            if (old) entry = { ...e, apiKey: old.apiKey };
          }
          const v = cleanProvider(entry);
          if (!v) return json({ error: "Mỗi hãng cần id, địa chỉ https và key." }, 400);
          if (clean.some((x) => x.id === v.id)) return json({ error: `Trùng id hãng: ${v.id}` }, 400);
          clean.push(v);
        }
        if (kv(env)) await kv(env).put("cfg:providers", JSON.stringify(clean)).catch(() => {});
        mem.providers = clean;
        mem.providersAt = Date.now();
        // Chain có thể trỏ tới hãng vừa xóa -> lọc lại.
        const chainNow = await getChain(env);
        const filtered = chainNow.map((x) => validChainEntry(x, clean)).filter(Boolean);
        if (filtered.length && filtered.length !== chainNow.length) {
          if (kv(env)) await kv(env).put("cfg:chain", JSON.stringify(filtered)).catch(() => {});
          mem.chain = filtered;
          mem.chainAt = Date.now();
        }
      }
      if (body.chain !== undefined) {
        if (!Array.isArray(body.chain) || body.chain.length === 0 || body.chain.length > MAX_CHAIN) {
          return json({ error: `Thứ tự 1-${MAX_CHAIN} đường.` }, 400);
        }
        const providersNow = await getProviders(env);
        const clean = [];
        for (const e of body.chain) {
          const v = validChainEntry(e, providersNow);
          if (!v) return json({ error: "Mỗi đường cần provider đúng + modelId hợp lệ." }, 400);
          clean.push(v);
        }
        if (kv(env)) await kv(env).put("cfg:chain", JSON.stringify(clean)).catch(() => {});
        mem.chain = clean;
        mem.chainAt = Date.now();
      }
      const [p2, g2] = await Promise.all([getProviders(env), getGen(env)]);
      return json({ current: await getCfModel(env), chain: await getChain(env), providers: maskProviders(p2), prompt: await getPrompt(env), gen: g2 });
    }

    if (url.pathname === "/chat" && req.method === "POST") {
      let body = {};
      try { body = await req.json(); } catch { return json({ error: "Body phải là JSON." }, 400); }
      const parsed = parseAttachments(body);
      if (parsed.error) return json({ error: parsed.error }, 400);
      const images = parsed.images;
      // File chữ nối thẳng vào câu hỏi nên hãng nào cũng đọc được.
      let text = String(body.text || "").trim().slice(0, MAX_TEXT);
      for (const f of parsed.files) {
        text += `\n\n[Nội dung file ${f.name}:]\n${f.text}`;
      }
      text = text.slice(0, MAX_TEXT + MAX_FILES * (MAX_FILE_TEXT + 100));
      if (!text && images.length === 0) return json({ error: "Nhập câu hỏi (text)." }, 400);

      // Chặn từ cổng: không vé hoặc vé giả thì không tốn lượt AI.
      // Thử nhanh ở admin: cho phép dùng ADMIN_TOKEN thay vé (chỉ khi strict + chọn model).
      const auth = req.headers.get("Authorization") || "";
      const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
      const isAdminTry = !!env.ADMIN_TOKEN && bearer === env.ADMIN_TOKEN && body.strict === true && typeof body.modelId === "string" && body.modelId;
      let uid = "";
      if (!isAdminTry) {
        const checked = await verifyFirebaseToken(env, bearer);
        if (!checked.uid) {
          mem.lastAuthError = { time: new Date().toISOString(), code: checked.code };
          // Ghi vào sổ chung để /status thấy dù khác máy (KV), tự xóa sau 1 giờ.
          if (kv(env)) {
            await kv(env).put("auth:lastErr", JSON.stringify(mem.lastAuthError), { expirationTtl: 3600 }).catch(() => {});
          }
          return json({ error: "Bạn đăng nhập lại để chat nhé." }, 401);
        }
        uid = checked.uid;
        const userLimit = Number(env.USER_DAILY_LIMIT) || 30;
        const uCount = await getCount(env, `user:${uid}:${day}`);
        if (uCount >= userLimit) {
          return json({ error: `Hôm nay bạn đã dùng hết ${userLimit} câu, mai quay lại nhé.` }, 429);
        }
        await incrCount(env, `user:${uid}:${day}`, 86400 + 3600);
      }

      // Thứ tự thử do admin xếp (body.provider + body.modelId để ép 1 câu khi thử nhanh).
      const wanted = String(body.model || "");
      const prov = String(body.provider || "");
      const providersNow = await getProviders(env);
      let sel = null;
      if (prov && typeof body.modelId === "string" && body.modelId) {
        const cand = { provider: prov, modelId: body.modelId };
        if (cand.provider === "cf" && CF_MODELS[cand.modelId]) sel = cand;
        else {
          const v = validChainEntry(cand, providersNow);
          if (v) sel = v;
        }
      } else if (CF_MODELS[wanted]) {
        sel = { provider: "cf", modelId: wanted };
      }
      // Thử nhanh mà chọn đường không còn đúng (hãng vừa xóa/tắt) thì báo ngay,
      // không tự rơi xuống đường khác gây hiểu nhầm.
      if (body.strict === true && prov && typeof body.modelId === "string" && body.modelId && !sel) {
        return json({ error: "Đường vừa chọn không còn đúng (hãng đổi/xóa). Tải lại trang admin rồi thử lại." }, 400);
      }
      const chain = await getChain(env);
      const attempts = [];
      if (sel) attempts.push(sel);
      // Chạy thử (strict): chỉ thử đúng model đã chọn, rớt thì báo luôn, không rơi xuống chuỗi.
      if (!(body.strict === true && sel)) {
        for (const e of chain) {
          if (!attempts.some((a) => a.provider === e.provider && a.modelId === e.modelId)) attempts.push(e);
        }
      }
      const [promptNow] = await Promise.all([getPrompt(env)]);
      const messages = toMessages(text, body.history, promptNow);

      let sawBusy = false;
      let lastError = "";
      let badProvider = "";
      const skipped = [];
      const noVision = [];
      for (const a of attempts) {
        const r = await runChainEntry(a, env, { day, min }, messages, images);
        if (r.text) return json(r);
        if (r.fatal) return json({ error: r.error }, r.status || 500);
        if (r.badKey) {
          badProvider = r.provider || a.provider;
          break;
        }
        // Model chỉ đọc chữ mà câu có ảnh: báo rõ, không tự đổi model.
        if (r.noVision) {
          noVision.push(`${a.provider === "cf" ? "Cloudflare" : a.provider}:${a.modelId}`);
          continue;
        }
        if (r.noKey || r.exhausted || r.skip) {
          sawBusy = true;
          skipped.push(`${a.provider}:${a.modelId}${r.noKey ? "(thiếu key)" : r.exhausted ? "(hết lượt)" : "(đang nghỉ/bị tắt)"}`);
          continue;
        }
        lastError = r.error || "";
      }
      if (badProvider) {
        return json({ error: `Key hãng ${badProvider} bị từ chối, kiểm tra lại key ở admin.` }, 502);
      }
      if (noVision.length > 0 && !lastError && !sawBusy) {
        return json({ error: `Model ${noVision.join(", ")} không đọc được ảnh. Đổi sang model có mắt như Gemini rồi gửi lại nhé.` }, 400);
      }
      if (sawBusy && !lastError) {
        const coolLeft = Math.max(0, mem.cfCooldownUntil - Date.now());
        const coolMsg = coolLeft > 0 ? ` Cloudflare đang nghỉ ${Math.ceil(coolLeft / 60000)} phút nữa.` : "";
        const lastErr = mem.lastError?.error ? ` Lỗi gần nhất: ${String(mem.lastError.error).slice(0, 150)}.` : "";
        return json({ error: `Các đường đều bận (${skipped.join(", ") || "không rõ đường"}).${coolMsg}${lastErr} Kiểm tra /status rồi thử lại.` }, 503);
      }
      return json({ error: `Dự phòng bận: ${String(lastError).slice(0, 200)}` }, 502);
    }

    return json({ error: "Dùng POST /chat, GET /status, GET /models, POST /providers/check, GET /providers/models, GET /health." }, 404);
  },
};

export default worker;
