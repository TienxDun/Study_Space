// @vitest-environment happy-dom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";

const { mockToast, mockSound } = vi.hoisted(() => {
  return {
    mockToast: {
      info: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
    },
    mockSound: vi.fn(),
  };
});

vi.mock("sonner", () => ({ toast: mockToast }));
vi.mock("@/components/study/study-sound", () => ({
  playPomodoroSound: mockSound,
}));

// Event bus mô phỏng LiveKit room
type Listener = (...args: any[]) => void;
class MockLiveKitRoom {
  listeners = new Map<string, Listener[]>();
  localParticipant: any;
  state = "connected";

  constructor(localIdentity: string, localName: string) {
    this.localParticipant = {
      identity: localIdentity,
      name: localName,
      attributes: {} as Record<string, string>,
      setAttributes: vi.fn(async (delta: Record<string, string>) => {
        this.localParticipant.attributes = {
          ...this.localParticipant.attributes,
          ...delta,
        };
        this.emit("participantAttributesChanged", delta, this.localParticipant);
      }),
      publishData: vi.fn(),
    };
  }

  on(event: string, cb: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(cb);
  }

  off(event: string, cb: Listener) {
    const list = this.listeners.get(event) || [];
    this.listeners.set(
      event,
      list.filter((fn) => fn !== cb)
    );
  }

  emit(event: string, ...args: any[]) {
    const list = this.listeners.get(event) || [];
    list.forEach((cb) => cb(...args));
  }
}

// Biến giữ mock room và participants động cho từng test case
let currentMockRoom: any = null;
let currentMockParticipants: any[] = [];

vi.mock("@livekit/components-react", () => ({
  useRoomContext: () => currentMockRoom,
  useLocalParticipant: () => ({ localParticipant: currentMockRoom?.localParticipant }),
  useParticipants: () => currentMockParticipants,
  RoomAudioRenderer: () => null,
  StartAudio: () => null,
  useTracks: () => [],
  useChat: () => ({ chatMessages: [], send: vi.fn() }),
  ConnectionQualityIndicator: () => null,
  ParticipantTile: () => null,
  TrackToggle: () => null,
  GridLayout: ({ children }: any) => children,
}));

import { useMeetStudyState } from "@/components/study/rooms/hooks/useMeetStudyState";
import { RoomStudyBar } from "@/components/study/rooms/components/RoomStudyBar";
import { MEET_ATTR, MEET_REACTION_TOPIC } from "@/components/study/rooms/utils/meet-protocol";

describe("Phase 2 Logic & Mobile Clamp Unit Tests", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  describe("1. Mobile Viewport Clamp (320px, 375px, 390px)", () => {
    it("ensures reaction menu (width 264px) never overflows right edge on 320px viewport", async () => {
      Object.defineProperty(window, "innerWidth", { value: 320, writable: true });

      const root = createRoot(container);
      await act(async () => {
        root.render(
          <RoomStudyBar
            local={{ status: "", handRaised: false, goal: "" }}
            timer={null}
            remainingSec={0}
            isTimerOwner={false}
            handRaisedCount={0}
            compact={true}
            onSetStatus={vi.fn()}
            onToggleHand={vi.fn()}
            onEditGoal={vi.fn()}
            onStartTimer={vi.fn()}
            onStopTimer={vi.fn()}
            onStartNextPhase={vi.fn()}
            onReaction={vi.fn()}
          />
        );
      });

      const btnElement = container.querySelector('button[aria-label="Thả cảm xúc"]') as HTMLButtonElement;
      expect(btnElement).toBeTruthy();

      // Giả lập nút bấm nằm sát mép phải màn hình 320px
      btnElement.getBoundingClientRect = () => ({
        top: 40,
        bottom: 70,
        left: 270,
        right: 312,
        width: 42,
        height: 30,
        x: 270,
        y: 40,
        toJSON: () => {},
      });

      await act(async () => {
        btnElement.click();
      });

      const menuPortal = document.body.querySelector('button[aria-label="Thả 🔥"]')?.parentElement as HTMLElement;
      expect(menuPortal).toBeTruthy();

      const leftStyle = parseInt(menuPortal.style.left, 10);
      const MENU_WIDTH = 264;
      const margin = 8;

      // Khẳng định: không vượt mép phải màn hình (left + MENU_WIDTH <= 320 - margin)
      expect(leftStyle).toBeGreaterThanOrEqual(margin);
      expect(leftStyle + MENU_WIDTH).toBeLessThanOrEqual(320 - margin);

      await act(async () => {
        root.unmount();
      });
    });

    it("ensures reaction menu never overflows right edge on 375px viewport", async () => {
      Object.defineProperty(window, "innerWidth", { value: 375, writable: true });

      const root = createRoot(container);
      await act(async () => {
        root.render(
          <RoomStudyBar
            local={{ status: "", handRaised: false, goal: "" }}
            timer={null}
            remainingSec={0}
            isTimerOwner={false}
            handRaisedCount={0}
            compact={true}
            onSetStatus={vi.fn()}
            onToggleHand={vi.fn()}
            onEditGoal={vi.fn()}
            onStartTimer={vi.fn()}
            onStopTimer={vi.fn()}
            onStartNextPhase={vi.fn()}
            onReaction={vi.fn()}
          />
        );
      });

      const btnElement = container.querySelector('button[aria-label="Thả cảm xúc"]') as HTMLButtonElement;
      btnElement.getBoundingClientRect = () => ({
        top: 40,
        bottom: 70,
        left: 320,
        right: 367,
        width: 47,
        height: 30,
        x: 320,
        y: 40,
        toJSON: () => {},
      });

      await act(async () => {
        btnElement.click();
      });

      const menuPortal = document.body.querySelector('button[aria-label="Thả 👍"]')?.parentElement as HTMLElement;
      expect(menuPortal).toBeTruthy();

      const leftStyle = parseInt(menuPortal.style.left, 10);
      const MENU_WIDTH = 264;
      const margin = 8;

      expect(leftStyle).toBeGreaterThanOrEqual(margin);
      expect(leftStyle + MENU_WIDTH).toBeLessThanOrEqual(375 - margin);

      await act(async () => {
        root.unmount();
      });
    });

    it("ensures reaction menu never overflows right edge on 390px viewport", async () => {
      Object.defineProperty(window, "innerWidth", { value: 390, writable: true });

      const root = createRoot(container);
      await act(async () => {
        root.render(
          <RoomStudyBar
            local={{ status: "", handRaised: false, goal: "" }}
            timer={null}
            remainingSec={0}
            isTimerOwner={false}
            handRaisedCount={0}
            compact={true}
            onSetStatus={vi.fn()}
            onToggleHand={vi.fn()}
            onEditGoal={vi.fn()}
            onStartTimer={vi.fn()}
            onStopTimer={vi.fn()}
            onStartNextPhase={vi.fn()}
            onReaction={vi.fn()}
          />
        );
      });

      const btnElement = container.querySelector('button[aria-label="Thả cảm xúc"]') as HTMLButtonElement;
      btnElement.getBoundingClientRect = () => ({
        top: 40,
        bottom: 70,
        left: 340,
        right: 382,
        width: 42,
        height: 30,
        x: 340,
        y: 40,
        toJSON: () => {},
      });

      await act(async () => {
        btnElement.click();
      });

      const menuPortal = document.body.querySelector('button[aria-label="Thả 🎉"]')?.parentElement as HTMLElement;
      expect(menuPortal).toBeTruthy();

      const leftStyle = parseInt(menuPortal.style.left, 10);
      const MENU_WIDTH = 264;
      const margin = 8;

      expect(leftStyle).toBeGreaterThanOrEqual(margin);
      expect(leftStyle + MENU_WIDTH).toBeLessThanOrEqual(390 - margin);

      await act(async () => {
        root.unmount();
      });
    });
  });

  describe("2. Unit Test Logic: P2-4 Adopt Timer khi Owner rời phòng", () => {
    it("khi owner rời phòng, người còn lại tự động nhận nuôi (adopt) timer một cách deterministic", async () => {
      const room = new MockLiveKitRoom("user-b", "Tài khoản B");
      currentMockRoom = room;

      const startedAt = Date.now() - 1000;
      const remoteOwnerA = {
        identity: "user-a",
        name: "Tài khoản A",
        attributes: {
          [MEET_ATTR.timerPhase]: "focus",
          [MEET_ATTR.timerStartedAt]: String(startedAt),
          [MEET_ATTR.timerDuration]: "1500",
          [MEET_ATTR.timerEndsAt]: String(startedAt + 1500 * 1000),
        },
      };

      currentMockParticipants = [room.localParticipant, remoteOwnerA];

      let hookState: any;
      function TestHookComponent() {
        hookState = useMeetStudyState();
        return null;
      }

      const root = createRoot(container);
      await act(async () => {
        root.render(<TestHookComponent />);
      });

      // Timer đang hoạt động là của owner A
      expect(hookState.timer?.phase).toBe("focus");
      expect(hookState.timer?.identity).toBe("user-a");
      expect(hookState.isTimerOwner).toBe(false);

      // Owner A rời phòng -> phát sự kiện ParticipantDisconnected
      await act(async () => {
        room.emit("participantDisconnected", remoteOwnerA);
      });

      // B là người duy nhất còn lại ('user-b') -> B adopt timer và giữ nguyên chính xác dữ liệu
      expect(room.localParticipant.setAttributes).toHaveBeenCalledWith({
        [MEET_ATTR.timerPhase]: "focus",
        [MEET_ATTR.timerStartedAt]: String(startedAt),
        [MEET_ATTR.timerDuration]: "1500",
        [MEET_ATTR.timerEndsAt]: String(startedAt + 1500 * 1000),
      });

      // Siết kiểm tra: A đã rời khỏi danh sách participants, chỉ còn lại B trong phòng
      currentMockParticipants = [room.localParticipant];
      await act(async () => {
        root.render(<TestHookComponent />);
      });

      // Timer vẫn tiếp tục tồn tại với B là owner mới ('user-b')
      expect(hookState.timer?.identity).toBe("user-b");
      expect(hookState.timer?.phase).toBe("focus");
      expect(hookState.isTimerOwner).toBe(true);

      await act(async () => {
        root.unmount();
      });
    });

    it("deterministic: nếu còn nhiều người trong phòng, chỉ người có identity nhỏ nhất adopt timer", async () => {
      // Local participant là C ('user-c')
      const roomC = new MockLiveKitRoom("user-c", "Tài khoản C");
      currentMockRoom = roomC;

      const remoteOwnerA = {
        identity: "user-a",
        name: "Tài khoản A (Owner)",
        attributes: {
          [MEET_ATTR.timerPhase]: "break",
          [MEET_ATTR.timerStartedAt]: "1700000000000",
          [MEET_ATTR.timerDuration]: "300",
          [MEET_ATTR.timerEndsAt]: "1700000300000",
        },
      };

      const remoteMemberB = {
        identity: "user-b",
        name: "Tài khoản B",
        attributes: {},
      };

      // Cả 3 người trong phòng
      currentMockParticipants = [roomC.localParticipant, remoteOwnerA, remoteMemberB];

      function TestHookComp() {
        useMeetStudyState();
        return null;
      }

      const root = createRoot(container);
      await act(async () => {
        root.render(<TestHookComp />);
      });

      // A (owner) rời phòng
      await act(async () => {
        roomC.emit("participantDisconnected", remoteOwnerA);
      });

      // Danh sách người còn lại: ['user-b', 'user-c']
      // 'user-b' < 'user-c' -> 'user-b' sẽ adopt, C không được gọi setAttributes
      expect(roomC.localParticipant.setAttributes).not.toHaveBeenCalled();

      await act(async () => {
        root.unmount();
      });
    });
  });

  describe("3. Unit Test Logic: P2-2 Xóa seenHandsRef khi Participant disconnect", () => {
    it("xóa khỏi danh sách giơ tay khi disconnect để khi rejoin và giơ tay lại, toast kích hoạt bình thường", async () => {
      const room = new MockLiveKitRoom("user-b", "Tài khoản B");
      currentMockRoom = room;

      const remoteA = {
        identity: "user-a",
        name: "Tài khoản A",
        attributes: {},
      };
      currentMockParticipants = [room.localParticipant, remoteA];

      function TestHookComp() {
        useMeetStudyState();
        return null;
      }

      const root = createRoot(container);
      await act(async () => {
        root.render(<TestHookComp />);
      });

      // 1. A giơ tay -> toast 1 lần
      await act(async () => {
        room.emit(
          "participantAttributesChanged",
          { [MEET_ATTR.hand]: "1" },
          { ...remoteA, attributes: { [MEET_ATTR.hand]: "1" } }
        );
      });
      expect(mockToast.info).toHaveBeenCalledTimes(1);
      expect(mockToast.info).toHaveBeenCalledWith(expect.stringContaining("Tài khoản A đang giơ tay ✋"));

      // 2. A disconnect khỏi phòng -> kích hoạt ParticipantDisconnected
      await act(async () => {
        room.emit("participantDisconnected", remoteA);
      });

      // 3. A rejoin và giơ tay lại -> toast phải xuất hiện lần 2
      mockToast.info.mockClear();
      await act(async () => {
        room.emit(
          "participantAttributesChanged",
          { [MEET_ATTR.hand]: "1" },
          { ...remoteA, attributes: { [MEET_ATTR.hand]: "1" } }
        );
      });
      expect(mockToast.info).toHaveBeenCalledTimes(1);
      expect(mockToast.info).toHaveBeenCalledWith(expect.stringContaining("Tài khoản A đang giơ tay ✋"));

      await act(async () => {
        root.unmount();
      });
    });
  });

  describe("4. Unit Test Logic: P2-5 Dọn dẹp Timeout Reaction khi unmount", () => {
    it("dọn dẹp toàn bộ setTimeout của reaction khi component unmount", async () => {
      const room = new MockLiveKitRoom("user-b", "Tài khoản B");
      currentMockRoom = room;
      currentMockParticipants = [room.localParticipant];

      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

      function TestHookComp() {
        useMeetStudyState();
        return null;
      }

      const root = createRoot(container);
      await act(async () => {
        root.render(<TestHookComp />);
      });

      // Gửi 2 reaction tới phòng qua Data Channel
      const payload1 = new TextEncoder().encode(JSON.stringify({ v: 1, emoji: "🔥" }));
      const payload2 = new TextEncoder().encode(JSON.stringify({ v: 1, emoji: "🎉" }));

      await act(async () => {
        room.emit("dataReceived", payload1, { identity: "user-a", name: "User A" }, undefined, MEET_REACTION_TOPIC);
        room.emit("dataReceived", payload2, { identity: "user-a", name: "User A" }, undefined, MEET_REACTION_TOPIC);
      });

      clearTimeoutSpy.mockClear();

      // Unmount component
      await act(async () => {
        root.unmount();
      });

      // Kiểm tra clearTimeout được gọi cho các timeout reaction đang chờ
      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it("dọn dẹp setTimeout của reaction cục bộ (sendReaction) khi component unmount", async () => {
      const room = new MockLiveKitRoom("user-b", "Tài khoản B");
      currentMockRoom = room;
      currentMockParticipants = [room.localParticipant];

      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

      let hookState: any;
      function TestHookComp() {
        hookState = useMeetStudyState();
        return null;
      }

      const root = createRoot(container);
      await act(async () => {
        root.render(<TestHookComp />);
      });

      // Gọi sendReaction() từ local
      await act(async () => {
        hookState.sendReaction("👍");
      });

      clearTimeoutSpy.mockClear();

      // Unmount component
      await act(async () => {
        root.unmount();
      });

      // Kiểm tra clearTimeout được gọi cho timeout local
      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe("5. Auto Pomodoro phase transition", () => {
    const expiredTimerAttrs = () => {
      const startedAt = Date.now() - 120_000;
      return {
        [MEET_ATTR.timerPhase]: "focus",
        [MEET_ATTR.timerStartedAt]: String(startedAt),
        [MEET_ATTR.timerDuration]: "60",
        [MEET_ATTR.timerEndsAt]: String(startedAt + 60_000),
      };
    };

    it("owner tự chuyển sang phase tiếp theo, chỉ ghi một lần và có toast + âm thanh", async () => {
      const room = new MockLiveKitRoom("user-b", "Tài khoản B");
      currentMockRoom = room;
      room.localParticipant.attributes = expiredTimerAttrs();
      currentMockParticipants = [room.localParticipant];

      function TestHookComp() {
        useMeetStudyState({ soundEnabled: true, soundType: "digital" });
        return null;
      }

      const root = createRoot(container);
      await act(async () => {
        root.render(<TestHookComp />);
      });

      expect(mockToast.info).toHaveBeenCalledWith(
        expect.stringContaining("Hết giờ tập trung")
      );
      expect(mockSound).toHaveBeenCalledWith("digital", true);
      expect(room.localParticipant.setAttributes).toHaveBeenCalledTimes(1);
      expect(room.localParticipant.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          [MEET_ATTR.timerPhase]: "break",
          [MEET_ATTR.timerDuration]: "300",
        })
      );
      expect(mockToast.success).not.toHaveBeenCalled();

      await act(async () => {
        root.unmount();
      });
    });

    it("non-owner nhận toast/âm thanh nhưng không tự ghi phase", async () => {
      const room = new MockLiveKitRoom("user-b", "Tài khoản B");
      currentMockRoom = room;
      const owner = {
        identity: "user-a",
        name: "Tài khoản A",
        attributes: expiredTimerAttrs(),
      };
      currentMockParticipants = [room.localParticipant, owner];

      let hookState: any;
      function TestHookComp() {
        hookState = useMeetStudyState({ soundEnabled: true, soundType: "digital" });
        return null;
      }

      const root = createRoot(container);
      await act(async () => {
        root.render(<TestHookComp />);
      });

      expect(hookState.isTimerOwner).toBe(false);
      expect(room.localParticipant.setAttributes).not.toHaveBeenCalled();
      expect(mockToast.info).toHaveBeenCalledWith(
        expect.stringContaining("Hết giờ tập trung")
      );
      expect(mockSound).toHaveBeenCalledWith("digital", true);

      await act(async () => {
        root.unmount();
      });
    });
  });
});
