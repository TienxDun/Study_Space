import { describe, expect, it } from "vitest";
import {
  VERIFIED_MODEL_IDS,
  getCapability,
  publicCapability,
} from "../../../../workers/chat-v2/capabilities.js";

// Bảng giá trị đã đối chiếu tài liệu chính thức của từng hãng (2026-11-03).
const DOCUMENTED_CONTEXT: Array<[string, number]> = [
  ["claude-opus-5-5", 1048576],
  ["claude-sonnet-5-5", 1048576],
  ["claude-haiku-5-5", 1048576],
  ["claude-haiku-4-5", 200000],
  ["claude-fable-5.1", 1048576],
  ["gpt-6-astra", 1050000],
  ["gpt-6.1-terra", 1050000],
  ["gpt-5.6-sol", 1050000],
  ["gpt-5.5", 1050000],
  ["gpt-5.4-mini", 400000],
  ["gpt-5.3-codex", 400000],
  ["gpt-5.3-codex-spark", 128000],
  ["codex-auto-review", 272000],
  ["gemini-4-argon", 1048576],
  ["gemini-2.5-flash", 1048576],
  ["deepseek-v4-flash", 1000000],
  ["DeepSeek-V4-Flash-0731", 1000000],
  ["deepseek-v4-pro", 1000000],
  ["qwen3.8-max", 1000000],
  ["qwen3.7-plus", 1000000],
  ["glm-5.3-flash", 1000000],
  ["glm-5.1", 200000],
  ["kimi-k3.1-pro", 1000000],
  ["kimi-k2.7-code", 262144],
  ["grok-4.7", 500000],
  ["grok-4.3", 1000000],
  ["grok-4.20-multi-agent-0309", 1000000],
  ["mimo-v2.5-pro", 1000000],
  ["minimax-m3", 1000000],
  ["minimax-m2.7", 196608],
  ["hy4-preview", 1000000],
  ["hy3", 262144],
];

describe("capabilities của model MộtAPI", () => {
  it("khớp context window đã đối chiếu tài liệu hãng", () => {
    for (const [id, contextTokens] of DOCUMENTED_CONTEXT) {
      expect(getCapability(id).contextTokens, id).toBe(contextTokens);
    }
  });

  it("model lạ dùng mức tối thiểu an toàn thay vì 1M", () => {
    const cap = getCapability("model-moi-chua-doi-chieu");
    expect(cap.contextTokens).toBe(32768);
    expect(cap.maxOutputTokens).toBe(8192);
    expect(cap.vision).toBe(false);
    expect(cap.priceIn).toBeNull();
    expect(cap.priceOut).toBeNull();
  });

  it("mọi model chat đều có giá pay-as-you-go dương", () => {
    for (const id of VERIFIED_MODEL_IDS) {
      const cap = getCapability(id);
      expect(cap.priceIn, id).toBeGreaterThan(0);
      expect(cap.priceOut, id).toBeGreaterThan(0);
    }
  });

  it("giá khớp bảng niêm yết motapis", () => {
    expect(getCapability("deepseek-v4-flash")).toMatchObject({ priceIn: 0.07, priceOut: 0.14 });
    expect(getCapability("gpt-6-luna")).toMatchObject({ priceIn: 0.1, priceOut: 0.5 });
    expect(getCapability("qwen3.7-max")).toMatchObject({ priceIn: 0.625, priceOut: 1.875 });
    expect(getCapability("claude-fable-5.1")).toMatchObject({ priceIn: 5, priceOut: 25 });
  });

  it("không khai báo model nào vượt quá 1.050.000 token context", () => {
    for (const id of VERIFIED_MODEL_IDS) {
      expect(getCapability(id).contextTokens, id).toBeLessThanOrEqual(1050000);
    }
  });

  it("publicCapability chỉ trả các trường cần cho client", () => {
    expect(publicCapability("gpt-6-luna")).toEqual({
      contextTokens: 1050000,
      maxOutputTokens: 16384,
      vision: true,
      priceIn: 0.1,
      priceOut: 0.5,
    });
  });
});
