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
});
