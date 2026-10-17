import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { MobileWelcomeScreen } from "@/components/study/mobile/welcome/MobileWelcomeScreen";

describe("MobileWelcomeScreen Component", () => {
  it("renders ZenStudy brand name and start button", () => {
    const html = renderToString(<MobileWelcomeScreen />);
    expect(html).toContain("ZenStudy Space");
    expect(html).toContain("BẮT ĐẦU HỌC NGAY");
    expect(html).toContain("Chạm bất kỳ đâu để vào");
  });

  it("displays the scene name when provided as a prop", () => {
    const html = renderToString(<MobileWelcomeScreen sceneName="Quán Cà Phê Mưa" />);
    expect(html).toContain("Quán Cà Phê Mưa");
  });
});
