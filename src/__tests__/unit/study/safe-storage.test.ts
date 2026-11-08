// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { saveStorageJSON, loadStorageJSON } from "@/lib/safe-storage";

describe("safe-storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("lưu và đọc dữ liệu JSON hợp lệ", () => {
    const data = { count: 42, text: "test" };
    saveStorageJSON("test_key", data);
    const result = loadStorageJSON("test_key", { count: 0, text: "" });
    expect(result).toEqual(data);
  });

  it("trả về fallback khi key không tồn tại", () => {
    const fallback = { count: 10 };
    const result = loadStorageJSON("non_existent_key", fallback);
    expect(result).toBe(fallback);
  });

  it("trả về fallback an toàn khi dữ liệu trong storage bị lỗi JSON", () => {
    localStorage.setItem("corrupted_key", "{ corrupted json");
    const fallback = ["fallback"];
    const result = loadStorageJSON("corrupted_key", fallback);
    expect(result).toBe(fallback);
  });
});
