import { describe, expect, it } from "vitest";
import {
  MAX_LIVE_SESSIONS,
  SESSION_STORE_VERSION,
  TOMBSTONE_RETENTION_MS,
  createSessionStore,
  loadSessionStore,
  liveSessions,
  normalizeSessionStore,
  pruneSessionStore,
  relativeTime,
  requestMessagesFor,
  saveSessionStore,
  serializeSessionStore,
  sessionMeta,
  sessionTitle,
} from "../../../features/chat-v2/lib/sessions";
import { shouldSummarize, summaryChunk } from "../../../features/chat-v2/lib/tokens";
import type { ChatV2Message, ChatV2Session, ChatV2SessionStore } from "../../../features/chat-v2/types";

function message(id: string, role: "user" | "assistant", text: string): ChatV2Message {
  return { id, role, text };
}

function session(id: string, updatedAt: number, overrides: Partial<ChatV2Session> = {}): ChatV2Session {
  return {
    id,
    title: "",
    modelId: "deepseek-v4-flash",
    createdAt: updatedAt,
    updatedAt,
    messages: [],
    ...overrides,
  };
}

function store(sessions: ChatV2Session[], activeSessionId: string | null = sessions[0]?.id || null): ChatV2SessionStore {
  return { schemaVersion: SESSION_STORE_VERSION, activeSessionId, sessions };
}

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  } as Storage;
}

describe("chat v2 sessions", () => {
  it("tạo store có đúng một phiên đang mở", () => {
    const created = createSessionStore("deepseek-v4-flash", 1000);
    expect(created.schemaVersion).toBe(1);
    expect(created.sessions).toHaveLength(1);
    expect(created.activeSessionId).toBe(created.sessions[0].id);
    expect(created.sessions[0].messages).toEqual([]);
  });

  it("đặt tiêu đề tự động từ câu hỏi đầu và tôn trọng tên tự sửa", () => {
    const auto = session("s1", 1, {
      messages: [message("u1", "user", "  Giải   thích đạo hàm giúp mình với  ")],
    });
    expect(sessionTitle(auto)).toBe("Giải thích đạo hàm giúp mình với");

    const manual = session("s2", 1, { title: "Ôn thi giữa kỳ" });
    expect(sessionTitle(manual)).toBe("Ôn thi giữa kỳ");
    expect(sessionTitle(session("s3", 1))).toBe("Cuộc trò chuyện mới");
  });

  it("chỉ gửi phần chưa tóm tắt kèm bản tóm tắt", () => {
    const item = session("s1", 1, {
      messages: [message("u1", "user", "A"), message("a1", "assistant", "B"), message("u2", "user", "C")],
      summary: { text: "Tóm tắt A/B", upToMessageId: "a1", messageCount: 2, updatedAt: 1 },
    });
    const request = requestMessagesFor(item);
    expect(request.messages).toEqual([{ role: "user", content: "C" }]);
    expect(request.summary).toBe("Tóm tắt A/B");
    expect(request.omittedMessages).toBe(2);
  });

  it("giữ metadata phiên cho sidebar", () => {
    const item = session("s1", 5000, {
      messages: [message("u1", "user", "Học Python")],
      summary: { text: "x", upToMessageId: "u1", messageCount: 4, updatedAt: 1 },
    });
    expect(sessionMeta(item)).toEqual({
      id: "s1",
      title: "Học Python",
      messageCount: 1,
      updatedAt: 5000,
      summaryMessageCount: 4,
    });
  });

  it("bỏ dữ liệu ảnh khi lưu nhưng giữ file text và metadata", () => {
    const item = session("s1", 1, {
      messages: [
        {
          id: "u1",
          role: "user",
          text: "Xem ảnh",
          attachments: [{ id: "at1", name: "de.png", kind: "image", thumb: "data:image/png;base64,small" }],
          payload: {
            images: [{ name: "de.png", data: "data:image/png;base64,BIG" }],
            files: [{ name: "bai.txt", text: "nội dung" }],
          },
        },
      ],
    });
    const parsed = JSON.parse(serializeSessionStore(store([item]))) as ChatV2SessionStore;
    const saved = parsed.sessions[0].messages[0];
    expect(saved.payload?.images).toEqual([]);
    expect(saved.payload?.files).toEqual([{ name: "bai.txt", text: "nội dung" }]);
    expect(saved.attachments?.[0].thumb).toContain("base64,small");
  });

  it("round-trip qua localStorage", () => {
    const storage = memoryStorage();
    const initial = createSessionStore("deepseek-v4-flash", 1000);
    initial.sessions[0].messages = [message("u1", "user", "Xin chào")];
    expect(saveSessionStore(initial, storage)).toBe(true);

    const loaded = loadSessionStore(storage);
    expect(loaded?.sessions[0].messages[0].text).toBe("Xin chào");
    expect(loaded?.activeSessionId).toBe(initial.activeSessionId);
  });

  it("lưu và phục hồi lastContext qua localStorage", () => {
    const storage = memoryStorage();
    const initial = createSessionStore("deepseek-v4-flash", 1000);
    initial.sessions[0].messages = [message("u1", "user", "Xin chào")];
    initial.sessions[0].lastContext = {
      estimatedInputTokens: 1200,
      maxInputTokens: 24000,
      trimmedMessages: 1,
      contextTokens: 32768,
      maxOutputTokens: 8192,
    };
    expect(saveSessionStore(initial, storage)).toBe(true);

    const loaded = loadSessionStore(storage);
    expect(loaded?.sessions[0].lastContext).toEqual({
      estimatedInputTokens: 1200,
      maxInputTokens: 24000,
      trimmedMessages: 1,
      contextTokens: 32768,
      maxOutputTokens: 8192,
    });
  });

  it("giữ thời gian phản hồi hợp lệ và bỏ giá trị hỏng", () => {
    const storage = memoryStorage();
    const initial = createSessionStore("deepseek-v4-flash", 1000);
    initial.sessions[0].messages = [
      { id: "a1", role: "assistant", text: "Đáp án", durationMs: 2450 },
      { id: "a2", role: "assistant", text: "Đáp án cũ", durationMs: -5 },
    ];
    expect(saveSessionStore(initial, storage)).toBe(true);

    const loaded = loadSessionStore(storage);
    expect(loaded?.sessions[0].messages[0].durationMs).toBe(2450);
    expect(loaded?.sessions[0].messages[1].durationMs).toBeUndefined();
  });

  it("bỏ qua JSON hỏng hoặc sai phiên bản", () => {
    expect(normalizeSessionStore(null)).toBeNull();
    expect(normalizeSessionStore({ schemaVersion: 99, sessions: [] })).toBeNull();
    expect(loadSessionStore(memoryStorage())).toBeNull();
  });

  it("giới hạn số phiên sống và dọn tombstone cũ", () => {
    const now = 100 * 24 * 60 * 60 * 1000;
    const sessions = Array.from({ length: MAX_LIVE_SESSIONS + 4 }, (_, index) =>
      session(`s${index}`, now - index)
    );
    sessions.push(session("old-deleted", now - TOMBSTONE_RETENTION_MS - 1, { deletedAt: now - TOMBSTONE_RETENTION_MS - 1 }));
    const pruned = pruneSessionStore(store(sessions), now);
    const live = pruned.sessions.filter((item) => !item.deletedAt);
    expect(live).toHaveLength(MAX_LIVE_SESSIONS);
    expect(pruned.sessions.some((item) => item.id === "old-deleted")).toBe(false);
    expect(liveSessions(pruned)[0].id).toBe("s0");
  });

  it("đổi phiên đang mở sang phiên còn lại khi phiên cũ bị xoá", () => {
    const pruned = pruneSessionStore(
      store([session("a", 2), session("b", 1, { deletedAt: 3 })], "b"),
      10
    );
    expect(pruned.activeSessionId).toBe("a");
  });

  it("hiển thị thời gian tương đối bằng tiếng Việt", () => {
    const now = 10 * 24 * 60 * 60 * 1000;
    expect(relativeTime(now - 5000, now)).toBe("Vừa xong");
    expect(relativeTime(now - 5 * 60 * 1000, now)).toBe("5 phút trước");
    expect(relativeTime(now - 3 * 60 * 60 * 1000, now)).toBe("3 giờ trước");
    expect(relativeTime(now - 24 * 60 * 60 * 1000, now)).toBe("Hôm qua");
    expect(relativeTime(now - 3 * 24 * 60 * 60 * 1000, now)).toBe("3 ngày trước");
  });
});

describe("chat v2 summary policy", () => {
  const model = { contextTokens: 1048576, maxOutputTokens: 16384, vision: false, free: false, available: true, id: "deepseek-v4-flash", ownedBy: "" };
  const smallModel = { contextTokens: 16384, maxOutputTokens: 4096, vision: false, free: false, available: true, id: "small-test", ownedBy: "" };

  it("chỉ tóm tắt khi lịch sử chưa nén vượt ngưỡng (số tin hoặc token)", () => {
    const shortMessages = Array.from({ length: 12 }, (_, index) =>
      message(`m${index}`, index % 2 === 0 ? "user" : "assistant", "ngắn")
    );
    expect(shouldSummarize(session("s1", 1, { messages: shortMessages }), model)).toBe(false);

    // Kích hoạt khi đạt mốc 20 tin nhắn (dù là tin ngắn)
    const twentyMessages = Array.from({ length: 20 }, (_, index) =>
      message(`m${index}`, index % 2 === 0 ? "user" : "assistant", "ngắn")
    );
    expect(shouldSummarize(session("s1b", 1, { messages: twentyMessages }), model)).toBe(true);

    // Kích hoạt khi tin dài vượt ngưỡng 16000 token trên model 1M
    const longText = "nội dung học tập ".repeat(180);
    const longMessages = Array.from({ length: 12 }, (_, index) =>
      message(`m${index}`, index % 2 === 0 ? "user" : "assistant", longText)
    );
    expect(shouldSummarize(session("s2", 1, { messages: longMessages }), model)).toBe(true);

    // Kích hoạt theo tỷ lệ context 55% trên model nhỏ
    const mediumText = "a".repeat(1200);
    const mediumMessages = Array.from({ length: 12 }, (_, index) =>
      message(`m${index}`, index % 2 === 0 ? "user" : "assistant", mediumText)
    );
    expect(shouldSummarize(session("s3", 1, { messages: mediumMessages }), smallModel)).toBe(true);
  });

  it("giữ lại tin gần nhất khi chọn phần cần nén", () => {
    const messages = Array.from({ length: 20 }, (_, index) =>
      message(`m${index}`, index % 2 === 0 ? "user" : "assistant", `tin ${index}`)
    );
    const chunk = summaryChunk(session("s1", 1, { messages }));
    expect(chunk).toHaveLength(14);
    expect(chunk[chunk.length - 1].id).toBe("m13");

    const short = messages.slice(0, 12);
    expect(summaryChunk(session("s2", 1, { messages: short }))).toHaveLength(6);
  });

  it("giới hạn ký tự mỗi lần nén và đi từ tin cũ nhất", () => {
    const messages = Array.from({ length: 20 }, (_, index) =>
      message(`m${index}`, index % 2 === 0 ? "user" : "assistant", "x".repeat(10000))
    );
    const chunk = summaryChunk(session("s1", 1, { messages }));
    expect(chunk).toHaveLength(3);
    expect(chunk[0].id).toBe("m0");
    expect(chunk.reduce((total, item) => total + item.text.length, 0)).toBeLessThanOrEqual(36000);
  });
});
