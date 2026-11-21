import { describe, expect, it } from "vitest";
import {
  blendedPrice,
  formatPrice,
  formatPricePair,
  sortModelsByPrice,
} from "../../../features/chat-v2/lib/pricing";

const MODEL = (id: string, priceIn: number | null, priceOut: number | null) => ({
  id,
  priceIn,
  priceOut,
});

describe("hiển thị và sắp xếp giá model", () => {
  it("định dạng giá gọn, giữ tới 3 chữ số thập phân", () => {
    expect(formatPrice(0.07)).toBe("$0.07");
    expect(formatPrice(0.075)).toBe("$0.075");
    expect(formatPrice(1.875)).toBe("$1.875");
    expect(formatPrice(2)).toBe("$2");
    expect(formatPrice(0)).toBe("$0");
    expect(formatPrice(null)).toBe("—");
    expect(formatPrice(undefined)).toBe("—");
  });

  it("hiển thị cặp giá vào/ra", () => {
    expect(formatPricePair({ priceIn: 0.07, priceOut: 0.14 })).toBe("$0.07/$0.14");
    expect(formatPricePair({ priceIn: 1.2, priceOut: 6 })).toBe("$1.2/$6");
    expect(formatPricePair({ priceIn: null, priceOut: 6 })).toBe("—");
  });

  it("chi phí ước tính = giá vào × 3 + giá ra", () => {
    expect(blendedPrice({ priceIn: 0.07, priceOut: 0.14 })).toBeCloseTo(0.35);
    expect(blendedPrice({ priceIn: 1.2, priceOut: 6 })).toBeCloseTo(9.6);
    expect(blendedPrice({ priceIn: null, priceOut: 6 })).toBeNull();
  });

  it("sắp xếp tăng dần, model chưa có giá nằm cuối", () => {
    const models = [
      MODEL("claude", 1.2, 6),
      MODEL("unknown", null, null),
      MODEL("deepseek", 0.07, 0.14),
      MODEL("qwen", 1, 3),
    ];
    expect(sortModelsByPrice(models, "asc").map((model) => model.id)).toEqual([
      "deepseek",
      "qwen",
      "claude",
      "unknown",
    ]);
  });

  it("sắp xếp giảm dần nhưng vẫn giữ model chưa có giá ở cuối", () => {
    const models = [
      MODEL("unknown", null, null),
      MODEL("deepseek", 0.07, 0.14),
      MODEL("claude", 1.2, 6),
    ];
    expect(sortModelsByPrice(models, "desc").map((model) => model.id)).toEqual([
      "claude",
      "deepseek",
      "unknown",
    ]);
  });

  it("thứ tự mặc định giữ nguyên danh sách gốc", () => {
    const models = [MODEL("b", 1, 2), MODEL("a", 0.1, 0.2)];
    expect(sortModelsByPrice(models, "default")).toBe(models);
  });
});
