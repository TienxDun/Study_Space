import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { SessionDrawer } from "@/components/study/chat/components/SessionDrawer";
import type { Session } from "@/components/study/chat/types";

describe("SessionDrawer Modern UI", () => {
  const dummySessions: Session[] = [
    {
      id: "session-1",
      title: "Giải tích hàm số đạo hàm",
      createdAt: Date.now(), // Just now (Today)
    },
    {
      id: "session-2",
      title: "Ngữ pháp tiếng Anh IELTS",
      createdAt: Date.now() - 1000 * 60 * 60 * 25, // Yesterday
    },
    {
      id: "session-3",
      title: "Lập trình React Hooks",
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 4, // 4 days ago
    },
  ];

  it("should render modern header and session list with time grouping", () => {
    const html = renderToString(
      React.createElement(SessionDrawer, {
        sessions: dummySessions,
        activeSid: "session-1",
        loading: false,
        confirmDelSid: null,
        onCreate: () => {},
        onSwitch: () => {},
        onDelete: () => {},
        onRename: () => {},
        onClose: () => {},
      })
    );

    expect(html).toContain("Lịch sử trò chuyện");
    expect(html).toContain("3 cuộc hội thoại");
    expect(html).toContain("Giải tích hàm số đạo hàm");
    expect(html).toContain("Ngữ pháp tiếng Anh IELTS");
    expect(html).toContain("Lập trình React Hooks");
    expect(html).toContain("Đang mở");
    expect(html).toContain("Hôm nay");
  });

  it("should render welcoming empty state with Sprout mascot when no sessions exist", () => {
    const html = renderToString(
      React.createElement(SessionDrawer, {
        sessions: [],
        activeSid: null,
        loading: false,
        confirmDelSid: null,
        onCreate: () => {},
        onSwitch: () => {},
        onDelete: () => {},
        onRename: () => {},
        onClose: () => {},
      })
    );

    expect(html).toContain("Chưa có cuộc trò chuyện nào");
    expect(html).toContain("Bắt đầu đoạn chat mới");
  });

  it("should render animated loading skeletons when loading is true", () => {
    const html = renderToString(
      React.createElement(SessionDrawer, {
        sessions: [],
        activeSid: null,
        loading: true,
        confirmDelSid: null,
        onCreate: () => {},
        onSwitch: () => {},
        onDelete: () => {},
        onRename: () => {},
        onClose: () => {},
      })
    );

    expect(html).toContain("animate-pulse");
  });
});
