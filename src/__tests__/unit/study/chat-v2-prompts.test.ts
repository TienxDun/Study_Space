import { describe, expect, it } from "vitest";
import {
  PROMPT_VERSION,
  buildSystemPrompt,
  normalizeAgeBand,
} from "../../../../workers/chat-v2/prompts.js";

describe("chat v2 prompt 16+", () => {
  it("luôn có safety core và age band mặc định 16-17", () => {
    const prompt = buildSystemPrompt(undefined);
    expect(prompt).toContain("Trợ lý học tập ZenStudy");
    expect(prompt).toContain("Người dùng 16–17 tuổi");
    expect(prompt).toContain("Không tạo nội dung tình dục");
    expect(prompt).toContain("111");
    expect(PROMPT_VERSION).toMatch(/^16\./);
  });

  it("đổi sang nhánh 18+", () => {
    expect(buildSystemPrompt("18+")).toContain("Người dùng từ 18 tuổi trở lên");
    expect(normalizeAgeBand("18+")).toBe("18+");
    expect(normalizeAgeBand("13-15")).toBe("16-17");
    expect(normalizeAgeBand(null)).toBe("16-17");
  });
});
