import type { ChatV2Message, ChatV2Model, ChatV2Session } from "../types";
import { unsummarizedMessages } from "./sessions";

export const CHARS_PER_TOKEN = 2;
export const CONTEXT_SAFETY_MARGIN = 1024;
export const SUMMARY_TRIGGER_RATIO = 0.55;
export const SUMMARY_KEEP_RECENT = 6;
export const SUMMARY_MIN_MESSAGES = 12;
export const SUMMARY_TRIGGER_MESSAGES = 20;
export const SUMMARY_TRIGGER_MAX_TOKENS = 16000;
export const SUMMARY_MAX_INPUT_CHARS = 36000;

export function estimateTextTokens(text: string): number {
  const length = String(text || "").length;
  return length > 0 ? Math.ceil(length / CHARS_PER_TOKEN) + 4 : 0;
}

export function estimateMessagesTokens(messages: ChatV2Message[]): number {
  return messages.reduce((total, message) => total + estimateTextTokens(message.text) + 2, 0);
}

export function maxInputTokensFor(model?: Pick<ChatV2Model, "contextTokens" | "maxOutputTokens">): number {
  if (!model) return 0;
  return model.contextTokens - model.maxOutputTokens - CONTEXT_SAFETY_MARGIN;
}

export function formatContextSize(tokens?: number): string {
  if (!tokens || tokens <= 0) return "-";
  if (tokens >= 900_000) {
    const m = tokens / (1024 * 1024);
    return m >= 0.95 && m <= 1.05 ? "1M" : `${m.toFixed(1).replace(".0", "")}M`;
  }
  return `${Math.round(tokens / 1024)}k`;
}

export function shouldSummarize(session: ChatV2Session, model?: ChatV2Model): boolean {
  const pending = unsummarizedMessages(session);
  if (pending.length < SUMMARY_MIN_MESSAGES) return false;
  const maxInput = maxInputTokensFor(model);
  if (maxInput <= 0) return false;

  // 1. Tự động tóm tắt khi số tin chờ nén đạt ngưỡng (giữ xa giới hạn an toàn 40 tin của Worker)
  if (pending.length >= SUMMARY_TRIGGER_MESSAGES) return true;

  // 2. Tự động tóm tắt khi token các tin chờ nén vượt ngưỡng an toàn (tiết kiệm chi phí token input)
  const used = estimateMessagesTokens(pending) + estimateTextTokens(session.summary?.text || "");
  if (used >= SUMMARY_TRIGGER_MAX_TOKENS) return true;

  // 3. Chốt chặn cho các model có context nhỏ (< 32k tokens)
  return used >= maxInput * SUMMARY_TRIGGER_RATIO;
}

/** Phần cũ đủ lớn để nén, luôn giữ lại vài tin gần nhất nguyên văn. */
export function summaryChunk(session: ChatV2Session): ChatV2Message[] {
  const pending = unsummarizedMessages(session);
  const candidates = pending.slice(0, Math.max(0, pending.length - SUMMARY_KEEP_RECENT));
  const chunk: ChatV2Message[] = [];
  let chars = 0;

  for (const message of candidates) {
    if (chunk.length > 0 && chars + message.text.length > SUMMARY_MAX_INPUT_CHARS) break;
    chunk.push(message);
    chars += message.text.length;
  }

  return chunk;
}
