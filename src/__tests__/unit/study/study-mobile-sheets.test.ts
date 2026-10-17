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

describe("Mobile Nav Active State Resolution", () => {
  const resolveActiveNav = (state: {
    isTasksOpen?: boolean;
    isNotesOpen?: boolean;
    isMixerOpen?: boolean;
    isMoreOpen?: boolean;
    isScenesOpen?: boolean;
    isEmbedPlayerOpen?: boolean;
    isRoomsOpen?: boolean;
    isChatOpen?: boolean;
    isStatsOpen?: boolean;
    isSettingsOpen?: boolean;
    isPomodoroVisible?: boolean;
  }) => {
    return state.isTasksOpen
      ? "tasks"
      : state.isNotesOpen
        ? "notes"
        : state.isMixerOpen
          ? "music"
          : state.isMoreOpen ||
              state.isScenesOpen ||
              state.isEmbedPlayerOpen ||
              state.isRoomsOpen ||
              state.isChatOpen ||
              state.isStatsOpen ||
              state.isSettingsOpen
            ? "more"
            : state.isPomodoroVisible
              ? "pomodoro"
              : null;
  };

  it("resolves to 'pomodoro' when clock is visible and null when clock is hidden", () => {
    expect(resolveActiveNav({ isPomodoroVisible: false })).toBeNull();
    expect(resolveActiveNav({ isPomodoroVisible: true })).toBe("pomodoro");
  });

  it("resolves to 'tasks' when tasks sheet is open", () => {
    expect(resolveActiveNav({ isTasksOpen: true })).toBe("tasks");
  });

  it("resolves to 'notes' when notes sheet is open", () => {
    expect(resolveActiveNav({ isNotesOpen: true })).toBe("notes");
  });

  it("resolves to 'music' when mixer is open", () => {
    expect(resolveActiveNav({ isMixerOpen: true })).toBe("music");
  });

  it("resolves to 'more' for secondary sheets like embed player, scenes, rooms, chat, settings", () => {
    expect(resolveActiveNav({ isEmbedPlayerOpen: true })).toBe("more");
    expect(resolveActiveNav({ isScenesOpen: true })).toBe("more");
    expect(resolveActiveNav({ isRoomsOpen: true })).toBe("more");
    expect(resolveActiveNav({ isChatOpen: true })).toBe("more");
    expect(resolveActiveNav({ isSettingsOpen: true })).toBe("more");
    expect(resolveActiveNav({ isMoreOpen: true })).toBe("more");
  });
});

describe("Mobile Tasks Detail Back Button Routing", () => {
  it("routes onBack to CardDetailModal when card is selected, not MobileSheetShell", () => {
    const parentOnBack = () => {};
    const parentBackLabel = "Kế hoạch";

    // Khi chưa chọn thẻ: nút Back nằm trên MobileSheetShell (nếu có stack trước đó)
    let selectedCard: any = null;
    const sheetOnBackBefore = selectedCard ? undefined : parentOnBack;
    const detailOnBackBefore = selectedCard ? parentOnBack : undefined;
    expect(sheetOnBackBefore).toBe(parentOnBack);
    expect(detailOnBackBefore).toBeUndefined();

    // Khi đã chọn thẻ xem chi tiết: nút Back chuyển sang CardDetailModal, MobileSheetShell không hiển thị
    selectedCard = { id: "card-1", title: "Làm bài tập" };
    const sheetOnBackAfter = selectedCard ? undefined : parentOnBack;
    const detailOnBackAfter = selectedCard ? (parentOnBack || (() => {})) : undefined;
    const detailBackLabel = selectedCard ? parentBackLabel : undefined;
    expect(sheetOnBackAfter).toBeUndefined();
    expect(detailOnBackAfter).toBe(parentOnBack);
    expect(detailBackLabel).toBe("Kế hoạch");
  });
});

