import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

vi.mock("@/lib/firebase-config", () => ({
  firebaseConfigured: true,
  firebaseConfig: {},
}));

vi.mock("@/lib/firebase", () => ({
  firebaseConfigured: true,
  auth: {},
  db: {},
}));

vi.mock("@/components/study/auth", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    redirectError: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    getToken: vi.fn(),
  }),
  GoogleSignInButton: () => React.createElement("button", null, "Google Sign In"),
}));

vi.mock("@/components/study/chat/hooks/useChatSessions", () => ({
  useChatSessions: () => ({
    sessions: [],
    activeSid: null,
    drawerOpen: false,
    drawerLoading: false,
    pendingAction: null,
    setDrawerOpen: vi.fn(),
    createSession: vi.fn(),
    switchSession: vi.fn(),
    deleteSession: vi.fn(),
    renameSession: vi.fn(),
  }),
}));

vi.mock("@/components/study/chat/hooks/useChatMessages", () => ({
  useChatMessages: () => ({
    msgs: [],
    loading: false,
    sending: false,
    regenerating: false,
    hasNew: false,
    copiedId: null,
    isAtBottom: true,
    canScrollUp: false,
    panelNewCount: 0,
    scrollRef: { current: null },
    bottomRef: { current: null },
    handleScroll: vi.fn(),
    scrollToBottom: vi.fn(),
    copyMsg: vi.fn(),
    regenerate: vi.fn(),
    sendWithText: vi.fn(),
    resetView: vi.fn(),
  }),
}));

vi.mock("@/components/study/chat/hooks/useImageAttachments", () => ({
  useImageAttachments: () => ({
    items: [],
    addFiles: vi.fn(),
    remove: vi.fn(),
  }),
}));

import { StudyChatWidget } from "@/components/study/chat/StudyChatWidget";

describe("StudyChatWidget Zen Mode Support", () => {
  it("renders ChatFab icon button when Zen Mode is OFF", () => {
    const html = renderToString(<StudyChatWidget isOpen={false} isZenMode={false} />);

    expect(html).toContain('id="tour-chat-fab"');
    expect(html).toContain("Hỏi trợ lý");
  });

  it("completely hides ChatFab icon button when Zen Mode is ON", () => {
    const html = renderToString(<StudyChatWidget isOpen={false} isZenMode={true} />);

    expect(html).not.toContain('id="tour-chat-fab"');
    expect(html).not.toContain("Hỏi trợ lý");
  });

  it("does not render chat panel when Zen Mode is ON even if isOpen is true", () => {
    const html = renderToString(<StudyChatWidget isOpen={true} isZenMode={true} />);

    expect(html).not.toContain('id="study-chat-panel"');
    expect(html).not.toContain('id="tour-chat-fab"');
  });
});
