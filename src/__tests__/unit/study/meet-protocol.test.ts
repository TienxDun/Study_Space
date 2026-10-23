import { describe, it, expect } from "vitest";
import {
  MEET_ATTR,
  MEET_REACTIONS,
  parseLocalAttributes,
  parseTimerAttributes,
  pickActiveTimer,
  remainingTimerSeconds,
  nextPhasePreset,
  formatMeetCountdown,
  isAllowedReaction,
  parseReactionPayload,
} from "@/components/study/rooms/utils/meet-protocol";

describe("meet-protocol pure functions", () => {
  describe("parseLocalAttributes", () => {
    it("handles empty or null attributes gracefully", () => {
      expect(parseLocalAttributes(null)).toEqual({
        status: "",
        handRaised: false,
        goal: "",
      });
      expect(parseLocalAttributes({})).toEqual({
        status: "",
        handRaised: false,
        goal: "",
      });
    });

    it("parses valid status, hand, and goal", () => {
      const res = parseLocalAttributes({
        [MEET_ATTR.status]: "focus",
        [MEET_ATTR.hand]: "1",
        [MEET_ATTR.goal]: "Học giải tích 1",
      });
      expect(res).toEqual({
        status: "focus",
        handRaised: true,
        goal: "Học giải tích 1",
      });
    });

    it("rejects invalid status and hand values", () => {
      const res = parseLocalAttributes({
        [MEET_ATTR.status]: "sleeping",
        [MEET_ATTR.hand]: "true",
      });
      expect(res.status).toBe("");
      expect(res.handRaised).toBe(false);
    });

    it("trims and truncates goal to 120 characters", () => {
      const longGoal = "  " + "A".repeat(150) + "  ";
      const res = parseLocalAttributes({
        [MEET_ATTR.goal]: longGoal,
      });
      expect(res.goal.length).toBe(120);
      expect(res.goal).toBe("A".repeat(120));
    });
  });

  describe("parseTimerAttributes", () => {
    it("returns null for invalid or missing timer attributes", () => {
      expect(parseTimerAttributes(null)).toBeNull();
      expect(parseTimerAttributes({})).toBeNull();
      expect(
        parseTimerAttributes({
          [MEET_ATTR.timerPhase]: "invalid",
          [MEET_ATTR.timerStartedAt]: "1000",
          [MEET_ATTR.timerDuration]: "1500",
        })
      ).toBeNull();
      // Duration < 60s
      expect(
        parseTimerAttributes({
          [MEET_ATTR.timerPhase]: "focus",
          [MEET_ATTR.timerStartedAt]: "1000",
          [MEET_ATTR.timerDuration]: "30",
        })
      ).toBeNull();
      // Duration > 3600s
      expect(
        parseTimerAttributes({
          [MEET_ATTR.timerPhase]: "focus",
          [MEET_ATTR.timerStartedAt]: "1000",
          [MEET_ATTR.timerDuration]: "4000",
        })
      ).toBeNull();
      // startedAt <= 0
      expect(
        parseTimerAttributes({
          [MEET_ATTR.timerPhase]: "focus",
          [MEET_ATTR.timerStartedAt]: "-5",
          [MEET_ATTR.timerDuration]: "1500",
        })
      ).toBeNull();
    });

    it("correctly parses valid timer and calculates endsAt from startedAt + duration * 1000", () => {
      const res = parseTimerAttributes({
        [MEET_ATTR.timerPhase]: "focus",
        [MEET_ATTR.timerStartedAt]: "10000",
        [MEET_ATTR.timerDuration]: "1500", // 25 mins
        [MEET_ATTR.timerEndsAt]: "999999", // should be ignored in favor of real formula
      });
      expect(res).toEqual({
        phase: "focus",
        startedAt: 10000,
        durationSec: 1500,
        endsAt: 10000 + 1500 * 1000,
      });
    });
  });

  describe("pickActiveTimer", () => {
    it("returns null when no participants have valid timer", () => {
      expect(pickActiveTimer([])).toBeNull();
      expect(
        pickActiveTimer([
          { identity: "user1", attributes: {} },
          { identity: "user2", attributes: { [MEET_ATTR.status]: "focus" } },
        ])
      ).toBeNull();
    });

    it("picks the timer with largest startedAt", () => {
      const p1 = {
        identity: "user1",
        name: "Alice",
        attributes: {
          [MEET_ATTR.timerPhase]: "focus",
          [MEET_ATTR.timerStartedAt]: "1000",
          [MEET_ATTR.timerDuration]: "1500",
        },
      };
      const p2 = {
        identity: "user2",
        name: "Bob",
        attributes: {
          [MEET_ATTR.timerPhase]: "break",
          [MEET_ATTR.timerStartedAt]: "2000",
          [MEET_ATTR.timerDuration]: "300",
        },
      };
      const active = pickActiveTimer([p1, p2]);
      expect(active?.identity).toBe("user2");
      expect(active?.phase).toBe("break");
      expect(active?.name).toBe("Bob");
    });

    it("tie-breaks by identity ascending when startedAt is equal", () => {
      const p1 = {
        identity: "user-b",
        name: "User B",
        attributes: {
          [MEET_ATTR.timerPhase]: "focus",
          [MEET_ATTR.timerStartedAt]: "5000",
          [MEET_ATTR.timerDuration]: "1500",
        },
      };
      const p2 = {
        identity: "user-a",
        name: "User A",
        attributes: {
          [MEET_ATTR.timerPhase]: "focus",
          [MEET_ATTR.timerStartedAt]: "5000",
          [MEET_ATTR.timerDuration]: "1500",
        },
      };
      const active = pickActiveTimer([p1, p2]);
      expect(active?.identity).toBe("user-a");
    });
  });

  describe("remainingTimerSeconds & formatMeetCountdown", () => {
    it("clamps remaining seconds between 0 and durationSec", () => {
      const timer = {
        phase: "focus" as const,
        startedAt: 10000,
        durationSec: 100,
        endsAt: 110000,
      };

      // Before timer starts or at beginning
      expect(remainingTimerSeconds(timer, 5000)).toBe(100);
      // Midway (endsAt 110000, now 70000 -> 40000ms -> 40s)
      expect(remainingTimerSeconds(timer, 70000)).toBe(40);
      // Exactly at end
      expect(remainingTimerSeconds(timer, 110000)).toBe(0);
      // Past end
      expect(remainingTimerSeconds(timer, 120000)).toBe(0);
    });

    it("formats countdown mm:ss correctly", () => {
      expect(formatMeetCountdown(1500)).toBe("25:00");
      expect(formatMeetCountdown(1499)).toBe("24:59");
      expect(formatMeetCountdown(61)).toBe("01:01");
      expect(formatMeetCountdown(5)).toBe("00:05");
      expect(formatMeetCountdown(0)).toBe("00:00");
      expect(formatMeetCountdown(-10)).toBe("00:00");
    });
  });

  describe("nextPhasePreset", () => {
    it("cycles through all 6 preset configurations correctly", () => {
      // focus 15 -> break 3
      expect(
        nextPhasePreset({ phase: "focus", startedAt: 0, durationSec: 15 * 60, endsAt: 0 })
      ).toEqual({ phase: "break", minutes: 3 });

      // focus 25 -> break 5
      expect(
        nextPhasePreset({ phase: "focus", startedAt: 0, durationSec: 25 * 60, endsAt: 0 })
      ).toEqual({ phase: "break", minutes: 5 });

      // focus 50 -> break 10
      expect(
        nextPhasePreset({ phase: "focus", startedAt: 0, durationSec: 50 * 60, endsAt: 0 })
      ).toEqual({ phase: "break", minutes: 10 });

      // break 3 -> focus 15
      expect(
        nextPhasePreset({ phase: "break", startedAt: 0, durationSec: 3 * 60, endsAt: 0 })
      ).toEqual({ phase: "focus", minutes: 15 });

      // break 5 -> focus 25
      expect(
        nextPhasePreset({ phase: "break", startedAt: 0, durationSec: 5 * 60, endsAt: 0 })
      ).toEqual({ phase: "focus", minutes: 25 });

      // break 10 -> focus 50
      expect(
        nextPhasePreset({ phase: "break", startedAt: 0, durationSec: 10 * 60, endsAt: 0 })
      ).toEqual({ phase: "focus", minutes: 50 });
    });

    it("falls back to default 25/5 if duration doesn't match preset", () => {
      expect(
        nextPhasePreset({ phase: "focus", startedAt: 0, durationSec: 40 * 60, endsAt: 0 })
      ).toEqual({ phase: "break", minutes: 5 });
      expect(
        nextPhasePreset({ phase: "break", startedAt: 0, durationSec: 7 * 60, endsAt: 0 })
      ).toEqual({ phase: "focus", minutes: 25 });
    });

    it("returns null for null timer", () => {
      expect(nextPhasePreset(null)).toBeNull();
    });
  });

  describe("reaction validation and parsing", () => {
    it("validates whitelisted reactions", () => {
      for (const emoji of MEET_REACTIONS) {
        expect(isAllowedReaction(emoji)).toBe(true);
      }
      expect(isAllowedReaction("🚀")).toBe(false);
      expect(isAllowedReaction("")).toBe(false);
      expect(isAllowedReaction(null)).toBe(false);
    });

    it("parses valid JSON string payload", () => {
      const payload = JSON.stringify({ v: 1, emoji: "🔥" });
      expect(parseReactionPayload(payload)).toBe("🔥");
    });

    it("parses valid Uint8Array payload", () => {
      const text = JSON.stringify({ v: 1, emoji: "❤️" });
      const bytes = new TextEncoder().encode(text);
      expect(parseReactionPayload(bytes)).toBe("❤️");
    });

    it("rejects malformed payload, wrong version, or invalid emoji", () => {
      expect(parseReactionPayload("invalid json")).toBeNull();
      expect(parseReactionPayload(JSON.stringify({ v: 2, emoji: "👍" }))).toBeNull();
      expect(parseReactionPayload(JSON.stringify({ v: 1, emoji: "💩" }))).toBeNull();
      expect(parseReactionPayload(JSON.stringify({ emoji: "👍" }))).toBeNull();
    });
  });
});
