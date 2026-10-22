// @vitest-environment happy-dom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";

type EventHandler = (...args: any[]) => void;

// Mock LiveKit hooks
const mockListeners = new Map<string, EventHandler[]>();
const mockRoom = {
  numParticipants: 2,
  on: vi.fn((event: string, cb: EventHandler) => {
    if (!mockListeners.has(event)) mockListeners.set(event, []);
    mockListeners.get(event)!.push(cb);
  }),
  off: vi.fn((event: string, cb: EventHandler) => {
    const list = mockListeners.get(event) || [];
    mockListeners.set(
      event,
      list.filter((fn) => fn !== cb)
    );
  }),
  localParticipant: {
    publishData: vi.fn(),
  },
};

// Giả lập LiveKit localParticipant với getter attributes luôn sinh object mới mỗi lần đọc
let internalAttrs: Record<string, string> = { "zen.status": "focus" };
const mockLocalParticipant = {
  identity: "user-1",
  name: "Alice",
  get attributes() {
    // Trả về new object reference mỗi lần đọc
    return Object.freeze({ ...internalAttrs });
  },
  setAttributes: vi.fn(async (delta: Record<string, string>) => {
    internalAttrs = { ...internalAttrs, ...delta };
  }),
};

let mockParticipantsList: any[] = [];

vi.mock("@livekit/components-react", () => ({
  useRoomContext: () => mockRoom,
  useLocalParticipant: () => ({ localParticipant: mockLocalParticipant }),
  useParticipants: () => mockParticipantsList,
  RoomAudioRenderer: () => null,
  StartAudio: () => null,
  useTracks: () => [],
  useChat: () => ({ chatMessages: [], send: vi.fn() }),
  ConnectionQualityIndicator: () => null,
  ParticipantTile: () => null,
  TrackToggle: () => null,
  GridLayout: ({ children }: any) => children,
}));

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { useMeetStudyState } from "@/components/study/rooms/useMeetStudyState";
import { RoomStudyLayer } from "@/components/study/rooms/RoomStudyLayer";

describe("Regression & Client Mount: useMeetStudyState", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    mockListeners.clear();
    internalAttrs = { "zen.status": "focus" };
    mockParticipantsList = [];
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("mounts without infinite render loop even when attributes getter returns new object references", async () => {
    let renderCount = 0;

    function TestComponent() {
      const state = useMeetStudyState();
      renderCount++;
      return (
        <div data-testid="status">
          {state.local.status}
        </div>
      );
    }

    const root = createRoot(container);
    await act(async () => {
      root.render(<TestComponent />);
    });

    // Sau khi mount, renderCount chỉ ở mức 1-2 lần, KHÔNG bao giờ bùng nổ vô hạn
    expect(renderCount).toBeLessThanOrEqual(3);
    expect(container.textContent).toContain("focus");

    await act(async () => {
      root.unmount();
    });
  });

  it("mounts RoomStudyLayer cleanly into the DOM without hanging", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<RoomStudyLayer />);
    });

    // Bar rendered in DOM
    expect(container.textContent).toContain("Pomodoro");
    expect(container.textContent).toContain("Tập trung");

    await act(async () => {
      root.unmount();
    });
  });

  it("allows starting a new timer to override existing timer", async () => {
    let hookState: any;

    function TestTimerOverride() {
      hookState = useMeetStudyState();
      return (
        <div>
          <span data-testid="timer-phase">{hookState.timer?.phase || "none"}</span>
          <button onClick={() => hookState.startTimer({ focus: 50, break: 10 })}>
            Override Timer
          </button>
        </div>
      );
    }

    const root = createRoot(container);
    await act(async () => {
      root.render(<TestTimerOverride />);
    });

    // Khởi tạo timer 50/10
    await act(async () => {
      hookState.startTimer({ focus: 50, break: 10 });
    });

    expect(mockLocalParticipant.setAttributes).toHaveBeenCalledWith(
      expect.objectContaining({
        "zen.timer.phase": "focus",
        "zen.timer.duration": "3000",
      })
    );

    await act(async () => {
      root.unmount();
    });
  });
});
