import { describe, it, expect } from "vitest";
import {
  formatTime,
  clampVolume,
  getNextTrackIndex,
  getPrevTrackIndex,
} from "@/components/study/music/utils/time-format";

describe("Study Music Player Utilities", () => {
  describe("formatTime", () => {
    it("formats 0 or negative values to '0:00'", () => {
      expect(formatTime(0)).toBe("0:00");
      expect(formatTime(-15)).toBe("0:00");
    });

    it("handles non-finite and NaN values gracefully", () => {
      expect(formatTime(NaN)).toBe("0:00");
      expect(formatTime(Infinity)).toBe("0:00");
      expect(formatTime(-Infinity)).toBe("0:00");
    });

    it("formats seconds with leading zero when < 10", () => {
      expect(formatTime(5)).toBe("0:05");
      expect(formatTime(65)).toBe("1:05");
    });

    it("formats multi-minute durations accurately", () => {
      expect(formatTime(120)).toBe("2:00");
      expect(formatTime(185)).toBe("3:05");
      expect(formatTime(3599)).toBe("59:59");
    });
  });

  describe("clampVolume", () => {
    it("clamps values between 0 and 1", () => {
      expect(clampVolume(-0.2)).toBe(0);
      expect(clampVolume(1.5)).toBe(1);
      expect(clampVolume(0.75)).toBe(0.75);
    });

    it("rounds to 2 decimal places", () => {
      expect(clampVolume(0.33333)).toBe(0.33);
      expect(clampVolume(0.66666)).toBe(0.67);
    });

    it("returns default 0.5 when input is NaN", () => {
      expect(clampVolume(NaN)).toBe(0.5);
    });
  });

  describe("getNextTrackIndex", () => {
    it("cycles sequentially when shuffle is false", () => {
      expect(getNextTrackIndex(0, 3, false)).toBe(1);
      expect(getNextTrackIndex(1, 3, false)).toBe(2);
      expect(getNextTrackIndex(2, 3, false)).toBe(0);
    });

    it("returns 0 if totalTracks is 1 or less", () => {
      expect(getNextTrackIndex(0, 1, false)).toBe(0);
      expect(getNextTrackIndex(0, 0, false)).toBe(0);
    });

    it("picks a valid random index in shuffle mode", () => {
      // Mocking random to return 0.6 -> floor(0.6 * 4) = 2
      const mockRandom = () => 0.6;
      expect(getNextTrackIndex(0, 4, true, mockRandom)).toBe(2);
    });

    it("avoids immediately replaying current track if random yields current index", () => {
      // Mock random returns index 0 when current is 0
      const mockRandom = () => 0.05; // floor(0.05 * 3) = 0
      const nextIdx = getNextTrackIndex(0, 3, true, mockRandom);
      expect(nextIdx).not.toBe(0);
      expect(nextIdx).toBe(1);
    });
  });

  describe("getPrevTrackIndex", () => {
    it("decrements sequentially and wraps around to last track", () => {
      expect(getPrevTrackIndex(2, 3)).toBe(1);
      expect(getPrevTrackIndex(1, 3)).toBe(0);
      expect(getPrevTrackIndex(0, 3)).toBe(2);
    });

    it("returns 0 if totalTracks is 1 or less", () => {
      expect(getPrevTrackIndex(0, 1)).toBe(0);
      expect(getPrevTrackIndex(0, 0)).toBe(0);
    });
  });

  describe("First-visit Autoplay Flag", () => {
    it("has correct storage key defined", async () => {
      const { STORAGE_KEYS } = await import("@/lib/storage-keys");
      expect(STORAGE_KEYS.musicAutoplayVisited).toBe("study_space_music_autoplay_visited");
    });
  });
});

