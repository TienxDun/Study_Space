// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MessageBubble } from "../../../features/chat-v2/components/MessageBubble";
import { SessionRail } from "../../../features/chat-v2/components/SessionRail";
import { Composer } from "../../../features/chat-v2/components/Composer";
import type { ChatV2Message } from "../../../features/chat-v2/types";

// @ts-expect-error test act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const THUMB = "data:image/jpeg;base64,AAAA";
const USER_MESSAGE: ChatV2Message = {
  id: "m1",
  role: "user",
  text: "xem ảnh",
  attachments: [{ id: "a1", name: "de-thi.png", kind: "image", thumb: THUMB }],
};

describe("xem lại ảnh đã gửi", () => {
  let container: HTMLDivElement;
  let root: Root;

  function mount(node: React.ReactElement) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(node);
    });
  }

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("bấm ảnh trong bong bóng tin nhắn mở bản xem trước và đóng bằng Escape", () => {
    mount(
      <MessageBubble
        message={USER_MESSAGE}
        streaming={false}
        canRegenerate={false}
        onRegenerate={() => {}}
      />
    );

    const button = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Xem ảnh de-thi.png"]'
    );
    expect(button).not.toBeNull();

    act(() => {
      button?.click();
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute("aria-label")).toBe("Xem ảnh de-thi.png");
    const image = dialog?.querySelector<HTMLImageElement>("img");
    expect(image?.getAttribute("src")).toBe(THUMB);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("bấm nền tối cũng đóng bản xem trước", () => {
    mount(
      <MessageBubble
        message={USER_MESSAGE}
        streaming={false}
        canRegenerate={false}
        onRegenerate={() => {}}
      />
    );

    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Xem ảnh de-thi.png"]')
        ?.click();
    });
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();

    act(() => {
      dialog?.click();
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("ảnh trong rail chi tiết phiên cũng mở được bản xem trước", () => {
    mount(
      <SessionRail
        summary={null}
        summarizing={false}
        files={[{ id: "a1", name: "de-thi.png", kind: "image", thumb: THUMB }]}
      />
    );

    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Xem ảnh de-thi.png"]')
        ?.click();
    });

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it("ảnh trong khay đính kèm trước khi gửi cũng xem trước được", () => {
    mount(
      <Composer
        input=""
        onInput={() => {}}
        inputRef={React.createRef<HTMLTextAreaElement>()}
        sending={false}
        canSend        attachments={[
          { id: "att-1", name: "de-thi.png", size: 1024, kind: "image", thumb: THUMB },
        ]}
        onAddFiles={vi.fn()}
        onRemoveAttachment={() => {}}
        onSend={() => {}}
        onStop={() => {}}
      />
    );

    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Xem ảnh de-thi.png"]')
        ?.click();
    });

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });
});
