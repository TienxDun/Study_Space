// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MessageBubble } from "../../../features/chat-v2/components/MessageBubble";
import type { ChatV2Message } from "../../../features/chat-v2/types";

const mocks = vi.hoisted(() => ({
  loadChatImage: vi.fn<(id: string) => Promise<string | null>>(),
}));

vi.mock("../../../features/chat-v2/lib/image-store", () => ({
  loadChatImage: mocks.loadChatImage,
  saveChatImage: vi.fn(),
  deleteChatImages: vi.fn(),
  pruneChatImages: vi.fn(),
}));

// @ts-expect-error test act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const THUMB = "data:image/jpeg;base64,THUMB";
const FULL = "data:image/jpeg;base64,FULL";
const USER_MESSAGE: ChatV2Message = {
  id: "m1",
  role: "user",
  text: "xem ảnh",
  attachments: [{ id: "a1", name: "de-thi.png", kind: "image", thumb: THUMB }],
};

describe("xem lại ảnh đã gửi ở bản gốc", () => {
  let container: HTMLDivElement;
  let root: Root;

  function mount() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <MessageBubble
          message={USER_MESSAGE}
          streaming={false}
          canRegenerate={false}
          onRegenerate={() => {}}
        />
      );
    });
  }

  async function openPreview() {
    const button = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Xem ảnh de-thi.png"]'
    );
    await act(async () => {
      button?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    return document.querySelector<HTMLElement>('[role="dialog"]');
  }

  beforeEach(() => {
    mocks.loadChatImage.mockReset();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("tải ảnh gốc trong IndexedDB thay cho thumb", async () => {
    mocks.loadChatImage.mockResolvedValue(FULL);
    mount();

    const dialog = await openPreview();
    expect(mocks.loadChatImage).toHaveBeenCalledWith("a1");
    expect(dialog?.querySelector<HTMLImageElement>("img")?.getAttribute("src")).toBe(FULL);
    expect(dialog?.textContent).not.toContain("Ảnh cũ");
  });

  it("ảnh cũ chưa có bản gốc thì giữ thumb và ghi chú", async () => {
    mocks.loadChatImage.mockResolvedValue(null);
    mount();

    const dialog = await openPreview();
    const image = dialog?.querySelector<HTMLImageElement>("img");
    expect(image?.getAttribute("src")).toBe(THUMB);

    Object.defineProperty(image as HTMLImageElement, "naturalWidth", {
      value: 240,
      configurable: true,
    });
    act(() => {
      image?.dispatchEvent(new Event("load"));
    });
    expect(dialog?.textContent).toContain("Ảnh cũ chỉ còn bản xem trước nhỏ.");
  });
});
