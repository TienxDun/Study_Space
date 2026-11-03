import { describe, expect, it } from "vitest";
import {
  buildBudget,
  estimateContentTokens,
  estimateTextTokens,
  maxInputTokensFor,
} from "../../../../workers/chat-v2/tokens.js";
import { formatContextSize } from "@/features/chat-v2/lib/tokens";

const CAP = { contextTokens: 2000, maxOutputTokens: 200, baselinePromptTokens: 0, vision: false };

describe("chat v2 token budget", () => {
  it("định dạng nhãn context đẹp mắt (k / M)", () => {
    expect(formatContextSize(1048576)).toBe("1M");
    expect(formatContextSize(1000000)).toBe("1M");
    expect(formatContextSize(524288)).toBe("512k");
    expect(formatContextSize(409600)).toBe("400k");
    expect(formatContextSize(32768)).toBe("32k");
    expect(formatContextSize(undefined)).toBe("-");
  });

  it("ước lượng text và ảnh", () => {
    expect(estimateTextTokens("abcd")).toBe(6);
    expect(estimateTextTokens("")).toBe(0);
    expect(
      estimateContentTokens([
        { type: "text", text: "abcd" },
        { type: "image_url", image_url: { url: "data:image/png;base64,AA==" } },
      ])
    ).toBe(1606);
  });

  it("tính max input sau khi trừ output và margin", () => {
    expect(maxInputTokensFor(CAP)).toBe(776);
  });

  it("cắt lịch sử cũ khi vượt budget", () => {
    const messages = [
      ...Array.from({ length: 10 }, (_, index) => ({
        role: index % 2 === 0 ? "user" : "assistant",
        content: "x".repeat(200),
      })),
      { role: "user", content: "câu hỏi cuối" },
    ];
    const budget = buildBudget({ messages, systemPrompt: "a".repeat(100), capability: CAP });
    expect(budget.error).toBeUndefined();
    expect(budget.trimmedMessages!).toBeGreaterThan(0);
    expect(budget.messages![budget.messages!.length - 1].content).toBe("câu hỏi cuối");
    expect(budget.estimatedInputTokens!).toBeLessThanOrEqual(budget.maxInputTokens!);
  });

  it("báo lỗi khi riêng câu hỏi cuối đã quá dài", () => {
    const budget = buildBudget({
      messages: [{ role: "user", content: "x".repeat(5000) }],
      systemPrompt: "a".repeat(100),
      capability: CAP,
    });
    expect(budget.error).toContain("quá dài");
  });
});
