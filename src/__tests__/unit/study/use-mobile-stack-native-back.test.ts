// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { useMobileStack } from "@/components/study/mobile/navigation/useMobileStack";

// @ts-expect-error test act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const native = vi.hoisted(() => ({
  handler: null as (() => void) | null,
  register: vi.fn(),
  unregister: vi.fn(),
  exit: vi.fn(),
}));

vi.mock("@/lib/google-sign-in", () => ({ isNativeApp: () => true }));
vi.mock("@/lib/native-back", () => ({
  registerNativeBackHandler: (handler: () => void) => {
    native.handler = handler;
    native.register();
    return () => {
      native.unregister();
      native.handler = null;
    };
  },
  exitNativeApp: native.exit,
}));

describe("useMobileStack - Back hệ thống trên app Android", () => {
  let container: HTMLDivElement;
  let root: Root;
  let mounted = true;
  let hookResult: ReturnType<typeof useMobileStack>;

  beforeEach(() => {
    vi.restoreAllMocks();
    mounted = true;
    native.handler = null;
    native.register.mockClear();
    native.unregister.mockClear();
    native.exit.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (mounted) {
      act(() => {
        root.unmount();
      });
    }
    container.remove();
  });

  function TestHarness() {
    hookResult = useMobileStack();
    return React.createElement("div", null, `Stack: ${hookResult.stack.length}`);
  }

  function pressSystemBack() {
    act(() => {
      native.handler?.();
    });
    // WebView lùi history -> trình duyệt phát popstate
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
  }

  it("đăng ký listener Back native khi mount và gỡ khi unmount", () => {
    act(() => {
      root.render(React.createElement(TestHarness));
    });

    expect(native.register).toHaveBeenCalledTimes(1);
    expect(native.handler).toBeTypeOf("function");

    act(() => {
      root.unmount();
    });
    mounted = false;

    expect(native.unregister).toHaveBeenCalledTimes(1);
  });

  it("Back hệ thống lùi stack qua history của WebView", () => {
    const backSpy = vi.spyOn(window.history, "back").mockImplementation(() => {});

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

    pressSystemBack();

    expect(backSpy).toHaveBeenCalledTimes(1);
    expect(hookResult.stack.length).toBe(1);
    expect(hookResult.currentScreen?.id).toBe("more");
  });

  it("Back lần thứ 2 ở màn hình chính gọi exitNativeApp thay vì history.back", () => {
    vi.useFakeTimers();
    vi.spyOn(window.history, "back").mockImplementation(() => {});

    act(() => {
      root.render(React.createElement(TestHarness));
    });

    pressSystemBack();
    expect(native.exit).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    pressSystemBack();

    expect(native.exit).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
