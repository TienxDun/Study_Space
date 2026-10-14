import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock("@/components/study/auth", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useAuth: () => mockUseAuth(),
  };
});
vi.mock("@/lib/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock LiveKit and CSS styles
vi.mock("@livekit/components-styles", () => ({}));
vi.mock("@livekit/components-react", () => ({
  LiveKitRoom: ({ children }: { children: React.ReactNode }) => children,
}));

import { StudyRoomsWidget } from "@/components/study/rooms/StudyRoomsWidget";
import { StudyTopBar } from "@/components/study/StudyTopBar";

describe("StudyRoomsWidget Authentication Gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render Google login gate when user is not authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      isSigningIn: false,
      authError: "",
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    const html = renderToString(React.createElement(StudyRoomsWidget, { isOpen: true, onClose: () => {} }));

    expect(html).toContain("Đăng nhập để vào phòng học nhóm");
    expect(html).toContain("Đăng nhập với Google");
    expect(html).toContain("Để giữ môi trường học tập an toàn");
    expect(html).not.toContain("Tên hiển thị trong phòng");
  });

  it("should render room join form and user identity when user is logged in", () => {
    mockUseAuth.mockReturnValue({
      user: {
        uid: "test-user-123",
        displayName: "Tiến Dũng",
        email: "tiendung@example.com",
        photoURL: "https://example.com/avatar.png",
      },
      loading: false,
      isSigningIn: false,
      authError: "",
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    const html = renderToString(React.createElement(StudyRoomsWidget, { isOpen: true, onClose: () => {} }));

    expect(html).toContain("tiendung@example.com");
    expect(html).toContain("Tên hiển thị trong phòng");
    expect(html).toContain("Vào phòng học");
    expect(html).toContain("Phòng đang mở");
    expect(html).not.toContain("Đăng nhập với Google");
  });

  it("should show loading state when auth state is being determined", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
      isSigningIn: false,
      authError: "",
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    const html = renderToString(React.createElement(StudyRoomsWidget, { isOpen: true, onClose: () => {} }));

    expect(html).toContain("Đang kiểm tra tài khoản...");
    expect(html).not.toContain("Đăng nhập với Google");
  });

  it("should render unified user profile in StudyTopBar when logged in", () => {
    mockUseAuth.mockReturnValue({
      user: {
        uid: "test-user-123",
        displayName: "Nhật Duy",
        email: "nhatduy@example.com",
        photoURL: "https://example.com/avatar.png",
      },
      loading: false,
      isSigningIn: false,
      authError: "",
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    const html = renderToString(
      React.createElement(StudyTopBar, {
        isZenMode: false,
        isPomodoroVisible: false,
        centerTab: "clock",
        isGlobalMuted: false,
        isSettingsOpen: false,
        isFullscreen: false,
        onToggleClock: () => {},
        onToggleShortcuts: () => {},
        onEnterZen: () => {},
        onExitZen: () => {},
        onToggleMute: () => {},
        onToggleSettings: () => {},
        onToggleFullscreen: () => {},
      })
    );

    expect(html).toContain("id=\"tour-topbar-actions\"");
    expect(html).toContain("Nhật Duy");
  });
});
