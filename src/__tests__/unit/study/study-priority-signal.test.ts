import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { PrioritySignalIcon } from "@/components/study/tasks/components/PrioritySignalIcon";

describe("PrioritySignalIcon Component", () => {
  it("renders 3 bars with 1 active bar for low priority", () => {
    const html = renderToString(React.createElement(PrioritySignalIcon, { priority: "low" }));
    expect(html).toContain("<svg");
    // Bar 1 active (opacity 1)
    expect(html).toContain("opacity=\"1\"");
    // Bars 2 and 3 inactive (opacity 0.25)
    expect(html).toContain("opacity=\"0.25\"");
  });

  it("renders 3 bars with 2 active bars for medium priority", () => {
    const html = renderToString(React.createElement(PrioritySignalIcon, { priority: "medium" }));
    expect(html).toContain("<svg");
    expect(html).toContain("#fbbf24"); // Amber active color
  });

  it("renders 3 bars with all 3 active bars for high priority", () => {
    const html = renderToString(React.createElement(PrioritySignalIcon, { priority: "high" }));
    expect(html).toContain("<svg");
    expect(html).toContain("#f43f5e"); // Rose active color
    // Should have no inactive bars
    expect(html).not.toContain("opacity=\"0.25\"");
  });
});
