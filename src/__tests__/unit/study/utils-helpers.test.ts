import { describe, it, expect } from "vitest";
import { clamp, generateId } from "@/lib/utils";

describe("utils helpers", () => {
  describe("clamp", () => {
    it("giữ nguyên giá trị khi nằm trong khoảng min và max", () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    it("giới hạn về min khi giá trị nhỏ hơn min", () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it("giới hạn về max khi giá trị lớn hơn max", () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it("trả về min khi giá trị là NaN", () => {
      expect(clamp(NaN, 0, 10)).toBe(0);
    });
  });

  describe("generateId", () => {
    it("tạo id duy nhất không bị trùng lặp", () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe("string");
      expect(id1.length).toBeGreaterThan(5);
    });

    it("thêm tiền tố khi được truyền vào", () => {
      const noteId = generateId("note");
      expect(noteId.startsWith("note-")).toBe(true);
    });
  });
});
