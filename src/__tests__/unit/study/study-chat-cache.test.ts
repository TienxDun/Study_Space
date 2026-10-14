import { describe, it, expect, beforeEach } from "vitest";
import { loadCache, saveCache, clearCache } from "@/components/study/chat/utils/chatCache";
import type { Msg } from "@/components/study/chat/types";

describe("Chat Cache & Session Messages Storage", () => {
  const uid = "test-user-123";
  const sid = "session-abc-456";

  beforeEach(() => {
    let store: Record<string, string> = {};
    const mockStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
      get length() {
        return Object.keys(store).length;
      },
      key: (i: number) => Object.keys(store)[i] ?? null,
    };
    globalThis.localStorage = mockStorage as unknown as Storage;
  });

  it("should return null when cache does not exist", () => {
    const cached = loadCache(uid, sid);
    expect(cached).toBeNull();
  });

  it("should correctly save and load messages from cache", () => {
    const mockMsgs: Msg[] = [
      { id: "m1", role: "user", text: "Xin chào", ts: 1000 },
      { id: "m2", role: "assistant", text: "Chào bạn, mình có thể giúp gì?", ts: 2000 },
    ];

    saveCache(uid, sid, mockMsgs);
    const cached = loadCache(uid, sid);

    expect(cached).toHaveLength(2);
    expect(cached?.[0].text).toBe("Xin chào");
    expect(cached?.[1].text).toBe("Chào bạn, mình có thể giúp gì?");
  });

  it("should clear cache when switching user account", () => {
    const mockMsgs: Msg[] = [{ id: "m1", role: "user", text: "Tin nhắn cũ" }];
    saveCache(uid, sid, mockMsgs);

    expect(loadCache(uid, sid)).not.toBeNull();

    clearCache(uid);
    expect(loadCache(uid, sid)).toBeNull();
  });

  it("should safely limit cache size to CACHE_MAX (50 items)", () => {
    const longList: Msg[] = Array.from({ length: 70 }, (_, i) => ({
      id: `msg-${i}`,
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      text: `Tin nhắn số ${i}`,
      ts: 1000 + i,
    }));

    saveCache(uid, sid, longList);
    const cached = loadCache(uid, sid);

    expect(cached).toHaveLength(50);
    // Lưu 50 tin nhắn mới nhất (cuối mảng)
    expect(cached?.[0].id).toBe("msg-20");
    expect(cached?.[49].id).toBe("msg-69");
  });
});
