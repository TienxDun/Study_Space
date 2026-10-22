import { describe, it, expect, afterEach } from "vitest";
import { buildInviteLink, readInviteRoom, getMeetEndpoints } from "@/lib/meet-invite";

describe("Meet Invite Link Utilities", () => {
  describe("buildInviteLink", () => {
    it("creates invite link with ?room= query from standard URL", () => {
      const link = buildInviteLink("phong-toan", "https://zenstudy.space/");
      expect(link).toBe("https://zenstudy.space/?room=phong-toan");
    });

    it("clears existing query params and hash when generating invite link", () => {
      const link = buildInviteLink(
        "phong-hoa",
        "https://example.com/app?tab=notes&theme=dark#scroll-top"
      );
      expect(link).toBe("https://example.com/app?room=phong-hoa");
    });

    it("preserves pathname with subpath / base path for GitHub Pages deployment", () => {
      const link = buildInviteLink(
        "on-thi",
        "https://username.github.io/Study_Space/?section=chat"
      );
      expect(link).toBe("https://username.github.io/Study_Space/?room=on-thi");
    });

    it("trims whitespace and clamps room name to 32 characters", () => {
      const longName = "   room-super-long-name-that-exceeds-thirty-two-chars   ";
      const link = buildInviteLink(longName, "https://zenstudy.space/");
      const parsed = new URL(link);
      const roomParam = parsed.searchParams.get("room");
      expect(roomParam).toBe(longName.trim().slice(0, 32));
      expect(roomParam?.length).toBe(32);
    });
  });

  describe("readInviteRoom", () => {
    it("reads valid room name from search query ?room=phong-toan", () => {
      expect(readInviteRoom("?room=phong-toan")).toBe("phong-toan");
    });

    it("reads room name from full URL search string with multiple params", () => {
      expect(readInviteRoom("?source=invite&room=phong-anh&ref=123")).toBe("phong-anh");
    });

    it("handles query string without leading question mark", () => {
      expect(readInviteRoom("room=phong-sinh")).toBe("phong-sinh");
    });

    it("returns null when room param is missing or empty or whitespace only", () => {
      expect(readInviteRoom("")).toBeNull();
      expect(readInviteRoom("?other=123")).toBeNull();
      expect(readInviteRoom("?room=")).toBeNull();
      expect(readInviteRoom("?room=   ")).toBeNull();
    });

    it("trims and clamps room name to 32 characters", () => {
      const long = "a".repeat(50);
      const res = readInviteRoom(`?room=  ${long}  `);
      expect(res).toBe("a".repeat(32));
      expect(res?.length).toBe(32);
    });
  });

  describe("getMeetEndpoints", () => {
    const originalEnv = process.env.NEXT_PUBLIC_LIVEKIT_TOKEN_URL;

    afterEach(() => {
      process.env.NEXT_PUBLIC_LIVEKIT_TOKEN_URL = originalEnv;
    });

    it("returns null endpoints and isAvailable false when env var is absent", () => {
      delete process.env.NEXT_PUBLIC_LIVEKIT_TOKEN_URL;
      const endpoints = getMeetEndpoints();
      expect(endpoints).toEqual({
        baseUrl: "",
        tokenUrl: null,
        roomsUrl: null,
        historyUrl: null,
        isAvailable: false,
      });
    });

    it("correctly resolves tokenUrl, roomsUrl, and historyUrl when env var is provided", () => {
      process.env.NEXT_PUBLIC_LIVEKIT_TOKEN_URL = "https://livekit.example.workers.dev/token";
      const endpoints = getMeetEndpoints();
      expect(endpoints).toEqual({
        baseUrl: "https://livekit.example.workers.dev",
        tokenUrl: "https://livekit.example.workers.dev/token",
        roomsUrl: "https://livekit.example.workers.dev/rooms",
        historyUrl: "https://livekit.example.workers.dev/history",
        isAvailable: true,
      });
    });
  });
});
