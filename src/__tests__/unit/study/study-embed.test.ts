import { describe, it, expect } from "vitest";
import {
  clampSplitRatio,
  filterEmbedItems,
} from "@/components/study/embed/utils/embed-helpers";
import { StudyEmbedItem } from "@/components/study/embed/types";

describe("Study Embed Player Utilities", () => {
  describe("clampSplitRatio", () => {
    it("returns default 44 when input is NaN", () => {
      expect(clampSplitRatio(NaN)).toBe(44);
    });

    it("clamps values below minimum (28%)", () => {
      expect(clampSplitRatio(10)).toBe(28);
      expect(clampSplitRatio(-5)).toBe(28);
    });

    it("clamps values above maximum (72%)", () => {
      expect(clampSplitRatio(85)).toBe(72);
      expect(clampSplitRatio(100)).toBe(72);
    });

    it("keeps values within range and rounds to 1 decimal place", () => {
      expect(clampSplitRatio(50)).toBe(50);
      expect(clampSplitRatio(44.444)).toBe(44.4);
      expect(clampSplitRatio(60.89)).toBe(60.9);
    });
  });

  describe("filterEmbedItems", () => {
    const mockItems: StudyEmbedItem[] = [
      {
        id: "yt-1",
        title: "Lofi Hip Hop Radio - Beats to Relax/Study to",
        url: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
        embedUrl: "https://www.youtube.com/embed/jfKfPfyJRdk",
        platform: "youtube",
        category: "Lofi Girl",
        isLive: true,
      },
      {
        id: "yt-2",
        title: "Coffee Shop Ambience & Jazz",
        url: "https://www.youtube.com/watch?v=abc12345",
        embedUrl: "https://www.youtube.com/embed/abc12345",
        platform: "youtube",
        category: "Jazz Beats",
        isLive: false,
      },
      {
        id: "sp-1",
        title: "Deep Focus Ambient Study",
        url: "https://open.spotify.com/playlist/37i9dQZF1DX4sWSpwq3LiO",
        embedUrl: "https://open.spotify.com/embed/playlist/37i9dQZF1DX4sWSpwq3LiO",
        platform: "spotify",
        category: "Focus",
      },
    ];

    it("returns all items when category is 'all' and query is empty", () => {
      const result = filterEmbedItems(mockItems, "", "all");
      expect(result.length).toBe(3);
    });

    it("filters accurately by platform category", () => {
      const ytResult = filterEmbedItems(mockItems, "", "youtube");
      expect(ytResult.length).toBe(2);
      expect(ytResult.every((item) => item.platform === "youtube")).toBe(true);

      const spResult = filterEmbedItems(mockItems, "", "spotify");
      expect(spResult.length).toBe(1);
      expect(spResult[0].id).toBe("sp-1");
    });

    it("filters by search query matching title case-insensitively", () => {
      const result = filterEmbedItems(mockItems, "coffee", "all");
      expect(result.length).toBe(1);
      expect(result[0].id).toBe("yt-2");
    });

    it("filters by search query matching category or url", () => {
      const categoryMatch = filterEmbedItems(mockItems, "lofi girl", "all");
      expect(categoryMatch.length).toBe(1);
      expect(categoryMatch[0].id).toBe("yt-1");

      const urlMatch = filterEmbedItems(mockItems, "spotify.com", "all");
      expect(urlMatch.length).toBe(1);
      expect(urlMatch[0].id).toBe("sp-1");
    });

    it("returns empty array when query does not match any items", () => {
      const result = filterEmbedItems(mockItems, "nonexistent keyword xyz", "all");
      expect(result.length).toBe(0);
    });
  });
});
