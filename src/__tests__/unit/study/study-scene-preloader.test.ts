import { describe, it, expect } from "vitest";
import { STUDY_SCENES } from "@/components/study/study-types";

describe("Scene Preloader Strategy & Data Integrity", () => {
  it("should have valid URLs for both background and thumbnail on all scenes", () => {
    STUDY_SCENES.forEach((scene) => {
      expect(scene.id).toBeTruthy();
      expect(scene.bgUrl).toBeTruthy();
      expect(scene.thumbnailUrl).toBeTruthy();
      expect(["VIDEO", "IMAGE"]).toContain(scene.type);
    });
  });

  it("should distinguish video and image media correctly for preloading logic", () => {
    const videoScenes = STUDY_SCENES.filter((s) => s.type === "VIDEO");
    const imageScenes = STUDY_SCENES.filter((s) => s.type === "IMAGE");

    expect(videoScenes.length).toBeGreaterThan(0);
    expect(imageScenes.length).toBeGreaterThan(0);

    videoScenes.forEach((s) => {
      expect(s.bgUrl).toMatch(/\.(mp4|webm)$/i);
    });

    imageScenes.forEach((s) => {
      expect(s.bgUrl).toMatch(/\.(jpg|jpeg|png|webp|avif)$/i);
    });
  });

  it("should correctly identify when a scene selection is a no-op", () => {
    const currentScene = STUDY_SCENES[0];
    const isSameScene = (targetId: string) => targetId === currentScene.id;

    expect(isSameScene(STUDY_SCENES[0].id)).toBe(true);
    expect(isSameScene(STUDY_SCENES[1].id)).toBe(false);
  });
});
