// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  startCloudSync,
  stopCloudSync,
  syncNow,
  packLocalData,
  unpackToLocal,
  clearLocalUserData,
  getSyncStatus,
  setDataApiUrl,
} from "@/lib/simple-cloud-sync";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { focusSessionStore } from "@/lib/focus-sessions";

describe("Simple Cloud Sync — Snapshot Save Game Tests", () => {
  const uid = "test-user-123";
  const token = "mock-token-abc";
  const mockGetToken = vi.fn().mockResolvedValue(token);

  let fetchCalls: Array<{ url: string; method: string; body?: any }> = [];

  beforeEach(() => {
    localStorage.clear();
    focusSessionStore.clear();
    fetchCalls = [];
    setDataApiUrl("https://api.zenstudy.space");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        let bodyObj: any = null;
        if (typeof init?.body === "string") {
          try {
            bodyObj = JSON.parse(init.body);
          } catch {}
        }

        fetchCalls.push({
          url,
          method: init?.method || "GET",
          body: bodyObj,
        });

        // Mock GET /data
        if (url.includes("/data") && (!init?.method || init.method === "GET")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              data: {
                version: 1,
                settings: { [STORAGE_KEYS.sceneId]: "cyberpunk-rain" },
                notes: [{ id: "n1", title: "Bài tập Toán", content: "Đã làm xong" }],
                tasks: [{ id: "b1", title: "Mục tiêu" }],
                focusSessions: [],
              },
              updatedAt: 10_000,
            }),
          };
        }

        // Mock POST /data
        if (url.includes("/data") && init?.method === "POST") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              updatedAt: 12_000,
            }),
          };
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        };
      })
    );
  });

  afterEach(() => {
    stopCloudSync();
    localStorage.clear();
    focusSessionStore.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("1. packLocalData đóng gói chuẩn xác toàn bộ dữ liệu học tập", () => {
    localStorage.setItem(STORAGE_KEYS.sceneId, "tokyo-night");
    localStorage.setItem(
      STORAGE_KEYS.multiNotes,
      JSON.stringify([{ id: "note-1", title: "Note test" }])
    );
    localStorage.setItem(
      STORAGE_KEYS.kanbanBoards,
      JSON.stringify([{ id: "board-1", title: "Board test" }])
    );

    const packet = packLocalData();
    expect(packet.settings[STORAGE_KEYS.sceneId]).toBe("tokyo-night");
    expect(packet.notes).toHaveLength(1);
    expect(packet.tasks).toHaveLength(1);
    expect(packet.version).toBe(1);
    expect(typeof packet.updatedAt).toBe("number");
  });

  it("2. unpackToLocal nạp đầy đủ dữ liệu từ đám mây vào máy", () => {
    unpackToLocal({
      settings: { [STORAGE_KEYS.sceneId]: "rain-cafe" },
      notes: [{ id: "n-cloud", title: "Ghi chú đám mây" }],
      tasks: [{ id: "t-cloud", title: "Việc đám mây" }],
      focusSessions: [],
    });

    expect(localStorage.getItem(STORAGE_KEYS.sceneId)).toBe("rain-cafe");
    const notes = JSON.parse(localStorage.getItem(STORAGE_KEYS.multiNotes) || "[]");
    expect(notes[0].title).toBe("Ghi chú đám mây");
    const tasks = JSON.parse(localStorage.getItem(STORAGE_KEYS.kanbanBoards) || "[]");
    expect(tasks[0].title).toBe("Việc đám mây");
  });

  it("3. startCloudSync gọi GET /data và nạp thành công vào localStorage", async () => {
    await startCloudSync(uid, mockGetToken);

    expect(fetchCalls.some((c) => c.url.includes("/data") && c.method === "GET")).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.sceneId)).toBe("cyberpunk-rain");
    expect(getSyncStatus().state).toBe("synced");
  });

  it("4. syncNow gửi đúng POST /data và cập nhật trạng thái đã lưu", async () => {
    await startCloudSync(uid, mockGetToken);

    localStorage.setItem(STORAGE_KEYS.sceneId, "new-scene-chill");
    const ok = await syncNow();

    expect(ok).toBe(true);
    const postCall = fetchCalls.find((c) => c.url.includes("/data") && c.method === "POST");
    expect(postCall).toBeDefined();
    expect(postCall?.body?.data?.settings[STORAGE_KEYS.sceneId]).toBe("new-scene-chill");
    expect(getSyncStatus().state).toBe("synced");
  });

  it("5. clearLocalUserData dọn sạch toàn bộ dữ liệu máy khi đăng xuất", () => {
    localStorage.setItem(STORAGE_KEYS.sceneId, "scene-private");
    localStorage.setItem(STORAGE_KEYS.multiNotes, "secret note");

    clearLocalUserData();

    expect(localStorage.getItem(STORAGE_KEYS.sceneId)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.multiNotes)).toBeNull();
    expect(getSyncStatus().state).toBe("idle");
  });
});
