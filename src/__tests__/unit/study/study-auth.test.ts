import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

const mockUseAuth = vi.fn();
vi.mock("@/lib/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

import {
  useAuth,
  GoogleIcon,
  TopBarUserProfile,
  GoogleSignInButton,
} from "@/components/study/auth";

describe("Study Auth Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export core auth utilities and components", () => {
    expect(useAuth).toBeDefined();
    expect(GoogleIcon).toBeDefined();
    expect(TopBarUserProfile).toBeDefined();
    expect(GoogleSignInButton).toBeDefined();
  });

  it("should render GoogleIcon with standard 4-color paths", () => {
    const html = renderToString(React.createElement(GoogleIcon));
    expect(html).toContain("viewBox=\"0 0 24 24\"");
    expect(html).toContain("#4285F4");
    expect(html).toContain("#34A853");
    expect(html).toContain("#FBBC05");
    expect(html).toContain("#EA4335");
  });

  it("should render sign in button when user is unauthenticated", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      isSigningIn: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    const html = renderToString(React.createElement(TopBarUserProfile));
    expect(html).toContain("Đăng nhập");
    expect(html).toContain("Đăng nhập tài khoản Google");
  });

  it("should render user display name when authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: {
        uid: "user-abc-123",
        displayName: "Duy Dũng",
        email: "duydung@example.com",
        photoURL: "https://example.com/avatar.jpg",
      },
      loading: false,
      isSigningIn: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    const html = renderToString(React.createElement(TopBarUserProfile));
    expect(html).toContain("Dũng");
    expect(html).toContain("avatar.jpg");
  });
});
