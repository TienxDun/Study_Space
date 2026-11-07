// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";

// @ts-expect-error test act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function findButton(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(text)
  );
}

describe("ConfirmDeleteModal chế độ chờ", () => {
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

  function renderModal(props: { pending?: boolean }) {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    act(() => {
      root.render(
        <ConfirmDeleteModal
          isOpen
          onClose={onClose}
          onConfirm={onConfirm}
          confirmText="Đăng xuất"
          {...props}
        />
      );
    });
    return { onConfirm, onClose };
  }

  it("khóa nút và hiện Đang xử lý… khi pending", () => {
    const { onConfirm, onClose } = renderModal({ pending: true });

    expect(document.body.textContent).toContain("Đang xử lý…");

    act(() => {
      findButton("Đang xử lý…")?.click();
      findButton("Hủy")?.click();
    });

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("khi có pending, modal không tự đóng sau khi bấm xác nhận", () => {
    const { onConfirm, onClose } = renderModal({ pending: false });

    act(() => {
      findButton("Đăng xuất")?.click();
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("giữ hành vi cũ cho thao tác đồng bộ: xác nhận rồi đóng ngay", () => {
    const { onConfirm, onClose } = renderModal({});

    act(() => {
      findButton("Đăng xuất")?.click();
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("hỗ trợ tùy biến confirmClassName cho thao tác tích cực (bổ nhiệm)", () => {
    act(() => {
      root.render(
        <ConfirmDeleteModal
          isOpen
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          confirmText="Bổ nhiệm"
          confirmClassName="bg-sky-600 hover:bg-sky-500 shadow-sky-600/30"
        />
      );
    });

    const button = findButton("Bổ nhiệm");
    expect(button?.className).toContain("bg-sky-600");
    expect(button?.className).not.toContain("bg-rose-600");
  });
});
