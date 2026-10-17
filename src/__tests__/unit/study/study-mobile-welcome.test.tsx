import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { MobileWelcomeScreen } from "@/components/study/mobile/welcome/MobileWelcomeScreen";

describe("MobileWelcomeScreen Component", () => {
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
});
