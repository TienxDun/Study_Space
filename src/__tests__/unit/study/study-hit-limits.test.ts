import { describe, it, expect } from "vitest";
import { SYSTEM_HIT_LIMITS } from "@/data/admin/hit-limits";

describe("System Hit Limits & Quotas Reference Data", () => {
  it("should have comprehensive coverage of all core services", () => {
    expect(SYSTEM_HIT_LIMITS.length).toBeGreaterThanOrEqual(8);

    const serviceNames = SYSTEM_HIT_LIMITS.map((s) => s.service.toLowerCase());
    expect(serviceNames.some((s) => s.includes("cloudflare workers ai"))).toBe(true);
    expect(serviceNames.some((s) => s.includes("groq"))).toBe(true);
    expect(serviceNames.some((s) => s.includes("cloudflare r2"))).toBe(true);
    expect(serviceNames.some((s) => s.includes("livekit"))).toBe(true);
    expect(serviceNames.some((s) => s.includes("localstorage") || s.includes("trình duyệt"))).toBe(true);
    expect(serviceNames.some((s) => s.includes("focus storage") || s.includes("zenstudy"))).toBe(true);

    // Hạ tầng backend thật đang chặn hệ thống (Workers/D1/KV)
    expect(serviceNames.some((s) => s.includes("workers") && !s.includes("ai"))).toBe(true);
    expect(serviceNames.some((s) => s.includes("d1"))).toBe(true);
    expect(serviceNames.some((s) => s.includes("kv"))).toBe(true);
  });

  it("should have complete and valid schema for each hit limit item", () => {
    const validSeverities = ["critical", "warning", "info"];
    const validCategories = ["ai", "backend", "storage", "realtime", "client", "embed"];

    SYSTEM_HIT_LIMITS.forEach((item) => {
      expect(item.id).toBeTruthy();
      expect(item.service).toBeTruthy();
      expect(item.component).toBeTruthy();
      expect(item.currentTier).toBeTruthy();
      expect(item.quotaDescription).toBeTruthy();
      expect(validSeverities).toContain(item.severity);
      expect(validCategories).toContain(item.category);

      // Must have rate limits
      expect(item.rateLimits.length).toBeGreaterThan(0);
      item.rateLimits.forEach((r) => {
        expect(r.label).toBeTruthy();
        expect(r.value).toBeTruthy();
      });

      // Must have symptoms
      expect(item.hitLimitSymptoms.length).toBeGreaterThan(0);

      // Must have fallback mechanism and remedy action
      expect(item.fallbackMechanism.length).toBeGreaterThan(10);
      expect(item.remedyAction.length).toBeGreaterThan(10);

      // Must have troubleshooting steps
      expect(item.troubleshootingSteps.length).toBeGreaterThan(0);
    });
  });

  it("should correctly identify critical risks like WebRTC room overflow or LocalStorage full", () => {
    const criticalItems = SYSTEM_HIT_LIMITS.filter((item) => item.severity === "critical");
    expect(criticalItems.length).toBeGreaterThanOrEqual(2);

    const criticalIds = criticalItems.map((c) => c.id);
    expect(criticalIds).toContain("livekit-cloud");
    expect(criticalIds).toContain("client-localstorage");
  });
});
