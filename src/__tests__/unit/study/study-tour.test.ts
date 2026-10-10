import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { StudyOnboardingTour } from "@/components/study/tour/StudyOnboardingTour";
import { StudyShortcutsModal } from "@/components/study/StudyShortcutsModal";

describe("Onboarding Tour Component", () => {
  it("should render active tour card when isOpen is true", () => {
    const html = renderToString(React.createElement(StudyOnboardingTour, { isOpen: true }));
    expect(html).toContain("Chào bạn tới ZenStudy Space");
    expect(html).toContain("1 / 7");
    expect(html).toContain("Tiếp tục");
    expect(html).toContain("Quay lại");
  });

  it("should not render tour when isOpen is false", () => {
    const html = renderToString(React.createElement(StudyOnboardingTour, { isOpen: false }));
    expect(html).not.toContain("Chào bạn tới ZenStudy Space");
  });

  it("should render Tour re-trigger option inside StudyShortcutsModal", () => {
    const html = renderToString(
      React.createElement(StudyShortcutsModal, {
        isOpen: true,
        onClose: () => {},
        onOpenTour: () => {},
      })
    );
    expect(html).toContain("Xem lại tour hướng dẫn");
  });

  it("should render unified bottom-right dock containing Nhạc Chill and Âm thanh nền (with tour-music-mixer-btn)", async () => {
    const { StudyMusicPlayer } = await import(
      "@/components/study/music/StudyMusicPlayer"
    );

    const html = renderToString(
      React.createElement(StudyMusicPlayer, {
        isExternalStreamActive: true,
        externalStreamItem: {
          id: "yt-coffee",
          title: "Coffee Shop Ambience",
          url: "https://www.youtube.com/watch?v=123",
          embedUrl: "https://www.youtube.com/embed/123",
          platform: "youtube" as const,
          category: "Coffee Jazz",
        },
      })
    );

    expect(html).toContain('id="tour-music-mixer-btn"');
    expect(html).toContain("Âm thanh nền");
    expect(html).toContain("Nhạc Chill");
  });

  it("should render Âm nền button with accessibility title and labels", async () => {
    const { StudyMusicPlayer } = await import(
      "@/components/study/music/StudyMusicPlayer"
    );

    const html = renderToString(React.createElement(StudyMusicPlayer));

    expect(html).toContain('id="tour-music-mixer-btn"');
    expect(html).toContain("Âm thanh nền");
    expect(html).toContain("Âm nền");
    expect(html).toContain("Mở Bộ trộn 20 âm thanh thiên nhiên");
  });
});
