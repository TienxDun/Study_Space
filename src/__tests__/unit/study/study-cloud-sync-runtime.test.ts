// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  startCloudSync,
  stopCloudSync,
  syncNow,
  enqueuePendingFocus,
  getCurrentFocusEpoch,
  clearCloudFocus,
  pendingFocusQueueKey,
  focusEpochStorageKey,
  setDataApiUrl,
  readMeta,
  getSyncState,
  hasUnsyncedChanges,
  EVENT_CLOUD_FOCUS_STALE,
  getBackoffDelay,
  mergeStudyNotes,
  isUserActivelyEditing,
  resetSyncMemory,
} from "@/lib/cloud-sync";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { shouldWipeKey, wipeLocalUserData } from "@/lib/local-data";
import { focusSessionStore, FocusSession, logFocusSession } from "@/lib/focus-sessions";
import { isNoteActive, StudyNote } from "@/components/study/notes/types";

describe("Cloud Sync Mốc 2 — Runtime & Contract Tests", () => {
  const uid = "test-user-m2";
  const token = "mock-token-m2";
  const mockGetToken = vi.fn().mockResolvedValue(token);

  let fetchCalls: Array<{ url: string; method: string; headers: Record<string, string>; body?: any }> = [];

  beforeEach(() => {
    localStorage.clear();
    resetSyncMemory();
    focusSessionStore.clear();
    fetchCalls = [];
    setDataApiUrl("https://api.zenstudy.space");

    // Mock fetch mặc định thành công
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        const headers: Record<string, string> = {};
        if (init?.headers) {
          if (init.headers instanceof Headers) {
            init.headers.forEach((val, key) => {
              headers[key] = val;
            });
          } else if (Array.isArray(init.headers)) {
            init.headers.forEach(([k, v]) => {
              headers[k] = v;
            });
          } else {
            Object.assign(headers, init.headers);
          }
        }

        let bodyObj: any = null;
        if (typeof init?.body === "string") {
          try {
            bodyObj = JSON.parse(init.body);
          } catch {}
        }

        fetchCalls.push({
          url,
          method: init?.method || "GET",
          headers,
          body: bodyObj,
        });

        // 1. GET /settings
        if (url.includes("/settings") && (!init?.method || init.method === "GET")) {
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({
              settings: {},
              deleted: [],
              updated: {},
              serverTime: 10_000,
            }),
          };
        }

        // 2. PUT /settings
        if (url.includes("/settings") && init?.method === "PUT") {
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({
              ok: true,
              saved: Object.keys(bodyObj?.settings || {}).length,
              at: 10_500,
            }),
          };
        }

        // 3. GET /focus
        if (url.includes("/focus") && (!init?.method || init.method === "GET")) {
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({
              sessions: [],
              epoch: 1,
            }),
          };
        }

        // 4. POST /focus
        if (url.includes("/focus") && init?.method === "POST") {
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({
              ok: true,
              saved: (bodyObj?.sessions || []).length,
              epoch: 1,
            }),
          };
        }

        // 5. DELETE /focus
        if (url.includes("/focus") && init?.method === "DELETE") {
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({
              ok: true,
              epoch: 2,
            }),
          };
        }

        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({}),
        };
      })
    );
  });

  afterEach(() => {
    stopCloudSync();
    resetSyncMemory();
    focusSessionStore.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("gửi đúng header X-Sync-Version: 2 và Bearer token trong mọi request", async () => {
    await startCloudSync(uid, mockGetToken);

    expect(fetchCalls.length).toBeGreaterThan(0);
    for (const call of fetchCalls) {
      expect(call.headers["X-Sync-Version"]).toBe("2");
      expect(call.headers["Authorization"]).toBe(`Bearer ${token}`);
    }
  });

  it("xử lý rejected KEY_DELETED từ PUT response: xóa key khỏi localStorage và tắt cờ dirty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes("/settings") && init?.method === "PUT") {
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({
              ok: true,
              saved: 0,
              at: 11_000,
              rejected: [{ key: STORAGE_KEYS.sceneId, reason: "KEY_DELETED" }],
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ settings: {}, deleted: [], updated: {}, serverTime: 10_000, sessions: [], epoch: 1 }),
        };
      })
    );

    localStorage.setItem(STORAGE_KEYS.sceneId, "cyberpunk-rain");
    await startCloudSync(uid, mockGetToken);

    expect(localStorage.getItem(STORAGE_KEYS.sceneId)).toBeNull();
  });

  it("xử lý mảng deleted trong delta GET /settings: xóa key khỏi localStorage và backup nếu có dirty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes("/sync")) {
          return {
            ok: false,
            status: 404,
            headers: new Headers(),
            json: async () => ({ error: "Endpoint /sync not supported in v1 server" }),
          };
        }
        if (url.includes("/settings") && (!init?.method || init.method === "GET")) {
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({
              settings: {},
              deleted: [STORAGE_KEYS.pomoDurations],
              updated: {},
              serverTime: 12_000,
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ ok: true, saved: 0, sessions: [], epoch: 1 }),
        };
      })
    );

    localStorage.setItem(STORAGE_KEYS.pomoDurations, JSON.stringify({ work: 30 }));
    await startCloudSync(uid, mockGetToken);

    expect(localStorage.getItem(STORAGE_KEYS.pomoDurations)).toBeNull();
  });

  it("hợp đồng focusEpoch: enqueue pending focus gán epoch hiện tại; clearCloudFocus tăng epoch và xóa sạch queue", async () => {
    localStorage.setItem(focusEpochStorageKey(uid), "1");

    enqueuePendingFocus(
      {
        id: "sess-1",
        taskId: "t1",
        taskTitle: "Học tập",
        startedAt: 1000,
        endedAt: 2500,
        focusSeconds: 1500,
        plannedSeconds: 1500,
        completed: true,
        schemaVersion: 1,
      },
      uid
    );

    const qRaw = localStorage.getItem(pendingFocusQueueKey(uid));
    expect(qRaw).not.toBeNull();
    const queue = JSON.parse(qRaw!);
    expect(queue.length).toBe(1);
    expect(queue[0].focusEpoch).toBe(1);

    const res = await clearCloudFocus(token, uid);
    expect(res.ok).toBe(true);
    expect(res.epoch).toBe(2);

    expect(getCurrentFocusEpoch(uid)).toBe(2);
    expect(localStorage.getItem(pendingFocusQueueKey(uid))).toBeNull();
  });

  it("cờ result.ok chỉ true khi cả GET và PUT đều thành công; nếu PUT lỗi thì result.ok = false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes("/settings") && init?.method === "PUT") {
          return {
            ok: false,
            status: 500,
            headers: new Headers(),
            json: async () => ({ error: "Internal Error" }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ settings: {}, deleted: [], updated: {}, serverTime: 10_000, sessions: [], epoch: 1 }),
        };
      })
    );

    localStorage.setItem(STORAGE_KEYS.mood, "chill");
    await startCloudSync(uid, mockGetToken);

    const syncRes = await syncNow();
    expect(syncRes.ok).toBe(false);
  });

  /* ---------------- 10 Blockers Kiểm Thử Nghiệm Thu Mốc 2 ---------------- */

  it("Blocker 1: shouldWipeKey và wipeLocalUserData xóa sạch key động theo UID (lastSyncedAt, focusEpoch, pendingFocusQueue, backups)", async () => {
    const testUid = "user-m2-wipe";
    const lastSyncedKey = `${STORAGE_KEYS.lastSyncedAt}_${testUid}`;
    const epochKey = `${STORAGE_KEYS.focusEpoch}_${testUid}`;
    const queueKey = `${STORAGE_KEYS.pendingFocusQueue}_${testUid}`;
    const backupKey = `study_space_backup_multiNotes_${Date.now()}`;

    localStorage.setItem(lastSyncedKey, "50000");
    localStorage.setItem(epochKey, "3");
    localStorage.setItem(queueKey, JSON.stringify([{ id: "s1" }]));
    localStorage.setItem(backupKey, "some backup");

    expect(shouldWipeKey(lastSyncedKey)).toBe(true);
    expect(shouldWipeKey(epochKey)).toBe(true);
    expect(shouldWipeKey(queueKey)).toBe(true);
    expect(shouldWipeKey(backupKey)).toBe(true);

    await wipeLocalUserData();

    expect(localStorage.getItem(lastSyncedKey)).toBeNull();
    expect(localStorage.getItem(epochKey)).toBeNull();
    expect(localStorage.getItem(queueKey)).toBeNull();
    expect(localStorage.getItem(backupKey)).toBeNull();
  });

  it("Blocker 2: sửa dữ liệu khi initial sync đang pending vẫn được đánh dấu dirty = true", async () => {
    let resolveGet: any;
    const getPromise = new Promise((resolve) => {
      resolveGet = resolve;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes("/settings") && (!init?.method || init.method === "GET")) {
          await getPromise; // Treo GET để mô phỏng initial sync đang chạy
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({
              settings: { [STORAGE_KEYS.mood]: "old_server" },
              deleted: [],
              updated: {},
              serverTime: 10_000,
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ settings: {}, deleted: [], updated: {}, serverTime: 10_000, sessions: [], epoch: 1 }),
        };
      })
    );

    const startPromise = startCloudSync(uid, mockGetToken);

    // Người dùng đổi mood ngay trong lúc GET đang pending
    window.localStorage.setItem(STORAGE_KEYS.mood, "deep_focus");

    // Kiểm tra meta: cờ dirty phải là true ngay lập tức dù chưa bootstrapped xong!
    const meta = readMeta();
    expect(meta[STORAGE_KEYS.mood]?.dirty).toBe(true);

    // Cho GET hoàn thành
    resolveGet();
    await startPromise;
  });

  it("Blocker 3: token null vẫn kích hoạt active & bootstrapped để theo dõi dirty chính xác", async () => {
    const res = await startCloudSync("offline-user", async () => null);
    expect(res.applied).toBe(0);
    expect(getSyncState().status).toBe("local");

    // Người dùng đổi theme/sceneId khi offline
    window.localStorage.setItem(STORAGE_KEYS.sceneId, "cozy-rain");
    const meta = readMeta();
    expect(meta[STORAGE_KEYS.sceneId]?.dirty).toBe(true);
    expect(hasUnsyncedChanges()).toBe(true);
  });

  it("Blocker 4: STALE_EPOCH được dọn sạch khỏi queue lẫn focusSessionStore và dispatch event", async () => {
    const staleSession: FocusSession = {
      id: "stale-sess-99",
      taskId: "t99",
      taskTitle: "Phiên cũ",
      startedAt: 1000,
      endedAt: 2500,
      focusSeconds: 1500,
      plannedSeconds: 1500,
      completed: true,
      schemaVersion: 1,
      focusEpoch: 1,
    };

    // Lưu vào local store và hàng đợi
    focusSessionStore.append(staleSession);
    enqueuePendingFocus(staleSession, uid);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes("/focus") && init?.method === "POST") {
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({
              ok: true,
              saved: 0,
              epoch: 2,
              rejected: [{ id: "stale-sess-99", reason: "STALE_EPOCH" }],
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ settings: {}, deleted: [], updated: {}, serverTime: 10_000, sessions: [], epoch: 2 }),
        };
      })
    );

    let staleEventFired = false;
    const listener = (e: any) => {
      if (e.detail?.staleIds?.includes("stale-sess-99")) {
        staleEventFired = true;
      }
    };
    window.addEventListener(EVENT_CLOUD_FOCUS_STALE, listener);

    await startCloudSync(uid, mockGetToken);

    window.removeEventListener(EVENT_CLOUD_FOCUS_STALE, listener);

    // Phiên stale phải bị xóa khỏi queue
    const qRaw = localStorage.getItem(pendingFocusQueueKey(uid));
    const queue = qRaw ? JSON.parse(qRaw) : [];
    expect(queue.find((s: any) => s.id === "stale-sess-99")).toBeUndefined();

    // Phiên stale phải bị dọn sạch khỏi focusSessionStore (không được hồi sinh)
    const storeList = focusSessionStore.list();
    expect(storeList.find((s: any) => s.id === "stale-sess-99")).toBeUndefined();

    // Event thông báo phải được kích hoạt
    expect(staleEventFired).toBe(true);
  });

  it("Blocker 5: delta sync (lastSyncedAt > 0) không push key không đổi lên server", async () => {
    const putBodies: any[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes("/settings") && init?.method === "PUT") {
          const body = JSON.parse(init.body as string);
          putBodies.push(body);
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({ ok: true, saved: 1, at: 20_000 }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            settings: {}, // delta rỗng: server không có gì thay đổi
            deleted: [],
            updated: {},
            serverTime: 20_000,
            sessions: [],
            epoch: 1,
          }),
        };
      })
    );

    // Giả lập máy đã từng sync ở mốc 10.000 (delta mode)
    localStorage.setItem(`${STORAGE_KEYS.lastSyncedAt}_${uid}`, "10000");
    localStorage.setItem(STORAGE_KEYS.sceneId, "cyberpunk-rain");
    localStorage.setItem(STORAGE_KEYS.mood, "study_flow");

    await startCloudSync(uid, mockGetToken);

    // Người dùng đổi mood
    window.localStorage.setItem(STORAGE_KEYS.mood, "study_zen");
    await syncNow();

    const lastPut = putBodies[putBodies.length - 1];

    // PUT chỉ được chứa mood, TUYỆT ĐỐI không chứa sceneId vì sceneId không dirty
    expect(lastPut?.settings).toBeDefined();
    expect(lastPut.settings[STORAGE_KEYS.mood]).toBe("study_zen");
    expect(lastPut.settings[STORAGE_KEYS.sceneId]).toBeUndefined();
  });

  it("Blocker 6: khi sync thất bại, syncSuccess là false giúp ngăn việc xóa local data khi đăng xuất", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes("/settings") && init?.method === "PUT") {
          return { ok: false, status: 500, headers: new Headers(), json: async () => ({ error: "fail" }) };
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ settings: {}, deleted: [], updated: {}, serverTime: 10_000, sessions: [], epoch: 1 }),
        };
      })
    );

    await startCloudSync(uid, mockGetToken);
    window.localStorage.setItem(STORAGE_KEYS.sceneId, "rain-window");

    const res = await syncNow();
    const syncSuccess = res.ok && !hasUnsyncedChanges();
    expect(syncSuccess).toBe(false); // useAuth sẽ dựa vào cờ này để alert và hủy đăng xuất, giữ nguyên dữ liệu local
  });

  it("Blocker 7: apiFetch tự động refresh token khi 401, bắt Retry-After khi 429, và bắt lỗi try/catch", async () => {
    const dynamicGetToken = vi.fn().mockImplementation(async (forceRefresh?: boolean) => {
      return forceRefresh ? "new-refreshed-token" : "expired-token";
    });

    let capturedAuthHeader = "";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        const auth = (init?.headers as any)?.Authorization;
        if (auth === "Bearer expired-token") {
          return {
            ok: false,
            status: 401,
            headers: new Headers(),
            json: async () => ({ error: "Unauthorized" }),
          };
        }
        capturedAuthHeader = auth;
        if (url.includes("/settings") && init?.method === "PUT") {
          return {
            ok: false,
            status: 429,
            headers: new Headers({ "Retry-After": "30" }),
            json: async () => ({ error: "Rate limit" }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ settings: {}, deleted: [], updated: {}, serverTime: 10_000, sessions: [], epoch: 1 }),
        };
      })
    );

    await startCloudSync(uid, dynamicGetToken);

    // 401 đã kích hoạt tokenFn(true) và gửi request tiếp theo với token mới
    expect(dynamicGetToken).toHaveBeenCalledWith(true);
    expect(capturedAuthHeader).toBe("Bearer new-refreshed-token");

    // Gây lỗi PUT để kích hoạt 429
    window.localStorage.setItem(STORAGE_KEYS.mood, "deep");
    const res = await syncNow();
    expect(res.ok).toBe(false);
    expect(getSyncState().status).toBe("error");

    // Backoff delay phải tôn trọng Retry-After 30 giây (30000ms)
    expect(getBackoffDelay()).toBe(30_000);
  });

  it("Blocker 8: cứu ghi chú offline khi server xóa dù đồng hồ máy chậm 15 phút; kiểm tra isNoteActive & restore", () => {
    const serverTime = 100_000;
    const localSlowTime = serverTime - 15 * 60 * 1000; // Chậm 15 phút

    const serverNotes: StudyNote[] = [
      {
        id: "note-1",
        title: "Bài học",
        content: "",
        deletedAt: 90_000,
        updatedAt: 90_000,
      },
    ];

    const localNotes: StudyNote[] = [
      {
        id: "note-1",
        title: "Bài học quan trọng",
        content: "Nội dung soạn thảo offline lúc máy chậm giờ",
        updatedAt: localSlowTime,
      },
    ];

    const merged = mergeStudyNotes(JSON.stringify(localNotes), JSON.stringify(serverNotes), serverTime);
    expect(merged.hasConflict).toBe(true);

    const parsed: StudyNote[] = JSON.parse(merged.raw);
    const tombstone = parsed.find((n) => n.id === "note-1");
    expect(tombstone).toBeDefined();
    expect(isNoteActive(tombstone!)).toBe(false);

    // Cứu bản sao với đầy đủ nội dung offline
    const rescued = parsed.find((n) => n.id.includes("note-1~conflict~"));
    expect(rescued).toBeDefined();
    expect(rescued?.content).toBe("Nội dung soạn thảo offline lúc máy chậm giờ");
    expect(isNoteActive(rescued!)).toBe(true);

    // Test khôi phục note (restoredAt > deletedAt)
    const restoredNote: StudyNote = {
      ...tombstone!,
      restoredAt: 120_000,
      updatedAt: 120_000,
    };
    expect(isNoteActive(restoredNote)).toBe(true);
  });

  it("Blocker 9: hasUnsyncedChanges trả về false sau khi sync notes sạch sẽ (không false positive)", async () => {
    const notesJson = JSON.stringify([{ id: "n1", title: "Note 1", content: "Content 1", updatedAt: 1000 }]);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            settings: { [STORAGE_KEYS.multiNotes]: notesJson },
            deleted: [],
            updated: { [STORAGE_KEYS.multiNotes]: 10_000 },
            serverTime: 10_000,
            sessions: [],
            epoch: 1,
          }),
        };
      })
    );

    localStorage.setItem(STORAGE_KEYS.multiNotes, notesJson);
    await startCloudSync(uid, mockGetToken);

    // Sau khi sync sạch sẽ, không còn cờ dirty hay lệch thời gian giả
    expect(hasUnsyncedChanges()).toBe(false);
  });

  it("Blocker 10: vòng lặp while cho needsResync đảm bảo thay đổi xuất hiện trong lúc sync không bị bỏ sót", async () => {
    let syncPassCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if ((url.includes("/settings") && init?.method === "PUT") || (url.includes("/sync") && init?.method === "POST")) {
          syncPassCount++;
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            ok: true,
            saved: 1,
            at: 10_000 + syncPassCount * 1000,
            settings: {},
            deleted: [],
            updated: {},
            serverTime: 10_000 + syncPassCount * 1000,
            sessions: [],
            epoch: 1,
          }),
        };
      })
    );

    await startCloudSync(uid, mockGetToken);

    // Tạo thay đổi 1
    window.localStorage.setItem(STORAGE_KEYS.mood, "mood_1");
    const p1 = syncNow();

    // Trong khi p1 đang chạy, tạo tiếp thay đổi 2 và gọi syncNow()
    window.localStorage.setItem(STORAGE_KEYS.mood, "mood_2");
    const p2 = syncNow();

    await Promise.all([p1, p2]);

    // Vòng lặp while đã xử lý cả 2 lượt sync
    expect(syncPassCount).toBeGreaterThanOrEqual(2);
    expect(hasUnsyncedChanges()).toBe(false);
  });

  /* ---------------- Kiểm Thử Nghiệm Thu Vòng 2 — Sửa Lỗi P0 & P1 ---------------- */

  it("P0-1: PUT hoặc DELETE thất bại bảo lưu 100% cờ dirty và del trong metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes("/settings") && init?.method === "PUT") {
          return { ok: false, status: 500, headers: new Headers(), json: async () => ({ error: "Server Error" }) };
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ settings: {}, deleted: [], updated: {}, serverTime: 10_000, sessions: [], epoch: 1 }),
        };
      })
    );

    await startCloudSync(uid, mockGetToken);

    // Người dùng đổi mood
    window.localStorage.setItem(STORAGE_KEYS.mood, "deep_focus_now");
    const res = await syncNow();
    expect(res.ok).toBe(false);

    // Cờ dirty PHẢI được bảo lưu trong meta vì PUT đã thất bại!
    const meta = readMeta();
    expect(meta[STORAGE_KEYS.mood]?.dirty).toBe(true);
    expect(hasUnsyncedChanges()).toBe(true);
  });

  it("P0-2: noteLocalChange trong lúc sync kích hoạt needsResync và bảo vệ dirty in-flight", async () => {
    let resolvePut: any;
    const putPromise = new Promise((resolve) => {
      resolvePut = resolve;
    });

    let shouldDelayPut = false;
    let putCallCount = 0;
    let lastPutBody: any = null;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes("/settings") && init?.method === "PUT") {
          putCallCount++;
          if (init?.body) {
            try {
              lastPutBody = JSON.parse(init.body as string);
            } catch {}
          }
          if (shouldDelayPut) {
            await putPromise;
          }
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({ ok: true, saved: 1, at: 15_000 + putCallCount }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ settings: {}, deleted: [], updated: {}, serverTime: 10_000, sessions: [], epoch: 1 }),
        };
      })
    );

    await startCloudSync(uid, mockGetToken);

    // Kích hoạt delay PUT cho lần sync kế tiếp
    shouldDelayPut = true;

    // 1. Sửa sceneId và gọi sync
    window.localStorage.setItem(STORAGE_KEYS.sceneId, "cyberpunk");
    const sync1 = syncNow();

    // 2. Trong lúc PUT đang bay (in-flight), người dùng sửa tiếp sceneId thành "rainy-day"
    window.localStorage.setItem(STORAGE_KEYS.sceneId, "rainy-day");

    // 3. Cho PUT 1 hoàn thành
    resolvePut();
    const finalRes = await sync1;

    // Vòng lặp while đã chạy thêm lượt sync 2 để đẩy "rainy-day"
    expect(finalRes.ok).toBe(true);
    expect(putCallCount).toBeGreaterThanOrEqual(2);
    expect(lastPutBody?.settings?.[STORAGE_KEYS.sceneId]).toBe("rainy-day");
    expect(hasUnsyncedChanges()).toBe(false);
  });

  it("P0-3: xóa key chưa từng sync (không có ở cả local lẫn server) không bị kẹt hasUnsyncedChanges", async () => {
    await startCloudSync(uid, mockGetToken);

    // Xóa một key chưa từng tồn tại trên server và local cũng không có
    window.localStorage.removeItem(STORAGE_KEYS.customEmbeds);

    // Lúc này noteLocalChange đánh dấu del: true
    const metaBefore = readMeta();
    expect(metaBefore[STORAGE_KEYS.customEmbeds]?.del).toBe(true);

    // Sync chạy
    const res = await syncNow();
    expect(res.ok).toBe(true);

    // Sau sync, cờ del phải được dọn sạch vì cả hai bên đều không có key này
    expect(hasUnsyncedChanges()).toBe(false);
    const metaAfter = readMeta();
    expect(metaAfter[STORAGE_KEYS.customEmbeds]?.del).toBe(false);
  });

  it("P0-4: Active editing guard phát hiện đang gõ và hoãn áp dụng để tránh đè dữ liệu", async () => {
    // Tạo một textarea giả lập người dùng đang focus gõ note
    const textarea = document.createElement("textarea");
    textarea.className = "notes-editor";
    document.body.appendChild(textarea);
    textarea.focus();

    expect(isUserActivelyEditing(STORAGE_KEYS.multiNotes)).toBe(true);

    const serverNotes = JSON.stringify([{ id: "n1", title: "Server Note", content: "From Server", updatedAt: 20_000 }]);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes("/settings") && (!init?.method || init.method === "GET")) {
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({
              settings: { [STORAGE_KEYS.multiNotes]: serverNotes },
              deleted: [],
              updated: { [STORAGE_KEYS.multiNotes]: 20_000 },
              serverTime: 20_000,
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ ok: true, saved: 1, at: 20_000, sessions: [], epoch: 1 }),
        };
      })
    );

    const localNotes = JSON.stringify([{ id: "n1", title: "Local Note", content: "Editing Local", updatedAt: 10_000 }]);
    window.localStorage.setItem(STORAGE_KEYS.multiNotes, localNotes);

    await startCloudSync(uid, mockGetToken);

    // Khi người dùng đang focus gõ note, multiNotes KHÔNG bị đè bởi server
    expect(window.localStorage.getItem(STORAGE_KEYS.multiNotes)).toBe(localNotes);

    document.body.removeChild(textarea);
  });

  it("P0-5: logFocusSession tự động bind epoch; Migration không hồi sinh phiên cũ khi epoch > 1", async () => {
    // Giả sử user đã clear lịch sử và server đang ở epoch 2
    window.localStorage.setItem(focusEpochStorageKey(uid), "2");

    // 1. logFocusSession tự gán epoch hiện tại
    const newSession = logFocusSession({
      taskId: "t-auto",
      taskTitle: "Auto Epoch",
      startedAt: 1000,
      endedAt: 2000,
      focusSeconds: 1000,
      plannedSeconds: 1000,
    });

    expect(newSession).not.toBeNull();
    expect(newSession?.focusEpoch).toBe(2);

    // 2. Phiên cũ không có epoch (từ trước khi clear) không được đưa vào queue khi epoch > 1
    const oldLegacySession: FocusSession = {
      id: "old-legacy-1",
      taskId: "t-old",
      taskTitle: "Phiên cũ thời epoch 1",
      startedAt: 500,
      endedAt: 900,
      focusSeconds: 400,
      plannedSeconds: 400,
      completed: true,
      schemaVersion: 1,
      // Không có focusEpoch
    };
    focusSessionStore.append(oldLegacySession);

    await startCloudSync(uid, mockGetToken);

    const qRaw = window.localStorage.getItem(pendingFocusQueueKey(uid));
    const queue = qRaw ? JSON.parse(qRaw) : [];

    // Phiên cũ không có epoch KHÔNG được enqueue vì epoch hiện tại là 2
    expect(queue.find((s: any) => s.id === "old-legacy-1")).toBeUndefined();
  });

  it("P0-6: resetLocalSyncedData khi switch account xóa sạch focusSessionStore và các key của user cũ", async () => {
    const userA = "user-A";
    const userB = "user-B";

    // User A đăng nhập và tạo dữ liệu
    await startCloudSync(userA, mockGetToken);
    focusSessionStore.append({
      id: "sess-user-a",
      taskId: "task-a",
      taskTitle: "Task A",
      startedAt: 1000,
      endedAt: 2000,
      focusSeconds: 1000,
      plannedSeconds: 1000,
      completed: true,
      schemaVersion: 1,
    });
    expect(focusSessionStore.list().length).toBe(1);

    // User B đăng nhập trên cùng trình duyệt
    await startCloudSync(userB, mockGetToken);

    // Dữ liệu focus của User A phải được dọn sạch hoàn toàn, không rò rỉ sang User B!
    expect(focusSessionStore.list().find((s) => s.id === "sess-user-a")).toBeUndefined();
  });

  it("P1-1: Backup key prefix study_space_backup_ khớp với DYNAMIC_PREFIXES và được xóa khi wipe", async () => {
    const backupKey = `study_space_backup_${STORAGE_KEYS.sceneId}_conflict_${Date.now()}`;
    window.localStorage.setItem(backupKey, "backup data");

    expect(shouldWipeKey(backupKey)).toBe(true);

    await wipeLocalUserData();
    expect(window.localStorage.getItem(backupKey)).toBeNull();
  });

  it("P1-3: mergeStudyNotes ưu tiên note phục hồi (restoredAt > deletedAt) thắng tombstone của server", () => {
    const localRestoredTime = 150_000;
    const serverDeleteTime = 100_000;

    const serverNotes: StudyNote[] = [
      {
        id: "note-restore-test",
        title: "Ghi chú",
        content: "",
        deletedAt: serverDeleteTime,
        updatedAt: serverDeleteTime,
      },
    ];

    const localNotes: StudyNote[] = [
      {
        id: "note-restore-test",
        title: "Ghi chú đã phục hồi",
        content: "Nội dung sau khi phục hồi",
        deletedAt: serverDeleteTime,
        restoredAt: localRestoredTime, // Phục hồi sau khi server xóa!
        updatedAt: localRestoredTime,
      },
    ];

    const res = mergeStudyNotes(JSON.stringify(localNotes), JSON.stringify(serverNotes), 160_000);

    const parsed: StudyNote[] = JSON.parse(res.raw);
    expect(parsed.length).toBe(1);
    expect(parsed[0].id).toBe("note-restore-test");
    expect(parsed[0].content).toBe("Nội dung sau khi phục hồi");
    expect(isNoteActive(parsed[0])).toBe(true);
    // Không sinh ra bản sao thừa
    expect(res.hasConflict).toBe(false);
  });
});
