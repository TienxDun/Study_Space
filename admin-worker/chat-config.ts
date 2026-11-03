/**
 * P2b — Cấu hình trợ lý chat. Worker admin chỉ validate, audit rồi chuyển tiếp
 * qua API của chat-proxy, nơi duy nhất giữ luật giữ key cũ và lọc chain.
 */

import { trimUrl, type AdminEnv } from "./shared";

export type ChatCfgKind = "model" | "prompt" | "chain" | "providers";
export const CHAT_CFG_TARGETS: Record<ChatCfgKind, string> = {
  model: "cfg:cfModel",
  prompt: "cfg:prompt",
  chain: "cfg:chain",
  providers: "cfg:providers",
};

const CHAT_CFG_TIMEOUT_MS = 12 * 1000;
const CHAT_PROMPT_MAX = 4000;
const CHAT_CHAIN_MAX = 5;
const CHAT_PROVIDERS_MAX = 10;
export const CHAT_PROVIDER_ID_RE = /^[a-z0-9][a-z0-9-_]{0,39}$/i;

export type ChatProvider = {
  id: string;
  type: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
};

export type ChatChainEntry = { provider: string; modelId: string };

export type ChatConfig = {
  current: string;
  available: Array<{ key: string; label: string; context?: number }>;
  chain: ChatChainEntry[];
  maxChain: number;
  providers: ChatProvider[];
  presets: Record<string, { label?: string; baseUrl?: string }>;
  prompt: string;
  /** Quy tắc an toàn cố định của chat-proxy, chỉ để hiển thị (không sửa từ admin). */
  safetyPrompt: string;
};

export type ChatCfgChange = {
  kind: ChatCfgKind;
  payload: Record<string, unknown>;
  auditDetail: unknown;
};

export function mapChatConfig(raw: Record<string, unknown>): ChatConfig {
  const providersRaw = Array.isArray(raw.providers) ? raw.providers : [];
  const providers: ChatProvider[] = [];
  for (const item of providersRaw) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const id = typeof entry.id === "string" ? entry.id : "";
    if (!id) continue;
    const masked = typeof entry.apiKey === "string" ? entry.apiKey : "";
    providers.push({
      id,
      type: typeof entry.type === "string" ? entry.type : "custom",
      label: typeof entry.label === "string" && entry.label ? entry.label : id,
      baseUrl: typeof entry.baseUrl === "string" ? entry.baseUrl : "",
      // Chỉ chuyển tiếp mặt nạ; nếu chat-proxy lỡ trả key thật thì bỏ hẳn.
      apiKey: masked.startsWith("***") ? masked : "",
      enabled: entry.enabled !== false,
    });
  }

  const chainRaw = Array.isArray(raw.chain) ? raw.chain : [];
  const chain: ChatChainEntry[] = [];
  for (const item of chainRaw) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    if (typeof entry.provider !== "string" || typeof entry.modelId !== "string") continue;
    chain.push({ provider: entry.provider, modelId: entry.modelId });
  }

  const availableRaw = Array.isArray(raw.available) ? raw.available : [];
  const available: ChatConfig["available"] = [];
  for (const item of availableRaw) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    if (typeof entry.key !== "string" || !entry.key) continue;
    available.push({
      key: entry.key,
      label: typeof entry.label === "string" ? entry.label : entry.key,
      ...(typeof entry.context === "number" ? { context: entry.context } : {}),
    });
  }

  const presets: ChatConfig["presets"] = {};
  if (raw.presets && typeof raw.presets === "object" && !Array.isArray(raw.presets)) {
    for (const [key, value] of Object.entries(raw.presets as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const preset = value as Record<string, unknown>;
      presets[key] = {
        ...(typeof preset.label === "string" ? { label: preset.label } : {}),
        ...(typeof preset.baseUrl === "string" ? { baseUrl: preset.baseUrl } : {}),
      };
    }
  }

  const maxChain = typeof raw.maxChain === "number" && raw.maxChain > 0 ? raw.maxChain : CHAT_CHAIN_MAX;

  return {
    current: typeof raw.current === "string" ? raw.current : "",
    available,
    chain,
    maxChain,
    providers,
    presets,
    prompt: typeof raw.prompt === "string" ? raw.prompt : "",
    safetyPrompt: typeof raw.safetyPrompt === "string" ? raw.safetyPrompt.slice(0, 4000) : "",
  };
}

type ChatProxyResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; status: number; error: string };

export function chatProxyCall(
  env: AdminEnv,
  path: string,
  options: {
    method?: string;
    body?: unknown;
    timeoutMs?: number;
    bearer?: boolean;
  } = {},
): Promise<ChatProxyResult> {
  const base = trimUrl(env.CHAT_PROXY_URL);
  const token = String(env.ADMIN_TOKEN || "").trim();
  if (!base || !token) return Promise.resolve({ ok: false, status: 503, error: "missing_config" });

  const url = options.bearer
    ? `${base}${path}`
    : `${base}${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;

  return fetch(url, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(options.bearer ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(options.timeoutMs || CHAT_CFG_TIMEOUT_MS),
  })
    .then(async (res) => {
      let data: Record<string, unknown> = {};
      try {
        const parsed = await res.json();
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          data = parsed as Record<string, unknown>;
        }
      } catch {
        data = {};
      }
      if (!res.ok) {
        return {
          ok: false as const,
          status: res.status,
          error:
            typeof data.error === "string" && data.error
              ? data.error
              : `chat_proxy_http_${res.status}`,
        };
      }
      return { ok: true as const, data };
    })
    .catch(() => ({ ok: false as const, status: 502, error: "chat_proxy_unreachable" }));
}

function stripProviderSecrets(list: ChatProvider[]) {
  return list.map((p) => ({ id: p.id, type: p.type, baseUrl: p.baseUrl, enabled: p.enabled }));
}

function chainLabels(list: ChatChainEntry[]): string[] {
  return list.map((entry) => `${entry.provider}:${entry.modelId}`);
}

/** Validate một nhóm thay đổi và dựng phần audit không chứa key hay nội dung prompt. */
export function parseChatCfgBody(body: unknown, cfg: ChatConfig): ChatCfgChange | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const raw = body as Record<string, unknown>;

  if (raw.kind === "model") {
    const pick = typeof raw.cfModel === "string" ? raw.cfModel : "";
    if (!cfg.available.some((model) => model.key === pick)) return null;
    return {
      kind: "model",
      payload: { cfModel: pick },
      auditDetail: { before: cfg.current, after: pick },
    };
  }

  if (raw.kind === "prompt") {
    const prompt = typeof raw.prompt === "string" ? raw.prompt : "";
    if (
      !prompt.trim() ||
      prompt.length > CHAT_PROMPT_MAX ||
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(prompt)
    ) {
      return null;
    }
    // Không ghi nội dung prompt vào audit, chỉ ghi độ dài.
    return {
      kind: "prompt",
      payload: { prompt },
      auditDetail: { beforeChars: cfg.prompt.length, afterChars: prompt.length },
    };
  }

  if (raw.kind === "chain") {
    if (!Array.isArray(raw.chain) || raw.chain.length === 0 || raw.chain.length > cfg.maxChain) {
      return null;
    }
    const providerIds = new Set(
      cfg.providers.filter((p) => p.enabled).map((p) => p.id),
    );
    const cfKeys = new Set(cfg.available.map((model) => model.key));
    const chain: ChatChainEntry[] = [];
    for (const item of raw.chain) {
      if (!item || typeof item !== "object") return null;
      const entry = item as Record<string, unknown>;
      const provider = typeof entry.provider === "string" ? entry.provider : "";
      const modelId = typeof entry.modelId === "string" ? entry.modelId.trim() : "";
      if (!modelId || modelId.length > 200) return null;
      if (provider === "cf") {
        if (!cfKeys.has(modelId)) return null;
      } else if (!providerIds.has(provider)) {
        return null;
      }
      chain.push({ provider, modelId });
    }
    return {
      kind: "chain",
      payload: { chain },
      auditDetail: { before: chainLabels(cfg.chain), after: chainLabels(chain) },
    };
  }

  if (raw.kind === "providers") {
    if (!Array.isArray(raw.providers) || raw.providers.length > CHAT_PROVIDERS_MAX) return null;
    const current = new Map(cfg.providers.map((p) => [p.id, p]));
    const next: ChatProvider[] = [];
    for (const item of raw.providers) {
      if (!item || typeof item !== "object") return null;
      const entry = item as Record<string, unknown>;
      const id = typeof entry.id === "string" ? entry.id : "";
      if (!CHAT_PROVIDER_ID_RE.test(id)) return null;
      const type =
        typeof entry.type === "string" && cfg.presets[entry.type] ? entry.type : "custom";
      const baseUrl =
        typeof entry.baseUrl === "string" ? entry.baseUrl.trim().replace(/\/$/, "") : "";
      if (!/^https:\/\/.+/.test(baseUrl) || baseUrl.length > 200) return null;
      const label =
        typeof entry.label === "string" && entry.label.trim()
          ? entry.label.trim().slice(0, 60)
          : id;
      const apiKey = typeof entry.apiKey === "string" ? entry.apiKey.trim() : "";
      if (apiKey.startsWith("***")) {
        // Mặt nạ: chat-proxy giữ key cũ, nhưng hãng phải đang tồn tại.
        if (!current.has(id)) return null;
      } else if (!apiKey || apiKey.length > 500) {
        return null;
      }
      if (next.some((p) => p.id === id)) return null;
      next.push({ id, type, label, baseUrl, apiKey, enabled: entry.enabled !== false });
    }
    return {
      kind: "providers",
      payload: { providers: next },
      auditDetail: {
        before: stripProviderSecrets(cfg.providers),
        after: stripProviderSecrets(next),
      },
    };
  }

  return null;
}
