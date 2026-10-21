// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const mockUseAuth = vi.fn();
const mockSignOut = vi.fn();

vi.mock("@/lib/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

import { TopBarUserProfile } from "@/components/study/auth";

// @ts-expect-error test act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function findButton(text: string, scope: ParentNode = document): HTMLButtonElement | undefined {
  return Array.from(scope.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(text)
  );
}

describe("TopBarUserProfile dropdown", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: {
        uid: "user-1",
        displayName: "Duy Dũng",
        email: "duydung@example.com",
        photoURL: null,
      },
      loading: false,
      isSigningIn: false,
      signIn: vi.fn(),
      signOut: mockSignOut,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("hides the sync status action and keeps a single manual sync button", () => {
    act(() => {
      root.render(<TopBarUserProfile />);
    });
    act(() => {
      document.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')?.click();
    });

    const status = document.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.closest("button")).toBeNull();
    expect(findButton("Đồng bộ ngay")).toBeTruthy();
  });

  it("asks for confirmation before signing out", () => {
    act(() => {
      root.render(<TopBarUserProfile />);
    });
    act(() => {
      document.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')?.click();
    });
    act(() => {
      findButton("Đăng xuất")?.click();
    });

    const dialog = document.querySelector('[role="alertdialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain("Đăng xuất khỏi ZenStudy?");
    expect(mockSignOut).not.toHaveBeenCalled();

    act(() => {
      findButton("Đăng xuất", dialog ?? document)?.click();
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
