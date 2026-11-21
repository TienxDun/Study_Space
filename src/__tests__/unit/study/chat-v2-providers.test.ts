import { describe, it, expect } from "vitest";
import { providerOf } from "../../../features/chat-v2/lib/providers";

// owned_by của motapis gần như luôn là "openai", kể cả với model hãng khác.
const gatewayModel = (id: string) => ({ id, ownedBy: "openai" });

describe("providerOf", () => {
  it("nhận diện hãng theo id khi owned_by bị gateway gán chung", () => {
    expect(providerOf(gatewayModel("DeepSeek-V4-Flash-0731")).key).toBe("deepseek");
    expect(providerOf(gatewayModel("qwen3.8-max")).key).toBe("qwen");
    expect(providerOf(gatewayModel("glm-5.3-flash")).key).toBe("glm");
    expect(providerOf(gatewayModel("kimi-k3.1-pro")).key).toBe("kimi");
    expect(providerOf(gatewayModel("grok-4.7")).key).toBe("grok");
    expect(providerOf(gatewayModel("mimo-v2.5-pro")).key).toBe("mimo");
    expect(providerOf(gatewayModel("minimax-m3")).key).toBe("minimax");
    expect(providerOf(gatewayModel("hy3")).key).toBe("hunyuan");
    expect(providerOf(gatewayModel("gemini-3.8-flash")).key).toBe("gemini");
    expect(providerOf(gatewayModel("gpt-6-luna")).key).toBe("openai");
    expect(providerOf(gatewayModel("o3-mini")).key).toBe("openai");
    expect(providerOf(gatewayModel("claude-sonnet-5-5")).key).toBe("claude");
  });

  it("dùng owned_by làm dự phòng khi id không khớp họ model nào", () => {
    expect(providerOf({ id: "custom-model", ownedBy: "anthropic" }).key).toBe("claude");
    expect(providerOf({ id: "custom-model", ownedBy: "zhipu" }).key).toBe("glm");
    expect(providerOf({ id: "custom-model", ownedBy: "motapis" }).key).toBe("other");
    expect(providerOf({ id: "custom-model", ownedBy: "openai" }).key).toBe("other");
    expect(providerOf({ id: "custom-model", ownedBy: "" }).key).toBe("other");
  });
});
