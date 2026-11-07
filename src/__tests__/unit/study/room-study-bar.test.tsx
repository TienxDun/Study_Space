import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { RoomStudyBar, type RoomStudyBarProps } from "@/components/study/rooms/components/RoomStudyBar";

describe("RoomStudyBar UI tests", () => {
  const defaultProps: RoomStudyBarProps = {
    local: {
      status: "",
      handRaised: false,
      goal: "",
    },
    timer: null,
    remainingSec: 0,
    isTimerOwner: false,
    handRaisedCount: 0,
    compact: false,
    onSetStatus: vi.fn(),
    onToggleHand: vi.fn(),
    onEditGoal: vi.fn(),
    onStartTimer: vi.fn(),
    onStopTimer: vi.fn(),
    onStartNextPhase: vi.fn(),
    onReaction: vi.fn(),
  };

  it("renders initial idle state with Pomodoro button and default status", () => {
    const html = renderToString(<RoomStudyBar {...defaultProps} />);
    expect(html).toContain("Pomodoro");
    expect(html).toContain("Bình thường");
    expect(html).toContain("Giơ tay");
    expect(html).toContain("Đặt mục tiêu");
    expect(html).toContain("Cảm xúc");
  });

  it("renders active Pomodoro focus timer with countdown for owner", () => {
    const html = renderToString(
      <RoomStudyBar
        {...defaultProps}
        timer={{
          phase: "focus",
          startedAt: 1000,
          durationSec: 1500,
          endsAt: 1501000,
          identity: "user-1",
          name: "Alice",
        }}
        remainingSec={1499}
        isTimerOwner={true}
      />
    );
    expect(html).toContain("24:59");
    expect(html).toContain("Chạm để đổi chu kỳ hoặc dừng");
  });

  it("renders active Pomodoro focus timer with countdown for non-owners", () => {
    const html = renderToString(
      <RoomStudyBar
        {...defaultProps}
        timer={{
          phase: "focus",
          startedAt: 1000,
          durationSec: 1500,
          endsAt: 1501000,
          identity: "user-1",
          name: "Alice",
        }}
        remainingSec={1499}
        isTimerOwner={false}
      />
    );
    expect(html).toContain("24:59");
    expect(html).toContain("Chạm để đổi chu kỳ hoặc dừng");
  });

  it("renders 00:00 when timer completes", () => {
    const html = renderToString(
      <RoomStudyBar
        {...defaultProps}
        timer={{
          phase: "focus",
          startedAt: 1000,
          durationSec: 1500,
          endsAt: 1501000,
          identity: "user-1",
          name: "Alice",
        }}
        remainingSec={0}
        isTimerOwner={true}
      />
    );
    expect(html).toContain("00:00");
  });

  it("renders raised hand state and goal text", () => {
    const html = renderToString(
      <RoomStudyBar
        {...defaultProps}
        local={{
          status: "focus",
          handRaised: true,
          goal: "Làm bài tập Hóa",
        }}
        handRaisedCount={2}
      />
    );
    expect(html).toContain("Tập trung");
    expect(html).toContain("Hạ tay xuống");
    expect(html).toContain("2"); // handRaisedCount
    expect(html).toContain("Làm bài tập Hóa");
  });

  it("renders compact mode for mobile view with dedicated short labels", () => {
    const html = renderToString(
      <RoomStudyBar
        {...defaultProps}
        local={{ status: "focus", handRaised: false, goal: "" }}
        compact={true}
      />
    );
    expect(html).toContain("Pomo");
    expect(html).toContain("Học");
    // Giơ tay text hidden in compact, but icon exists
    expect(html).not.toContain("<span>Giơ tay</span>");
  });

  it("renders override button when timer is active so non-owners can start a new timer", () => {
    const html = renderToString(
      <RoomStudyBar
        {...defaultProps}
        timer={{
          phase: "focus",
          startedAt: 1000,
          durationSec: 1500,
          endsAt: 1501000,
          identity: "user-1",
          name: "Alice",
        }}
        remainingSec={1200}
        isTimerOwner={false}
      />
    );
    expect(html).toContain("20:00");
    expect(html).toContain("Chạm để đổi chu kỳ hoặc dừng");
  });
});
