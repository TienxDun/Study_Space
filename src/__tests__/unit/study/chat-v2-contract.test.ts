import { describe, expect, it } from "vitest";
import { finishNotice, normalizeUsage, parseChatReply } from "@/features/chat-v2/lib/contract";

describe("chat v2 contract", () => {
  it("đọc usage snake_case và camelCase", () => {
    expect(normalizeUsage({ prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 })).toEqual({
      promptTokens: 12,
      completionTokens: 8,
      totalTokens: 20,
    });
    expect(normalizeUsage({ promptTokens: 3, completionTokens: 4 })).toEqual({
      promptTokens: 3,
      completionTokens: 4,
      totalTokens: undefined,
    });
    expect(normalizeUsage(null)).toBeNull();
  });

  it("báo đúng lý do kết thúc cần hiển thị", () => {
    expect(finishNotice("length")).toContain("bị cắt");
    expect(finishNotice("content_filter")).toContain("chặn");
    expect(finishNotice("tool_calls")).toContain("công cụ");
    expect(finishNotice("stop")).toBeNull();
  });

  it("giữ nguyên text, model, usage và latency từ Worker", () => {
    const reply = parseChatReply(
      {
        text: "Xin chào",
        model: "deepseek-v4-flash",
        finishReason: "stop",
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
        latencyMs: 123,
        id: "chatcmpl-1",
      },
      999
    );
    expect(reply).toEqual({
      text: "Xin chào",
      model: "deepseek-v4-flash",
      finishReason: "stop",
      usage: { promptTokens: 5, completionTokens: 2, totalTokens: 7 },
      latencyMs: 123,
      id: "chatcmpl-1",
    });
  });

  it("payload hỏng thì trả object rỗng, dùng latency đo tại client", () => {
    expect(parseChatReply(null, 456)).toEqual({
      text: "",
      model: "",
      finishReason: "",
      usage: null,
      latencyMs: 456,
    });
  });
});
