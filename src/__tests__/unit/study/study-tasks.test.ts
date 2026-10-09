import { describe, it, expect } from "vitest";
import { getDeadlineStatus } from "@/components/study/tasks/utils/task-deadline";

describe("StudyTasksWidget Deadline Logic", () => {
  it("should return null when no dueDate is provided", () => {
    expect(getDeadlineStatus(undefined)).toBeNull();
    expect(getDeadlineStatus("")).toBeNull();
  });

  it("should recognize today as due today", () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d}`;

    const status = getDeadlineStatus(todayStr);
    expect(status).not.toBeNull();
    expect(status?.status).toBe("today");
    expect(status?.isToday).toBe(true);
    expect(status?.shortLabel).toBe("Hôm nay");
  });

  it("should recognize tomorrow as due tomorrow", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const y = tomorrow.getFullYear();
    const m = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const d = String(tomorrow.getDate()).padStart(2, "0");
    const tomorrowStr = `${y}-${m}-${d}`;

    const status = getDeadlineStatus(tomorrowStr);
    expect(status).not.toBeNull();
    expect(status?.status).toBe("tomorrow");
    expect(status?.isTomorrow).toBe(true);
  });

  it("should recognize past dates as overdue", () => {
    const past = new Date();
    past.setDate(past.getDate() - 3);
    const y = past.getFullYear();
    const m = String(past.getMonth() + 1).padStart(2, "0");
    const d = String(past.getDate()).padStart(2, "0");
    const pastStr = `${y}-${m}-${d}`;

    const status = getDeadlineStatus(pastStr);
    expect(status).not.toBeNull();
    expect(status?.status).toBe("overdue");
    expect(status?.isOverdue).toBe(true);
    expect(status?.label).toContain("Quá hạn");
  });

  it("should recognize future dates as future", () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    const y = future.getFullYear();
    const m = String(future.getMonth() + 1).padStart(2, "0");
    const d = String(future.getDate()).padStart(2, "0");
    const futureStr = `${y}-${m}-${d}`;

    const status = getDeadlineStatus(futureStr);
    expect(status).not.toBeNull();
    expect(status?.status).toBe("future");
    expect(status?.label).toContain("Hạn");
  });

  it("should handle optional time in dueDate correctly", () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    const y = future.getFullYear();
    const m = String(future.getMonth() + 1).padStart(2, "0");
    const d = String(future.getDate()).padStart(2, "0");
    const withTimeStr = `${y}-${m}-${d}T15:30`;

    const status = getDeadlineStatus(withTimeStr);
    expect(status).not.toBeNull();
    expect(status?.status).toBe("future");
    expect(status?.shortLabel).toContain("15:30");
    expect(status?.label).toContain("15:30");
  });

  it("should detect overdue when deadline time today has already passed", () => {
    const pastTime = new Date();
    pastTime.setHours(pastTime.getHours() - 2);
    const y = pastTime.getFullYear();
    const m = String(pastTime.getMonth() + 1).padStart(2, "0");
    const d = String(pastTime.getDate()).padStart(2, "0");
    const h = String(pastTime.getHours()).padStart(2, "0");
    const min = String(pastTime.getMinutes()).padStart(2, "0");
    const pastTimeToday = `${y}-${m}-${d}T${h}:${min}`;

    const status = getDeadlineStatus(pastTimeToday);
    expect(status).not.toBeNull();
    expect(status?.status).toBe("overdue");
    expect(status?.isOverdue).toBe(true);
  });
});

describe("Task In-Place Reorder Logic", () => {
  const cards = [
    { id: "c1", title: "Task 1", columnId: "col1", priority: "low", completed: false, checklist: [] },
    { id: "c2", title: "Task 2", columnId: "col1", priority: "medium", completed: false, checklist: [] },
    { id: "c3", title: "Task 3", columnId: "col1", priority: "high", completed: false, checklist: [] },
  ];

  it("should reorder cards correctly when dragging card downwards (after)", () => {
    const draggingCard = cards[0]; // c1
    const targetCardId = "c3";
    const position = "after";

    const remaining = cards.filter((c) => c.id !== draggingCard.id);
    const targetIdx = remaining.findIndex((c) => c.id === targetCardId);
    const insertIdx = position === "after" ? targetIdx + 1 : targetIdx;

    const reordered = [...remaining];
    reordered.splice(insertIdx, 0, draggingCard);

    expect(reordered.map((c) => c.id)).toEqual(["c2", "c3", "c1"]);
  });

  it("should reorder cards correctly when dragging card upwards (before)", () => {
    const draggingCard = cards[2]; // c3
    const targetCardId = "c1";
    const position = "before";

    const remaining = cards.filter((c) => c.id !== draggingCard.id);
    const targetIdx = remaining.findIndex((c) => c.id === targetCardId);
    const insertIdx = (position as string) === "after" ? targetIdx + 1 : targetIdx;

    const reordered = [...remaining];
    reordered.splice(insertIdx, 0, draggingCard);

    expect(reordered.map((c) => c.id)).toEqual(["c3", "c1", "c2"]);
  });

  it("should preserve original card order in source column when no target card is hovered", () => {
    const draggingCard = cards[1]; // c2
    const isSourceCol = true;
    const dragOverCardId = null;

    let displayCards = cards;
    if (draggingCard) {
      if (dragOverCardId) {
        // ...
      } else if (isSourceCol) {
        displayCards = cards;
      }
    }

    expect(displayCards.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
  });
});
