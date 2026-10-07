import { describe, it, expect } from "vitest";
import {
  getSoundTheme,
  formatTime,
  isPresetActive,
  togglePresetVolumes,
} from "@/components/study/mixer/utils/sound-helpers";
import { AmbientSound } from "@/components/study/mixer/types";

describe("Study Sound Mixer Utilities", () => {
  describe("getSoundTheme", () => {
    it("returns amber theme for campfire / fireplace sounds", () => {
      const campfire: AmbientSound = {
        id: "fire-1",
        name: "Campfire Flame",
        icon: "Flame",
        src: "/sounds/camp.mp3",
        category: "nature",
      };
      const theme = getSoundTheme(campfire);
      expect(theme.accentColor).toBe("accent-amber-400");
      expect(theme.activeIconBg).toContain("amber");
    });

    it("returns sky theme for rain and ocean sounds", () => {
      const rain: AmbientSound = {
        id: "summer-rain",
        name: "Summer Rain",
        icon: "CloudRain",
        src: "/sounds/rain.mp3",
        category: "rain",
      };
      const theme = getSoundTheme(rain);
      expect(theme.accentColor).toBe("accent-sky-400");
      expect(theme.activeIconBg).toContain("sky");
    });

    it("returns emerald theme for birds and forest sounds", () => {
      const forest: AmbientSound = {
        id: "deep-forest",
        name: "Green Forest",
        icon: "Trees",
        src: "/sounds/forest.mp3",
        category: "nature",
      };
      const theme = getSoundTheme(forest);
      expect(theme.accentColor).toBe("accent-emerald-400");
      expect(theme.activeIconBg).toContain("emerald");
    });

    it("returns purple theme for space or mechanical sounds", () => {
      const space: AmbientSound = {
        id: "deep-space",
        name: "Deep Space Cosmos",
        icon: "Sparkles",
        src: "/sounds/space.mp3",
        category: "indoor",
      };
      const theme = getSoundTheme(space);
      expect(theme.accentColor).toBe("accent-purple-400");
    });
  });

  describe("formatTime", () => {
    it("formats 0 and negative numbers to '0:00'", () => {
      expect(formatTime(0)).toBe("0:00");
      expect(formatTime(-10)).toBe("0:00");
    });

    it("formats valid seconds with zero-padding", () => {
      expect(formatTime(9)).toBe("0:09");
      expect(formatTime(75)).toBe("1:15");
      expect(formatTime(3600)).toBe("60:00");
    });
  });

  describe("isPresetActive and togglePresetVolumes", () => {
    const mockSounds: AmbientSound[] = [
      {
        id: "snd-rain",
        name: "Window Rain",
        icon: "CloudRain",
        src: "",
        category: "rain",
      },
      {
        id: "snd-cafe",
        name: "People Talking Cafe",
        icon: "Coffee",
        src: "",
        category: "indoor",
      },
      {
        id: "snd-keys",
        name: "Keyboard Typing",
        icon: "Keyboard",
        src: "",
        category: "indoor",
      },
    ];

    const recipe = {
      "Window Rain": 0.5,
      "People Talking": 0.35,
    };

    it("returns false if any recipe sound is not active", () => {
      const vols = { "snd-rain": 0.5 }; // missing snd-cafe
      expect(isPresetActive(recipe, vols, mockSounds)).toBe(false);
    });

    it("returns true if all recipe sounds are active (> 0)", () => {
      const vols = { "snd-rain": 0.5, "snd-cafe": 0.35 };
      expect(isPresetActive(recipe, vols, mockSounds)).toBe(true);
    });

    it("toggles ON: activates sounds when preset was inactive", () => {
      const initialVols = {};
      const nextVols = togglePresetVolumes(recipe, initialVols, mockSounds);
      expect(nextVols["snd-rain"]).toBe(0.5);
      expect(nextVols["snd-cafe"]).toBe(0.35);
    });

    it("toggles OFF: removes sounds when preset was already active", () => {
      const activeVols = { "snd-rain": 0.5, "snd-cafe": 0.35, other: 0.8 };
      const nextVols = togglePresetVolumes(recipe, activeVols, mockSounds);
      expect(nextVols["snd-rain"]).toBeUndefined();
      expect(nextVols["snd-cafe"]).toBeUndefined();
      expect(nextVols["other"]).toBe(0.8);
    });
  });
});
