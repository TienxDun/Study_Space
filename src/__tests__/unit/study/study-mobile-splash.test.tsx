// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { MobileSplashScreen } from "@/components/study/mobile/splash/MobileSplashScreen";

// @ts-expect-error test act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("MobileSplashScreen Component", () => {
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

  it("renders without crashing in SSR/server mode", () => {
    const html = renderToString(<MobileSplashScreen />);
    expect(html).toBeDefined();
  });

  it("renders splash screen in DOM with branding logo and status", () => {
    act(() => {
      root.render(<MobileSplashScreen forceShow={true} />);
    });

    const splash = document.querySelector('[aria-label="Màn hình khởi động ứng dụng"]');
    expect(splash).not.toBeNull();
    expect(document.body.textContent).toContain("ZEN");
    expect(document.body.textContent).toContain("STUDY");
    expect(document.body.textContent).toContain("Không gian học tập & làm việc sâu");
  });

  it("calls onFinish callback after duration expires", () => {
    vi.useFakeTimers();
    const handleFinish = vi.fn();

    act(() => {
      root.render(<MobileSplashScreen forceShow={true} duration={400} onFinish={handleFinish} />);
    });

    // Lúc ban đầu chưa gọi finish
    expect(handleFinish).not.toHaveBeenCalled();

    // Chạy hết duration + delay kết thúc
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(handleFinish).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
