import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

vi.mock("@livekit/components-styles", () => ({}));
vi.mock("@livekit/components-react", () => ({
  RoomAudioRenderer: () => React.createElement("div", { "data-testid": "livekit-room-audio-renderer" }),
  StartAudio: ({ label }: { label: string }) =>
    React.createElement("button", { "data-testid": "livekit-start-audio" }, label),
  useRoomContext: () => ({ numParticipants: 3, disconnect: vi.fn(), on: vi.fn(), off: vi.fn() }),
  useTracks: () => [],
  useChat: () => ({ chatMessages: [], send: vi.fn() }),
  useParticipants: () => [],
  useLocalParticipant: () => ({
    localParticipant: {
      identity: "user-test",
      name: "Học viên",
      attributes: {},
      setAttributes: async () => {},
    },
  }),
  ConnectionQualityIndicator: () => null,
  TrackToggle: ({ source }: { source: string }) =>
    React.createElement("button", { "data-testid": `track-toggle-${source}` }, source),
  GridLayout: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  ParticipantTile: () => React.createElement("div", null, "ParticipantTile"),
}));

import { StudyRoomView } from "@/components/study/rooms/StudyRoomView";

describe("StudyRoomView Audio and Media Rendering", () => {
  it("renders RoomAudioRenderer to ensure remote participant audio plays", () => {
    const html = renderToString(
      React.createElement(StudyRoomView, {
        roomName: "toan-cao-cap",
        onLeave: () => {},
      })
    );

    // Verify RoomAudioRenderer is mounted in the DOM
    expect(html).toContain('data-testid="livekit-room-audio-renderer"');
  });

  it("renders StartAudio button for browser autoplay policy recovery", () => {
    const html = renderToString(
      React.createElement(StudyRoomView, {
        roomName: "toan-cao-cap",
        onLeave: () => {},
      })
    );

    // Verify StartAudio exists with Vietnamese label
    expect(html).toContain('data-testid="livekit-start-audio"');
    expect(html).toContain("bật âm thanh phòng học");
  });

  it("renders fullscreen toggle button and toggles state", () => {
    const normalHtml = renderToString(
      React.createElement(StudyRoomView, {
        roomName: "toan-cao-cap",
        onLeave: () => {},
        isFullscreen: false,
        onToggleFullscreen: () => {},
      })
    );
    expect(normalHtml).toContain("Toàn màn hình");
    expect(normalHtml).not.toContain("Thu nhỏ");

    const fsHtml = renderToString(
      React.createElement(StudyRoomView, {
        roomName: "toan-cao-cap",
        onLeave: () => {},
        isFullscreen: true,
        onToggleFullscreen: () => {},
      })
    );
    expect(fsHtml).toContain("Thu nhỏ");
  });
});
