import { describe, it, expect } from "vitest";
import { formatMinutesSeconds, formatDurationHuman } from "@/lib/time";

describe("time utils", () => {
  describe("formatMinutesSeconds", () => {
    it("định dạng mm:ss mặc định có số 0 đệm", () => {
      expect(formatMinutesSeconds(65)).toBe("01:05");
      expect(formatMinutesSeconds(0)).toBe("00:00");
      expect(formatMinutesSeconds(-10)).toBe("00:00");
    });

    it("định dạng m:ss khi padMinutes là false", () => {
      expect(formatMinutesSeconds(65, false)).toBe("1:05");
      expect(formatMinutesSeconds(5, false)).toBe("0:05");
    });
  });

  describe("formatDurationHuman", () => {
    it("hiển thị phút khi dưới 1 giờ", () => {
      expect(formatDurationHuman(1800)).toBe("30p");
    });

    it("hiển thị giờ và phút khi trên 1 giờ", () => {
      expect(formatDurationHuman(3600 + 1800)).toBe("1h 30p");
    });

    it("hiển thị chỉ giờ nếu số phút tròn", () => {
      expect(formatDurationHuman(7200)).toBe("2h");
    });
  });
});
