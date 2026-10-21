import { describe, it, expect } from "vitest";
import { mintRoomToken, b64urlToBytes } from "../../../../workers/livekit-rooms/worker.js";

describe("LiveKit Meet Token Claims & Permissions", () => {
  const env = {
    LIVEKIT_API_KEY: "API_TEST_KEY_123",
    LIVEKIT_API_SECRET: "SECRET_TEST_999999999999999999999999",
  };

  function decodePayload(jwt: string) {
    const parts = jwt.split(".");
    expect(parts.length).toBe(3);
    const bytes = b64urlToBytes(parts[1]);
    const jsonStr = new TextDecoder().decode(bytes);
    return JSON.parse(jsonStr);
  }

  it("mints token with roomConfig.maxParticipants and emptyTimeout", async () => {
    const token = await mintRoomToken(env, "user-abc", "Bạn An", "phong-hoc-1", {
      maxParticipants: 6,
      emptyTimeoutSec: 300,
    });
    const payload = decodePayload(token);

    expect(payload.sub).toBe("user-abc");
    expect(payload.name).toBe("Bạn An");
    expect(payload.iss).toBe(env.LIVEKIT_API_KEY);
    expect(payload.roomConfig).toBeDefined();
    expect(payload.roomConfig.maxParticipants).toBe(6);
    expect(payload.roomConfig.emptyTimeout).toBe(300);
  });

  it("mints token with required Phase 2 video permissions (canPublishData, canUpdateOwnMetadata)", async () => {
    const token = await mintRoomToken(env, "user-xyz", "Bình", "phong-nhom", {
      maxParticipants: 4,
      emptyTimeoutSec: 180,
    });
    const payload = decodePayload(token);

    expect(payload.video).toBeDefined();
    expect(payload.video.roomJoin).toBe(true);
    expect(payload.video.room).toBe("phong-nhom");
    expect(payload.video.canPublish).toBe(true);
    expect(payload.video.canSubscribe).toBe(true);
    expect(payload.video.canPublishData).toBe(true);
    expect(payload.video.canUpdateOwnMetadata).toBe(true);
  });

  it("respects customized maxParticipants from config", async () => {
    const token = await mintRoomToken(env, "user-custom", "Cường", "phong-rieng", {
      maxParticipants: 12,
      emptyTimeoutSec: 600,
    });
    const payload = decodePayload(token);

    expect(payload.roomConfig.maxParticipants).toBe(12);
    expect(payload.roomConfig.emptyTimeout).toBe(600);
  });

  it("sets valid token expiration and nbf window", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await mintRoomToken(env, "user-time", "Duy", "test-exp");
    const payload = decodePayload(token);

    expect(payload.exp).toBeGreaterThan(now + 7000); // 2 hours
    expect(payload.nbf).toBeLessThanOrEqual(now);
  });
});
