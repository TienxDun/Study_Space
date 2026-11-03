export const CHAT_V2_URL = (
  process.env.NEXT_PUBLIC_CHAT_V2_URL || "http://localhost:8788"
).replace(/\/$/, "");

export const CHAT_V2_DEV_TOKEN =
  process.env.NEXT_PUBLIC_CHAT_V2_DEV_TOKEN || "chat-v2-dev-local";

export const CHAT_V2_DEFAULT_MODEL = "deepseek-v4-flash";

// Regex nhận diện các model phi hội thoại (tạo ảnh, tạo video, tts, whisper, embed)
export const NON_CHAT_MODEL_RE = /(image|video|tts|whisper|transcribe|embed|moderation)/i;

// 19 model thuộc gói miễn phí của MộtAPI (motapis.com/#pricing)
export const CHAT_V2_FREE_MODELS = new Set([
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

// Danh sách model chat/reasoning tiêu biểu sắp xếp theo P/P và độ phổ biến
export const CHAT_V2_VERIFIED_MODELS = [
  // Miễn phí & Giá rẻ tối ưu (Tier 1)
  "deepseek-v4-flash",
  "deepseek-v4.1-flash-1017",
  "claude-sonnet-5-5",
  "gpt-6-luna",
  "glm-5.3-flash",
  "qwen3.8-max",
  "gpt-6-astra",
  "gpt-6-sol",
  "kimi-k3.1-pro",
  "DeepSeek-V4-Flash-0731",
  "claude-sonnet-5",
  "claude-sonnet-4-6",
  "gpt-5.6-sol",
  "grok-4.5",
  "grok-4.6",
  "minimax-m3",

  // Flagship & Đa phương thức nâng cao (Tier 2)
  "claude-opus-5-5",
  "claude-opus-5",
  "gemini-4-argon",
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "grok-4.7",
  "gpt-6.1-sol",
  "gpt-6.1-terra",
  "mimo-v2.5-pro",
  "qwen3.7-max",
  "kimi-k3",
  "claude-haiku-5-5",
  "claude-fable-5.1",
  "claude-fable-5",

  // Suy luận chuyên sâu (Text-only reasoning)
  "deepseek-v4-pro",
  "glm-5.3",
  "gpt-5.6",
  "gpt-5.4-mini",
  "gpt-5.3-codex",
];

// Danh sách fallback khi offline hoặc Worker chưa phản hồi
// contextTokens khớp bảng đã đối chiếu tài liệu hãng trong workers/chat-v2/capabilities.js
// priceIn/priceOut là giá USD / 1M token (vào/ra) lấy từ motapis.com/models.js
export const CHAT_V2_FALLBACK_MODELS = [
  { id: "deepseek-v4-flash", ownedBy: "deepseek", contextTokens: 1000000, maxOutputTokens: 16384, vision: true, priceIn: 0.07, priceOut: 0.14 },
  { id: "claude-sonnet-5-5", ownedBy: "anthropic", contextTokens: 1048576, maxOutputTokens: 16384, vision: true, priceIn: 1.2, priceOut: 6 },
  { id: "gpt-6-luna", ownedBy: "openai", contextTokens: 1050000, maxOutputTokens: 16384, vision: true, priceIn: 0.1, priceOut: 0.5 },
  { id: "gemini-3.8-flash", ownedBy: "google", contextTokens: 1048576, maxOutputTokens: 16384, vision: true, priceIn: 0.4, priceOut: 2 },
  { id: "qwen3.8-max", ownedBy: "alibaba", contextTokens: 1000000, maxOutputTokens: 16384, vision: true, priceIn: 1, priceOut: 3 },
  { id: "glm-5.3-flash", ownedBy: "zhipu", contextTokens: 1000000, maxOutputTokens: 16384, vision: true, priceIn: 0.075, priceOut: 0.25 },
  { id: "kimi-k3.1-pro", ownedBy: "moonshot", contextTokens: 1000000, maxOutputTokens: 16384, vision: true, priceIn: 1, priceOut: 5 },
  { id: "deepseek-v4-pro", ownedBy: "deepseek", contextTokens: 1000000, maxOutputTokens: 16384, vision: false, priceIn: 0.22, priceOut: 0.44 },
  { id: "grok-4.7", ownedBy: "xai", contextTokens: 500000, maxOutputTokens: 16384, vision: true, priceIn: 1.2, priceOut: 2.4 },
  { id: "mimo-v2.5-pro", ownedBy: "xiaomi", contextTokens: 1000000, maxOutputTokens: 16384, vision: true, priceIn: 0.5, priceOut: 1.5 },
];
