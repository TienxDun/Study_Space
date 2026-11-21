// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ModelPicker } from "../../../features/chat-v2/components/ModelPicker";
import type { ChatV2Model } from "../../../features/chat-v2/types";

// @ts-expect-error test act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// motapis trả owned_by = "openai" cho hầu hết model, chỉ claude là "claude"
const MOCK_MODELS: ChatV2Model[] = [
  { id: "deepseek-v4-flash", ownedBy: "openai", free: true, available: true, contextTokens: 1048576, maxOutputTokens: 16384, priceIn: 0.07, priceOut: 0.14 },
  { id: "claude-sonnet-5-5", ownedBy: "claude", free: true, available: true, contextTokens: 1048576, maxOutputTokens: 16384, priceIn: 1.2, priceOut: 6 },
  { id: "deepseek-v4-pro", ownedBy: "openai", free: false, available: true, contextTokens: 1048576, maxOutputTokens: 16384, priceIn: 0.22, priceOut: 0.44 },
  { id: "gpt-6-luna", ownedBy: "openai", free: true, available: true, contextTokens: 1048576, maxOutputTokens: 16384, priceIn: 0.1, priceOut: 0.5 },
  { id: "gemini-3.8-flash", ownedBy: "openai", free: true, available: true, contextTokens: 1048576, maxOutputTokens: 16384, priceIn: 0.4, priceOut: 2 },
  { id: "qwen3.8-max", ownedBy: "openai", free: true, available: true, contextTokens: 1048576, maxOutputTokens: 16384, priceIn: 1, priceOut: 3 },
  { id: "glm-5.3-flash", ownedBy: "openai", free: true, available: true, contextTokens: 1048576, maxOutputTokens: 16384, priceIn: 0.075, priceOut: 0.25 },
  { id: "grok-4.5", ownedBy: "xai", free: true, available: false, contextTokens: 500000, maxOutputTokens: 16384, priceIn: 1.2, priceOut: 2.4 },
  // Các model hình ảnh/video cần bị loại bỏ:
  { id: "gpt-image-2", ownedBy: "openai", free: false, available: true, contextTokens: 0, maxOutputTokens: 0 },
  { id: "grok-imagine-image-2.0", ownedBy: "xai", free: false, available: true, contextTokens: 0, maxOutputTokens: 0 },
  { id: "grok-imagine-video-1.5", ownedBy: "xai", free: false, available: true, contextTokens: 0, maxOutputTokens: 0 },
];

function findButton(text: string, scope: ParentNode = document): HTMLButtonElement | undefined {
  return Array.from(scope.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(text)
  );
}

describe("ModelPicker component", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  async function pickProvider(label: string) {
    const trigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label^="Lọc theo hãng"]'
    );
    await act(async () => {
      trigger?.click();
    });
    const menu = container.querySelector<HTMLElement>(
      '[role="menu"][aria-label="Lọc theo hãng"]'
    );
    const option = Array.from(menu?.querySelectorAll("button") ?? []).find((button) =>
      button.textContent?.includes(label)
    );
    expect(option).toBeDefined();
    await act(async () => {
      option?.click();
    });
  }

  it("loại bỏ hoàn toàn các model hình ảnh và video", async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        <ModelPicker
          models={MOCK_MODELS}
          value="deepseek-v4-flash"
          onChange={onChange}
        />
      );
    });

    // Mở popover picker
    const trigger = findButton("deepseek-v4-flash", container);
    expect(trigger).toBeDefined();

    await act(async () => {
      trigger?.click();
    });

    const text = container.textContent || "";
    // Không được có model hình ảnh hay video
    expect(text.includes("gpt-image-2")).toBe(false);
    expect(text.includes("grok-imagine-image")).toBe(false);
    expect(text.includes("grok-imagine-video")).toBe(false);

    // Có các model chat hợp lệ
    expect(text.includes("claude-sonnet-5-5")).toBe(true);
    expect(text.includes("deepseek-v4-flash")).toBe(true);
  });

  it("cho phép lọc theo Miễn phí và Hãng", async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        <ModelPicker
          models={MOCK_MODELS}
          value="deepseek-v4-flash"
          onChange={onChange}
        />
      );
    });

    const trigger = findButton("deepseek-v4-flash", container);
    await act(async () => {
      trigger?.click();
    });

    // Bấm chip filter "Miễn phí" (chip lọc, không phải nhãn trong danh sách)
    const freeChip = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")
    ).find((button) => button.textContent?.includes("Miễn phí"));
    expect(freeChip).toBeDefined();

    await act(async () => {
      freeChip?.click();
    });

    // deepseek-v4-pro là model trả phí, không được xuất hiện trong listbox
    const listbox = container.querySelector('[role="listbox"]');
    expect(listbox?.textContent?.includes("deepseek-v4-pro")).toBe(false);
    expect(listbox?.textContent?.includes("claude-sonnet-5-5")).toBe(true);

    // Bấm chip filter "Claude" trong menu hãng
    await pickProvider("Claude");

    expect(listbox?.textContent?.includes("claude-sonnet-5-5")).toBe(true);
    expect(listbox?.textContent?.includes("deepseek-v4-flash")).toBe(false);
  });

  it("phân loại provider theo id dù owned_by của motapis là openai", async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        <ModelPicker
          models={MOCK_MODELS}
          value="deepseek-v4-flash"
          onChange={onChange}
        />
      );
    });

    const trigger = findButton("deepseek-v4-flash", container);
    await act(async () => {
      trigger?.click();
    });
    const listbox = container.querySelector('[role="listbox"]');

    // OpenAI chỉ chứa model gpt, không nuốt deepseek/qwen/glm
    await pickProvider("OpenAI");
    expect(listbox?.textContent?.includes("gpt-6-luna")).toBe(true);
    expect(listbox?.textContent?.includes("deepseek-v4-flash")).toBe(false);
    expect(listbox?.textContent?.includes("qwen3.8-max")).toBe(false);
    expect(listbox?.textContent?.includes("glm-5.3-flash")).toBe(false);

    await pickProvider("DeepSeek");
    expect(listbox?.textContent?.includes("deepseek-v4-flash")).toBe(true);
    expect(listbox?.textContent?.includes("gpt-6-luna")).toBe(false);

    await pickProvider("Qwen");
    expect(listbox?.textContent?.includes("qwen3.8-max")).toBe(true);
    expect(listbox?.textContent?.includes("deepseek-v4-flash")).toBe(false);

    await pickProvider("GLM");
    expect(listbox?.textContent?.includes("glm-5.3-flash")).toBe(true);
    expect(listbox?.textContent?.includes("qwen3.8-max")).toBe(false);
  });

  it("hiển thị giá vào/ra mỗi 1M token cho từng model", async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        <ModelPicker
          models={MOCK_MODELS}
          value="deepseek-v4-flash"
          onChange={onChange}
        />
      );
    });

    const trigger = findButton("deepseek-v4-flash", container);
    await act(async () => {
      trigger?.click();
    });

    const listbox = container.querySelector('[role="listbox"]');
    expect(listbox?.textContent).toContain("$0.07/$0.14");
    expect(listbox?.textContent).toContain("$1.2/$6");

    const sortButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label^="Sắp xếp theo giá"]'
    );
    expect(sortButton).not.toBeNull();
    await act(async () => {
      sortButton?.click();
    });
    const sortMenu = container.querySelector('[role="menu"][aria-label="Sắp xếp theo giá"]');
    expect(sortMenu?.textContent).toContain("Giá vào/ra · USD / 1M token");
  });

  it("sắp xếp được theo giá tăng dần và giảm dần", async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        <ModelPicker
          models={MOCK_MODELS}
          value="deepseek-v4-flash"
          onChange={onChange}
        />
      );
    });

    const trigger = findButton("deepseek-v4-flash", container);
    await act(async () => {
      trigger?.click();
    });

    const optionTexts = () =>
      Array.from(container.querySelectorAll('[role="option"]')).map(
        (option) => option.textContent || ""
      );
    const sortButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label^="Sắp xếp theo giá"]'
    );
    expect(sortButton).not.toBeNull();

    await act(async () => {
      sortButton?.click();
    });
    const ascOption = Array.from(
      container.querySelectorAll('[role="menuitemradio"]')
    ).find((item) => item.textContent?.includes("Giá thấp"));
    expect(ascOption).toBeDefined();
    await act(async () => {
      (ascOption as HTMLButtonElement).click();
    });

    const ascending = optionTexts();
    expect(ascending[0]).toContain("deepseek-v4-flash");
    expect(ascending[1]).toContain("glm-5.3-flash");
    expect(ascending[ascending.length - 1]).toContain("claude-sonnet-5-5");

    await act(async () => {
      sortButton?.click();
    });
    const descOption = Array.from(
      container.querySelectorAll('[role="menuitemradio"]')
    ).find((item) => item.textContent?.includes("Giá cao"));
    expect(descOption).toBeDefined();
    await act(async () => {
      (descOption as HTMLButtonElement).click();
    });

    const descending = optionTexts();
    expect(descending[0]).toContain("claude-sonnet-5-5");
    expect(descending[descending.length - 1]).toContain("deepseek-v4-flash");
  });

  it("gọi onChange khi người dùng chọn một model", async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        <ModelPicker
          models={MOCK_MODELS}
          value="deepseek-v4-flash"
          onChange={onChange}
        />
      );
    });

    const trigger = findButton("deepseek-v4-flash", container);
    await act(async () => {
      trigger?.click();
    });

    const claudeOption = findButton("claude-sonnet-5-5", container);
    expect(claudeOption).toBeDefined();

    await act(async () => {
      claudeOption?.click();
    });

    expect(onChange).toHaveBeenCalledWith("claude-sonnet-5-5");
  });

  it("khoá model chưa xác minh và model đang hỏng", async () => {
    const lockedModels: ChatV2Model[] = [
      { id: "deepseek-v4-flash", ownedBy: "DeepSeek", free: true, available: true, contextTokens: 1048576, maxOutputTokens: 16384, priceIn: 0.07, priceOut: 0.14, checkedAt: "2026-11-20T18:32:39.607Z" },
      { id: "claude-opus-5-5", ownedBy: "Anthropic", free: false, available: null, contextTokens: 1000000, maxOutputTokens: 16384, priceIn: 2.4, priceOut: 12 },
      { id: "grok-4.5", ownedBy: "xAI", free: true, available: false, contextTokens: null, maxOutputTokens: null, priceIn: 1.2, priceOut: 2.4, checkedAt: "2026-11-20T18:38:54.931Z" },
    ];
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        <ModelPicker models={lockedModels} value="deepseek-v4-flash" onChange={onChange} />
      );
    });

    const trigger = findButton("deepseek-v4-flash", container);
    await act(async () => {
      trigger?.click();
    });

    const options = () =>
      Array.from(container.querySelectorAll<HTMLButtonElement>('[role="option"]'));
    const unverified = options().find((option) => option.textContent?.includes("claude-opus-5-5"));
    const broken = options().find((option) => option.textContent?.includes("grok-4.5"));
    expect(unverified?.disabled).toBe(true);
    expect(unverified?.textContent).toContain("Đang xác minh");
    expect(broken?.disabled).toBe(true);
    expect(broken?.textContent).toContain("Tạm không khả dụng");

    await act(async () => {
      unverified?.click();
    });
    expect(onChange).not.toHaveBeenCalled();

    expect(container.textContent).toContain("3 model · 1 dùng được");
  });
});
