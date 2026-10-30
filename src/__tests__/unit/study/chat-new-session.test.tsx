// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getDocs, onSnapshot, setDoc } from "firebase/firestore";
import { useChatSessions } from "@/components/study/chat/hooks/useChatSessions";

// @ts-expect-error test act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Firestore giả: document cha đã có activeSid "A", getDocs luôn trả phiên A.
vi.mock("@/lib/firebase", () => ({
  firebaseConfigured: true,
  getFirebaseDb: () => ({}),
}));

vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  query: (ref: unknown) => ref,
  orderBy: () => null,
  limit: () => null,
  getDocs: vi.fn(async () => ({
    empty: false,
    docs: [
      {
        id: "A",
        data: () => ({ title: "Phiên cũ", createdAt: undefined }),
      },
    ],
  })),
  onSnapshot: (_ref: unknown, cb: (snap: unknown) => void) => {
    cb({ data: () => ({ activeSid: "A", updatedAt: undefined }) });
    return () => {};
  },
  setDoc: vi.fn(async () => {}),
  addDoc: vi.fn(async () => ({ id: "new-sid" })),
  updateDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
  serverTimestamp: () => null,
}));

type SessionsApi = ReturnType<typeof useChatSessions>;

describe("Tạo đoạn chat mới", () => {
  let container: HTMLDivElement;
  let root: Root;
  let api: SessionsApi;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function Probe() {
    api = useChatSessions({ user: { uid: "u1" }, open: true, notify: () => {} });
    return <span data-testid="sid">{String(api.activeSid)}</span>;
  }

  it("một lần bấm phải giữ được phiên trắng, không tự nạp lại phiên cũ", async () => {
    await act(async () => {
      root.render(<Probe />);
    });
    expect(container.textContent).toBe("A");

    (getDocs as unknown as ReturnType<typeof vi.fn>).mockClear();

    await act(async () => {
      api.createSession(true, false, () => {});
    });
    // Để mọi promise getDocs (nếu có) kịp chạy xong.
    await act(async () => {});

    expect(container.textContent).toBe("null");
    expect(getDocs).not.toHaveBeenCalled();
    expect(setDoc).toHaveBeenCalled();
    expect(onSnapshot).toBeTruthy();
  });
});
