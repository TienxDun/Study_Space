import { normalizeUsage } from "./contract";
import type { ChatV2Usage } from "../types";

export interface ChatV2StreamEvent {
  delta: string;
  finishReason: string;
  usage: ChatV2Usage | null;
  model: string;
  done: boolean;
  error?: string;
}

function deltaText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((part) => (typeof part === "string" ? part : String((part as { text?: unknown })?.text || "")))
      .join("");
  }
  return "";
}

function errorText(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const row = value as { message?: unknown; error?: unknown };
    if (typeof row.message === "string") return row.message;
    if (typeof row.error === "string") return row.error;
  }
  return "Motapis trả lỗi trong stream.";
}

export function createSseParser(onEvent: (event: ChatV2StreamEvent) => void) {
  let buffer = "";

  const consume = (text: string) => {
    buffer += text;
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const raw = trimmed.slice(5).trim();
      if (!raw) continue;
      if (raw === "[DONE]") {
        onEvent({ delta: "", finishReason: "", usage: null, model: "", done: true });
        continue;
      }
      let data: Record<string, unknown> | null = null;
      try {
        data = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        continue;
      }
      const error = errorText(data.error);
      if (error) {
        onEvent({ delta: "", finishReason: "", usage: null, model: "", done: false, error });
        continue;
      }
      const choices = Array.isArray(data.choices) ? data.choices : [];
      const choice = (choices[0] || {}) as Record<string, unknown>;
      const delta = (choice.delta || {}) as Record<string, unknown>;
      const event: ChatV2StreamEvent = {
        delta: deltaText(delta.content),
        finishReason: typeof choice.finish_reason === "string" ? choice.finish_reason : "",
        usage: normalizeUsage(data.usage),
        model: typeof data.model === "string" ? data.model : "",
        done: false,
      };
      if (event.delta || event.finishReason || event.usage || event.model) onEvent(event);
    }
  };

  return {
    push: consume,
    flush: () => consume("\n"),
  };
}
