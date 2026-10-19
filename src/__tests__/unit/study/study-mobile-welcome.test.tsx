// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { MobileWelcomeScreen } from "@/components/study/mobile/welcome/MobileWelcomeScreen";
import { STORAGE_KEYS } from "@/lib/storage-keys";

// @ts-expect-error test act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("MobileWelcomeScreen Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
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
    localStorage.clear();
    sessionStorage.clear();
  });

  it("renders without crashing in SSR/server mode", () => {
    const html = renderToString(<MobileWelcomeScreen />);
    expect(html).toBeDefined();
  });

  it("accepts sceneName prop cleanly", () => {
    const html = renderToString(<MobileWelcomeScreen sceneName="Quán Cà Phê Mưa" />);
    expect(html).toBeDefined();
  });

  it("accepts onStart, onSelectScene and forceOpen props without error", () => {
    const handleStart = vi.fn();
    const handleSelectScene = vi.fn();
    const html = renderToString(
      <MobileWelcomeScreen
        sceneName="Thư Viện Đêm"
        onStart={handleStart}
        onSelectScene={handleSelectScene}
        forceOpen={true}
      />
    );
    expect(html).toBeDefined();
  });

  it("opens when localStorage does not have welcome completed flag", () => {
    act(() => {
      root.render(<MobileWelcomeScreen />);
    });

    const dialog = document.querySelector('[aria-label="Màn hình chào mừng ZenStudy"]');
    expect(dialog).not.toBeNull();
  });

  it("does NOT open when user has already completed welcome screen in localStorage", () => {
    localStorage.setItem(STORAGE_KEYS.mobileWelcomeCompleted, "true");

    act(() => {
      root.render(<MobileWelcomeScreen />);
    });

    const dialog = document.querySelector('[aria-label="Màn hình chào mừng ZenStudy"]');
    expect(dialog).toBeNull();
  });
});

