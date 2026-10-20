import { describe, it, expect } from "vitest";
import { formatClockTime, getSyncStatusView } from "@/components/study/sync/sync-status-view";

describe("getSyncStatusView — nhãn theo trạng thái đồng bộ", () => {
  it("chưa đăng nhập / chưa cấu hình thì báo chỉ lưu máy", () => {
    const v = getSyncStatusView({ status: "local", lastSyncedAt: null, savedTime: "09:30" });
    expect(v.label).toBe("Đã lưu");
    expect(v.tone).toBe("emerald");
    expect(v.title).toContain("09:30");
  });

  it("có thay đổi chưa đẩy thì báo chờ đồng bộ và nhấp nháy", () => {
    const v = getSyncStatusView({ status: "pending", lastSyncedAt: null });
    expect(v.label).toBe("Chờ đồng bộ");
    expect(v.tone).toBe("amber");
    expect(v.motion).toBe("pulse");
  });

  it("đang gửi thì báo đang đồng bộ và xoay", () => {
    const v = getSyncStatusView({ status: "syncing", lastSyncedAt: null });
    expect(v.label).toBe("Đang đồng bộ");
    expect(v.tone).toBe("sky");
    expect(v.motion).toBe("spin");
  });

  it("lần gần nhất lỗi thì báo chưa đồng bộ, vẫn trấn an dữ liệu còn trên máy", () => {
    const v = getSyncStatusView({ status: "error", lastSyncedAt: null, savedTime: "10:05" });
    expect(v.label).toBe("Chưa đồng bộ");
    expect(v.tone).toBe("rose");
    expect(v.title).toContain("10:05");
  });

  it("thành công thì báo đã đồng bộ kèm mốc giờ", () => {
    const at = new Date(2026, 0, 1, 14, 7).getTime();
    const v = getSyncStatusView({ status: "synced", lastSyncedAt: at });
    expect(v.label).toBe("Đã đồng bộ");
    expect(v.title).toContain("14:07");
  });
});

describe("formatClockTime", () => {
  it("đệm 0 cho giờ/phút dưới 10", () => {
    expect(formatClockTime(new Date(2026, 0, 1, 8, 5).getTime())).toBe("08:05");
  });
});
