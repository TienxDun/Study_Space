import { describe, it, expect } from "vitest";
import { filterCommandActions, type CommandAction } from "@/components/study/command/StudyCommandPalette";

describe("StudyChat Shortcut and Command Palette Integration", () => {
  const actions: CommandAction[] = [
    { id: "nav-pomodoro", group: "Mở nhanh", label: "Đồng hồ Pomodoro", hint: "T", run: () => {} },
    { id: "nav-tasks", group: "Mở nhanh", label: "Kế hoạch học tập", hint: "K", run: () => {} },
    { id: "nav-chat", group: "Mở nhanh", label: "Trợ lý học tập AI", hint: "C", run: () => {} },
  ];

  it("finds the AI chatbot action by shortcut hint C", () => {
    const results = filterCommandActions(actions, "c");
    expect(results.some((a) => a.id === "nav-chat")).toBe(true);
  });

  it("finds the AI chatbot action by keyword 'trợ lý' or 'chat'", () => {
    const byTroLy = filterCommandActions(actions, "trợ lý");
    expect(byTroLy.some((a) => a.id === "nav-chat")).toBe(true);
  });
});
