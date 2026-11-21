// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Composer } from "../../../features/chat-v2/components/Composer";

// @ts-expect-error test act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function pasteEvent(textarea: HTMLTextAreaElement, clipboardData: unknown): Event {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: clipboardData });
  textarea.dispatchEvent(event);
  return event;
}

describe("Composer dán ảnh từ clipboard", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onAddFiles = vi.fn();

  async function renderComposer() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const inputRef = React.createRef<HTMLTextAreaElement>();
    await act(async () => {
      root.render(
        <Composer
          input=""
          onInput={() => {}}
          inputRef={inputRef}
          sending={false}
          canSend={false}          attachments={[]}
          onAddFiles={onAddFiles}
          onRemoveAttachment={() => {}}
          onSend={() => {}}
          onStop={() => {}}
        />
      );
    });
    const textarea = container.querySelector<HTMLTextAreaElement>("#chat-v2-input");
    expect(textarea).not.toBeNull();
    return textarea as HTMLTextAreaElement;
  }

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    onAddFiles.mockClear();
  });

  it("dán ảnh từ clipboard thì chặn dán chữ và thêm tệp ảnh", async () => {
    const textarea = await renderComposer();
    const file = new File(["png"], "", { type: "image/png" });

    let event: Event = new Event("paste");
    await act(async () => {
      event = pasteEvent(textarea, {
        items: [{ kind: "file", type: "image/png", getAsFile: () => file }],
        files: [],
      });
    });

    expect(event.defaultPrevented).toBe(true);
    expect(onAddFiles).toHaveBeenCalledTimes(1);
    const added = onAddFiles.mock.calls[0][0] as File[];
    expect(added).toHaveLength(1);
    expect(added[0].name).toMatch(/^clipboard-\d+-1\.png$/);
    expect(added[0].type).toBe("image/png");
  });

  it("giữ tên tệp nếu clipboard đã có tên", async () => {
    const textarea = await renderComposer();
    const file = new File(["png"], "image.png", { type: "image/png" });

    await act(async () => {
      pasteEvent(textarea, {
        items: [{ kind: "file", type: "image/png", getAsFile: () => file }],
        files: [],
      });
    });

    const added = onAddFiles.mock.calls[0][0] as File[];
    expect(added[0].name).toBe("image.png");
  });

  it("không can thiệp khi dán chữ thường", async () => {
    const textarea = await renderComposer();

    let event: Event = new Event("paste");
    await act(async () => {
      event = pasteEvent(textarea, {
        items: [{ kind: "string", type: "text/plain", getAsFile: () => null }],
        files: [],
      });
    });

    expect(event.defaultPrevented).toBe(false);
    expect(onAddFiles).not.toHaveBeenCalled();
  });
});
