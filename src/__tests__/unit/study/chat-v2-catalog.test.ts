import { describe, expect, it } from "vitest";
import {
  CATALOG_IDS,
  catalogEntry,
  getCapability,
  isFreeModel,
  listCatalog,
  publicCapability,
} from "../../../../workers/chat-v2/catalog.js";

describe("danh mục model chat v2", () => {
  it("mỗi model ghi rõ trạng thái xác minh và nguồn", () => {
    expect(CATALOG_IDS.length).toBeGreaterThan(0);
    for (const id of CATALOG_IDS) {
      const entry = catalogEntry(id)!;
      expect(typeof entry.free, id).toBe("boolean");
      if (entry.available === true) expect(entry.checkedAt, id).toBeTruthy();
      if (entry.priceSource === "motapis-models.js") {
        expect(entry.priceIn, id).toBeGreaterThan(0);
        expect(entry.priceOut, id).toBeGreaterThan(0);
      }
    }
  });

  it("có cả model free lẫn model trả phí", () => {
    const all = listCatalog();
    const free = all.find((model) => model.free);
    expect(free).toBeTruthy();
    expect(isFreeModel(free!.id)).toBe(true);
    expect(all.some((model) => !model.free)).toBe(true);
  });

  it("model lạ không có capability mặc định", () => {
    expect(getCapability("model-moi-chua-doi-chieu")).toBeNull();
    expect(publicCapability("model-moi-chua-doi-chieu")).toBeNull();
  });

  it("ngữ cảnh trả đúng số trong danh mục", () => {
    const known = listCatalog().filter((model) => model.contextTokens);
    expect(known.length).toBeGreaterThan(0);
    for (const model of known) {
      expect(getCapability(model.id)!.contextTokens, model.id).toBe(model.contextTokens);
    }
  });

  it("chỉ giữ tối đa 16.384 token đầu ra cho app", () => {
    for (const id of CATALOG_IDS) {
      const cap = getCapability(id);
      if (cap) expect(cap.maxOutputTokens, id).toBeLessThanOrEqual(16384);
    }
  });
});
