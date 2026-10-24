import { describe, it, expect } from "vitest";
import { getRoomExitNotice } from "@/components/study/rooms/utils/room-exit";

describe("getRoomExitNotice", () => {
  it("ánh xạ PARTICIPANT_REMOVED thành thẻ cảnh báo có nút vào lại", () => {
    const notice = getRoomExitNotice(4, "on-thi-cuoi-ky");

    expect(notice.kind).toBe("kicked");
    expect(notice.showNotice).toBe(true);
    expect(notice.tone).toBe("amber");
    expect(notice.allowRejoin).toBe(true);
    expect(notice.title).toContain("mời ra khỏi phòng");
    expect(notice.description).toContain("on-thi-cuoi-ky");
  });

  it("không làm phiền khi người dùng tự rời phòng", () => {
    const notice = getRoomExitNotice(1, "phong-a");

    expect(notice.kind).toBe("voluntary");
    expect(notice.showNotice).toBe(false);
    expect(notice.allowRejoin).toBe(false);
  });

  it("không có lý do cụ thể (rớt mạng) vẫn báo mất kết nối", () => {
    const notice = getRoomExitNotice(undefined, "phong-a");

    expect(notice.kind).toBe("network");
    expect(notice.showNotice).toBe(true);
    expect(notice.description).toContain("phong-a");
  });

  it("gọi tên đúng từng lý do rời phòng", () => {
    expect(getRoomExitNotice(2, "x").kind).toBe("duplicate_identity");
    expect(getRoomExitNotice(3, "x").kind).toBe("server");
    expect(getRoomExitNotice(5, "x").kind).toBe("room_deleted");
    expect(getRoomExitNotice(6, "x").kind).toBe("invalid_session");
    expect(getRoomExitNotice(7, "x").kind).toBe("invalid_session");
    expect(getRoomExitNotice(9, "x").kind).toBe("network");
    expect(getRoomExitNotice(10, "x").kind).toBe("room_idle_closed");
    expect(getRoomExitNotice(14, "x").kind).toBe("network");
    expect(getRoomExitNotice(15, "x").kind).toBe("network");
  });

  it("chuyển node (MIGRATION) và mã không dùng đều im lặng", () => {
    expect(getRoomExitNotice(8, "x").showNotice).toBe(false);
    expect(getRoomExitNotice(11, "x").showNotice).toBe(false);
    expect(getRoomExitNotice(12, "x").showNotice).toBe(false);
    expect(getRoomExitNotice(13, "x").showNotice).toBe(false);
    expect(getRoomExitNotice(16, "x").showNotice).toBe(false);
  });

  it("giá trị lạ không crash và vẫn có title tiếng Việt", () => {
    const notice = getRoomExitNotice(99, "phong-la");

    expect(notice.kind).toBe("unknown");
    expect(notice.showNotice).toBe(true);
    expect(notice.title.length).toBeGreaterThan(0);
    expect(notice.description).toContain("phong-la");
  });

  it("không lọt chuỗi tiếng Anh ra bản hiển thị", () => {
    const reasons = [undefined, 2, 3, 4, 5, 6, 7, 9, 10, 14, 15, 99];
    const englishWords = /\b(kicked|removed|disconnected|disconnect|connection|network|error|room)\b/i;

    for (const reason of reasons) {
      const notice = getRoomExitNotice(reason, "phong-hoc");
      expect(notice.showNotice).toBe(true);
      expect(notice.title).not.toMatch(englishWords);
      expect(notice.description).not.toMatch(englishWords);
    }
  });
});
