// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RoomExitNotice } from "@/components/study/rooms/components/RoomExitNotice";
import { getRoomExitNotice } from "@/components/study/rooms/utils/room-exit";

// @ts-expect-error test act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function findButton(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(text)
  );
}

describe("RoomExitNotice", () => {
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

  it("hiện lời giải thích và cả hai nút cho ca bị mời ra", () => {
    const onDismiss = vi.fn();
    const onRejoin = vi.fn();

    act(() => {
      root.render(
        <RoomExitNotice
          notice={getRoomExitNotice(4, "on-thi-cuoi-ky")}
          onDismiss={onDismiss}
          onRejoin={onRejoin}
        />
      );
    });

    expect(container.textContent).toContain("Bạn được mời ra khỏi phòng");
    expect(container.textContent).toContain("on-thi-cuoi-ky");
    expect(findButton("Đã hiểu")).toBeDefined();
    expect(findButton("Vào lại phòng")).toBeDefined();

    act(() => {
      findButton("Đã hiểu")?.click();
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onRejoin).not.toHaveBeenCalled();

    act(() => {
      findButton("Vào lại phòng")?.click();
    });
    expect(onRejoin).toHaveBeenCalledTimes(1);
  });

  it("không hiện nút Vào lại khi thông báo không cho vào lại", () => {
    const notice = { ...getRoomExitNotice(4, "on-thi-cuoi-ky"), allowRejoin: false };

    act(() => {
      root.render(<RoomExitNotice notice={notice} onDismiss={vi.fn()} onRejoin={vi.fn()} />);
    });

    expect(container.textContent).toContain("Bạn được mời ra khỏi phòng");
    expect(findButton("Đã hiểu")).toBeDefined();
    expect(findButton("Vào lại phòng")).toBeUndefined();
  });

  it("không render gì khi thông báo được đánh dấu ẩn", () => {
    act(() => {
      root.render(
        <RoomExitNotice
          notice={getRoomExitNotice(1, "on-thi-cuoi-ky")}
          onDismiss={vi.fn()}
          onRejoin={vi.fn()}
        />
      );
    });

    expect(container.textContent).toBe("");
  });
});
