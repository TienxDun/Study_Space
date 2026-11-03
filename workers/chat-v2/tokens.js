export const CHARS_PER_TOKEN = 2;
export const IMAGE_TOKEN_ESTIMATE = 1600;
export const SAFETY_MARGIN_TOKENS = 1024;

export function estimateTextTokens(text) {
  const length = String(text || "").length;
  return length > 0 ? Math.ceil(length / CHARS_PER_TOKEN) + 4 : 0;
}

export function estimateContentTokens(content) {
  if (typeof content === "string") return estimateTextTokens(content);
  if (!Array.isArray(content)) return 0;
  let total = 0;
  for (const part of content) {
    if (typeof part === "string") total += estimateTextTokens(part);
    else if (part && part.type === "text") total += estimateTextTokens(part.text);
    else if (part && part.type === "image_url") total += IMAGE_TOKEN_ESTIMATE;
  }
  return total;
}

export function estimateMessageTokens(message) {
  return estimateContentTokens(message && message.content) + 2;
}

export function estimateMessagesTokens(messages) {
  return (Array.isArray(messages) ? messages : []).reduce(
    (total, message) => total + estimateMessageTokens(message),
    0
  );
}

export function maxInputTokensFor(capability) {
  return (
    Number(capability.contextTokens || 0) -
    Number(capability.maxOutputTokens || 0) -
    SAFETY_MARGIN_TOKENS -
    Number(capability.baselinePromptTokens || 0)
  );
}

export function buildBudget({ messages, systemPrompt, capability }) {
  const list = Array.isArray(messages) ? messages : [];
  if (list.length === 0) return { error: "Không có tin nhắn để gửi." };

  const maxInputTokens = maxInputTokensFor(capability);
  if (maxInputTokens <= 0) {
    return { error: "Model không đủ context để xử lý câu hỏi." };
  }

  const systemTokens = estimateTextTokens(systemPrompt);
  const last = list[list.length - 1];
  let used = systemTokens + estimateMessageTokens(last);
  if (used > maxInputTokens) {
    return {
      error: `Nội dung quá dài: ước tính ${Math.ceil(used)} token, model này chỉ nhận tối đa ${maxInputTokens} token đầu vào. Bỏ bớt file/lịch sử hoặc chọn model khác.`,
    };
  }

  const history = list.slice(0, -1);
  let firstKept = history.length;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const next = used + estimateMessageTokens(history[i]);
    if (next > maxInputTokens) break;
    used = next;
    firstKept = i;
  }

  const kept = history.slice(firstKept);
  let trimmedMessages = firstKept;
  while (kept.length > 0 && kept[0].role === "assistant") {
    kept.shift();
    trimmedMessages += 1;
  }

  const finalMessages = [...kept, last];
  const estimatedInputTokens = systemTokens + estimateMessagesTokens(finalMessages);
  return {
    messages: finalMessages,
    estimatedInputTokens,
    maxInputTokens,
    trimmedMessages,
    systemTokens,
  };
}
