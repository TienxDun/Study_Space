import { CHAT_V2_DEV_TOKEN, CHAT_V2_URL } from "./config";
import { createSseParser } from "./sse";
import type {
  ChatV2FilePayload,
  ChatV2ImagePayload,
  ChatV2KeyTier,
  ChatV2Model,
  ChatV2Reply,
  ChatV2RequestMessage,
  ChatV2Usage,
} from "../types";

export class ChatV2ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ChatV2ApiError";
    this.status = status;
  }
}

async function request(
  path: string,
  init: RequestInit = {},
  keyTier: ChatV2KeyTier = "auto"
): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(`${CHAT_V2_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Chat-V2-Token": CHAT_V2_DEV_TOKEN,
        "X-Chat-V2-Key": keyTier,
        ...(init.headers || {}),
      },
    });
  } catch {
    throw new ChatV2ApiError(
      `Không kết nối được Worker chat v2 tại ${CHAT_V2_URL}. Chạy npm run dev:chat-v2 trước nhé.`,
      0
    );
  }

  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const message =
      data && typeof data.error === "string" && data.error
        ? data.error
        : `Worker chat v2 lỗi ${res.status}.`;
    throw new ChatV2ApiError(message, res.status);
  }
  return data || {};
}

export async function fetchChatV2Models(keyTier: ChatV2KeyTier = "auto"): Promise<ChatV2Model[]> {
  const data = await request("/models", {}, keyTier);
  const rows = Array.isArray(data.data) ? data.data : [];
  return rows
    .map((item): ChatV2Model | null => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      if (typeof row.id !== "string" || !row.id) return null;
      return {
        id: row.id,
        ownedBy: typeof row.ownedBy === "string" ? row.ownedBy : "",
        contextTokens: typeof row.contextTokens === "number" ? row.contextTokens : 16384,
        maxOutputTokens: typeof row.maxOutputTokens === "number" ? row.maxOutputTokens : 4096,
        vision: row.vision === true,
        priceIn: typeof row.priceIn === "number" ? row.priceIn : null,
        priceOut: typeof row.priceOut === "number" ? row.priceOut : null,
      };
    })
    .filter((item): item is ChatV2Model => item !== null);
}

export interface StreamChatOptions {
  model: string;
  messages: ChatV2RequestMessage[];
  summary?: string;
  images?: ChatV2ImagePayload[];
  files?: ChatV2FilePayload[];
  keyTier?: ChatV2KeyTier;
  signal?: AbortSignal;
  onDelta?: (delta: string) => void;
}

function isAbortError(cause: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" && cause instanceof DOMException && cause.name === "AbortError") ||
    (!!cause && typeof cause === "object" && (cause as { name?: string }).name === "AbortError")
  );
}

export async function streamChatV2({
  model,
  messages,
  summary,
  images,
  files,
  keyTier = "auto",
  signal,
  onDelta,
}: StreamChatOptions): Promise<ChatV2Reply> {
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(`${CHAT_V2_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Chat-V2-Token": CHAT_V2_DEV_TOKEN,
        "X-Chat-V2-Key": keyTier,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        ...(summary ? { summary } : {}),
        ...(images && images.length > 0 ? { images } : {}),
        ...(files && files.length > 0 ? { files } : {}),
      }),
      signal,
    });
  } catch (cause) {
    if (isAbortError(cause)) throw cause;
    throw new ChatV2ApiError(
      `Không kết nối được Worker chat v2 tại ${CHAT_V2_URL}. Chạy npm run dev:chat-v2 trước nhé.`,
      0
    );
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
    const message =
      data && typeof data.error === "string" && data.error
        ? data.error
        : `Worker chat v2 lỗi ${res.status}.`;
    throw new ChatV2ApiError(message, res.status);
  }
  if (!res.body) throw new ChatV2ApiError("Worker không trả stream.", 502);

  let text = "";
  let modelSeen = "";
  let finishReason = "";
  let usage: ChatV2Reply["usage"] = null;
  let streamError: string | null = null;
  let done = false;

  const parser = createSseParser((event) => {
    if (event.error) streamError = event.error;
    if (event.delta) {
      text += event.delta;
      onDelta?.(event.delta);
    }
    if (event.finishReason) finishReason = event.finishReason;
    if (event.usage) usage = event.usage;
    if (event.model) modelSeen = event.model;
    if (event.done) done = true;
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  try {
    while (!done && !streamError) {
      const step = await reader.read();
      if (step.done) break;
      parser.push(decoder.decode(step.value, { stream: true }));
    }
    parser.flush();
  } catch (cause) {
    if (isAbortError(cause)) throw cause;
    throw new ChatV2ApiError("Mất kết nối khi đang nhận câu trả lời.", 0);
  } finally {
    await reader.cancel().catch(() => {});
  }

  if (streamError) throw new ChatV2ApiError(streamError, 502);

  const headerNumber = (name: string): number | undefined => {
    const raw = res.headers.get(name);
    if (raw === null) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  };
  const estimatedInputTokens = headerNumber("X-Chat-V2-Estimated-Input");
  const maxInputTokens = headerNumber("X-Chat-V2-Max-Input");
  const contextTokens = headerNumber("X-Chat-V2-Context");
  const maxOutputTokens = headerNumber("X-Chat-V2-Max-Output");
  const trimmedMessages = headerNumber("X-Chat-V2-Trimmed");
  const context =
    estimatedInputTokens !== undefined &&
    maxInputTokens !== undefined &&
    contextTokens !== undefined &&
    maxOutputTokens !== undefined
      ? {
          estimatedInputTokens,
          maxInputTokens,
          trimmedMessages: trimmedMessages || 0,
          contextTokens,
          maxOutputTokens,
        }
      : undefined;

  return {
    text,
    model: modelSeen || model,
    finishReason,
    usage,
    latencyMs: Date.now() - started,
    context,
  };
}

export interface SummarizeChatOptions {
  messages: ChatV2RequestMessage[];
  summary?: string;
  keyTier?: ChatV2KeyTier;
  signal?: AbortSignal;
}

export interface ChatV2SummaryReply {
  text: string;
  model: string;
  usage: ChatV2Usage | null;
  latencyMs: number;
}

export async function summarizeChatV2({
  messages,
  summary,
  keyTier = "auto",
  signal,
}: SummarizeChatOptions): Promise<ChatV2SummaryReply> {
  const data = await request(
    "/summarize",
    {
      method: "POST",
      body: JSON.stringify({
        messages,
        ...(summary ? { summary } : {}),
      }),
      signal,
    },
    keyTier
  );

  const text = typeof data.summary === "string" ? data.summary.trim() : "";
  if (!text) throw new ChatV2ApiError("Worker không trả bản tóm tắt.", 502);

  return {
    text,
    model: typeof data.model === "string" ? data.model : "",
    usage: data.usage && typeof data.usage === "object" ? (data.usage as ChatV2Usage) : null,
    latencyMs: typeof data.latencyMs === "number" ? data.latencyMs : 0,
  };
}
