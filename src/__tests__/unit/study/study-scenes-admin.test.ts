import { describe, it, expect } from "vitest";
import rawScenes from "@/data/assets/scenes.json";
import { SceneAsset } from "@/types/assets";

describe("Study Scenes Admin & Asset Integrity", () => {
  it("should have valid schema for all scenes in scenes.json", () => {
    const scenes = rawScenes as SceneAsset[];
    expect(scenes.length).toBeGreaterThan(0);

    scenes.forEach((scene) => {
      expect(scene.id).toBeTruthy();
      expect(scene.name).toBeTruthy();
      expect(["VIDEO", "IMAGE"]).toContain(scene.type);
      expect(scene.category).toBeTruthy();
      expect(scene.mediaPath).toBeTruthy();
      expect(scene.thumbnailPath).toBeTruthy();
    });
  });

  it("should support both VIDEO and IMAGE background types", () => {
    const scenes = rawScenes as SceneAsset[];
    const videoScenes = scenes.filter((s) => s.type === "VIDEO");
    const imageScenes = scenes.filter((s) => s.type === "IMAGE");

    expect(videoScenes.length).toBeGreaterThan(0);
    expect(imageScenes.length).toBeGreaterThan(0);
  });

  it("should have valid categories for each scene", () => {
    const validCategories = [
      "chill",
      "anime",
      "cyberpunk",
      "dark",
      "urban",
      "nature",
      "cartoon",
      "cute",
    ];

    const scenes = rawScenes as SceneAsset[];
    scenes.forEach((s) => {
      expect(validCategories).toContain(s.category);
    });
  });
});
