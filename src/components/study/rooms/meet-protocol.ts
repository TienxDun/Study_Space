/**
 * Protocol thuần và các hàm tiện ích cho phòng học nhóm ZenStudy (Phase 2):
 * - Trạng thái học tập cá nhân (focus, break, help)
 * - Giơ tay (hand)
 * - Mục tiêu cá nhân (goal)
 * - Pomodoro đồng bộ qua Participant Attributes
 * - Reaction nhanh qua Data Channel
 */

export const MEET_ATTR = {
  status: "zen.status",
  hand: "zen.hand",
  timerPhase: "zen.timer.phase",
  timerEndsAt: "zen.timer.endsAt",
  timerDuration: "zen.timer.duration",
  timerStartedAt: "zen.timer.startedAt",
  goal: "zen.goal",
} as const;

export const MEET_PRESETS = [
  { focus: 15, break: 3 },
  { focus: 25, break: 5 },
  { focus: 50, break: 10 },
] as const;

export const MEET_REACTION_TOPIC = "zenstudy.reaction.v1";
export const MEET_REACTIONS = ["👍", "👏", "❤️", "😂", "🎉", "🔥"] as const;

export type MeetStatus = "focus" | "break" | "help" | "";
export type MeetPreset = (typeof MEET_PRESETS)[number];
export type MeetReaction = (typeof MEET_REACTIONS)[number];

export interface MeetLocalState {
  status: MeetStatus;
  handRaised: boolean;
  goal: string;
}

export interface MeetTimerData {
  phase: "focus" | "break";
  startedAt: number;
  durationSec: number;
  endsAt: number;
}

export interface ActiveMeetTimer extends MeetTimerData {
  identity: string;
  name: string;
}

export interface MeetReactionEvent {
  id: string;
  emoji: MeetReaction;
  senderName: string;
  createdAt: number;
}

/**
 * Phân tích các attribute cá nhân thành state cục bộ.
 */
export function parseLocalAttributes(
  attrs?: Record<string, string | undefined> | null
): MeetLocalState {
  const rawStatus = attrs?.[MEET_ATTR.status] || "";
  const status: MeetStatus =
    rawStatus === "focus" || rawStatus === "break" || rawStatus === "help"
      ? rawStatus
      : "";

  const handRaised = attrs?.[MEET_ATTR.hand] === "1";
  const rawGoal = (attrs?.[MEET_ATTR.goal] || "").trim();
  const goal = rawGoal.slice(0, 120);

  return {
    status,
    handRaised,
    goal,
  };
}

/**
 * Phân tích các attribute hẹn giờ thành dữ liệu Timer.
 * Timer hợp lệ khi:
 * - phase là "focus" hoặc "break"
 * - startedAt là số dương
 * - durationSec nằm trong khoảng 60–3600 giây
 * Nguồn thật tính từ startedAt + durationSec * 1000.
 */
export function parseTimerAttributes(
  attrs?: Record<string, string | undefined> | null
): MeetTimerData | null {
  if (!attrs) return null;

  const rawPhase = attrs[MEET_ATTR.timerPhase];
  if (rawPhase !== "focus" && rawPhase !== "break") {
    return null;
  }

  const startedAt = Number(attrs[MEET_ATTR.timerStartedAt]);
  if (!Number.isFinite(startedAt) || startedAt <= 0) {
    return null;
  }

  const durationSec = Number(attrs[MEET_ATTR.timerDuration]);
  if (!Number.isFinite(durationSec) || durationSec < 60 || durationSec > 3600) {
    return null;
  }

  const endsAt = startedAt + durationSec * 1000;

  return {
    phase: rawPhase,
    startedAt,
    durationSec,
    endsAt,
  };
}

/**
 * Chọn timer mới nhất từ danh sách người tham gia.
 * Nếu timerStartedAt bằng nhau, so sánh identity tăng dần để đảm bảo mọi client cùng chọn 1 timer.
 */
export function pickActiveTimer(
  participants: Array<{
    identity: string;
    name?: string;
    attributes?: Record<string, string | undefined>;
  }>
): ActiveMeetTimer | null {
  const candidates: ActiveMeetTimer[] = [];

  for (const p of participants) {
    const timer = parseTimerAttributes(p.attributes);
    if (timer) {
      candidates.push({
        ...timer,
        identity: p.identity,
        name: p.name || p.identity,
      });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (b.startedAt !== a.startedAt) {
      return b.startedAt - a.startedAt; // Giảm dần theo startedAt (mới nhất lên trước)
    }
    return a.identity.localeCompare(b.identity); // Tie-break theo identity tăng dần
  });

  return candidates[0];
}

/**
 * Tính số giây còn lại của timer dựa trên mốc thời gian nowMs.
 * Dùng Math.ceil, kẹp trong khoảng [0..durationSec].
 */
export function remainingTimerSeconds(
  timer: MeetTimerData | null,
  nowMs: number
): number {
  if (!timer) return 0;
  const diffMs = timer.endsAt - nowMs;
  const remSec = Math.ceil(diffMs / 1000);
  return Math.max(0, Math.min(timer.durationSec, remSec));
}

/**
 * Xác định phase và số phút kế tiếp của Pomodoro:
 * - focus 15 -> break 3
 * - focus 25 -> break 5
 * - focus 50 -> break 10
 * - break 3 -> focus 15
 * - break 5 -> focus 25
 * - break 10 -> focus 50
 * - Không khớp preset: focus -> break 5; break -> focus 25.
 */
export function nextPhasePreset(
  timer: MeetTimerData | null
): { phase: "focus" | "break"; minutes: number } | null {
  if (!timer) return null;

  const currentMinutes = Math.round(timer.durationSec / 60);

  if (timer.phase === "focus") {
    if (currentMinutes === 15) return { phase: "break", minutes: 3 };
    if (currentMinutes === 25) return { phase: "break", minutes: 5 };
    if (currentMinutes === 50) return { phase: "break", minutes: 10 };
    return { phase: "break", minutes: 5 };
  } else {
    if (currentMinutes === 3) return { phase: "focus", minutes: 15 };
    if (currentMinutes === 5) return { phase: "focus", minutes: 25 };
    if (currentMinutes === 10) return { phase: "focus", minutes: 50 };
    return { phase: "focus", minutes: 25 };
  }
}

/**
 * Định dạng thời gian đếm ngược mm:ss
 */
export function formatMeetCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
}

/**
 * Kiểm tra emoji có nằm trong danh sách phản ứng được phép không.
 */
export function isAllowedReaction(value: unknown): value is MeetReaction {
  return typeof value === "string" && (MEET_REACTIONS as readonly string[]).includes(value);
}

/**
 * Phân tích payload reaction từ data channel.
 * Định dạng: { "v": 1, "emoji": "👍" }
 */
export function parseReactionPayload(raw: unknown): MeetReaction | null {
  try {
    let obj: any = raw;
    if (typeof raw === "string") {
      obj = JSON.parse(raw);
    } else if (raw instanceof Uint8Array) {
      const text = new TextDecoder().decode(raw);
      obj = JSON.parse(text);
    }
    if (obj && typeof obj === "object" && obj.v === 1 && isAllowedReaction(obj.emoji)) {
      return obj.emoji;
    }
  } catch {}
  return null;
}
