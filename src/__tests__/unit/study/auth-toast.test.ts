// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";

// @ts-expect-error test act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { mockToast } = vi.hoisted(() => ({
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

const mockSignInWithPopup = vi.fn();
const mockSignInWithRedirect = vi.fn();
const mockGetRedirectResult = vi.fn().mockResolvedValue(null);
const mockOnAuthStateChanged = vi.fn((_auth, cb) => {
  cb(null);
  return () => {};
});

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {
    setCustomParameters = vi.fn();
  },
  signInWithPopup: (auth: unknown, provider: unknown) => mockSignInWithPopup(auth, provider),
  signInWithRedirect: (auth: unknown, provider: unknown) => mockSignInWithRedirect(auth, provider),
  getRedirectResult: (auth: unknown) => mockGetRedirectResult(auth),
  onAuthStateChanged: (auth: unknown, cb: (u: unknown) => void) => mockOnAuthStateChanged(auth, cb),
  signOut: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/firebase", () => ({
  getFirebaseAuth: vi.fn().mockReturnValue({}),
}));

const mockIsNativeApp = vi.fn().mockReturnValue(false);
const mockSignInWithGoogleNative = vi.fn();

vi.mock("@/lib/google-sign-in", () => ({
  isNativeApp: () => mockIsNativeApp(),
  signInWithGoogleNative: () => mockSignInWithGoogleNative(),
  signOutGoogleNative: vi.fn(),
}));

vi.mock("@/lib/firebase-config", () => ({
  firebaseConfigured: true,
}));

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}));

import { useAuth } from "@/components/study/auth/hooks/use-auth";

describe("useAuth - Toast notifications on login", () => {
  let container: HTMLDivElement;
  let root: Root;
  let hookResult: ReturnType<typeof useAuth>;

  function TestHarness() {
    hookResult = useAuth();
    return React.createElement("div", null, hookResult.user ? "Logged in" : "Guest");
  }

  beforeEach(() => {
    vi.clearAllMocks();
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

  it("hiển thị toast.success khi đăng nhập bằng popup thành công", async () => {
    mockSignInWithPopup.mockResolvedValueOnce({ user: { uid: "test-user" } });

    await act(async () => {
      root.render(React.createElement(TestHarness));
    });

    await act(async () => {
      await hookResult.signIn();
    });

    expect(mockToast.success).toHaveBeenCalledWith("Đăng nhập thành công!");
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it("hiển thị toast.error khi đăng nhập bằng popup thất bại", async () => {
    mockSignInWithPopup.mockRejectedValueOnce({
      code: "auth/network-request-failed",
      message: "Network error",
    });

    await act(async () => {
      root.render(React.createElement(TestHarness));
    });

    await act(async () => {
      await hookResult.signIn();
    });

    expect(mockToast.error).toHaveBeenCalledWith("Mạng chập chờn, bạn kiểm tra kết nối nhé.");
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it("không hiển thị toast khi người dùng chủ động đóng popup hủy đăng nhập", async () => {
    mockSignInWithPopup.mockRejectedValueOnce({
      code: "auth/popup-closed-by-user",
    });

    await act(async () => {
      root.render(React.createElement(TestHarness));
    });

    await act(async () => {
      await hookResult.signIn();
    });

    expect(mockToast.success).not.toHaveBeenCalled();
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it("hiển thị toast.success trên thiết bị Android native khi đăng nhập thành công", async () => {
    mockIsNativeApp.mockReturnValue(true);
    mockSignInWithGoogleNative.mockResolvedValueOnce({ cancelled: false });

    await act(async () => {
      root.render(React.createElement(TestHarness));
    });

    await act(async () => {
      await hookResult.signIn();
    });

    expect(mockToast.success).toHaveBeenCalledWith("Đăng nhập thành công!");
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it("hiển thị toast.error trên thiết bị Android native khi đăng nhập lỗi", async () => {
    mockIsNativeApp.mockReturnValue(true);
    mockSignInWithGoogleNative.mockRejectedValueOnce(new Error("Native error"));

    await act(async () => {
      root.render(React.createElement(TestHarness));
    });

    await act(async () => {
      await hookResult.signIn();
    });

    expect(mockToast.error).toHaveBeenCalledWith("Đăng nhập Google thất bại, bạn thử lại nhé.");
    expect(mockToast.success).not.toHaveBeenCalled();
  });
});
