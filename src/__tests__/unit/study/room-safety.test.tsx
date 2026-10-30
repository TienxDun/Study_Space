// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { toast } from "sonner";
import { MemberSafetyMenu } from "@/components/study/rooms/components/MemberSafetyMenu";
import { BlockedUsersSection } from "@/components/study/settings/BlockedUsersSection";

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

vi.mock("@/components/study/auth", () => {
  // Trả cùng một object mỗi lần gọi để getToken ổn định, tránh effect tải lại vô hạn.
  const getToken = async () => "token-abc";
  const state = { user: { uid: "user_me", displayName: "Người Kiểm Thử" }, getToken };
  return { useAuth: () => state };
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function findButton(scope: ParentNode, label: string) {
  return scope.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
}

function findButtonText(scope: ParentNode, text: string) {
  return Array.from(scope.querySelectorAll("button")).find((b) =>
    b.textContent?.includes(text)
  ) as HTMLButtonElement | undefined;
}

function mount(node: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return { container, root };
}

async function flush() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

describe("MemberSafetyMenu", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  function renderMenu(onBlocked = vi.fn()) {
    ({ container, root } = mount(
      <MemberSafetyMenu
        getToken={async () => "token-abc"}
        roomName="phong-hoc-1"
        targetUid="user_bob"
        targetName="Bạn Bình"
        onBlocked={onBlocked}
      />
    ));
    return { onBlocked };
  }

  it("mở menu và hiện 2 lựa chọn báo cáo/chặn", () => {
    renderMenu();

    act(() => {
      findButton(container, "Tùy chọn an toàn cho Bạn Bình")?.click();
    });
    // Dialog render qua portal vào document.body để không bị khung phòng cắt.
    expect(document.body.textContent).toContain("Báo cáo thành viên");
    expect(document.body.textContent).toContain("Chặn thành viên");
  });

  it("chặn gọi POST /blocks rồi báo cho phòng rời đi", async () => {
    const fetchMock = vi.fn(async () => json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const { onBlocked } = renderMenu();

    act(() => {
      findButton(container, "Tùy chọn an toàn cho Bạn Bình")?.click();
    });
    act(() => {
      findButtonText(document, "Chặn thành viên")?.click();
    });
    expect(document.body.textContent).toContain("Chặn thành viên?");

    await act(async () => {
      findButtonText(document, "Chặn")?.click();
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/blocks");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      targetUid: "user_bob",
      targetName: "Bạn Bình",
    });
    expect(onBlocked).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  it("báo cáo gửi source room kèm phòng và người bị báo cáo", async () => {
    const fetchMock = vi.fn(async () => json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    renderMenu();

    act(() => {
      findButton(container, "Tùy chọn an toàn cho Bạn Bình")?.click();
    });
    act(() => {
      findButtonText(document, "Báo cáo thành viên")?.click();
    });
    await flush();

    expect(document.body.textContent).toContain("Báo cáo thành viên");
    expect(document.querySelectorAll('input[type="radio"]').length).toBe(5);

    act(() => {
      document.querySelector<HTMLInputElement>('input[value="harassment"]')?.click();
    });
    await act(async () => {
      findButtonText(document, "Gửi báo cáo")?.click();
    });
    await flush();

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/report");
    expect(JSON.parse(String(init.body))).toMatchObject({
      source: "room",
      room: "phong-hoc-1",
      targetUid: "user_bob",
      targetName: "Bạn Bình",
      reporterName: "Người Kiểm Thử",
      reason: "harassment",
    });
  });
});

describe("BlockedUsersSection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("liệt kê người đã chặn và bỏ chặn gọi DELETE", async () => {
    const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/blocks") && (init?.method || "GET") === "GET") {
        return json({
          ok: true,
          blocks: [{ uid: "user_bob_123456", name: "Bạn Bình", createdAt: 1 }],
        });
      }
      return json({ ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);
    ({ container, root } = mount(<BlockedUsersSection />));
    await flush();

    expect(container.textContent).toContain("Người đã chặn (1)");
    expect(container.textContent).toContain("Bạn Bình");
    const unblock = findButtonText(container, "Bỏ chặn");
    expect(unblock).toBeTruthy();

    await act(async () => {
      unblock?.click();
    });
    await flush();

    const del = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === "DELETE"
    );
    expect(del).toBeTruthy();
    expect(String(del?.[0])).toContain("/blocks/user_bob_123456");
    expect(container.textContent).toContain("Chưa chặn ai.");
  });
});
