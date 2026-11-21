import type { ChatV2Model } from "../types";

export interface ChatV2ProviderFamily {
  key: string;
  label: string;
  test: (id: string) => boolean;
}

// motapis trả owned_by = "openai" cho gần như mọi model nên phải nhận diện hãng theo id.
export const PROVIDER_FAMILIES: ChatV2ProviderFamily[] = [
  { key: "claude", label: "Claude", test: (id) => id.startsWith("claude") },
  { key: "openai", label: "OpenAI", test: (id) => /^(gpt|chatgpt|codex|o\d)/.test(id) },
  { key: "gemini", label: "Gemini", test: (id) => id.startsWith("gemini") },
  { key: "deepseek", label: "DeepSeek", test: (id) => id.startsWith("deepseek") },
  { key: "qwen", label: "Qwen", test: (id) => id.startsWith("qwen") },
  { key: "glm", label: "GLM", test: (id) => id.startsWith("glm") },
  { key: "kimi", label: "Kimi", test: (id) => /^(kimi|moonshot)/.test(id) },
  { key: "grok", label: "Grok", test: (id) => id.startsWith("grok") },
  { key: "mimo", label: "MiMo", test: (id) => id.startsWith("mimo") },
  { key: "minimax", label: "MiniMax", test: (id) => id.startsWith("minimax") },
  { key: "hunyuan", label: "Hunyuan", test: (id) => /^(hy\d|hunyuan|tencent)/.test(id) },
  { key: "meta", label: "Llama", test: (id) => /^(llama|meta-)/.test(id) },
  { key: "mistral", label: "Mistral", test: (id) => /^(mistral|mixtral|codestral)/.test(id) },
];

export const OTHER_PROVIDER = { key: "other", label: "Hãng khác" } as const;

const OWNED_BY_ALIASES: Record<string, string> = {
  anthropic: "claude",
  claude: "claude",
  google: "gemini",
  deepseek: "deepseek",
  alibaba: "qwen",
  qwen: "qwen",
  zhipu: "glm",
  "z-ai": "glm",
  moonshot: "kimi",
  "moonshot-ai": "kimi",
  xai: "grok",
  "x-ai": "grok",
  xiaomi: "mimo",
  minimax: "minimax",
  tencent: "hunyuan",
  meta: "meta",
  mistral: "mistral",
};

// Giá trị owned_by của gateway, không dùng để đoán hãng.
const GATEWAY_OWNERS = new Set(["", "openai", "motapis", "self-dploy", "system"]);

export function providerOf(model: Pick<ChatV2Model, "id" | "ownedBy">): {
  key: string;
  label: string;
} {
  const id = model.id.toLowerCase();
  const byId = PROVIDER_FAMILIES.find((family) => family.test(id));
  if (byId) return byId;

  const owned = (model.ownedBy || "").toLowerCase().trim();
  const alias = OWNED_BY_ALIASES[owned];
  if (alias) {
    const family = PROVIDER_FAMILIES.find((item) => item.key === alias);
    if (family) return family;
  }

  return {
    key: OTHER_PROVIDER.key,
    label: GATEWAY_OWNERS.has(owned) ? "Khác" : owned,
  };
}
