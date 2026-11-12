// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { usePanelState } from "@/components/study/hooks/usePanelState";
import { SYSTEM_FLAGS_DEFAULT } from "@/lib/system-flags";

// @ts-expect-error test act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Floating panels dynamic z-index layering", () => {
  let container: HTMLDivElement;
  let root: Root;
  let hookResult: ReturnType<typeof usePanelState>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function TestHarness() {
    hookResult = usePanelState({
      systemFlags: SYSTEM_FLAGS_DEFAULT,
      isMobile: false,
    });
    return React.createElement("div", null, "Panel Harness");
  }

  it("places the most recently opened or focused panel on top", () => {
    act(() => {
      root.render(React.createElement(TestHarness));
    });

    // 1. Open Kanban (tasks)
    act(() => {
      hookResult.handleToggleTasks();
    });

    const tasksZ1 = hookResult.getPanelZIndex("tasks");
    const notesZ1 = hookResult.getPanelZIndex("notes");
    expect(hookResult.isTasksOpen).toBe(true);
    expect(tasksZ1).toBeGreaterThan(notesZ1);

    // 2. Open Notes (ghi chú)
    act(() => {
      hookResult.handleToggleNotes();
    });

    const tasksZ2 = hookResult.getPanelZIndex("tasks");
    const notesZ2 = hookResult.getPanelZIndex("notes");
    expect(hookResult.isNotesOpen).toBe(true);
    // Notes opened second -> must be higher layer than Tasks
    expect(notesZ2).toBeGreaterThan(tasksZ2);

    // 3. User clicks back on Kanban (focus tasks)
    act(() => {
      hookResult.bringPanelToFront("tasks");
    });

    const tasksZ3 = hookResult.getPanelZIndex("tasks");
    const notesZ3 = hookResult.getPanelZIndex("notes");
    // Tasks brought to front -> must be higher layer than Notes
    expect(tasksZ3).toBeGreaterThan(notesZ3);

    // 4. User opens Meeting (rooms)
    act(() => {
      hookResult.setIsRoomsOpen(true);
    });

    const roomsZ4 = hookResult.getPanelZIndex("rooms");
    const tasksZ4 = hookResult.getPanelZIndex("tasks");
    const notesZ4 = hookResult.getPanelZIndex("notes");
    expect(hookResult.isRoomsOpen).toBe(true);
    // Rooms opened latest -> must be on top of both
    expect(roomsZ4).toBeGreaterThan(tasksZ4);
    expect(roomsZ4).toBeGreaterThan(notesZ4);

    // 5. User clicks on Notes again
    act(() => {
      hookResult.bringPanelToFront("notes");
    });

    const notesZ5 = hookResult.getPanelZIndex("notes");
    const roomsZ5 = hookResult.getPanelZIndex("rooms");
    const tasksZ5 = hookResult.getPanelZIndex("tasks");
    expect(notesZ5).toBeGreaterThan(roomsZ5);
    expect(notesZ5).toBeGreaterThan(tasksZ5);
  });

  it("counts the feedback sheet as an open mobile sheet", () => {
    act(() => {
      root.render(React.createElement(TestHarness));
    });

    expect(hookResult.isAnyMobileSheetOpen).toBe(false);

    act(() => {
      hookResult.setIsFeedbackOpen(true);
    });

    expect(hookResult.isFeedbackOpen).toBe(true);
    expect(hookResult.isAnyModalOpen).toBe(true);
    expect(hookResult.isAnyMobileSheetOpen).toBe(true);
  });
});
