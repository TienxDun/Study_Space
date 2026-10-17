// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { useMobileStack } from "@/components/study/mobile/navigation/useMobileStack";

// Đánh dấu môi trường hỗ trợ React 19 act()
// @ts-expect-error test act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("useMobileStack - Navigation & Deduplication Tests", () => {
  let container: HTMLDivElement;
  let root: Root;
  let hookResult: ReturnType<typeof useMobileStack>;

  beforeEach(() => {
    vi.restoreAllMocks();
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

  function TestHarness({
    onStackChange,
    isZenMode,
    onExitZen,
  }: {
    onStackChange?: (current: any, stack: any[]) => void;
    isZenMode?: boolean;
    onExitZen?: () => void;
  }) {
    hookResult = useMobileStack({ onStackChange, isZenMode, onExitZen });
    return React.createElement("div", null, `Stack: ${hookResult.stack.length}`);
  }

  it("khởi tạo với stack rỗng và đảm bảo có root guard ban đầu", () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");

    act(() => {
      root.render(React.createElement(TestHarness));
    });

    expect(hookResult.stack).toEqual([]);
    expect(hookResult.canGoBack).toBe(false);
    expect(hookResult.isOpen).toBe(false);
    // Component mount sẽ gọi ensureRootHistoryGuard() đẩy 1 guard state
    expect(pushStateSpy).toHaveBeenCalledWith({ studyMobileRootGuard: true }, "");
  });

  it("openRoot đặt một root screen duy nhất và gọi pushState", () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");

    act(() => {
      root.render(React.createElement(TestHarness));
    });

    pushStateSpy.mockClear();

    act(() => {
      hookResult.openRoot("tasks", "Công việc");
    });

    expect(hookResult.stack.length).toBe(1);
    expect(hookResult.currentScreen?.id).toBe("tasks");
    expect(hookResult.canGoBack).toBe(false);
    expect(hookResult.isOpen).toBe(true);
    expect(pushStateSpy).toHaveBeenCalledWith(
      { studyMobileStack: true, screenId: "tasks", depth: 1 },
      ""
    );
  });

  it("chuyển đổi giữa 2 root screens sử dụng replaceState mượt mà (không race condition)", () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    act(() => {
      root.render(React.createElement(TestHarness));
    });

    act(() => {
      hookResult.openRoot("tasks", "Công việc");
    });

    replaceStateSpy.mockClear();

    act(() => {
      hookResult.openRoot("notes", "Ghi chú");
    });

    expect(hookResult.stack.length).toBe(1);
    expect(hookResult.currentScreen?.id).toBe("notes");
    expect(replaceStateSpy).toHaveBeenCalledWith(
      { studyMobileStack: true, screenId: "notes", depth: 1 },
      ""
    );
  });

  it("PUSH DEDUPLICATION: chặn đẩy trùng màn hình đỉnh, ngăn ngừa bơm tràn window.history khi gõ phím", () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");

    act(() => {
      root.render(React.createElement(TestHarness));
    });

    // 1. Mở root tasks
    act(() => {
      hookResult.openRoot("tasks", "Công việc");
    });

    pushStateSpy.mockClear();

    // 2. Mở chi tiết task lần đầu
    act(() => {
      hookResult.push("tasks-detail", "Chi tiết việc");
    });

    expect(hookResult.stack.length).toBe(2);
    expect(hookResult.currentScreen?.id).toBe("tasks-detail");
    expect(hookResult.previousScreen?.id).toBe("tasks");
    expect(hookResult.canGoBack).toBe(true);
    expect(pushStateSpy).toHaveBeenCalledTimes(1);

    // 3. Giả lập người dùng gõ 10 ký tự trong modal chi tiết (mỗi ký tự trigger push trùng)
    for (let i = 0; i < 10; i++) {
      act(() => {
        hookResult.push("tasks-detail", "Chi tiết việc");
      });
    }

    // Chặn trùng tuyệt đối: stack vẫn là 2, pushState KHÔNG bị gọi thêm bất kỳ lần nào!
    expect(hookResult.stack.length).toBe(2);
    expect(pushStateSpy).toHaveBeenCalledTimes(1);
  });

  it("closeAll dọn sạch stack và gọi history.go đúng số bước", () => {
    const goSpy = vi.spyOn(window.history, "go").mockImplementation(() => {});

    act(() => {
      root.render(React.createElement(TestHarness));
    });

    act(() => {
      hookResult.openRoot("more", "Thêm");
    });
    act(() => {
      hookResult.push("settings", "Cài đặt");
    });

    expect(hookResult.stack.length).toBe(2);
    expect(hookResult.isOpen).toBe(true);

    act(() => {
      hookResult.closeAll();
    });

    expect(hookResult.stack).toEqual([]);
    expect(hookResult.isOpen).toBe(false);
    expect(hookResult.canGoBack).toBe(false);
    // Stack có depth 2 -> go(-2) để trở về guard state của màn hình chính
    expect(goSpy).toHaveBeenCalledWith(-2);
  });

  it("phím Back phần cứng lùi từ tầng con về tầng cha và không hiện toast thoát app", () => {
    act(() => {
      root.render(React.createElement(TestHarness));
    });

    act(() => {
      hookResult.openRoot("more", "Thêm");
    });
    act(() => {
      hookResult.push("settings", "Cài đặt");
    });

    expect(hookResult.stack.length).toBe(2);

    // Giả lập trình duyệt bắn popstate (nhấn phím Back điện thoại)
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    // Lùi từ settings về more
    expect(hookResult.stack.length).toBe(1);
    expect(hookResult.currentScreen?.id).toBe("more");
    expect(hookResult.canGoBack).toBe(false);

    // Nhấn tiếp phím Back điện thoại
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    // Lùi từ more về màn hình chính (stack rỗng)
    expect(hookResult.stack.length).toBe(0);
    expect(hookResult.isOpen).toBe(false);
  });

  it("chế độ Zen Mode: bấm Back lần 1 không thoát, bấm Back lần 2 trong vòng 2 giây sẽ gọi onExitZen", () => {
    vi.useFakeTimers();
    const onExitZen = vi.fn();

    act(() => {
      root.render(React.createElement(TestHarness, { isZenMode: true, onExitZen }));
    });

    // Bấm Back lần 1
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(onExitZen).not.toHaveBeenCalled();

    // Chờ 500ms (< 2000ms), bấm Back lần 2
    act(() => {
      vi.advanceTimersByTime(500);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    // Lần 2 trong 2s -> gọi onExitZen để thoát Zen mode
    expect(onExitZen).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
