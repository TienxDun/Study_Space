import { describe, it, expect } from "vitest";
import { formatClockTime, getSyncStatusView } from "@/components/study/sync/sync-status-view";

describe("getSyncStatusView — nhãn theo trạng thái đồng bộ", () => {
  it("chưa đăng nhập / mặc định (idle) thì báo đã lưu trên máy", () => {
    const v = getSyncStatusView({ status: "idle", lastSyncedAt: null });
    expect(v.label).toBe("Đã lưu trên máy");
    expect(v.tone).toBe("emerald");
    expect(v.title).toContain("Đăng nhập");
  });

  it("đang gửi thì báo đang lưu và xoay", () => {
    const v = getSyncStatusView({ status: "syncing", lastSyncedAt: null });
    expect(v.label).toBe("Đang lưu...");
    expect(v.tone).toBe("sky");
    expect(v.motion).toBe("spin");
  });

  it("mất mạng (offline) thì báo đang offline", () => {
    const v = getSyncStatusView({ status: "offline", lastSyncedAt: null, savedTime: "09:30" });
    expect(v.label).toBe("Đang offline");
    expect(v.tone).toBe("amber");
    expect(v.title).toContain("09:30");
  });

  it("lỗi kết nối thì báo lỗi và có hướng dẫn bấm thử lại", () => {
    const v = getSyncStatusView({ status: "error", lastSyncedAt: null, savedTime: "10:05" });
    expect(v.label).toBe("Lỗi kết nối");
    expect(v.tone).toBe("rose");
    expect(v.title).toContain("10:05");
  });

  it("thành công (synced) thì báo đã lưu đám mây kèm mốc giờ", () => {
    const at = new Date(2026, 0, 1, 14, 7).getTime();
    const v = getSyncStatusView({ status: "synced", lastSyncedAt: at });
    expect(v.label).toBe("Đã lưu đám mây");
    expect(v.tone).toBe("emerald");
    expect(v.title).toContain("14:07");
  });
});

describe("formatClockTime", () => {
  it("đệm 0 cho giờ/phút dưới 10", () => {
    expect(formatClockTime(new Date(2026, 0, 1, 8, 5).getTime())).toBe("08:05");
  });
});
