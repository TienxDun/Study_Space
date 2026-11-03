/**
 * chat-v2 — Worker độc lập cho chatbot mới.
 *
 * Không dùng chung code với workers/chat-proxy.
 * Nhiệm vụ sprint 0:
 *   - giữ MOTAPIS_API_KEY ở server
 *   - proxy /v1/models + /v1/chat/completions sang motapis.com
 *   - chặn bằng dev token + Origin localhost
 *   - trả text/usage/finish_reason đã chuẩn hoá cho web
 *
 * Biến môi trường (.dev.vars khi chạy local):
 *   MOTAPIS_API_KEY_FREE = key gói miễn phí, dùng trước cho 19 model free
 *   MOTAPIS_API_KEY      = key trả phí, dùng cho model trả phí và khi key free hết quota
 *   CHAT_V2_DEV_TOKEN    = chat-v2-dev-local
 *   ALLOWED_ORIGINS      = http://localhost:3001
 *   DEFAULT_MODEL        = deepseek-v4-flash
 */

import {
  buildContextSummaryPrompt,
  buildSystemPrompt,
  normalizeAgeBand,
  PROMPT_VERSION,
  SUMMARY_PROMPT,
} from "./prompts.js";
import { getCapability, publicCapability } from "./capabilities.js";
import { appendFilesToLastUser, attachImagesToLastUser, parseAttachments } from "./attachments.js";
import { buildBudget } from "./tokens.js";

const MOTAPIS_BASE = "https://motapis.com/v1";
const DEFAULT_MODEL = "deepseek-v4-flash";
const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 20000;
const MAX_TOTAL_CHARS = 120000;
const MAX_MODEL_ID = 120;
const MAX_SUMMARY_CHARS = 6000;
const MAX_SUMMARY_INPUT_CHARS = 40000;
const MAX_SUMMARY_MESSAGES = 80;
const SUMMARY_MODEL = "deepseek-v4-flash";
const NON_CHAT_RE = /(image|video|tts|whisper|transcribe|embed|moderation)/i;

// 19 model thuộc gói miễn phí, chốt 2026-11-02 từ motapis.com/#pricing.
// Model ngoài danh sách này luôn đi bằng key trả phí.
const FREE_MODELS = new Set([
  "DeepSeek-V4-Flash-0731",
  "claude-sonnet-4-6",
  "claude-sonnet-5",
  "claude-sonnet-5-5",
  "deepseek-v4-flash",
  "deepseek-v4.1-flash-1017",
  "glm-5.3-flash",
  "gpt-5.6-sol",
  "gpt-6-astra",
  "gpt-6-luna",
  "gpt-6-sol",
  "grok-4.5",
  "grok-4.6",
  "hy3",
  "hy4-preview",
  "kimi-k3.1-pro",
  "minimax-m2.7",
  "minimax-m3",
  "qwen3.8-max",
]);

// Key free hết quota / bị chặn thì mới rơi sang key trả phí (chỉ ở chế độ auto).
const PAID_FALLBACK_STATUS = new Set([401, 402, 403, 429]);

// Client dev có thể chọn key qua header X-Chat-V2-Key: auto | free | paid.
const KEY_TIERS = new Set(["auto", "free", "paid"]);

function freeKey(env) {
  return String(env.MOTAPIS_API_KEY_FREE || "").trim();
}

function paidKey(env) {
  return String(env.MOTAPIS_API_KEY || "").trim();
}

function keyTierOf(req) {
  const raw = String(req.headers.get("X-Chat-V2-Key") || "").trim().toLowerCase();
  return KEY_TIERS.has(raw) ? raw : "auto";
}

function keyTierError(tier, env, cors) {
  if (tier === "free" && !freeKey(env)) {
    return json({ error: "Chưa cấu hình MOTAPIS_API_KEY_FREE trong Worker." }, 503, cors);
  }
  if (tier === "paid" && !paidKey(env)) {
    return json({ error: "Chưa cấu hình MOTAPIS_API_KEY trong Worker." }, 503, cors);
  }
  return null;
}

function keyFor(model, env, tier = "auto") {
  const free = freeKey(env);
  const paid = paidKey(env);
  if (tier === "free") return { key: free, tier: "free" };
  if (tier === "paid") return { key: paid, tier: "paid" };
  if (free && FREE_MODELS.has(model)) return { key: free, tier: "free" };
  if (paid) return { key: paid, tier: "paid" };
  return { key: free, tier: "free" };
}

async function motapisFetch(path, init, model, env, tier = "auto") {
  const primary = keyFor(model, env, tier);
  const send = (key) =>
    fetch(`${MOTAPIS_BASE}${path}`, {
      ...init,
      headers: { ...(init.headers || {}), Authorization: `Bearer ${key}` },
    }).catch((error) => ({
      ok: false,
      status: 0,
      body: null,
      text: async () => String(error),
    }));

  let res = await send(primary.key);
  const canFallback = tier === "auto" && primary.tier === "free";
  if (!res.ok && canFallback && PAID_FALLBACK_STATUS.has(res.status)) {
    const paid = paidKey(env);
    if (paid) {
      await res.body?.cancel?.().catch?.(() => {});
      console.log(
        JSON.stringify({ event: "chat_v2_key_fallback", model, status: res.status, from: "free", to: "paid" })
      );
      res = await send(paid);
    }
  }
  return res;
}

function json(data, status = 200, cors = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
  });
}

function allowedOrigins(env) {
  const raw = String(env.ALLOWED_ORIGINS || "http://localhost:3001");
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function corsHeaders(req, env) {
  const origin = req.headers.get("Origin") || "";
  const list = allowedOrigins(env);
  const ok = !origin || list.includes("*") || list.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin || "*" : "null",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Chat-V2-Token, X-Chat-V2-Key",
    "Access-Control-Expose-Headers":
      "X-Chat-V2-Estimated-Input, X-Chat-V2-Max-Input, X-Chat-V2-Trimmed, X-Chat-V2-Context, X-Chat-V2-Max-Output",
    "Access-Control-Max-Age": "86400",
  };
}

function devTokenError(req, env, cors) {
  const expected = String(env.CHAT_V2_DEV_TOKEN || "");
  if (!expected) {
    return json({ error: "Worker chưa cấu hình CHAT_V2_DEV_TOKEN." }, 503, cors);
  }
  const got = req.headers.get("X-Chat-V2-Token") || "";
  if (got !== expected) {
    return json({ error: "Sai dev token." }, 401, cors);
  }
  return null;
}

function apiKeyError(env, cors) {
  if (!paidKey(env) && !freeKey(env)) {
    return json(
      {
        error:
          "Chưa cấu hình MOTAPIS_API_KEY_FREE hoặc MOTAPIS_API_KEY trong workers/chat-v2/.dev.vars.",
      },
      503,
      cors
    );
  }
  return null;
}

function upstreamError(status, text, cors) {
  let detail = String(text || "").slice(0, 400);
  try {
    const parsed = JSON.parse(text);
    const err = parsed && parsed.error;
    detail = typeof err === "string" ? err : (err && err.message) || parsed.message || detail;
  } catch {
    /* giữ text gốc */
  }
  const error =
    status === 401 || status === 403
      ? "Motapis từ chối API key. Kiểm tra MOTAPIS_API_KEY_FREE và MOTAPIS_API_KEY."
      : status === 429
        ? "Motapis báo hết hạn mức hoặc quá nhiều request trên cả key free lẫn trả phí."
        : `Motapis lỗi ${status}: ${String(detail).slice(0, 300)}`;
  return json({ error }, status === 429 ? 429 : 502, cors);
}

function extractText(payload) {
  const message = payload && payload.choices && payload.choices[0] && payload.choices[0].message;
  const content = message && message.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : String((part && part.text) || "")))
      .join("")
      .trim();
  }
  const refusal = message && message.refusal;
  return typeof refusal === "string" ? refusal.trim() : "";
}

function normalizeUsage(raw) {
  if (!raw || typeof raw !== "object") return null;
  const pick = (...keys) => {
    for (const key of keys) {
      const value = raw[key];
      if (typeof value === "number" && Number.isFinite(value)) return value;
    }
    return undefined;
  };
  const usage = {
    promptTokens: pick("prompt_tokens", "input_tokens", "promptTokens"),
    completionTokens: pick("completion_tokens", "output_tokens", "completionTokens"),
    totalTokens: pick("total_tokens", "totalTokens"),
  };
  return usage.promptTokens === undefined &&
    usage.completionTokens === undefined &&
    usage.totalTokens === undefined
    ? null
    : usage;
}

function cleanMessages(input) {
  if (!Array.isArray(input) || input.length === 0) {
    return { error: "messages phải là danh sách có ít nhất 1 tin." };
  }
  if (input.length > MAX_MESSAGES) {
    return { error: `Tối đa ${MAX_MESSAGES} tin một request.` };
  }
  const out = [];
  let total = 0;
  for (const item of input) {
    if (!item || typeof item !== "object") return { error: "Mỗi tin phải là object." };
    const role = item.role;
    if (role === "system") {
      return { error: "Không nhận system prompt từ client." };
    }
    if (role !== "user" && role !== "assistant") {
      return { error: "role chỉ nhận user/assistant." };
    }
    if (typeof item.content !== "string") {
      return { error: "Sprint 0 chỉ nhận content dạng text." };
    }
    if (item.content.length > MAX_MESSAGE_CHARS) {
      return { error: `Mỗi tin tối đa ${MAX_MESSAGE_CHARS} ký tự.` };
    }
    total += item.content.length;
    if (total > MAX_TOTAL_CHARS) {
      return { error: `Tổng nội dung tối đa ${MAX_TOTAL_CHARS} ký tự.` };
    }
    out.push({ role, content: item.content });
  }
  return { messages: out, totalChars: total };
}

function cleanModel(value, env) {
  const model = String(value || env.DEFAULT_MODEL || DEFAULT_MODEL).trim();
  if (!model || model.length > MAX_MODEL_ID) return null;
  if (!/^[A-Za-z0-9._:/-]+$/.test(model)) return null;
  return model;
}

function cleanChatSummary(value) {
  if (value === undefined || value === null || value === "") return { summary: "" };
  if (typeof value !== "string") return { error: "summary phải là chuỗi." };
  const summary = value.trim();
  if (!summary) return { summary: "" };
  if (summary.length > MAX_SUMMARY_CHARS) {
    return { error: `summary tối đa ${MAX_SUMMARY_CHARS} ký tự.` };
  }
  return { summary };
}

function cleanTranscript(input) {
  if (!Array.isArray(input) || input.length === 0) {
    return { error: "messages phải có ít nhất 1 tin." };
  }
  if (input.length > MAX_SUMMARY_MESSAGES) {
    return { error: `Tối đa ${MAX_SUMMARY_MESSAGES} tin để tóm tắt.` };
  }

  const messages = [];
  let total = 0;
  for (const item of input) {
    if (!item || typeof item !== "object") return { error: "Mỗi tin phải là object." };
    if (item.role !== "user" && item.role !== "assistant") {
      return { error: "Chỉ nhận tin user/assistant để tóm tắt." };
    }
    if (typeof item.content !== "string") return { error: "content phải là chuỗi." };
    if (!item.content.trim()) continue;
    if (item.content.length > MAX_MESSAGE_CHARS) {
      return { error: `Mỗi tin tối đa ${MAX_MESSAGE_CHARS} ký tự.` };
    }
    total += item.content.length;
    if (total > MAX_SUMMARY_INPUT_CHARS) {
      return { error: `Tổng nội dung tóm tắt tối đa ${MAX_SUMMARY_INPUT_CHARS} ký tự.` };
    }
    messages.push({ role: item.role, content: item.content });
  }

  if (messages.length === 0) return { error: "Không có nội dung để tóm tắt." };
  return { messages };
}

async function summarize(req, env, cors) {
  const tokenError = devTokenError(req, env, cors);
  if (tokenError) return tokenError;
  const keyError = apiKeyError(env, cors);
  if (keyError) return keyError;
  const tier = keyTierOf(req);
  const tierError = keyTierError(tier, env, cors);
  if (tierError) return tierError;

  let body = null;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body phải là JSON." }, 400, cors);
  }

  const cleaned = cleanTranscript(body && body.messages);
  if (cleaned.error) return json({ error: cleaned.error }, 400, cors);

  const previous = cleanChatSummary(body && body.summary);
  if (previous.error) return json({ error: previous.error }, 400, cors);

  const model = String(env.CHAT_V2_SUMMARY_MODEL || SUMMARY_MODEL).trim() || SUMMARY_MODEL;
  if (!/^[A-Za-z0-9._:/-]+$/.test(model) || model.length > MAX_MODEL_ID) {
    return json({ error: "CHAT_V2_SUMMARY_MODEL không hợp lệ." }, 500, cors);
  }

  const transcript = cleaned.messages
    .map((message) => `${message.role === "user" ? "HỌC VIÊN" : "TRỢ LÝ"}: ${message.content}`)
    .join("\n\n");
  const sections = [];
  if (previous.summary) {
    sections.push(`[TÓM TẮT CŨ]\n${previous.summary}\n[HẾT TÓM TẮT CŨ]`);
  }
  sections.push(`[HỘI THOẠI CẦN NÉN]\n${transcript}\n[HẾT HỘI THOẠI]`);

  const started = Date.now();
  const upstream = await motapisFetch(
    "/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SUMMARY_PROMPT },
          { role: "user", content: sections.join("\n\n") },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    },
    model,
    env,
    tier
  );

  if (!upstream.ok) {
    const errorText = await upstream.text().catch(() => "");
    console.log(
      JSON.stringify({
        event: "chat_v2_summary_error",
        model,
        status: upstream.status || 0,
        ms: Date.now() - started,
      })
    );
    return upstreamError(upstream.status || 502, errorText, cors);
  }

  const text = await upstream.text().catch(() => "");
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    return json({ error: "Motapis trả tóm tắt không phải JSON." }, 502, cors);
  }

  const summary = extractText(payload);
  if (!summary) return json({ error: "Model không trả bản tóm tắt." }, 502, cors);

  const latencyMs = Date.now() - started;
  const result = {
    summary,
    model,
    usage: normalizeUsage(payload && payload.usage),
    latencyMs,
  };

  console.log(
    JSON.stringify({
      event: "chat_v2_summary",
      model,
      messages: cleaned.messages.length,
      chars: cleaned.messages.reduce((total, message) => total + message.content.length, 0),
      summaryChars: summary.length,
      ms: latencyMs,
    })
  );
  return json(result, 200, cors);
}

async function listModels(env, cors, tier = "auto") {
  const keyError = apiKeyError(env, cors);
  if (keyError) return keyError;
  const tierError = keyTierError(tier, env, cors);
  if (tierError) return tierError;

  const paid = paidKey(env);
  const free = freeKey(env);
  const send = (key) =>
    fetch(`${MOTAPIS_BASE}/models`, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(30000),
    }).catch((error) => ({
      ok: false,
      status: 0,
      body: null,
      text: async () => String(error),
    }));

  // Key trả phí thấy đủ danh mục; key free chỉ thấy 19 model nên chỉ dùng dự phòng.
  let res;
  if (tier === "free") {
    res = await send(free);
  } else if (tier === "paid") {
    res = await send(paid);
  } else {
    res = await send(paid || free);
    if (!res.ok && paid && free && PAID_FALLBACK_STATUS.has(res.status)) {
      await res.body?.cancel?.().catch?.(() => {});
      res = await send(free);
    }
  }
  const text = await res.text().catch(() => "");
  if (!res.ok) return upstreamError(res.status, text, cors);

  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    return json({ error: "Motapis trả /models không phải JSON." }, 502, cors);
  }
  const raw = Array.isArray(payload && payload.data)
    ? payload.data
    : Array.isArray(payload && payload.models)
      ? payload.models
      : [];
  const data = raw
    .map((item) => {
      const id = typeof item === "string" ? item : item && item.id;
      if (typeof id !== "string" || !id || NON_CHAT_RE.test(id)) return null;
      const ownedBy =
        (item && (item.owned_by || item.provider || item.ownedBy)) || "";
      const capability = publicCapability(id);
      return { id, ownedBy: String(ownedBy), ...capability };
    })
    .filter(Boolean);

  return json({ object: "list", count: data.length, data }, 200, cors);
}

async function chat(req, env, cors) {
  const tokenError = devTokenError(req, env, cors);
  if (tokenError) return tokenError;
  const keyError = apiKeyError(env, cors);
  if (keyError) return keyError;
  const tier = keyTierOf(req);
  const tierError = keyTierError(tier, env, cors);
  if (tierError) return tierError;

  let body = null;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body phải là JSON." }, 400, cors);
  }

  const cleaned = cleanMessages(body && body.messages);
  if (cleaned.error) return json({ error: cleaned.error }, 400, cors);
  if (cleaned.messages[cleaned.messages.length - 1].role !== "user") {
    return json({ error: "Tin cuối phải là câu hỏi của người dùng." }, 400, cors);
  }

  const model = cleanModel(body && body.model, env);
  if (!model) return json({ error: "Tên model không hợp lệ." }, 400, cors);
  if (tier === "free" && !FREE_MODELS.has(model)) {
    return json({ error: `Model ${model} không có trong gói key free.` }, 400, cors);
  }

  const parsed = parseAttachments(body);
  if (parsed.error) return json({ error: parsed.error }, 400, cors);

  const capability = getCapability(model);
  if (parsed.images.length > 0 && !capability.vision) {
    return json(
      {
        error: `Model ${model} không đọc được ảnh. Chọn model có nhãn ảnh hoặc bỏ ảnh rồi gửi lại.`,
      },
      400,
      cors
    );
  }

  let messages = cleaned.messages;
  if (parsed.files.length > 0) messages = appendFilesToLastUser(messages, parsed.files);
  if (parsed.images.length > 0) messages = attachImagesToLastUser(messages, parsed.images);

  const wantsStream = body && body.stream === true;
  const started = Date.now();
  const ageBand = normalizeAgeBand(env.AGE_BAND);
  const summaryInput = cleanChatSummary(body && body.summary);
  if (summaryInput.error) return json({ error: summaryInput.error }, 400, cors);
  const baseSystemPrompt = buildSystemPrompt(ageBand);
  const systemPrompt = summaryInput.summary
    ? `${baseSystemPrompt}\n\n${buildContextSummaryPrompt(summaryInput.summary)}`
    : baseSystemPrompt;
  const budget = buildBudget({ messages, systemPrompt, capability });
  if (budget.error) return json({ error: budget.error }, 400, cors);

  const contextMeta = {
    estimatedInputTokens: budget.estimatedInputTokens,
    maxInputTokens: budget.maxInputTokens,
    trimmedMessages: budget.trimmedMessages,
    contextTokens: capability.contextTokens,
    maxOutputTokens: capability.maxOutputTokens,
  };
  const contextHeaders = {
    "X-Chat-V2-Estimated-Input": String(contextMeta.estimatedInputTokens),
    "X-Chat-V2-Max-Input": String(contextMeta.maxInputTokens),
    "X-Chat-V2-Trimmed": String(contextMeta.trimmedMessages),
    "X-Chat-V2-Context": String(contextMeta.contextTokens),
    "X-Chat-V2-Max-Output": String(contextMeta.maxOutputTokens),
  };
  const upstreamBody = {
    model,
    messages: [{ role: "system", content: systemPrompt }, ...budget.messages],
    stream: wantsStream,
    ...(wantsStream ? { stream_options: { include_usage: true } } : {}),
  };

  const upstream = await motapisFetch(
    "/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(upstreamBody),
      signal: wantsStream ? req.signal : AbortSignal.timeout(60000),
    },
    model,
    env,
    tier
  );

  if (!upstream.ok) {
    const errorText = await upstream.text().catch(() => "");
    console.log(
      JSON.stringify({
        event: "chat_v2_upstream_error",
        model,
        status: upstream.status || 0,
        ms: Date.now() - started,
      })
    );
    return upstreamError(upstream.status || 502, errorText, cors);
  }

  if (wantsStream) {
    console.log(
      JSON.stringify({
        event: "chat_v2_stream_open",
        model,
        ageBand,
        promptVersion: PROMPT_VERSION,
        chars: cleaned.totalChars,
        images: parsed.images.length,
        files: parsed.files.length,
        estimatedInputTokens: budget.estimatedInputTokens,
        maxInputTokens: budget.maxInputTokens,
        trimmedMessages: budget.trimmedMessages,
        summaryChars: summaryInput.summary.length,
        ms: Date.now() - started,
      })
    );
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        ...contextHeaders,
        ...cors,
      },
    });
  }

  const text = await upstream.text().catch(() => "");
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    return json({ error: "Motapis trả chat không phải JSON." }, 502, cors);
  }

  const latencyMs = Date.now() - started;
  const choice = payload && payload.choices && payload.choices[0];
  const result = {
    text: extractText(payload),
    model,
    upstreamModel: (payload && payload.model) || model,
    finishReason: (choice && choice.finish_reason) || "",
    usage: normalizeUsage(payload && payload.usage),
    latencyMs,
    id: (payload && payload.id) || "",
    context: contextMeta,
  };

  console.log(
    JSON.stringify({
      event: "chat_v2_chat",
      model: result.model,
      ageBand,
      promptVersion: PROMPT_VERSION,
      finishReason: result.finishReason,
      promptTokens: result.usage && result.usage.promptTokens,
      completionTokens: result.usage && result.usage.completionTokens,
      ms: latencyMs,
    })
  );
  return json(result, 200, cors);
}

const worker = {
  async fetch(req, env) {
    const cors = corsHeaders(req, env);
    const origin = req.headers.get("Origin") || "";
    const list = allowedOrigins(env);
    if (origin && !list.includes("*") && !list.includes(origin)) {
      return json({ error: "Origin không được phép." }, 403, cors);
    }
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(req.url);

    if (url.pathname === "/health" && req.method === "GET") {
      return json(
        {
          ok: true,
          service: "chat-v2",
          provider: "motapis",
          defaultModel: env.DEFAULT_MODEL || DEFAULT_MODEL,
          ageBand: normalizeAgeBand(env.AGE_BAND),
          promptVersion: PROMPT_VERSION,
          hasApiKey: !!(paidKey(env) || freeKey(env)),
          hasFreeKey: !!freeKey(env),
          hasPaidKey: !!paidKey(env),
          freeModels: FREE_MODELS.size,
          hasDevToken: !!env.CHAT_V2_DEV_TOKEN,
          summaryModel: env.CHAT_V2_SUMMARY_MODEL || SUMMARY_MODEL,
        },
        200,
        cors
      );
    }

    if (url.pathname === "/models" && req.method === "GET") {
      const tokenError = devTokenError(req, env, cors);
      if (tokenError) return tokenError;
      return listModels(env, cors, keyTierOf(req));
    }

    if (url.pathname === "/chat" && req.method === "POST") {
      return chat(req, env, cors);
    }

    if (url.pathname === "/summarize" && req.method === "POST") {
      return summarize(req, env, cors);
    }

    return json(
      { error: "Dùng GET /health, GET /models, POST /chat, POST /summarize." },
      404,
      cors
    );
  },
};

export default worker;

export const __test = {
  cleanMessages,
  cleanModel,
  cleanChatSummary,
  cleanTranscript,
  extractText,
  normalizeUsage,
  corsHeaders,
  FREE_MODELS,
  keyFor,
  keyTierOf,
};
