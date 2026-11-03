import type { ChatV2Reply, ChatV2Usage } from "../types";

function readNumber(raw: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

export function normalizeUsage(raw: unknown): ChatV2Usage | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const usage = {
    promptTokens: readNumber(row, "promptTokens", "prompt_tokens", "input_tokens"),
    completionTokens: readNumber(row, "completionTokens", "completion_tokens", "output_tokens"),
    totalTokens: readNumber(row, "totalTokens", "total_tokens"),
  };
  return usage.promptTokens === undefined &&
    usage.completionTokens === undefined &&
    usage.totalTokens === undefined
    ? null
    : usage;
}

export function finishNotice(reason: string): string | null {
  if (reason === "length") return "Câu trả lời bị cắt vì chạm giới hạn output của model.";
  if (reason === "content_filter") return "Model đã chặn nội dung này vì chính sách an toàn.";
  if (reason === "tool_calls") return "Model muốn gọi công cụ; sprint này chưa bật tool.";
  return null;
}

export function parseChatReply(raw: unknown, measuredMs: number): ChatV2Reply {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { text: "", model: "", finishReason: "", usage: null, latencyMs: measuredMs };
  }
  const row = raw as Record<string, unknown>;
  return {
    text: typeof row.text === "string" ? row.text : "",
    model: typeof row.model === "string" ? row.model : "",
    finishReason: typeof row.finishReason === "string" ? row.finishReason : "",
    usage: normalizeUsage(row.usage),
    latencyMs:
      typeof row.latencyMs === "number" && Number.isFinite(row.latencyMs)
        ? row.latencyMs
        : measuredMs,
    id: typeof row.id === "string" ? row.id : undefined,
  };
}
