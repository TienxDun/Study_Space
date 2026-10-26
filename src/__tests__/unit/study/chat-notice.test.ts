import { beforeEach, describe, expect, it, vi } from "vitest";

const { toastFn, dismissFn } = vi.hoisted(() => ({ toastFn: vi.fn(), dismissFn: vi.fn() }));

vi.mock("sonner", () => ({
  toast: Object.assign(toastFn, { dismiss: dismissFn }),
}));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CHAT_API_URL", "https://chat.test");
  vi.resetModules();
  toastFn.mockClear();
  dismissFn.mockClear();
});

async function loadChatApi() {
  return import("@/components/study/chat/utils/chatApi");
}

function stubResponse(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status }))
  );
}

describe("callChatApi — lỗi trả về câu tiếng Việt", () => {
  it("429 hết lượt trong ngày", async () => {
    stubResponse(429, { error: "Hôm nay bạn đã dùng hết 30 câu, mai quay lại nhé." });
    const { callChatApi } = await loadChatApi();
    const res = await callChatApi(async () => "token", "hỏi");
    expect(res).toEqual({ ok: false, notice: "Bản free hôm nay đã hết lượt, mai bạn quay lại nhé." });
  });

  it("503 khi chat bị tắt bằng cờ giữ nguyên câu của máy chủ", async () => {
    stubResponse(503, {
      error: "Trợ lý chat đang tạm tắt. Bạn vẫn học và ghi chú bình thường.",
      code: "CHAT_DISABLED",
    });
    const { callChatApi } = await loadChatApi();
    const res = await callChatApi(async () => "token", "hỏi");
    expect(res).toEqual({
      ok: false,
      notice: "Trợ lý chat đang tạm tắt. Bạn vẫn học và ghi chú bình thường.",
    });
  });

  it("401 nhắc đăng nhập lại", async () => {
    stubResponse(401, { error: "unauthorized" });
    const { callChatApi } = await loadChatApi();
    const res = await callChatApi(async () => "token", "hỏi");
    expect(res).toEqual({ ok: false, notice: "Bạn đăng nhập lại để chat nhé." });
  });

  it("không có token thì không gọi mạng", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { callChatApi } = await loadChatApi();
    const res = await callChatApi(async () => null, "hỏi");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res).toEqual({ ok: false, notice: "Phiên đăng nhập hết hạn, bạn đăng nhập lại nhé." });
  });

  it("mất mạng báo thử lại", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const { callChatApi } = await loadChatApi();
    const res = await callChatApi(async () => "token", "hỏi");
    expect(res).toEqual({ ok: false, notice: "Mạng chập chờn, bạn thử lại nhé." });
  });
});

describe("notifyChat — toast dùng chung", () => {
  it("hiện toast 6 giây và thay toast cũ", async () => {
    const { notifyChat } = await import("@/components/study/chat/utils/chatNotice");
    notifyChat("Hết lượt rồi");
    expect(toastFn).toHaveBeenCalledWith("Hết lượt rồi", { id: "chat-notice", duration: 6000 });
  });

  it("dọn toast khi bắt đầu lượt mới", async () => {
    const { clearChatNotice } = await import("@/components/study/chat/utils/chatNotice");
    clearChatNotice();
    expect(dismissFn).toHaveBeenCalledWith("chat-notice");
  });
});
