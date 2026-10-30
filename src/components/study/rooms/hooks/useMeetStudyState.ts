"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  useRoomContext,
  useParticipants,
  useLocalParticipant,
} from "@livekit/components-react";
import { RoomEvent, type Participant } from "livekit-client";
import { toast } from "sonner";
import { devWarn } from "@/lib/logger";
import {
  playPomodoroSound,
  type PomodoroSoundType,
} from "@/components/study/study-sound";
import {
  MEET_ATTR,
  MEET_REACTION_TOPIC,
  type MeetLocalState,
  type ActiveMeetTimer,
  type MeetStatus,
  type MeetPreset,
  type MeetReactionEvent,
  parseLocalAttributes,
  pickActiveTimer,
  remainingTimerSeconds,
  nextPhasePreset,
  isAllowedReaction,
  parseReactionPayload,
} from "../utils/meet-protocol";

export interface UseMeetStudyStateReturn {
  local: MeetLocalState;
  timer: ActiveMeetTimer | null;
  remainingSec: number;
  isTimerOwner: boolean;
  handRaisedCount: number;
  reactions: MeetReactionEvent[];
  setStatus: (status: MeetStatus) => void;
  toggleHand: () => void;
  setGoal: (goal: string) => void;
  startTimer: (preset: MeetPreset) => void;
  stopTimer: () => void;
  startNextPhase: (auto?: boolean) => void;
  sendReaction: (emoji: string) => void;
}

export interface UseMeetStudyStateOptions {
  soundEnabled?: boolean;
  soundType?: PomodoroSoundType;
}

/**
 * Hook quản lý trạng thái học tập trong phòng học nhóm ZenStudy:
 * - Trạng thái cá nhân (focus/break/help)
 * - Giơ tay
 * - Mục tiêu cá nhân (tối đa 120 ký tự)
 * - Pomodoro đồng bộ (sử dụng participant attributes)
 * - Reaction bay lên qua LiveKit Data Channel
 */
export function useMeetStudyState(
  options: UseMeetStudyStateOptions = {}
): UseMeetStudyStateReturn {
  const { soundEnabled = true, soundType = "classic_clock" } = options;
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  // State cục bộ cho attributes của local participant (cho phản hồi UI tức thì)
  const [localAttrs, setLocalAttrs] = useState<Record<string, string>>(() => {
    return (localParticipant?.attributes as Record<string, string>) || {};
  });

  // Tăng version mỗi khi có thay đổi attributes từ bất kỳ thành viên nào
  const [, setAttrVersion] = useState(0);

  // Mốc thời gian cục bộ để tính đồng hồ đếm ngược từng giây
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Danh sách phản ứng reaction đang bay lên
  const [reactions, setReactions] = useState<MeetReactionEvent[]>([]);

  // Giữ danh sách identity đang giơ tay để không toast lặp
  const seenHandsRef = useRef<Set<string>>(new Set());

  // Lưu startedAt của timer đã cảnh báo hết giờ để chỉ toast/rung 1 lần
  const hasAlertedExpireRef = useRef<number | null>(null);

  // Chống tự chuyển phase lặp lại cho cùng một timer
  const autoAdvancedRef = useRef<string | null>(null);

  // Throttle gửi reaction (700ms)
  const lastReactionTimeRef = useRef<number>(0);

  // Lưu danh sách timeout reaction để dọn dẹp khi unmount
  const reactionTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Ref lưu timer hiện tại và danh sách participants để xử lý disconnect/adopt timer
  const timerRef = useRef<ActiveMeetTimer | null>(null);
  const participantsRef = useRef(participants);
  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  const localParticipantRef = useRef(localParticipant);
  useEffect(() => {
    localParticipantRef.current = localParticipant;
  }, [localParticipant]);

  // Hàm tiện ích cập nhật attribute an toàn (khai báo sớm để dùng trong sự kiện)
  const updateAttributes = useCallback(
    async (nextDelta: Record<string, string>) => {
      const currentLocal = localParticipantRef.current;
      if (!currentLocal) return;
      let previous: Record<string, string> = {};
      setLocalAttrs((prev) => {
        previous = { ...prev };
        return { ...prev, ...nextDelta };
      });

      try {
        if (typeof currentLocal.setAttributes === "function") {
          await currentLocal.setAttributes(nextDelta);
        }
      } catch (err) {
        devWarn("Lỗi cập nhật thuộc tính người tham gia:", err);
        setLocalAttrs(previous);
        toast.error("Không thể cập nhật trạng thái");
      }
    },
    []
  );

  // Đồng bộ localAttrs khi localParticipant thay đổi danh tính (tránh lặp vô hạn do getter attributes luôn trả về object mới)
  useEffect(() => {
    if (!localParticipant) return;
    setLocalAttrs({ ...(localParticipant.attributes as Record<string, string>) });
  }, [localParticipant?.identity]);

  // Lắng nghe các sự kiện từ LiveKit Room
  useEffect(() => {
    if (!room) return;

    const handleAttributesChanged = (
      _changedAttributes: Record<string, string>,
      participant: Participant
    ) => {
      setAttrVersion((v) => v + 1);

      if (localParticipant && participant.identity === localParticipant.identity) {
        setLocalAttrs({ ...(participant.attributes as Record<string, string>) });
      } else {
        // Kiểm tra giơ tay của thành viên khác để hiển thị toast
        const isHandRaised = participant.attributes?.[MEET_ATTR.hand] === "1";
        const wasRaised = seenHandsRef.current.has(participant.identity);

        if (isHandRaised && !wasRaised) {
          seenHandsRef.current.add(participant.identity);
          const name = participant.name || participant.identity || "Thành viên";
          toast.info(`${name} đang giơ tay ✋`);
        } else if (!isHandRaised && wasRaised) {
          seenHandsRef.current.delete(participant.identity);
        }
      }
    };

    const handleParticipantDisconnected = (participant: Participant) => {
      // 1. P2-2: Xóa khỏi danh sách đã giơ tay để nếu họ kết nối lại và giơ tay, toast vẫn hiển thị đúng
      seenHandsRef.current.delete(participant.identity);

      // 2. P2-4: Kiểm tra nếu người vừa rời phòng là owner của active timer hiện tại
      const activeTimer = timerRef.current;
      if (activeTimer && activeTimer.identity === participant.identity) {
        // Lấy danh sách thành viên còn lại trong phòng (bao gồm localParticipant và remotes khác)
        const currentLocal = localParticipantRef.current;
        const currentRemotes = participantsRef.current;
        const remainingIdentities = [
          ...(currentLocal?.identity ? [currentLocal.identity] : []),
          ...currentRemotes
            .filter((p) => p.identity !== participant.identity)
            .map((p) => p.identity),
        ].filter(Boolean);

        const uniqueSorted = Array.from(new Set(remainingIdentities)).sort();

        // Deterministic: thành viên có identity nhỏ nhất theo thứ tự từ điển nhận nuôi timer
        if (
          uniqueSorted.length > 0 &&
          currentLocal &&
          currentLocal.identity === uniqueSorted[0]
        ) {
          // Nhận nuôi timer, giữ nguyên 100% phase, startedAt, durationSec, endsAt
          updateAttributes({
            [MEET_ATTR.timerPhase]: activeTimer.phase,
            [MEET_ATTR.timerStartedAt]: String(activeTimer.startedAt),
            [MEET_ATTR.timerDuration]: String(activeTimer.durationSec),
            [MEET_ATTR.timerEndsAt]: String(activeTimer.endsAt),
          });
        }
      }
    };

    const handleDataReceived = (
      payload: Uint8Array,
      participant?: Participant,
      _kind?: unknown,
      topic?: string
    ) => {
      if (topic !== MEET_REACTION_TOPIC) return;

      const emoji = parseReactionPayload(payload);
      if (!emoji) return;

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const senderName = participant?.name || participant?.identity || "Thành viên";

      setReactions((prev) => [
        ...prev,
        { id, emoji, senderName, createdAt: Date.now() },
      ]);

      const timerId = setTimeout(() => {
        reactionTimeoutsRef.current.delete(timerId);
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 2500);

      reactionTimeoutsRef.current.add(timerId);
    };

    room.on(RoomEvent.ParticipantAttributesChanged, handleAttributesChanged);
    room.on(RoomEvent.DataReceived, handleDataReceived);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    return () => {
      room.off(RoomEvent.ParticipantAttributesChanged, handleAttributesChanged);
      room.off(RoomEvent.DataReceived, handleDataReceived);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

      // P2-5: Dọn dẹp tất cả các timeout reaction đang chờ khi unmount
      reactionTimeoutsRef.current.forEach((t) => clearTimeout(t));
      reactionTimeoutsRef.current.clear();
    };
  }, [room, localParticipant, updateAttributes]);

  // Gom toàn bộ thành viên trong phòng (local + remotes)
  const allParticipants = useMemo(() => {
    const list: Array<{
      identity: string;
      name?: string;
      attributes?: Record<string, string | undefined>;
    }> = [];

    if (localParticipant) {
      list.push({
        identity: localParticipant.identity,
        name: localParticipant.name,
        attributes: {
          ...(localParticipant.attributes as Record<string, string | undefined>),
          ...localAttrs,
        },
      });
    }

    for (const p of participants) {
      if (p.identity !== localParticipant?.identity) {
        list.push({
          identity: p.identity,
          name: p.name,
          attributes: p.attributes as Record<string, string | undefined>,
        });
      }
    }

    return list;
  }, [localParticipant, localAttrs, participants]);

  // Đọc trạng thái cục bộ
  const local = useMemo(() => {
    return parseLocalAttributes(localAttrs);
  }, [localAttrs]);

  // Xác định timer đang hoạt động
  const timer = useMemo(() => {
    return pickActiveTimer(allParticipants);
  }, [allParticipants]);

  useEffect(() => {
    timerRef.current = timer;
  }, [timer]);

  // Quản lý interval đếm ngược 1s khi có timer
  useEffect(() => {
    if (!timer) return;
    setNowMs(Date.now());
    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(intervalId);
  }, [timer]);

  // Số giây còn lại của timer
  const remainingSec = useMemo(() => {
    return remainingTimerSeconds(timer, nowMs);
  }, [timer, nowMs]);

  // Kiểm tra xem local participant có phải là owner của timer hiện tại không
  const isTimerOwner = Boolean(
    timer && localParticipant && timer.identity === localParticipant.identity
  );

  // Đếm tổng số người đang giơ tay trong phòng
  const handRaisedCount = useMemo(() => {
    return allParticipants.filter((p) => p.attributes?.[MEET_ATTR.hand] === "1").length;
  }, [allParticipants]);

  // Thông báo, âm thanh và rung khi timer kết thúc
  useEffect(() => {
    if (!timer || remainingSec > 0) return;
    if (hasAlertedExpireRef.current === timer.startedAt) return;

    hasAlertedExpireRef.current = timer.startedAt;

    const next = nextPhasePreset(timer);
    const finishedLabel = timer.phase === "focus" ? "tập trung" : "nghỉ";
    const nextLabel = next
      ? next.phase === "focus"
        ? `tập trung ${next.minutes} phút`
        : `nghỉ ${next.minutes} phút`
      : "phiên tiếp theo";

    toast.info(`Hết giờ ${finishedLabel}! Tự chuyển sang ${nextLabel} ⏰`);
    playPomodoroSound(soundType, soundEnabled);

    try {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate([80, 40, 80]);
      }
    } catch {}
  }, [timer, remainingSec, soundEnabled, soundType]);


  // Cập nhật trạng thái học tập
  const setStatus = useCallback(
    (status: MeetStatus) => {
      updateAttributes({ [MEET_ATTR.status]: status });
    },
    [updateAttributes]
  );

  // Bật/tắt giơ tay
  const toggleHand = useCallback(() => {
    const nextVal = local.handRaised ? "" : "1";
    updateAttributes({ [MEET_ATTR.hand]: nextVal });
  }, [local.handRaised, updateAttributes]);

  // Cập nhật mục tiêu cá nhân
  const setGoal = useCallback(
    (goal: string) => {
      const sanitized = goal.trim().slice(0, 120);
      updateAttributes({ [MEET_ATTR.goal]: sanitized });
    },
    [updateAttributes]
  );

  // Bắt đầu một timer Pomodoro mới
  const startTimer = useCallback(
    (preset: MeetPreset) => {
      const startedAt = Date.now();
      const durationSec = preset.focus * 60;
      const endsAt = startedAt + durationSec * 1000;

      updateAttributes({
        [MEET_ATTR.timerPhase]: "focus",
        [MEET_ATTR.timerStartedAt]: String(startedAt),
        [MEET_ATTR.timerDuration]: String(durationSec),
        [MEET_ATTR.timerEndsAt]: String(endsAt),
      });

      toast.success(`Bắt đầu tập trung ${preset.focus} phút 🎯`);
    },
    [updateAttributes]
  );

  // Dừng timer (chỉ owner mới có quyền)
  const stopTimer = useCallback(() => {
    if (!isTimerOwner) return;

    updateAttributes({
      [MEET_ATTR.timerPhase]: "",
      [MEET_ATTR.timerStartedAt]: "",
      [MEET_ATTR.timerDuration]: "",
      [MEET_ATTR.timerEndsAt]: "",
    });

    toast.info("Đã dừng đồng hồ Pomodoro");
  }, [isTimerOwner, updateAttributes]);

  // Chuyển sang phase tiếp theo khi timer đã hết giờ (chỉ owner)
  const startNextPhase = useCallback(
    (auto = false) => {
      if (!isTimerOwner || !timer || remainingSec > 0) return;

      const next = nextPhasePreset(timer);
      if (!next) return;

      const startedAt = Date.now();
      const durationSec = next.minutes * 60;
      const endsAt = startedAt + durationSec * 1000;

      updateAttributes({
        [MEET_ATTR.timerPhase]: next.phase,
        [MEET_ATTR.timerStartedAt]: String(startedAt),
        [MEET_ATTR.timerDuration]: String(durationSec),
        [MEET_ATTR.timerEndsAt]: String(endsAt),
      });

      if (!auto) {
        const phaseLabel = next.phase === "focus" ? "tập trung" : "nghỉ ngơi";
        toast.success(`Bắt đầu ${phaseLabel} ${next.minutes} phút ☕`);
      }
    },
    [isTimerOwner, timer, remainingSec, updateAttributes]
  );

  // Tự động chuyển phase khi hết giờ. Chỉ owner ghi attributes để tránh trùng.
  useEffect(() => {
    if (!timer || !isTimerOwner || remainingSec > 0) return;

    const key = `${timer.identity}:${timer.startedAt}:${timer.phase}`;
    if (autoAdvancedRef.current === key) return;

    autoAdvancedRef.current = key;
    startNextPhase(true);
  }, [timer, remainingSec, isTimerOwner, startNextPhase]);

  // Gửi reaction nhanh
  const sendReaction = useCallback(
    (emoji: string) => {
      if (!isAllowedReaction(emoji)) return;

      const now = Date.now();
      if (now - lastReactionTimeRef.current < 700) {
        return; // Throttle 700ms
      }
      lastReactionTimeRef.current = now;

      const payload = JSON.stringify({ v: 1, emoji });
      const bytes = new TextEncoder().encode(payload);

      try {
        if (room?.localParticipant?.publishData) {
          room.localParticipant.publishData(bytes, {
            reliable: false,
            topic: MEET_REACTION_TOPIC,
          });
        }
      } catch (err) {
        devWarn("Lỗi gửi dữ liệu reaction qua Data Channel:", err);
      }

      // Hiện ngay phản ứng trên màn hình người gửi
      const id = `${now}-${Math.random().toString(36).slice(2, 7)}`;
      const senderName =
        localParticipant?.name || localParticipant?.identity || "Bạn";

      setReactions((prev) => [
        ...prev,
        { id, emoji, senderName, createdAt: now },
      ]);

      const timerId = setTimeout(() => {
        reactionTimeoutsRef.current.delete(timerId);
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 2500);
      reactionTimeoutsRef.current.add(timerId);
    },
    [room, localParticipant]
  );

  return {
    local,
    timer,
    remainingSec,
    isTimerOwner,
    handRaisedCount,
    reactions,
    setStatus,
    toggleHand,
    setGoal,
    startTimer,
    stopTimer,
    startNextPhase,
    sendReaction,
  };
}
