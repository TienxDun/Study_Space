// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { toast } from "sonner";
import { MessageList } from "@/components/study/chat/components/MessageList";
import { ReportAnswerDialog } from "@/components/study/chat/components/ReportAnswerDialog";
import { submitAiReport } from "@/lib/content-reports";
import type { Msg } from "@/components/study/chat/types";

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

const MSGS: Msg[] = [
  { id: "u1", role: "user", text: "Giải thích định luật Newton" },
  { id: "a1", role: "assistant", text: "Định luật 1 nói về quán tính." },
];

function findButton(scope: ParentNode, label: string): HTMLButtonElement | undefined {
  return scope.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`) ?? undefined;
}

describe("Nút báo cáo trong MessageList", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderList(extra: Partial<React.ComponentProps<typeof MessageList>> = {}) {
    const onReport = vi.fn();
    act(() => {
      root.render(
        <MessageList
          msgs={MSGS}
          sending={false}
          regenerating={false}
          copiedId={null}
          isAtBottom
          canScrollUp={false}
          panelNewCount={0}
          scrollRef={createRef<HTMLDivElement>()}
          bottomRef={createRef<HTMLDivElement>()}
          onScroll={vi.fn()}
          onScrollBottom={vi.fn()}
          onCopy={vi.fn()}
          onRegenerate={vi.fn()}
          onReuse={vi.fn()}
          onSuggest={vi.fn()}
          onReport={onReport}
          {...extra}
        />
      );
    });
    return { onReport };
  }

  it("chỉ tin của trợ lý có nút báo cáo và bấm gửi đúng id/nội dung", () => {
    const { onReport } = renderList();

    const buttons = container.querySelectorAll('button[aria-label="Báo cáo câu trả lời"]');
    expect(buttons.length).toBe(1);

    act(() => {
      (buttons[0] as HTMLButtonElement).click();
    });
    expect(onReport).toHaveBeenCalledWith({
      id: "a1",
      text: "Định luật 1 nói về quán tính.",
    });
  });

  it("tin đã báo cáo thì đổi sang trạng thái khóa", () => {
    renderList({ reportedIds: ["a1"] });

    expect(findButton(container, "Báo cáo câu trả lời")).toBeUndefined();
    const reported = findButton(container, "Đã báo cáo câu trả lời");
    expect(reported?.disabled).toBe(true);
  });
});

describe("ReportAnswerDialog", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  function renderDialog(overrides: Partial<React.ComponentProps<typeof ReportAnswerDialog>> = {}) {
    const onClose = vi.fn();
    const onSubmitted = vi.fn();
    act(() => {
      root.render(
        <ReportAnswerDialog
          target={{ id: "a1", text: "Câu trả lời cần kiểm tra" }}
          sessionId="sid-1"
          getToken={async () => "token-abc"}
          onClose={onClose}
          onSubmitted={onSubmitted}
          {...overrides}
        />
      );
    });
    return { onClose, onSubmitted };
  }

  function submitButton(): HTMLButtonElement {
    const btn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Gửi báo cáo")
    );
    expect(btn).toBeTruthy();
    return btn as HTMLButtonElement;
  }

  it("liệt kê 5 lý do và bắt buộc chọn lý do trước khi gửi", () => {
    renderDialog();

    expect(container.querySelectorAll('input[type="radio"]').length).toBe(5);
    expect(submitButton().disabled).toBe(true);
  });

  it("gửi đúng body lên data-api /report", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, id: "r1" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { onClose, onSubmitted } = renderDialog();

    act(() => {
      container
        .querySelector<HTMLInputElement>('input[value="inaccurate"]')
        ?.click();
    });
    expect(submitButton().disabled).toBe(false);

    await act(async () => {
      submitButton().click();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/report");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-abc");
    expect(JSON.parse(String(init.body))).toEqual({
      source: "ai",
      reason: "inaccurate",
      content: "Câu trả lời cần kiểm tra",
      detail: "",
      sessionId: "sid-1",
      messageId: "a1",
    });
    expect(onSubmitted).toHaveBeenCalledWith("a1");
    expect(onClose).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  it("gặp giới hạn 10 báo cáo/ngày thì giữ dialog mở và báo lỗi", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: "Bạn đã gửi quá nhiều báo cáo hôm nay." }),
      })
    );
    const { onClose, onSubmitted } = renderDialog();

    act(() => {
      container.querySelector<HTMLInputElement>('input[value="other"]')?.click();
    });
    await act(async () => {
      submitButton().click();
    });

    expect(onSubmitted).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      "Bạn đã gửi quá nhiều báo cáo hôm nay, mai bạn thử lại nhé.",
      expect.objectContaining({ id: "report-notice" })
    );
  });
});

describe("submitAiReport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("không có token thì không gọi mạng", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitAiReport({
      getToken: async () => null,
      answer: "nội dung",
      reason: "other",
    });

    expect(result).toEqual({
      ok: false,
      notice: "Phiên đăng nhập đã hết hạn, bạn đăng nhập lại nhé.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lỗi mạng trả về thông báo thân thiện", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const result = await submitAiReport({
      getToken: async () => "tok",
      answer: "nội dung",
      reason: "other",
    });

    expect(result).toEqual({ ok: false, notice: "Mạng chập chờn, bạn thử lại nhé." });
  });

  it("cắt nội dung quá dài theo giới hạn của Worker", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await submitAiReport({
      getToken: async () => "tok",
      answer: "x".repeat(9000),
      reason: "dangerous",
      detail: "y".repeat(600),
    });

    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.content.length).toBe(8000);
    expect(body.detail.length).toBe(500);
  });
});
