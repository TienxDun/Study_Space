// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Composer } from "../../../features/chat-v2/components/Composer";

// @ts-expect-error test act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function dragEvent(
  type: string,
  target: HTMLElement,
  data: { types: string[]; files: File[] }
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: { types: data.types, files: data.files, dropEffect: "" },
  });
  target.dispatchEvent(event);
  return event;
}

describe("Composer kéo thả tệp", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onAddFiles = vi.fn();

  async function renderComposer({ sending = false } = {}) {
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
          sending={sending}
          canSend={false}
          visionBlocked={false}
          attachments={[]}
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

  it("hiện gợi ý khi kéo tệp vào và ẩn khi kéo ra", async () => {
    const textarea = await renderComposer();

    await act(async () => {
      dragEvent("dragenter", textarea, { types: ["Files"], files: [] });
    });
    expect(container.textContent).toContain("Thả tệp để đính kèm");

    await act(async () => {
      dragEvent("dragleave", textarea, { types: ["Files"], files: [] });
    });
    expect(container.textContent).not.toContain("Thả tệp để đính kèm");
  });

  it("thả tệp thì chặn trình duyệt mở tệp và chuyển cho onAddFiles", async () => {
    const textarea = await renderComposer();
    const file = new File(["png"], "de-thi.png", { type: "image/png" });

    let event: Event = new Event("drop");
    await act(async () => {
      event = dragEvent("drop", textarea, { types: ["Files"], files: [file] });
    });

    expect(event.defaultPrevented).toBe(true);
    expect(onAddFiles).toHaveBeenCalledTimes(1);
    const added = onAddFiles.mock.calls[0][0] as File[];
    expect(added).toHaveLength(1);
    expect(added[0].name).toBe("de-thi.png");
    expect(container.textContent).not.toContain("Thả tệp để đính kèm");
  });

  it("bỏ qua khi đang gửi câu trả lời", async () => {
    const textarea = await renderComposer({ sending: true });
    const file = new File(["png"], "de-thi.png", { type: "image/png" });

    await act(async () => {
      dragEvent("dragenter", textarea, { types: ["Files"], files: [] });
    });
    expect(container.textContent).not.toContain("Thả tệp để đính kèm");

    await act(async () => {
      dragEvent("drop", textarea, { types: ["Files"], files: [file] });
    });
    expect(onAddFiles).not.toHaveBeenCalled();
  });

  it("không can thiệp khi kéo chữ thường", async () => {
    const textarea = await renderComposer();

    await act(async () => {
      dragEvent("dragenter", textarea, { types: ["text/plain"], files: [] });
    });
    expect(container.textContent).not.toContain("Thả tệp để đính kèm");
  });
});
