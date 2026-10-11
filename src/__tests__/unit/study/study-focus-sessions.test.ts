import { describe, it, expect } from "vitest";
import {
  FocusSession,
  FocusSessionStore,
  logFocusSession,
  getFocusSummary,
  getTodaySummary,
  getWeekSummary,
  getMonthSummary,
  getDailySeries,
  formatDayLabel,
  getTaskTotalSeconds,
  formatFocusDuration,
  startOfDay,
  startOfWeek,
  startOfMonth,
} from "@/lib/focus-sessions";

const memStore = (): FocusSessionStore => {
  let items: FocusSession[] = [];
  return {
    list: () => [...items],
    append: (s) => {
      items = [...items, s];
      return [...items];
    },
    clear: () => {
      items = [];
    },
  };
};

const sess = (
  taskId: string,
  startedAt: Date,
  focusSeconds: number,
  taskTitle = taskId
): FocusSession => ({
  id: `${taskId}-${startedAt.getTime()}`,
  taskId,
  taskTitle,
  startedAt: startedAt.getTime(),
  endedAt: startedAt.getTime() + focusSeconds * 1000,
  focusSeconds,
  plannedSeconds: focusSeconds,
  completed: true,
  schemaVersion: 1,
});

// Thứ Tư 07/10/2026 12:00 giờ địa phương
const WED = new Date(2026, 9, 7, 12, 0, 0, 0);

describe("focus session range helpers", () => {
  it("startOfDay cắt về 00:00", () => {
    expect(startOfDay(WED).getHours()).toBe(0);
    expect(startOfDay(WED).getMinutes()).toBe(0);
  });

  it("startOfWeek luôn về Thứ Hai", () => {
    // Thứ Tư 07/10 -> Thứ Hai 05/10
    const mon = startOfWeek(WED);
    expect(mon.getDay()).toBe(1);
    expect(mon.getDate()).toBe(5);
    // Chủ Nhật 11/10 vẫn thuộc tuần đó (lùi 6 ngày)
    const sun = startOfWeek(new Date(2026, 9, 11, 23, 59));
    expect(sun.getDate()).toBe(5);
    // Thứ Hai giữ nguyên
    expect(startOfWeek(new Date(2026, 9, 5, 0, 0)).getDate()).toBe(5);
  });

  it("startOfMonth về ngày 1", () => {
    expect(startOfMonth(WED).getDate()).toBe(1);
    expect(startOfMonth(WED).getMonth()).toBe(9);
  });
});

describe("focus summary aggregation", () => {
  it("lọc đúng khoảng [from, to) và cộng dồn theo task", () => {
    const sessions = [
      sess("task-a", new Date(2026, 9, 7, 9, 0), 1500, "Ôn thi"),
      sess("task-a", new Date(2026, 9, 7, 10, 0), 1500, "Ôn thi cuối kỳ"),
      sess("task-b", new Date(2026, 9, 7, 11, 0), 300),
      // Ngoài khoảng (hôm qua)
      sess("task-a", new Date(2026, 9, 6, 9, 0), 1500),
    ];
    const from = new Date(2026, 9, 7, 0, 0).getTime();
    const to = new Date(2026, 9, 8, 0, 0).getTime();
    const sum = getFocusSummary(sessions, from, to);
    expect(sum.totalSeconds).toBe(3300);
    expect(sum.sessions).toBe(3);
    expect(sum.byTask).toHaveLength(2);
    // Sắp xếp giảm dần theo giây
    expect(sum.byTask[0].taskId).toBe("task-a");
    expect(sum.byTask[0].focusSeconds).toBe(3000);
    // Tên task lấy bản mới nhất trong kỳ
    expect(sum.byTask[0].taskTitle).toBe("Ôn thi cuối kỳ");
  });

  it("getTodaySummary chỉ lấy phiên hôm nay", () => {
    const sessions = [
      sess("t1", new Date(2026, 9, 7, 8, 0), 1500),
      sess("t1", new Date(2026, 9, 7, 23, 59), 600),
      sess("t1", new Date(2026, 9, 8, 0, 0), 1500), // ngày mai -> loại
      sess("t1", new Date(2026, 9, 6, 23, 59), 1500), // hôm qua -> loại
    ];
    const sum = getTodaySummary(sessions, WED);
    expect(sum.totalSeconds).toBe(2100);
    expect(sum.sessions).toBe(2);
  });

  it("getWeekSummary gom cả tuần T2-CN", () => {
    const sessions = [
      sess("t1", new Date(2026, 9, 5, 9, 0), 1500), // T2
      sess("t1", new Date(2026, 9, 11, 22, 0), 1500), // CN
      sess("t1", new Date(2026, 9, 12, 9, 0), 1500), // T2 tuần sau -> loại
      sess("t1", new Date(2026, 9, 4, 9, 0), 1500), // CN tuần trước -> loại
    ];
    const sum = getWeekSummary(sessions, WED);
    expect(sum.totalSeconds).toBe(3000);
    expect(sum.sessions).toBe(2);
  });

  it("getMonthSummary cắt đúng biên tháng", () => {
    const sessions = [
      sess("t1", new Date(2026, 9, 1, 0, 0), 1500),
      sess("t1", new Date(2026, 9, 31, 23, 0), 1500),
      sess("t1", new Date(2026, 8, 30, 23, 59), 1500), // tháng 9 -> loại
      sess("t1", new Date(2026, 10, 1, 0, 0), 1500), // tháng 11 -> loại
    ];
    const sum = getMonthSummary(sessions, WED);
    expect(sum.totalSeconds).toBe(3000);
    expect(sum.sessions).toBe(2);
  });

  it("getTaskTotalSeconds cộng mọi thời gian của 1 task", () => {
    const sessions = [
      sess("t1", new Date(2026, 9, 1, 9, 0), 1500),
      sess("t2", new Date(2026, 9, 2, 9, 0), 300),
      sess("t1", new Date(2026, 8, 1, 9, 0), 600),
    ];
    expect(getTaskTotalSeconds(sessions, "t1")).toBe(2100);
    expect(getTaskTotalSeconds(sessions, "t2")).toBe(300);
    expect(getTaskTotalSeconds(sessions, "nope")).toBe(0);
  });
});

describe("logFocusSession", () => {
  it("ghi phiên hợp lệ và từ chối phiên 0 giây", () => {
    const store = memStore();
    const ok = logFocusSession(
      {
        taskId: "t1",
        taskTitle: "Ôn thi",
        startedAt: WED.getTime(),
        endedAt: WED.getTime() + 1500 * 1000,
        focusSeconds: 1500,
        plannedSeconds: 1500,
      },
      store
    );
    expect(ok).not.toBeNull();
    expect(ok?.id.length).toBeGreaterThan(0);
    expect(store.list()).toHaveLength(1);

    const bad = logFocusSession(
      {
        taskId: "t1",
        taskTitle: "Skip",
        startedAt: WED.getTime(),
        endedAt: WED.getTime(),
        focusSeconds: 0,
        plannedSeconds: 1500,
      },
      store
    );
    expect(bad).toBeNull();
    expect(store.list()).toHaveLength(1);
  });
});

describe("formatFocusDuration", () => {
  it("định dạng giây / phút / giờ tiếng Việt", () => {
    expect(formatFocusDuration(0)).toBe("0 giây");
    expect(formatFocusDuration(45)).toBe("45 giây");
    expect(formatFocusDuration(1500)).toBe("25 phút");
    expect(formatFocusDuration(3600)).toBe("1 giờ");
    expect(formatFocusDuration(3900)).toBe("1 giờ 5 phút");
    expect(formatFocusDuration(7200)).toBe("2 giờ");
  });
});

describe("daily series timeline", () => {
  it("gom đúng từng ngày, mới nhất trước, kèm chi tiết task", () => {
    const sessions = [
      sess("t1", new Date(2026, 9, 7, 9, 0), 1500, "Ôn thi"),
      sess("t2", new Date(2026, 9, 7, 10, 0), 600, "Đọc sách"),
      sess("t1", new Date(2026, 9, 5, 9, 0), 900, "Ôn thi"),
      sess("t1", new Date(2026, 9, 1, 9, 0), 300, "Ôn thi"),
    ];
    const series = getDailySeries(sessions, WED);
    expect(series).toHaveLength(3);
    // Mới nhất trước
    expect(series[0].dayStartMs).toBeGreaterThan(series[1].dayStartMs);
    expect(series[0].totalSeconds).toBe(2100);
    expect(series[0].sessions).toBe(2);
    expect(series[0].byTask).toHaveLength(2);
    expect(series[0].byTask[0].taskId).toBe("t1");
    // Ngày cũ nhất
    expect(series[2].totalSeconds).toBe(300);
  });

  it("formatDayLabel: Hôm nay / Hôm qua / T2, 5/10", () => {
    const todayStart = startOfDay(WED).getTime();
    expect(formatDayLabel(todayStart, WED)).toBe("Hôm nay");
    expect(formatDayLabel(todayStart - 24 * 3600 * 1000, WED)).toBe("Hôm qua");
    expect(formatDayLabel(new Date(2026, 9, 5, 9, 0).getTime(), WED)).toBe(
      "T2, 5/10"
    );
    expect(formatDayLabel(new Date(2026, 9, 11, 9, 0).getTime(), WED)).toBe(
      "CN, 11/10"
    );
  });
});
