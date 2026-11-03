/**
 * Capability của các model MộtAPI (motapis.com).
 * contextTokens lấy từ tài liệu chính thức của từng hãng (đối chiếu 2026-11-03):
 * - Anthropic: platform.claude.com/docs/en/models/overview
 * - OpenAI: developers.openai.com/api/docs/models
 * - Google: ai.google.dev/gemini-api/docs/models
 * - DeepSeek: api-docs.deepseek.com/quick_start/pricing
 * - Alibaba: alibabacloud.com/help/en/model-studio
 * - Zhipu: docs.z.ai/guides/llm
 * - Moonshot: platform.kimi.com/docs
 * - xAI: docs.x.ai/developers/models
 * - Xiaomi: mimo.xiaomi.com, MiniMax: platform.minimax.io/docs, Tencent: tencentcloud.com/document
 *
 * maxOutputTokens KHÔNG phải giới hạn thật của model: đây là phần dự phòng đầu ra mà
 * budget của app giữ lại (không gửi max_tokens lên upstream). baselinePromptTokens là
 * token đầu vào đo được khi gửi "ping" không system (nếu gateway có system ẩn).
 */

// Model lạ (MộtAPI thêm mới, chưa kịp đối chiếu) dùng mức tối thiểu an toàn để
// tránh gửi vượt context thật; model nào biết chắc thì khai báo trong CAPABILITIES.
const DEFAULT_CAPABILITY = {
  contextTokens: 32768,
  maxOutputTokens: 8192,
  vision: false,
  baselinePromptTokens: 0,
  priceIn: null,
  priceOut: null,
};

const CAPABILITIES = {
  // Anthropic Claude (12 models - toàn bộ hỗ trợ Vision). 1M cho dòng mới; Haiku 4.5 chỉ 200K.
  "claude-opus-5-5": { contextTokens: 1048576, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 9 },
  "claude-opus-5": { contextTokens: 1048576, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 9 },
  "claude-opus-4-8": { contextTokens: 1048576, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 9 },
  "claude-opus-4-7": { contextTokens: 1048576, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 9 },
  "claude-opus-4-6": { contextTokens: 1048576, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 9 },
  "claude-sonnet-5-5": { contextTokens: 1048576, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 0 },
  "claude-sonnet-5": { contextTokens: 1048576, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 0 },
  "claude-sonnet-4-6": { contextTokens: 1048576, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 0 },
  "claude-haiku-5-5": { contextTokens: 1048576, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 0 },
  "claude-haiku-4-5": { contextTokens: 200000, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 0 },
  "claude-fable-5.1": { contextTokens: 1048576, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 0 },
  "claude-fable-5": { contextTokens: 1048576, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 0 },

  // OpenAI GPT & Codex (14 models - loại bỏ các model sinh ảnh gpt-image-*)
  // Dòng GPT mới công bố 1.050.000 token đầu vào; Codex chỉ 400K, Spark 128K.
  "gpt-6-astra": { contextTokens: 1050000, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 0 },
  "gpt-6-sol": { contextTokens: 1050000, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 4387 },
  "gpt-6-luna": { contextTokens: 1050000, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 4396 },
  "gpt-6.1-sol": { contextTokens: 1050000, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 4387 },
  "gpt-6.1-terra": { contextTokens: 1050000, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 74 },
  "gpt-5.6-sol": { contextTokens: 1050000, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 18 },
  "gpt-5.6-luna": { contextTokens: 1050000, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 18 },
  "gpt-5.6-terra": { contextTokens: 1050000, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 18 },
  "gpt-5.6": { contextTokens: 1050000, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 18 },
  "gpt-5.5": { contextTokens: 1050000, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 18 },
  "gpt-5.4-mini": { contextTokens: 400000, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 18 },
  "gpt-5.3-codex": { contextTokens: 400000, maxOutputTokens: 8192, vision: false, baselinePromptTokens: 0 },
  "gpt-5.3-codex-spark": { contextTokens: 128000, maxOutputTokens: 8192, vision: false, baselinePromptTokens: 0 },
  "codex-auto-review": { contextTokens: 272000, maxOutputTokens: 8192, vision: false, baselinePromptTokens: 0 },

  // Google Gemini (8 models)
  "gemini-4-argon": { contextTokens: 1048576, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 255 },
  "gemini-3.8-flash": { contextTokens: 1048576, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 255 },
  "gemini-3.7-flash": { contextTokens: 1048576, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 255 },
  "gemini-3.6-flash": { contextTokens: 1048576, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 255 },
  "gemini-3.5-flash": { contextTokens: 1048576, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 255 },
  "gemini-3.1-pro-preview": { contextTokens: 1048576, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 255 },
  "gemini-3.1-flash-lite-preview": { contextTokens: 1048576, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 255 },
  "gemini-2.5-flash": { contextTokens: 1048576, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 255 },

  // DeepSeek (6 models): toàn dòng V4 công bố 1M token đầu vào
  "deepseek-v4-flash": { contextTokens: 1000000, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 0 },
  "DeepSeek-V4-Flash-0731": { contextTokens: 1000000, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 0 },
  "deepseek-v4.1-flash-1017": { contextTokens: 1000000, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 0 },
  "deepseek-v4.1-flash": { contextTokens: 1000000, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 0 },
  "deepseek-v4-pro": { contextTokens: 1000000, maxOutputTokens: 16384, vision: false, baselinePromptTokens: 84 },
  "deepseek-v4-pro-0813": { contextTokens: 1000000, maxOutputTokens: 16384, vision: false, baselinePromptTokens: 84 },

  // Alibaba Qwen (3 models): 1M token đầu vào
  "qwen3.8-max": { contextTokens: 1000000, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 0 },
  "qwen3.7-max": { contextTokens: 1000000, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 7 },
  "qwen3.7-plus": { contextTokens: 1000000, maxOutputTokens: 16384, vision: false, baselinePromptTokens: 0 },

  // Zhipu GLM (4 models): 5.3/5.2 là 1M, riêng 5.1 chỉ 200K
  "glm-5.3-flash": { contextTokens: 1000000, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 0 },
  "glm-5.3": { contextTokens: 1000000, maxOutputTokens: 16384, vision: false, baselinePromptTokens: 13 },
  "glm-5.2": { contextTokens: 1000000, maxOutputTokens: 16384, vision: false, baselinePromptTokens: 13 },
  "glm-5.1": { contextTokens: 200000, maxOutputTokens: 16384, vision: false, baselinePromptTokens: 13 },

  // Moonshot AI Kimi (4 models): K3 là 1M, K2.x là 256K (262.144)
  "kimi-k3.1-pro": { contextTokens: 1000000, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 0 },
  "kimi-k3": { contextTokens: 1000000, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 0 },
  "kimi-k2.7-code": { contextTokens: 262144, maxOutputTokens: 8192, vision: false, baselinePromptTokens: 0 },
  "kimi-k2.6": { contextTokens: 262144, maxOutputTokens: 8192, vision: false, baselinePromptTokens: 0 },

  // xAI Grok (5 chat models - loại bỏ các model sinh ảnh/video grok-imagine-*)
  // 4.7/4.6/4.5: 500K; 4.3 và 4.20 multi-agent: 1M
  "grok-4.7": { contextTokens: 500000, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 206 },
  "grok-4.6": { contextTokens: 500000, maxOutputTokens: 16384, vision: false, baselinePromptTokens: 208 },
  "grok-4.5": { contextTokens: 500000, maxOutputTokens: 16384, vision: false, baselinePromptTokens: 208 },
  "grok-4.3": { contextTokens: 1000000, maxOutputTokens: 16384, vision: false, baselinePromptTokens: 208 },
  "grok-4.20-multi-agent-0309": { contextTokens: 1000000, maxOutputTokens: 16384, vision: false, baselinePromptTokens: 208 },

  // Xiaomi, MiniMax, Tencent (5 models)
  "mimo-v2.5-pro": { contextTokens: 1000000, maxOutputTokens: 16384, vision: true, baselinePromptTokens: 803 },
  "minimax-m3": { contextTokens: 1000000, maxOutputTokens: 16384, vision: false, baselinePromptTokens: 0 },
  "minimax-m2.7": { contextTokens: 196608, maxOutputTokens: 8192, vision: false, baselinePromptTokens: 0 },
  "hy4-preview": { contextTokens: 1000000, maxOutputTokens: 8192, vision: false, baselinePromptTokens: 0 },
  "hy3": { contextTokens: 262144, maxOutputTokens: 8192, vision: false, baselinePromptTokens: 0 },
};

export const VERIFIED_MODEL_IDS = Object.keys(CAPABILITIES);

// Giá niêm yết của MộtAPI (motapis.com/models.js, tải ngày 2026-11-03), đơn vị USD / 1M token.
// Đây là giá pay-as-you-go; model thuộc gói miễn phí vẫn có giá này khi hết quota.
const PRICING = {
  // Anthropic Claude
  "claude-opus-5-5": { priceIn: 2.4, priceOut: 12 },
  "claude-opus-5": { priceIn: 2, priceOut: 10 },
  "claude-opus-4-8": { priceIn: 2, priceOut: 10 },
  "claude-opus-4-7": { priceIn: 2, priceOut: 10 },
  "claude-opus-4-6": { priceIn: 2, priceOut: 10 },
  "claude-sonnet-5-5": { priceIn: 1.2, priceOut: 6 },
  "claude-sonnet-5": { priceIn: 1.2, priceOut: 6 },
  "claude-sonnet-4-6": { priceIn: 1.2, priceOut: 6 },
  "claude-haiku-5-5": { priceIn: 0.4, priceOut: 2 },
  "claude-haiku-4-5": { priceIn: 0.4, priceOut: 2 },
  "claude-fable-5.1": { priceIn: 5, priceOut: 25 },
  "claude-fable-5": { priceIn: 2, priceOut: 10 },

  // OpenAI
  "gpt-6-astra": { priceIn: 3, priceOut: 15 },
  "gpt-6-sol": { priceIn: 1.2, priceOut: 6 },
  "gpt-6-luna": { priceIn: 0.1, priceOut: 0.5 },
  "gpt-6.1-sol": { priceIn: 1.2, priceOut: 6 },
  "gpt-6.1-terra": { priceIn: 0.7, priceOut: 3.5 },
  "gpt-5.6-sol": { priceIn: 1.2, priceOut: 6 },
  "gpt-5.6-luna": { priceIn: 1.2, priceOut: 6 },
  "gpt-5.6-terra": { priceIn: 1.2, priceOut: 6 },
  "gpt-5.6": { priceIn: 1.2, priceOut: 6 },
  "gpt-5.5": { priceIn: 1.2, priceOut: 6 },
  "gpt-5.4-mini": { priceIn: 0.4, priceOut: 2 },
  "gpt-5.3-codex": { priceIn: 1.2, priceOut: 6 },
  "gpt-5.3-codex-spark": { priceIn: 0.4, priceOut: 2 },
  "codex-auto-review": { priceIn: 1.2, priceOut: 6 },

  // Google Gemini
  "gemini-4-argon": { priceIn: 1.2, priceOut: 6 },
  "gemini-3.8-flash": { priceIn: 0.4, priceOut: 2 },
  "gemini-3.7-flash": { priceIn: 0.4, priceOut: 2 },
  "gemini-3.6-flash": { priceIn: 0.4, priceOut: 2 },
  "gemini-3.5-flash": { priceIn: 0.4, priceOut: 2 },
  "gemini-3.1-pro-preview": { priceIn: 0.4, priceOut: 2 },
  "gemini-3.1-flash-lite-preview": { priceIn: 0.4, priceOut: 2 },
  "gemini-2.5-flash": { priceIn: 0.4, priceOut: 2 },

  // DeepSeek
  "deepseek-v4-flash": { priceIn: 0.07, priceOut: 0.14 },
  "DeepSeek-V4-Flash-0731": { priceIn: 0.07, priceOut: 0.14 },
  "deepseek-v4.1-flash-1017": { priceIn: 0.075, priceOut: 0.3 },
  "deepseek-v4.1-flash": { priceIn: 0.075, priceOut: 0.3 },
  "deepseek-v4-pro": { priceIn: 0.22, priceOut: 0.44 },
  "deepseek-v4-pro-0813": { priceIn: 0.22, priceOut: 0.44 },

  // Alibaba Qwen
  "qwen3.8-max": { priceIn: 1, priceOut: 3 },
  "qwen3.7-max": { priceIn: 0.625, priceOut: 1.875 },
  "qwen3.7-plus": { priceIn: 0.4, priceOut: 1.2 },

  // Zhipu GLM
  "glm-5.3-flash": { priceIn: 0.075, priceOut: 0.25 },
  "glm-5.3": { priceIn: 0.7, priceOut: 2.2 },
  "glm-5.2": { priceIn: 0.7, priceOut: 2.2 },
  "glm-5.1": { priceIn: 0.7, priceOut: 2.2 },

  // Moonshot Kimi
  "kimi-k3.1-pro": { priceIn: 1, priceOut: 5 },
  "kimi-k3": { priceIn: 1.5, priceOut: 7.5 },
  "kimi-k2.7-code": { priceIn: 0.48, priceOut: 2 },
  "kimi-k2.6": { priceIn: 0.48, priceOut: 2 },

  // xAI Grok
  "grok-4.7": { priceIn: 1.2, priceOut: 2.4 },
  "grok-4.6": { priceIn: 0.5, priceOut: 2 },
  "grok-4.5": { priceIn: 0.5, priceOut: 2 },
  "grok-4.3": { priceIn: 1.2, priceOut: 2.4 },
  "grok-4.20-multi-agent-0309": { priceIn: 1.2, priceOut: 2.4 },

  // Xiaomi, MiniMax, Tencent
  "mimo-v2.5-pro": { priceIn: 0.5, priceOut: 1.5 },
  "minimax-m3": { priceIn: 0.15, priceOut: 0.6 },
  "minimax-m2.7": { priceIn: 0.15, priceOut: 0.6 },
  "hy4-preview": { priceIn: 0.4, priceOut: 1.2 },
  "hy3": { priceIn: 0.075, priceOut: 0.25 },
};

export function getCapability(modelId) {
  const key = String(modelId || "");
  return { ...DEFAULT_CAPABILITY, ...(CAPABILITIES[key] || {}), ...(PRICING[key] || {}) };
}

export function publicCapability(modelId) {
  const cap = getCapability(modelId);
  return {
    contextTokens: cap.contextTokens,
    maxOutputTokens: cap.maxOutputTokens,
    vision: cap.vision,
    priceIn: cap.priceIn,
    priceOut: cap.priceOut,
  };
}
