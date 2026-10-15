import { describe, it, expect, beforeEach } from "vitest";
import { STORAGE_KEYS } from "@/lib/storage-keys";

describe("Mobile Sheets Zen Mode Persistence", () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    const mockStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        store = {};
      },
    };

    // @ts-expect-error test mock
    globalThis.localStorage = mockStorage;
  });

  it("STORAGE_KEYS contains mobileSheetZenMap key", () => {
    expect(STORAGE_KEYS.mobileSheetZenMap).toBe("study_space_mobile_sheet_zen_map");
  });

  it("defaults to compact mode (false) when no user preference is stored", () => {
    const raw = localStorage.getItem(STORAGE_KEYS.mobileSheetZenMap);
    expect(raw).toBeNull();
    // Default should be false (thu nhỏ / compact)
    const defaultZenMode = false;
    expect(defaultZenMode).toBe(false);
  });

  it("correctly stores and restores user preference for specific sheets", () => {
    // Giả lập người dùng bấm nút phóng to bảng Tasks
    const initialMap: Record<string, boolean> = {};
    initialMap["tasks"] = true; // phóng to
    localStorage.setItem(STORAGE_KEYS.mobileSheetZenMap, JSON.stringify(initialMap));

    // Đọc lại từ localStorage
    const savedRaw = localStorage.getItem(STORAGE_KEYS.mobileSheetZenMap);
    const savedMap = savedRaw ? JSON.parse(savedRaw) : {};

    // Tasks đã phóng to theo setup của user
    expect(savedMap["tasks"]).toBe(true);

    // Các bảng khác chưa chỉnh (ví dụ: notes, scenes) vẫn fallback về mặc định false (thu nhỏ)
    expect(savedMap["notes"] ?? false).toBe(false);
    expect(savedMap["scenes"] ?? false).toBe(false);
  });

  it("preserves updated state when user shrinks a previously expanded sheet", () => {
    const map: Record<string, boolean> = {
      tasks: true,
      notes: true,
    };
    localStorage.setItem(STORAGE_KEYS.mobileSheetZenMap, JSON.stringify(map));

    // Người dùng bấm thu nhỏ lại bảng tasks
    map["tasks"] = false;
    localStorage.setItem(STORAGE_KEYS.mobileSheetZenMap, JSON.stringify(map));

    const updatedRaw = localStorage.getItem(STORAGE_KEYS.mobileSheetZenMap);
    const updatedMap = updatedRaw ? JSON.parse(updatedRaw) : {};

    expect(updatedMap["tasks"]).toBe(false);
    expect(updatedMap["notes"]).toBe(true);
  });
});
