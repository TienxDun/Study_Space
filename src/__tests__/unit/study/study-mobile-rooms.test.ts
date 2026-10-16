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

// Mock ModalShell để render được trong SSR renderToString
vi.mock("@/components/ui/ModalShell", () => ({
  ModalShell: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? React.createElement("div", { "data-testid": "modal-shell" }, children) : null,
}));

// Mock LiveKit and styles
vi.mock("@livekit/components-styles", () => ({}));
vi.mock("@livekit/components-react", () => ({
  LiveKitRoom: ({ children }: { children: React.ReactNode }) => children,
  RoomAudioRenderer: () => null,
  StartAudio: () => null,
  useTracks: () => [],
  useChat: () => ({ chatMessages: [], send: vi.fn() }),
  useRoomContext: () => ({ numParticipants: 2 }),
  GridLayout: ({ children }: { children: React.ReactNode }) => children,
  ParticipantTile: () => null,
  TrackToggle: () => null,
}));

import { MobileRoomsSheet } from "@/components/study/mobile/sheets/MobileRoomsSheet";
import { MobileActiveRoomPill } from "@/components/study/mobile/rooms/MobileActiveRoomPill";

describe("MobileRoomsSheet UI Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders login card when user is not authenticated on mobile", () => {
    const html = renderToString(
      React.createElement(MobileRoomsSheet, {
        isOpen: true,
        onClose: () => {},
        onOpen: () => {},
        user: null,
        authLoading: false,
        isSigningIn: false,
        authError: null,
        signIn: vi.fn(),
        displayName: "",
        setDisplayName: vi.fn(),
        roomName: "",
        setRoomName: vi.fn(),
        openRooms: [],
        loadingRooms: false,
        loadOpenRooms: vi.fn(),
        handleJoinListed: vi.fn(),
        handleJoin: vi.fn(),
        canJoin: false,
        joining: false,
        error: null,
        token: null,
        serverUrl: "",
        joinedRoom: "",
        handleLeave: vi.fn(),
        isAvailable: true,
      })
    );

    expect(html).toContain("Đăng nhập để vào phòng học");
    expect(html).toContain("Đăng nhập với Google");
    expect(html).toContain("Bật camera &amp; mic");
  });

  it("renders room list and join form when authenticated", () => {
    const html = renderToString(
      React.createElement(MobileRoomsSheet, {
        isOpen: true,
        onClose: () => {},
        onOpen: () => {},
        user: { uid: "u1", email: "student@zenstudy.app", displayName: "Học Viên" } as any,
        authLoading: false,
        isSigningIn: false,
        authError: null,
        signIn: vi.fn(),
        displayName: "Học Viên",
        setDisplayName: vi.fn(),
        roomName: "",
        setRoomName: vi.fn(),
        openRooms: [{ name: "on-thi-thpt", count: 3 }],
        loadingRooms: false,
        loadOpenRooms: vi.fn(),
        handleJoinListed: vi.fn(),
        handleJoin: vi.fn(),
        canJoin: true,
        joining: false,
        error: null,
        token: null,
        serverUrl: "",
        joinedRoom: "",
        handleLeave: vi.fn(),
        isAvailable: true,
      })
    );

    expect(html).toContain("Tên của bạn trong phòng");
    expect(html).toContain("on-thi-thpt");
    expect(html).toContain("người đang học");
    expect(html).toContain("Vào ngay");
    expect(html).toContain("Vào phòng học");
  });

  it("renders active room pill when connected and sheet is closed to view other tabs", () => {
    const html = renderToString(
      React.createElement(MobileRoomsSheet, {
        isOpen: false, // Người dùng đang mở tab khác (Việc, Cảnh...)
        onClose: () => {},
        onOpen: () => {},
        user: { uid: "u1", email: "student@zenstudy.app", displayName: "Học Viên" } as any,
        authLoading: false,
        isSigningIn: false,
        authError: null,
        signIn: vi.fn(),
        displayName: "Học Viên",
        setDisplayName: vi.fn(),
        roomName: "lop-toan-12",
        setRoomName: vi.fn(),
        openRooms: [],
        loadingRooms: false,
        loadOpenRooms: vi.fn(),
        handleJoinListed: vi.fn(),
        handleJoin: vi.fn(),
        canJoin: true,
        joining: false,
        error: null,
        token: "livekit-token-mock",
        serverUrl: "wss://livekit.example.com",
        joinedRoom: "lop-toan-12",
        handleLeave: vi.fn(),
        isAvailable: true,
      })
    );

    // Bảng trượt đóng, nhưng cuộc gọi chạy ngầm và thanh pill xuất hiện
    expect(html).toContain("lop-toan-12");
    expect(html).toContain("(Đang học)");
    expect(html).toContain("Mở lại");
    expect(html).toContain("Rời");
  });

  it("renders MobileActiveRoomPill standalone with leave and reopen controls", () => {
    const html = renderToString(
      React.createElement(MobileActiveRoomPill, {
        roomName: "nhom-hoc-sinh-hoc",
        onReopen: () => {},
        onLeave: () => {},
      })
    );

    expect(html).toContain("nhom-hoc-sinh-hoc");
    expect(html).toContain("(Đang học)");
    expect(html).toContain("Mở lại");
    expect(html).toContain("Rời");
    expect(html).toContain("Phòng học đang hoạt động");
  });
});
