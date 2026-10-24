// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SessionDrawer } from "@/components/study/chat/components/SessionDrawer";
import type { Session, SessionPendingAction } from "@/components/study/chat/types";

// @ts-expect-error test act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const SESSIONS: Session[] = [{ id: "s1", title: "Đoạn chat thử", createdAt: Date.now() }];

function findButton(text: string, scope: ParentNode = document): HTMLButtonElement | undefined {
  return Array.from(scope.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(text)
  );
}

describe("SessionDrawer hành động xóa", () => {
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

  function renderDrawer(pendingAction: SessionPendingAction = null) {
    const onDelete = vi.fn();
    const onSwitch = vi.fn();
    const onCreate = vi.fn();
    act(() => {
      root.render(
        <SessionDrawer
          sessions={SESSIONS}
          activeSid="s1"
          loading={false}
          pendingAction={pendingAction}
          onCreate={onCreate}
          onSwitch={onSwitch}
          onDelete={onDelete}
          onRename={vi.fn()}
          onClose={vi.fn()}
        />
      );
    });
    return { onDelete, onSwitch, onCreate };
  }

  it("chỉ cần bấm Có một lần là xóa ngay", () => {
    const { onDelete } = renderDrawer();

    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Xóa đoạn chat Đoạn chat thử"]')
        ?.click();
    });
    expect(container.textContent).toContain("Xóa?");

    act(() => {
      findButton("Có")?.click();
    });

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith("s1");
  });

  it("hiện Đang xóa… và khóa thao tác trong lúc chờ", () => {
    const { onSwitch, onCreate } = renderDrawer({ type: "delete", sid: "s1" });

    expect(container.textContent).toContain("Đang xóa…");
    expect(findButton("Đoạn mới")?.disabled).toBe(true);

    act(() => {
      container.querySelector<HTMLElement>('p[title="Đoạn chat thử"]')?.click();
      findButton("Đoạn mới")?.click();
    });

    expect(onSwitch).not.toHaveBeenCalled();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("khóa nút xóa và đổi tên khi đang lưu tên mới", () => {
    renderDrawer({ type: "rename", sid: "s1" });

    const trash = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Xóa đoạn chat Đoạn chat thử"]'
    );
    const rename = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Đổi tên đoạn chat Đoạn chat thử"]'
    );

    expect(trash?.disabled).toBe(true);
    expect(rename?.disabled).toBe(true);
    expect(findButton("Đoạn mới")?.disabled).toBe(true);
  });
});
