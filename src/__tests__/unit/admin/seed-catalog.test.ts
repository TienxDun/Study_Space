import { describe, expect, it } from "vitest";
import rawScenes from "@/data/assets/scenes.json";
import rawSounds from "@/data/assets/sounds.json";
import rawTracks from "@/data/assets/tracks.json";
import { SOUND_ICONS, validateCatalog } from "../../../../admin-worker/content";

/**
 * Bộ nội dung đóng gói sẵn phải qua được đúng validator mà API admin dùng,
 * nếu không nút "Nạp bộ nội dung ban đầu" sẽ chết ngay lần đầu.
 */
describe("seed catalog", () => {
  it("catalog đóng gói hợp lệ với validator của admin", () => {
    const result = validateCatalog({
      scenes: rawScenes,
      sounds: rawSounds,
      tracks: rawTracks,
    });

    if (!result.ok) {
      throw new Error(JSON.stringify(result.errors.slice(0, 5), null, 2));
    }
    expect(result.counts.scenes).toBeGreaterThan(0);
    expect(result.counts.sounds).toBeGreaterThan(0);
    expect(result.counts.tracks).toBeGreaterThan(0);
  });

  it("mọi icon âm thanh đều nằm trong danh sách cho phép", () => {
    const icons = new Set((rawSounds as Array<{ icon: string }>).map((sound) => sound.icon));
    for (const icon of icons) {
      expect(SOUND_ICONS).toContain(icon);
    }
  });
});
