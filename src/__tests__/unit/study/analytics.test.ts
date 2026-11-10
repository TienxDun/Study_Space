import { describe, expect, it } from "vitest";
import {
  isLocalHostname,
  resolveGoatCounterConfig,
  shouldTrackPath,
} from "@/lib/analytics";

describe("resolveGoatCounterConfig", () => {
  it("nhận mã site của bản hosted goatcounter.com", () => {
    expect(resolveGoatCounterConfig("zenstudy")).toEqual({
      endpoint: "https://zenstudy.goatcounter.com/count",
      scriptSrc: "https://gc.zgo.at/count.js",
    });
  });

  it("nhận URL bản tự host và bỏ dấu / ở cuối", () => {
    expect(resolveGoatCounterConfig("https://stats.zenstudy.space/")).toEqual({
      endpoint: "https://stats.zenstudy.space/count",
      scriptSrc: "https://stats.zenstudy.space/count.js",
    });
  });

  it("trả null khi trống hoặc không hợp lệ", () => {
    expect(resolveGoatCounterConfig(undefined)).toBeNull();
    expect(resolveGoatCounterConfig("   ")).toBeNull();
    expect(resolveGoatCounterConfig("zen study")).toBeNull();
  });
});

describe("shouldTrackPath", () => {
  it("bỏ qua bảng admin và các trang thử nội bộ", () => {
    expect(shouldTrackPath("/admin")).toBe(false);
    expect(shouldTrackPath("/admin/limits")).toBe(false);
    expect(shouldTrackPath("/dev/surface-lab")).toBe(false);
    expect(shouldTrackPath("/dev-preview")).toBe(false);
  });

  it("đếm các trang công khai", () => {
    expect(shouldTrackPath("/")).toBe(true);
    expect(shouldTrackPath("/privacy/")).toBe(true);
    expect(shouldTrackPath("/administrator")).toBe(true);
  });
});

describe("isLocalHostname", () => {
  it("nhận ra máy local", () => {
    expect(isLocalHostname("localhost")).toBe(true);
    expect(isLocalHostname("127.0.0.1")).toBe(true);
    expect(isLocalHostname("[::1]")).toBe(true);
  });

  it("không nhầm domain thật với máy local", () => {
    expect(isLocalHostname("zenstudy.space")).toBe(false);
    expect(isLocalHostname("localhost.zenstudy.space")).toBe(false);
  });
});
