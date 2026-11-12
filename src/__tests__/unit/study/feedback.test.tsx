// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { toast } from "sonner";
import { FeedbackDialog, FeedbackSheet } from "@/components/study/feedback/FeedbackDialog";
import { submitFeedback } from "@/lib/feedback";
import { prepareFeedbackImage } from "@/lib/feedback-image";

// @ts-expect-error test act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("sonner", () => {
  const callable = vi.fn();
  return {
    toast: Object.assign(callable, {
      error: vi.fn(),
      success: vi.fn(),
      dismiss: vi.fn(),
    }),
  };
});

const authState = vi.hoisted(() => ({
  user: null as { displayName?: string } | null,
  loading: false,
}));

vi.mock("@/components/study/auth", () => ({
  GoogleIcon: () => null,
  useAuth: () => ({
    user: authState.user,
    loading: authState.loading,
    isSigningIn: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    getToken: async () => "token-abc",
  }),
}));

function okResponse(body: unknown = { ok: true }) {
  return { ok: true, status: 200, json: async () => body };
}

describe("submitFeedback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("không có token thì không gọi mạng", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitFeedback({
      getToken: async () => null,
      kind: "bug",
      message: "Một đoạn góp ý đủ dài",
    });

    expect(result).toEqual({
      ok: false,
      notice: "Phiên đăng nhập đã hết hạn, bạn đăng nhập lại nhé.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gửi đúng body kèm ngữ cảnh lên data-api /feedback", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitFeedback({
      getToken: async () => "tok",
      kind: "idea",
      message: "  Mong có thêm chế độ học nhóm  ",
      contact: "  an@example.com  ",
      name: "Người Kiểm Thử",
    });

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/feedback");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      kind: "idea",
      contact: "an@example.com",
      name: "Người Kiểm Thử",
      appVersion: "v0.1.0",
      platform: "web",
    });
    expect(body.viewport).toMatch(/^\d+x\d+$/);
    expect(typeof body.locale).toBe("string");
  });

  it("cắt nội dung và liên hệ theo giới hạn của Worker", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    await submitFeedback({
      getToken: async () => "tok",
      kind: "other",
      message: "x".repeat(3000),
      contact: "y".repeat(200),
    });

    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.message.length).toBe(2000);
    expect(body.contact.length).toBe(120);
  });

  it("401 trả thông báo đăng nhập lại", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }),
    );
    const result = await submitFeedback({
      getToken: async () => "tok",
      kind: "bug",
      message: "Một đoạn góp ý đủ dài",
    });
    expect(result).toEqual({
      ok: false,
      notice: "Phiên đăng nhập đã hết hạn, bạn đăng nhập lại nhé.",
    });
  });

  it("429 trả thông báo giới hạn trong ngày", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }),
    );
    const result = await submitFeedback({
      getToken: async () => "tok",
      kind: "bug",
      message: "Một đoạn góp ý đủ dài",
    });
    expect(result).toEqual({
      ok: false,
      notice: "Bạn đã gửi nhiều góp ý hôm nay, mai bạn thử lại nhé.",
    });
  });

  it("có ảnh thì gửi multipart, không đặt Content-Type thủ công", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);
    const image = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" });

    const result = await submitFeedback({
      getToken: async () => "tok",
      kind: "bug",
      message: "Nút ghi chú không phản hồi",
      image,
    });

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/feedback");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
    const form = init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("kind")).toBe("bug");
    expect(form.get("message")).toBe("Nút ghi chú không phản hồi");
    const file = form.get("image") as File;
    expect(file.size).toBe(3);
    expect(file.type).toBe("image/jpeg");
  });

  it("giới hạn ảnh/ngày hiện đúng thông báo từ máy chủ", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({
          error: "Bạn đã gửi 3 ảnh hôm nay, mai bạn gửi tiếp nhé.",
          code: "IMAGE_RATE_LIMITED",
        }),
      }),
    );
    const result = await submitFeedback({
      getToken: async () => "tok",
      kind: "bug",
      message: "Một đoạn góp ý đủ dài",
      image: new Blob([new Uint8Array([1])], { type: "image/jpeg" }),
    });
    expect(result).toEqual({
      ok: false,
      notice: "Bạn đã gửi 3 ảnh hôm nay, mai bạn gửi tiếp nhé.",
    });
  });

  it("lỗi mạng trả thông báo thân thiện", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const result = await submitFeedback({
      getToken: async () => "tok",
      kind: "bug",
      message: "Một đoạn góp ý đủ dài",
    });
    expect(result).toEqual({ ok: false, notice: "Mạng chập chờn, bạn thử lại nhé." });
  });
});

describe("prepareFeedbackImage", () => {
  it("từ chối định dạng lạ và ảnh gốc quá lớn trước khi giải mã", async () => {
    const wrong = await prepareFeedbackImage({ type: "image/gif", size: 10 } as File);
    expect(wrong).toEqual({ ok: false, notice: "Chỉ nhận ảnh JPG, PNG hoặc WebP." });

    const oversized = await prepareFeedbackImage({
      type: "image/jpeg",
      size: 20 * 1024 * 1024 + 1,
    } as File);
    expect(oversized).toEqual({
      ok: false,
      notice: "Ảnh gốc quá 20 MB, bạn chọn ảnh nhỏ hơn nhé.",
    });
  });
});

describe("FeedbackDialog", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    authState.user = { displayName: "Người Kiểm Thử" };
    authState.loading = false;
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  function renderDialog() {
    const onClose = vi.fn();
    act(() => {
      root.render(<FeedbackDialog onClose={onClose} />);
    });
    return { onClose };
  }

  function submitButton(): HTMLButtonElement {
    const btn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Gửi",
    );
    expect(btn).toBeTruthy();
    return btn as HTMLButtonElement;
  }

  function kindButton(label: string): HTMLButtonElement {
    const btn = Array.from(container.querySelectorAll<HTMLButtonElement>('button[role="radio"]')).find(
      (b) => b.textContent?.includes(label),
    );
    expect(btn).toBeTruthy();
    return btn as HTMLButtonElement;
  }

  function typeInto(el: HTMLTextAreaElement | HTMLInputElement, value: string) {
    const proto =
      el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  it("chưa đăng nhập thì chỉ hiện lời mời đăng nhập, không dựng form", () => {
    authState.user = null;
    renderDialog();

    expect(container.textContent).toContain("Đăng nhập để góp ý nhé");
    const signIn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Đăng nhập với Google",
    );
    expect(signIn).toBeTruthy();
    expect(container.querySelector("textarea")).toBeNull();
    expect(container.querySelectorAll('button[role="radio"]').length).toBe(0);
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(
      Array.from(container.querySelectorAll("button")).some(
        (b) => b.textContent?.trim() === "Gửi",
      ),
    ).toBe(false);
  });

  it("bắt buộc chọn loại và nội dung đủ 10 ký tự", () => {
    renderDialog();
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;

    expect(container.querySelectorAll('button[role="radio"]').length).toBe(3);
    expect(submitButton().disabled).toBe(true);

    act(() => kindButton("Báo lỗi").click());
    expect(submitButton().disabled).toBe(true);

    act(() => typeInto(textarea, "ngắn"));
    expect(container.textContent).toContain("Cần thêm");
    expect(submitButton().disabled).toBe(true);

    act(() => typeInto(textarea, "Nút ghi chú không phản hồi"));
    expect(container.textContent).toContain("26/2000");
    expect(submitButton().disabled).toBe(false);
  });

  it("gửi thành công thì đóng hộp thoại và báo cảm ơn", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);
    const { onClose } = renderDialog();

    act(() => kindButton("Báo lỗi").click());
    act(() =>
      typeInto(
        container.querySelector("textarea") as HTMLTextAreaElement,
        "Nút ghi chú không phản hồi",
      ),
    );
    await act(async () => {
      submitButton().click();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/feedback");
    expect(JSON.parse(String(init.body))).toMatchObject({
      kind: "bug",
      message: "Nút ghi chú không phản hồi",
      name: "Người Kiểm Thử",
    });
    expect(onClose).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(
      "Đã gửi góp ý, cảm ơn bạn!",
      expect.objectContaining({ id: "feedback-notice" }),
    );
  });

  it("gặp giới hạn trong ngày thì giữ nội dung và báo lỗi", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }),
    );
    const { onClose } = renderDialog();

    act(() => kindButton("Đề xuất").click());
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    act(() => typeInto(textarea, "Mong có thêm chế độ học nhóm"));
    await act(async () => {
      submitButton().click();
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(textarea.value).toBe("Mong có thêm chế độ học nhóm");
    expect(toast.error).toHaveBeenCalledWith(
      "Bạn đã gửi nhiều góp ý hôm nay, mai bạn thử lại nhé.",
      expect.objectContaining({ id: "feedback-notice" }),
    );
  });

  it("bấm Escape thì đóng", () => {
    const { onClose } = renderDialog();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("FeedbackSheet", () => {
  let container: HTMLDivElement;
  let root: Root;

  const dialog = () =>
    document.querySelector<HTMLElement>('[role="dialog"][aria-label="Gửi góp ý"]');

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    authState.user = { displayName: "Người Kiểm Thử" };
    authState.loading = false;
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
  });

  function renderSheet(isOpen: boolean, extra: { onBack?: () => void; backLabel?: string } = {}) {
    const onClose = vi.fn();
    act(() => {
      root.render(<FeedbackSheet isOpen={isOpen} onClose={onClose} {...extra} />);
    });
    return { onClose };
  }

  it("dùng khay đáy chung: có tiêu đề, nút Zen và đủ trường", () => {
    renderSheet(true);

    expect(dialog()).toBeTruthy();
    const text = dialog()?.textContent || "";
    expect(text).toContain("Gửi góp ý");
    expect(text).toContain("Chỉ quản trị viên ZenStudy đọc được");
    expect(
      document.querySelector('button[aria-label="Chuyển chế độ xem"]'),
    ).toBeTruthy();
    expect(dialog()?.querySelectorAll('button[role="radio"]').length).toBe(3);
    expect(dialog()?.querySelector('textarea[aria-label="Nội dung góp ý"]')).toBeTruthy();
    expect(
      dialog()?.querySelector('input[aria-label="Email liên hệ (không bắt buộc)"]'),
    ).toBeTruthy();
    expect(dialog()?.textContent).toContain("Đính kèm ảnh");
    const fileInput = dialog()?.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput?.accept).toBe("image/jpeg,image/png,image/webp");
  });

  it("chưa đăng nhập thì khay chỉ có lời mời đăng nhập", () => {
    authState.user = null;
    renderSheet(true);

    expect(dialog()?.textContent).toContain("Đăng nhập để góp ý nhé");
    expect(dialog()?.querySelector("textarea")).toBeNull();
    expect(dialog()?.querySelectorAll('button[role="radio"]').length).toBe(0);
    expect(dialog()?.querySelector('input[type="file"]')).toBeNull();
    expect(
      Array.from(document.querySelectorAll("button")).some(
        (b) => b.textContent?.trim() === "Gửi",
      ),
    ).toBe(false);
  });

  it("có nút quay lại khi mở từ màn hình trước", () => {
    const onBack = vi.fn();
    renderSheet(true, { onBack, backLabel: "Thêm" });

    const back = document.querySelector<HTMLButtonElement>('button[aria-label="Quay lại Thêm"]');
    expect(back).toBeTruthy();
    act(() => back!.click());
    expect(onBack).toHaveBeenCalled();
  });

  it("đóng rồi mở lại thì form trắng", () => {
    renderSheet(true);
    const textarea = dialog()!.querySelector("textarea") as HTMLTextAreaElement;
    const kind = dialog()!.querySelectorAll<HTMLButtonElement>('button[role="radio"]')[0];
    act(() => kind.click());
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
      textarea,
      "Nội dung đã gõ",
    );
    act(() => {
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(textarea.value).toBe("Nội dung đã gõ");

    renderSheet(false);
    renderSheet(true);

    const reopened = dialog()!.querySelector("textarea") as HTMLTextAreaElement;
    expect(reopened.value).toBe("");
    expect(
      dialog()!.querySelectorAll('button[role="radio"]')[0].getAttribute("aria-checked"),
    ).toBe("false");
  });
});
