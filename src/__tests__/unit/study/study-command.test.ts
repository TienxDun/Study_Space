import { describe, it, expect } from "vitest";
import {
  filterCommandActions,
  type CommandAction,
} from "@/components/study/command/StudyCommandPalette";

const SAMPLE: CommandAction[] = [
  { id: "nav-tasks", group: "Mở nhanh", label: "Kế hoạch học tập", hint: "K", run: () => {} },
  { id: "nav-notes", group: "Mở nhanh", label: "Ghi chép nhanh", hint: "N", run: () => {} },
  { id: "scene-tokyo", group: "Bối cảnh", label: "Tokyo City Night", run: () => {} },
];

describe("filterCommandActions", () => {
  it("returns all actions on empty query", () => {
    expect(filterCommandActions(SAMPLE, "")).toHaveLength(3);
    expect(filterCommandActions(SAMPLE, "   ")).toHaveLength(3);
  });

  it("matches label case-insensitively", () => {
    const result = filterCommandActions(SAMPLE, "kế hoạch");
    expect(result.map((a) => a.id)).toEqual(["nav-tasks"]);
  });

  it("matches group name", () => {
    expect(filterCommandActions(SAMPLE, "bối cảnh").map((a) => a.id)).toEqual([
      "scene-tokyo",
    ]);
  });

  it("matches hint", () => {
    expect(filterCommandActions(SAMPLE, "n").map((a) => a.id)).toContain(
      "nav-notes"
    );
  });

  it("returns empty when nothing matches", () => {
    expect(filterCommandActions(SAMPLE, "xyz-khong-co")).toHaveLength(0);
  });
});
