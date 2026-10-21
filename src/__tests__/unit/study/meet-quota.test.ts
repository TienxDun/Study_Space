import { describe, it, expect } from "vitest";
import worker, {
  computeQuota,
  monthKeyUtc,
  clampInt,
} from "../../../../workers/livekit-rooms/worker.js";

describe("LiveKit Quota & Token Endpoints", () => {
  describe("computeQuota pure function", () => {
    it("calculates remaining minutes correctly when within limit", () => {
      const res = computeQuota({ usedSeconds: 300 * 60, limitMinutes: 4500, enforceQuota: true });
      expect(res.usedMinutes).toBe(300);
      expect(res.remainingMinutes).toBe(4200);
      expect(res.isExceeded).toBe(false);
      expect(res.quotaStatus).toBe("ok");
    });

    it("marks quota exceeded when usage reaches limit", () => {
      const res = computeQuota({ usedSeconds: 4500 * 60, limitMinutes: 4500, enforceQuota: true });
      expect(res.usedMinutes).toBe(4500);
      expect(res.remainingMinutes).toBe(0);
      expect(res.isExceeded).toBe(true);
      expect(res.quotaStatus).toBe("exceeded");
    });

    it("clamps remaining minutes to 0 when usage exceeds limit", () => {
      const res = computeQuota({ usedSeconds: 5000 * 60, limitMinutes: 4500, enforceQuota: true });
      expect(res.remainingMinutes).toBe(0);
      expect(res.isExceeded).toBe(true);
    });

    it("returns quotaStatus disabled when enforceQuota is false", () => {
      const res = computeQuota({ usedSeconds: 6000 * 60, limitMinutes: 4500, enforceQuota: false });
      expect(res.isExceeded).toBe(false);
      expect(res.quotaStatus).toBe("disabled");
    });
  });

  describe("monthKeyUtc pure function", () => {
    it("formats year and month in UTC", () => {
      expect(monthKeyUtc(new Date(Date.UTC(2026, 9, 31, 23, 59)))).toBe("2026-10");
      expect(monthKeyUtc(new Date(Date.UTC(2026, 10, 1, 0, 1)))).toBe("2026-11");
    });
  });

  describe("clampInt pure function", () => {
    it("restricts numbers within min/max bounds and handles invalid input", () => {
      expect(clampInt(6, 6, 2, 20)).toBe(6);
      expect(clampInt("1", 6, 2, 20)).toBe(2);
      expect(clampInt("25", 6, 2, 20)).toBe(20);
      expect(clampInt("abc", 6, 2, 20)).toBe(6);
    });
  });

  describe("POST /token endpoint quota enforcement", () => {
    const baseEnv = {
      LIVEKIT_URL: "wss://test.livekit.cloud",
      LIVEKIT_API_KEY: "KEY_TEST",
      LIVEKIT_API_SECRET: "SECRET_VERY_LONG_STRING_FOR_HMAC_1234567890",
      FIREBASE_PROJECT_ID: "test-fb",
      ALLOWED_ORIGINS: "*",
      _verifyToken: async () => ({ uid: "test-user-id-123" }),
    };

    it("returns HTTP 429 QUOTA_EXCEEDED when monthly limit is reached", async () => {
      const mockDb = {
        prepare: () => ({
          bind: () => ({
            first: async () => ({ participant_seconds: 4600 * 60 }),
          }),
        }),
      };

      const req = new Request("https://worker.test/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer mock-fb-token",
        },
        body: JSON.stringify({ room: "phong-toan", name: "An" }),
      });

      const res = await worker.fetch(req, {
        ...baseEnv,
        QUOTA_ENFORCE: "true",
        LIVEKIT_MONTHLY_MINUTES: "4500",
        DB: mockDb,
      });

      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.code).toBe("QUOTA_EXCEEDED");
      expect(data.error).toContain("hết hạn mức");
    });

    it("fails open with quotaStatus unknown when D1 DB throws an error", async () => {
      const mockFaultyDb = {
        prepare: () => ({
          bind: () => ({
            first: async () => {
              throw new Error("D1 database query failure");
            },
          }),
        }),
      };

      const req = new Request("https://worker.test/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer mock-fb-token",
        },
        body: JSON.stringify({ room: "phong-van", name: "Bình" }),
      });

      const res = await worker.fetch(req, {
        ...baseEnv,
        QUOTA_ENFORCE: "true",
        DB: mockFaultyDb,
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.quotaStatus).toBe("unknown");
      expect(data.token).toBeDefined();
    });

    it("bypasses quota check with quotaStatus disabled when QUOTA_ENFORCE is false", async () => {
      const mockDb = {
        prepare: () => ({
          bind: () => ({
            first: async () => ({ participant_seconds: 999999 }),
          }),
        }),
      };

      const req = new Request("https://worker.test/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer mock-fb-token",
        },
        body: JSON.stringify({ room: "phong-anh", name: "Cường" }),
      });

      const res = await worker.fetch(req, {
        ...baseEnv,
        QUOTA_ENFORCE: "false",
        DB: mockDb,
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.quotaStatus).toBe("disabled");
      expect(data.token).toBeDefined();
    });
  });
});
