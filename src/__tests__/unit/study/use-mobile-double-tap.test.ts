// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { useMobileDoubleTap } from "@/components/study/mobile/hooks/useMobileDoubleTap";

// @ts-expect-error test act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("useMobileDoubleTap - Gestures & Anti-Mistrigger Tests", () => {
  let container: HTMLDivElement;
  let root: Root;

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
    enabled = true,
    onDoubleTap,
    maxDelay = 320,
    maxDistance = 32,
  }: {
    enabled?: boolean;
    onDoubleTap: () => void;
    maxDelay?: number;
    maxDistance?: number;
  }) {
    useMobileDoubleTap({ enabled, onDoubleTap, maxDelay, maxDistance });
    return React.createElement(
      "div",
      { id: "test-bg" },
      React.createElement("button", { id: "test-btn" }, "Nút bấm"),
      React.createElement("input", { id: "test-input", defaultValue: "Input" }),
      React.createElement("div", { id: "test-content" }, "Nền trống")
    );
  }

  function simulateTap(target: EventTarget, x: number, y: number, duration = 50) {
    const touchObj = {
      clientX: x,
      clientY: y,
      identifier: 0,
      target,
    } as unknown as Touch;

    const startEvent = new CustomEvent("touchstart", { bubbles: true }) as unknown as TouchEvent;
    Object.defineProperty(startEvent, "touches", { value: [touchObj] });
    Object.defineProperty(startEvent, "target", { value: target });
    window.dispatchEvent(startEvent);

    if (duration > 0) {
      vi.advanceTimersByTime(duration);
    }

    const endEvent = new CustomEvent("touchend", { bubbles: true }) as unknown as TouchEvent;
    Object.defineProperty(endEvent, "changedTouches", { value: [touchObj] });
    Object.defineProperty(endEvent, "touches", { value: [] });
    Object.defineProperty(endEvent, "target", { value: target });
    window.dispatchEvent(endEvent);
  }

  it("kích hoạt onDoubleTap khi chạm đúp nhanh vào nền trống hợp lệ", () => {
    vi.useFakeTimers();
    const onDoubleTap = vi.fn();

    act(() => {
      root.render(React.createElement(TestHarness, { onDoubleTap }));
    });

    const content = container.querySelector("#test-content")!;

    // Tap 1
    act(() => {
      simulateTap(content, 100, 100, 40);
    });
    expect(onDoubleTap).not.toHaveBeenCalled();

    // Chờ 100ms (< 320ms)
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Tap 2 tại vị trí gần (105, 102)
    act(() => {
      simulateTap(content, 105, 102, 40);
    });

    expect(onDoubleTap).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("KHÔNG kích hoạt onDoubleTap khi chạm vào button hoặc interactive element", () => {
    vi.useFakeTimers();
    const onDoubleTap = vi.fn();

    act(() => {
      root.render(React.createElement(TestHarness, { onDoubleTap }));
    });

    const button = container.querySelector("#test-btn")!;

    act(() => {
      simulateTap(button, 100, 100, 40);
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      simulateTap(button, 100, 100, 40);
    });

    expect(onDoubleTap).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("KHÔNG kích hoạt onDoubleTap khi khoảng cách giữa 2 lần tap quá xa (> maxDistance)", () => {
    vi.useFakeTimers();
    const onDoubleTap = vi.fn();

    act(() => {
      root.render(React.createElement(TestHarness, { onDoubleTap, maxDistance: 32 }));
    });

    const content = container.querySelector("#test-content")!;

    act(() => {
      simulateTap(content, 50, 50, 40);
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    // Tap lần 2 ở toạ độ (200, 200) cách xa 212px
    act(() => {
      simulateTap(content, 200, 200, 40);
    });

    expect(onDoubleTap).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("KHÔNG kích hoạt onDoubleTap khi khoảng thời gian giữa 2 lần tap quá lâu (> maxDelay)", () => {
    vi.useFakeTimers();
    const onDoubleTap = vi.fn();

    act(() => {
      root.render(React.createElement(TestHarness, { onDoubleTap, maxDelay: 320 }));
    });

    const content = container.querySelector("#test-content")!;

    act(() => {
      simulateTap(content, 100, 100, 40);
    });
    // Chờ 500ms (> 320ms)
    act(() => {
      vi.advanceTimersByTime(500);
    });
    act(() => {
      simulateTap(content, 102, 102, 40);
    });

    expect(onDoubleTap).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("KHÔNG kích hoạt khi enabled = false (ví dụ đang mở sheet)", () => {
    vi.useFakeTimers();
    const onDoubleTap = vi.fn();

    act(() => {
      root.render(React.createElement(TestHarness, { enabled: false, onDoubleTap }));
    });

    const content = container.querySelector("#test-content")!;

    act(() => {
      simulateTap(content, 100, 100, 40);
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      simulateTap(content, 102, 102, 40);
    });

    expect(onDoubleTap).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
