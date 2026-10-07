import { describe, it, expect } from "vitest";
import { ensureYouTubeJsApi, sendYouTubeCommand } from "../../../lib/youtube-remote";
import { parseEmbedUrl } from "../../../components/study/study-types";

describe("YouTube Remote Control Utilities", () => {
  it("ensureYouTubeJsApi should append enablejsapi=1 if missing", () => {
    const rawUrl = "https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1";
    const result = ensureYouTubeJsApi(rawUrl);
    expect(result).toBe("https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&enablejsapi=1");
  });

  it("ensureYouTubeJsApi should preserve url if enablejsapi=1 already present", () => {
    const existingUrl = "https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&enablejsapi=1";
    const result = ensureYouTubeJsApi(existingUrl);
    expect(result).toBe(existingUrl);
  });

  it("ensureYouTubeJsApi should ignore non-youtube urls (e.g. Spotify)", () => {
    const spotifyUrl = "https://open.spotify.com/embed/playlist/37i9dQZF1DX8Uebhn9wzrS";
    const result = ensureYouTubeJsApi(spotifyUrl);
    expect(result).toBe(spotifyUrl);
  });

  it("ensureYouTubeJsApi handles empty or null safely", () => {
    expect(ensureYouTubeJsApi(null)).toBe("");
    expect(ensureYouTubeJsApi(undefined)).toBe("");
    expect(ensureYouTubeJsApi("")).toBe("");
  });

  it("parseEmbedUrl for YouTube should generate embedUrl with enablejsapi=1", () => {
    const parsed = parseEmbedUrl("https://www.youtube.com/watch?v=5qap5aO4i9A");
    expect(parsed).not.toBeNull();
    expect(parsed?.embedUrl).toContain("enablejsapi=1");
  });

  it("sendYouTubeCommand safely handles document when no iframes or non-browser", () => {
    // Should return false and not crash if no iframes found
    const res = sendYouTubeCommand("pauseVideo");
    expect(typeof res).toBe("boolean");
  });
});
