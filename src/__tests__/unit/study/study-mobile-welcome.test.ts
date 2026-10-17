import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { MobileWelcomeScreen } from "@/components/study/mobile/welcome/MobileWelcomeScreen";

describe("MobileWelcomeScreen Component", () => {
  it("should return null when isMobile is false", () => {
    const html = renderToString(
      React.createElement(MobileWelcomeScreen, {
        isMobile: false,
      })
    );
    expect(html).toBe("");
  });

  it("should render welcome screen elements when isMobile is true", () => {
    const html = renderToString(
      React.createElement(MobileWelcomeScreen, {
        isMobile: true,
        currentSceneName: "Quán Cà Phê Mưa",
      })
    );
    expect(html).toContain("Vào bàn học ngay");
    expect(html).toContain("ZenStudy");
    expect(html).toContain("Quán Cà Phê Mưa");
    expect(html).toContain("Sẵn sàng học tập");
  });
});
