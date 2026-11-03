#!/usr/bin/env node
/**
 * Probe model motapis trước khi cam kết capability.
 *
 * Chạy: npm run probe:chat-v2
 * Key đọc từ process.env.MOTAPIS_API_KEY hoặc workers/chat-v2/.dev.vars.
 * Không in key ra console.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = (process.env.MOTAPIS_BASE || "https://motapis.com/v1").replace(/\/$/, "");
const DEV_VARS = resolve(process.cwd(), "workers/chat-v2/.dev.vars");
const DEFAULT_MODELS = [
  "deepseek-v4-flash",
  "gemini-3.5-flash",
  "gpt-5.4-mini",
  "claude-haiku-4-5",
];

function readDotVars(path) {
  const out = {};
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  } catch {
    /* không có file */
  }
  return out;
}

const dotVars = readDotVars(DEV_VARS);
const API_KEY = process.env.MOTAPIS_API_KEY || dotVars.MOTAPIS_API_KEY || "";

const args = process.argv.slice(2);
const modelArg = args.find((arg) => arg.startsWith("--models="));
const outArg = args.find((arg) => arg.startsWith("--out="));
const models = modelArg
  ? modelArg
      .slice("--models=".length)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  : DEFAULT_MODELS;

if (!API_KEY) {
  console.error(
    "Thiếu MOTAPIS_API_KEY. Dán key vào workers/chat-v2/.dev.vars hoặc export biến môi trường."
  );
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

async function postChat(payload, timeoutMs = 60000) {
  const started = Date.now();
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      /* giữ text */
    }
    return { ok: res.ok, status: res.status, ms: Date.now() - started, data, text };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - started,
      data: null,
      text: String(error && error.message ? error.message : error),
    };
  }
}

function messageText(data) {
  const content = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : String((part && part.text) || "")))
      .join("");
  }
  return "";
}

function errorOf(result) {
  if (result.ok) return "";
  const data = result.data;
  const detail =
    (data && data.error && (data.error.message || data.error)) ||
    (data && data.message) ||
    result.text;
  return String(detail || "").slice(0, 120);
}

async function testText(model) {
  return postChat({
    model,
    messages: [{ role: "user", content: "Giải thích ngắn gọn: vì sao bầu trời màu xanh?" }],
    stream: false,
  });
}

async function testStream(model) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Đếm từ 1 đến 10." }],
        stream: true,
      }),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      return { ok: false, status: res.status, ms: Date.now() - started, chunks: 0, chars: 0, finish: "" };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let chunks = 0;
    let chars = 0;
    let finish = "";
    let done = false;
    while (!done && chunks < 200) {
      const step = await reader.read();
      if (step.done) break;
      buffer += decoder.decode(step.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const raw = trimmed.slice(5).trim();
        if (raw === "[DONE]") {
          done = true;
          break;
        }
        try {
          const event = JSON.parse(raw);
          chunks += 1;
          const delta = event.choices && event.choices[0] && event.choices[0].delta;
          if (delta && typeof delta.content === "string") chars += delta.content.length;
          const reason = event.choices && event.choices[0] && event.choices[0].finish_reason;
          if (reason) finish = reason;
        } catch {
          /* bỏ event lỗi */
        }
      }
    }
    await reader.cancel().catch(() => {});
    return { ok: true, status: res.status, ms: Date.now() - started, chunks, chars, finish };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - started,
      chunks: 0,
      chars: 0,
      finish: "",
      error: String(error && error.message ? error.message : error).slice(0, 120),
    };
  } finally {
    clearTimeout(timer);
  }
}

const PIXEL_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

async function testImage(model) {
  const result = await postChat({
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Ảnh này màu gì? Trả lời 1 từ." },
          { type: "image_url", image_url: { url: PIXEL_PNG } },
        ],
      },
    ],
    stream: false,
  });
  return { ...result, textResult: messageText(result.data).slice(0, 80) };
}

async function testTools(model) {
  const result = await postChat({
    model,
    messages: [{ role: "user", content: "Dùng tool get_time để lấy giờ hiện tại." }],
    tools: [
      {
        type: "function",
        function: {
          name: "get_time",
          description: "Lấy giờ hiện tại",
          parameters: { type: "object", properties: {}, required: [] },
        },
      },
    ],
    tool_choice: "auto",
    stream: false,
  });
  const calls =
    result.data &&
    result.data.choices &&
    result.data.choices[0] &&
    result.data.choices[0].message &&
    result.data.choices[0].message.tool_calls;
  return { ...result, toolCalls: Array.isArray(calls) ? calls.length : 0 };
}

async function testJson(model) {
  const result = await postChat({
    model,
    messages: [{ role: "user", content: 'Trả về đúng JSON: {"ok": true}' }],
    response_format: { type: "json_object" },
    stream: false,
  });
  let parses = false;
  try {
    parses = !!JSON.parse(messageText(result.data));
  } catch {
    parses = false;
  }
  return { ...result, parses };
}

function usageOf(result) {
  const usage = result.data && result.data.usage;
  if (!usage) return "-";
  return `${usage.prompt_tokens ?? "?"}/${usage.completion_tokens ?? "?"}`;
}

function finishOf(result) {
  const choice = result.data && result.data.choices && result.data.choices[0];
  return (choice && choice.finish_reason) || "-";
}

const report = [];

for (const model of models) {
  console.log(`\n=== ${model} ===`);
  const text = await testText(model);
  console.log(
    `text    ok=${text.ok} status=${text.status} ${text.ms}ms finish=${finishOf(text)} usage=${usageOf(text)} ${errorOf(text)}`
  );

  const stream = await testStream(model);
  console.log(
    `stream  ok=${stream.ok} status=${stream.status} ${stream.ms}ms chunks=${stream.chunks} chars=${stream.chars} finish=${stream.finish || "-"} ${stream.error || ""}`
  );

  const image = await testImage(model);
  console.log(
    `image   ok=${image.ok} status=${image.status} ${image.ms}ms ${image.ok ? `reply="${image.textResult}"` : errorOf(image)}`
  );

  const tools = await testTools(model);
  console.log(
    `tools   ok=${tools.ok} status=${tools.status} tool_calls=${tools.toolCalls} ${tools.ok ? finishOf(tools) : errorOf(tools)}`
  );

  const json = await testJson(model);
  console.log(
    `json    ok=${json.ok} status=${json.status} parses=${json.parses} ${json.ok ? "" : errorOf(json)}`
  );

  report.push({
    model,
    text: { ok: text.ok, status: text.status, ms: text.ms, finish: finishOf(text), usage: usageOf(text), error: errorOf(text) },
    stream: { ok: stream.ok, status: stream.status, ms: stream.ms, chunks: stream.chunks, chars: stream.chars, finish: stream.finish, error: stream.error || "" },
    image: { ok: image.ok, status: image.status, ms: image.ms, reply: image.textResult || "", error: errorOf(image) },
    tools: { ok: tools.ok, status: tools.status, toolCalls: tools.toolCalls, error: errorOf(tools) },
    json: { ok: json.ok, status: json.status, parses: json.parses, error: errorOf(json) },
  });
}

if (outArg) {
  const path = resolve(process.cwd(), outArg.slice("--out=".length));
  const { writeFileSync } = await import("node:fs");
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`\nĐã ghi kết quả: ${path}`);
}
