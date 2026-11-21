import { describe, expect, it } from "vitest";
import { createSseParser } from "@/features/chat-v2/lib/sse";

describe("chat v2 SSE parser", () => {
  it("đọc delta, finish_reason, usage và [DONE] khi chunk bị chia nhỏ", () => {
    const events: Array<{ delta: string; finish: string; total?: number; done: boolean; model: string }> = [];
    const parser = createSseParser((event) => {
      events.push({
        delta: event.delta,
        finish: event.finishReason,
        total: event.usage?.totalTokens,
        done: event.done,
        model: event.model,
      });
    });

    parser.push('data: {"model":"deepseek-v4-flash","choices":[{"delta":{"content":"Xin ');
    parser.push('"}}]}\n\ndata: {"choices":[{"delta":{"content":"chào"},"finish_reason":"stop"}],"usage":{"prompt_tokens":12,"completion_tokens":2,"total_tokens":14}}\n\n');
    parser.push("data: [DONE]\n\n");

    expect(events).toEqual([
      { delta: "Xin ", finish: "", total: undefined, done: false, model: "deepseek-v4-flash" },
      { delta: "chào", finish: "stop", total: 14, done: false, model: "" },
      { delta: "", finish: "", total: undefined, done: true, model: "" },
    ]);
  });

  it("trả lỗi khi stream có error", () => {
    const errors: string[] = [];
    const parser = createSseParser((event) => {
      if (event.error) errors.push(event.error);
    });
    parser.push('data: {"error":{"message":"hết hạn mức"}}\n\n');
    expect(errors).toEqual(["hết hạn mức"]);
  });

  it("bỏ qua dòng không phải data và JSON hỏng", () => {
    const events: string[] = [];
    const parser = createSseParser((event) => {
      if (event.delta) events.push(event.delta);
    });
    parser.push("event: message\n\ndata: not-json\n\ndata: {\"choices\":[{\"delta\":{\"content\":\"ok\"}}]}\n\n");
    expect(events).toEqual(["ok"]);
  });
});
