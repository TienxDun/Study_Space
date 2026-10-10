import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { ZenStudyLogo } from "@/components/study/brand/ZenStudyLogo";
import { StudyTopBar } from "@/components/study/StudyTopBar";

describe("ZenStudy Brand Logo Component", () => {
  it("should render full SVG logo image with valid alt text and asset path", () => {
    const html = renderToString(React.createElement(ZenStudyLogo, { variant: "full" }));
    expect(html).toContain("src=\"/brand/zenstudy-logo.svg\"");
    expect(html).toContain("alt=\"ZenStudy Logo\"");
  });

  it("should render icon variant with valid icon SVG path", () => {
    const html = renderToString(React.createElement(ZenStudyLogo, { variant: "icon" }));
    expect(html).toContain("src=\"/brand/zenstudy-logo-icon.svg\"");
    expect(html).toContain("alt=\"ZenStudy Space Icon Logo\"");
  });

  it("should be rendered inside StudyTopBar brand capsule", () => {
    const html = renderToString(
      React.createElement(StudyTopBar, {
        isZenMode: false,
        isPomodoroVisible: false,
        centerTab: "clock",
        isGlobalMuted: false,
        isSettingsOpen: false,
        isFullscreen: false,
        onToggleClock: () => {},
        onToggleShortcuts: () => {},
        onEnterZen: () => {},
        onExitZen: () => {},
        onToggleMute: () => {},
        onToggleSettings: () => {},
        onToggleFullscreen: () => {},
      })
    );
    expect(html).toContain("src=\"/brand/zenstudy-logo.svg\"");
    expect(html).toContain("ZenStudy - Không gian học tập tương tác");
  });
});
