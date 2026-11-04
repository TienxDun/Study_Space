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

    // Chạy hết reveal + delay kết thúc
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(handleFinish).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("renders developer preview toolbar and stays open when preview prop is true", () => {
    vi.useFakeTimers();
    act(() => {
      root.render(<MobileSplashScreen preview={true} duration={400} />);
    });

    const toolbar = document.body.textContent;
    expect(toolbar).toContain("Chế độ xem thử");
    expect(toolbar).toContain("Chạy lại");
    expect(toolbar).toContain("Đóng");

    // Cho dù chạy qua duration thì màn hình vẫn còn mở
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const splash = document.querySelector('[aria-label="Màn hình khởi động ứng dụng"]');
    expect(splash).not.toBeNull();

    vi.useRealTimers();
  });

  it("triggers onFinish when clicking Đóng in preview toolbar", () => {
    const handleFinish = vi.fn();
    act(() => {
      root.render(<MobileSplashScreen preview={true} onFinish={handleFinish} />);
    });

    const closeBtn = Array.from(document.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === "Đóng"
    );
    expect(closeBtn).toBeDefined();

    act(() => {
      closeBtn?.click();
    });

    expect(handleFinish).toHaveBeenCalledTimes(1);
  });

  it("resets progress when clicking Chạy lại in preview toolbar", () => {
    vi.useFakeTimers();
    act(() => {
      root.render(<MobileSplashScreen preview={true} duration={400} />);
    });

    // Chạy tới 100%
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const replayBtn = Array.from(document.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === "Chạy lại"
    );
    expect(replayBtn).toBeDefined();

    act(() => {
      replayBtn?.click();
    });

    const splash = document.querySelector('[aria-label="Màn hình khởi động ứng dụng"]');
    expect(splash).not.toBeNull();

    vi.useRealTimers();
  });

  it("waits for isReady to become true before calling onFinish", () => {
    vi.useFakeTimers();
    const handleFinish = vi.fn();

    // Render với isReady = false và duration = 400ms
    act(() => {
      root.render(
        <MobileSplashScreen
          forceShow={true}
          duration={400}
          isReady={false}
          maxDuration={3000}
          onFinish={handleFinish}
        />
      );
    });

    // Sau 800ms (đã quá duration 400ms) nhưng isReady vẫn false -> Chưa được đóng
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(handleFinish).not.toHaveBeenCalled();

    // Khi dữ liệu nạp xong, chuyển isReady thành true
    act(() => {
      root.render(
        <MobileSplashScreen
          forceShow={true}
          duration={400}
          isReady={true}
          maxDuration={3000}
          onFinish={handleFinish}
        />
      );
    });

    // Chạy thêm đủ cho reveal + delay thoát
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(handleFinish).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("force closes when maxDuration timeout is reached even if isReady is false", () => {
    vi.useFakeTimers();
    const handleFinish = vi.fn();

    act(() => {
      root.render(
        <MobileSplashScreen
          forceShow={true}
          duration={400}
          isReady={false}
          maxDuration={1500}
          onFinish={handleFinish}
        />
      );
    });

    // Trước khi chạm trần timeout 1500ms
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(handleFinish).not.toHaveBeenCalled();

    // Vượt qua trần timeout 1500ms + exit animation delay
    act(() => {
      vi.advanceTimersByTime(1300);
    });

    expect(handleFinish).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
