import { describe, it, expect } from "vitest";
import {
  MEET_ATTR,
  parseTimerAttributes,
  pickActiveTimer,
  remainingTimerSeconds,
  formatMeetCountdown,
} from "@/components/study/rooms/utils/meet-protocol";

describe("meet-timer behavior and countdowns", () => {
  it("formats countdown sequence: 25:00 -> 24:59 -> 00:00", () => {
    const startedAt = 1000000;
    const durationSec = 1500; // 25 minutes
    const endsAt = startedAt + durationSec * 1000;

    const timer = {
      phase: "focus" as const,
      startedAt,
      durationSec,
      endsAt,
    };

    // At start: 1500 seconds remaining
    const remStart = remainingTimerSeconds(timer, startedAt);
    expect(remStart).toBe(1500);
    expect(formatMeetCountdown(remStart)).toBe("25:00");

    // After 1 second: 1499 seconds remaining
    const rem1s = remainingTimerSeconds(timer, startedAt + 1000);
    expect(rem1s).toBe(1499);
    expect(formatMeetCountdown(rem1s)).toBe("24:59");

    // When ended: 0 seconds remaining
    const remEnd = remainingTimerSeconds(timer, endsAt);
    expect(remEnd).toBe(0);
    expect(formatMeetCountdown(remEnd)).toBe("00:00");

    // When past end: still 0, never negative
    const remPast = remainingTimerSeconds(timer, endsAt + 10000);
    expect(remPast).toBe(0);
    expect(formatMeetCountdown(remPast)).toBe("00:00");
  });

  it("skips invalid timer with missing startedAt or out-of-range duration", () => {
    // Missing startedAt
    expect(
      parseTimerAttributes({
        [MEET_ATTR.timerPhase]: "focus",
        [MEET_ATTR.timerDuration]: "1500",
      })
    ).toBeNull();

    // Duration too short (< 60s)
    expect(
      parseTimerAttributes({
        [MEET_ATTR.timerPhase]: "focus",
        [MEET_ATTR.timerStartedAt]: "1000",
        [MEET_ATTR.timerDuration]: "59",
      })
    ).toBeNull();

    // Duration too long (> 3600s)
    expect(
      parseTimerAttributes({
        [MEET_ATTR.timerPhase]: "focus",
        [MEET_ATTR.timerStartedAt]: "1000",
        [MEET_ATTR.timerDuration]: "3601",
      })
    ).toBeNull();
  });

  it("chooses between two timers with identical startedAt deterministically by identity", () => {
    const pAlpha = {
      identity: "user-alpha",
      name: "Alpha",
      attributes: {
        [MEET_ATTR.timerPhase]: "focus",
        [MEET_ATTR.timerStartedAt]: "5000",
        [MEET_ATTR.timerDuration]: "900",
      },
    };

    const pBeta = {
      identity: "user-beta",
      name: "Beta",
      attributes: {
        [MEET_ATTR.timerPhase]: "focus",
        [MEET_ATTR.timerStartedAt]: "5000",
        [MEET_ATTR.timerDuration]: "900",
      },
    };

    // Regardless of order in array, user-alpha is chosen
    expect(pickActiveTimer([pAlpha, pBeta])?.identity).toBe("user-alpha");
    expect(pickActiveTimer([pBeta, pAlpha])?.identity).toBe("user-alpha");
  });
});
