"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import {
  ParticipantTile,
  TrackToggle,
  useChat,
  useRoomContext,
  useTracks,
  RoomAudioRenderer,
  StartAudio,
  useMaybeTrackRefContext,
  type ReceivedChatMessage,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { Track, RoomEvent } from "livekit-client";
import { getTrackReferenceId } from "@livekit/components-core";
import {
  SignOutIcon,
  ChatTextIcon,
  PaperPlaneTiltIcon,
  XIcon,
  CheckIcon,
  SparkleIcon,
  CircleNotchIcon,
  LinkSimpleIcon,
  HandWavingIcon,
  TargetIcon,
  CrownIcon,
  StarIcon,
  ShieldCheckIcon,
  DotsThreeVerticalIcon,
  ClockCounterClockwiseIcon,
  MicrophoneSlashIcon,
  UserMinusIcon,
  SquaresFourIcon,
  PresentationIcon,
  PushPinIcon,
  PushPinSlashIcon,
  CornersOutIcon,
  CornersInIcon,
} from "@phosphor-icons/react";

export type MobileRoomLayoutMode = "grid" | "speaker";
import { toast } from "sonner";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import type { PomodoroSoundType } from "@/components/study/study-sound";
import { RoomSessionTimer } from "../../rooms/components/RoomSessionTimer";
import { buildInviteLink, getMeetEndpoints } from "@/lib/meet-invite";
import { RoomStudyLayer } from "../../rooms/components/RoomStudyLayer";
import { useMeetStudyState } from "../../rooms/hooks/useMeetStudyState";
import { MEET_ATTR } from "../../rooms/utils/meet-protocol";
import { applyChosenDevices } from "../../rooms/utils/room-devices";
import { RoomHostControlsModal } from "../../rooms/components/RoomHostControlsModal";
import { RoomHistoryModal } from "../../rooms/components/RoomHistoryModal";
import { MemberSafetyMenu } from "../../rooms/components/MemberSafetyMenu";

interface MobileRoomViewProps {
  roomName: string;
  onLeave: () => void;
  remainingMinutes?: number | null;
  sessionMaxMinutes?: number;
  audioDeviceId?: string;
  videoDeviceId?: string;
  soundEnabled?: boolean;
  soundType?: PomodoroSoundType;
  userRole?: "host" | "co-host" | "member";
  isHost?: boolean;
  isCoHost?: boolean;
  initialIsLocked?: boolean;
  initialHasPassword?: boolean;
  getIdToken?: () => Promise<string | null>;
}

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

// Tin nhắn cũ giữ nguyên tham chiếu nên chỉ dòng mới được vẽ lại khi có tin đến
const MobileChatMessageRow = memo(function MobileChatMessageRow({
  message,
  isMe,
}: {
  message: ReceivedChatMessage;
  isMe: boolean;
}) {
  return (
    <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
      <div className="flex items-baseline gap-1.5 mb-0.5 px-1">
        <span className="text-[11px] font-bold text-slate-300">
          {isMe ? "Bạn" : message.from?.name || message.from?.identity || "Thành viên"}
        </span>
        <span className="text-[9px] text-slate-500">
          {formatTime(message.timestamp)}
        </span>
      </div>
      <div
        className={`max-w-[82%] px-3 py-1.5 rounded-2xl text-xs leading-relaxed break-words ${
          isMe
            ? "bg-emerald-500/25 border border-emerald-400/30 text-emerald-100 rounded-tr-sm"
            : "bg-white/10 border border-white/10 text-slate-100 rounded-tl-sm"
        }`}
      >
        {message.message}
      </div>
    </div>
  );
});

type PendingActionType = "mute" | "kick" | "co-host";

interface MobileParticipantTileProps {
  trackRef?: TrackReferenceOrPlaceholder | null;
  localRole: "host" | "co-host" | "member";
  canModerate: boolean;
  isLocalHost: boolean;
  pendingType: PendingActionType | null;
  getToken?: () => Promise<string | null>;
  roomName: string;
  onMute: (identity: string) => void;
  onKick: (identity: string, name: string) => void;
  onToggleCoHost: (identity: string) => void;
  onBlocked: () => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
  isCompact?: boolean;
}

function MobileParticipantTileBase({
  trackRef,
  localRole,
  canModerate,
  isLocalHost,
  onMute,
  onKick,
  onToggleCoHost,
  pendingType,
  getToken,
  roomName,
  onBlocked,
  isPinned,
  onTogglePin,
  isCompact = false,
}: MobileParticipantTileProps) {
  const contextTrackRef = useMaybeTrackRefContext();
  const resolvedTrackRef = trackRef ?? contextTrackRef;
  const participant = resolvedTrackRef?.participant;
  const identity = participant?.identity;
  const targetUid = identity ? String(identity).replace(/^user-/, "") : "";
  const attrs = participant?.attributes;
  const status = attrs?.[MEET_ATTR.status];
  const isHandRaised = attrs?.[MEET_ATTR.hand] === "1";
  const goal = (attrs?.[MEET_ATTR.goal] || "").trim();
  const isLocal = participant?.isLocal;
  const isActionPending = pendingType !== null;

  const roleAttr = attrs?.["zen.role"];
  const isTargetHost = (isLocal && localRole === "host") || roleAttr === "host";
  const isTargetCoHost = (isLocal && localRole === "co-host") || roleAttr === "co-host";

  const statusLabel =
    status === "focus"
      ? "Tập trung"
      : status === "break"
      ? "Nghỉ"
      : status === "help"
      ? "Cần giúp"
      : null;

  // Trạng thái hiển thị video: false (Vừa khung / contain - mặc định), true (Lấp đầy / cover)
  const [isCover, setIsCover] = useState(false);
  const [feedbackText, setFeedbackText] = useState<string | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<number>(0);

  const isVideoActive = Boolean(
    resolvedTrackRef?.publication &&
    !resolvedTrackRef.publication.isMuted &&
    (resolvedTrackRef.source === Track.Source.Camera || resolvedTrackRef.source === Track.Source.ScreenShare)
  );

  const toggleFit = useCallback(() => {
    setIsCover((prev) => {
      const next = !prev;
      setFeedbackText(next ? "Lấp đầy khung" : "Vừa khung");
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => {
        setFeedbackText(null);
      }, 1200);
      return next;
    });
  }, []);

  const handleTouchEnd = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, [role='button'], a, input, select")) return;
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      if (isVideoActive) {
        toggleFit();
      }
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, [role='button'], a, input, select")) return;
    if (isVideoActive) {
      toggleFit();
    }
  };

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  return (
    <div
      className={`relative w-full h-full group/tile ${
        isHandRaised ? "z-20" : "z-0"
      } ${isCover ? "tile-fit-cover" : "tile-fit-contain"}`}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
    >
      <ParticipantTile
        trackRef={resolvedTrackRef}
        className={`w-full h-full rounded-2xl overflow-hidden bg-black/25 ${
          isCover ? "tile-fit-cover" : "tile-fit-contain"
        } [&_.lk-participant-placeholder]:bg-white/[0.04] [&_.lk-participant-metadata]:whitespace-nowrap [&_.lk-participant-metadata]:flex-nowrap [&_.lk-participant-metadata-item]:max-w-[calc(100%-4.5rem)] [&_.lk-participant-metadata-item]:whitespace-nowrap [&_.lk-participant-metadata-item]:flex-nowrap [&_.lk-participant-metadata-item]:overflow-hidden [&_.lk-participant-name]:whitespace-nowrap [&_.lk-participant-name]:truncate [&_.lk-participant-name]:block ${!isLocal && targetUid ? "[&_.lk-connection-quality]:mr-7.5" : ""}`}
      />

      {/* Huy hiệu vai trò, trạng thái, giơ tay và mục tiêu góc trên trái (mobile nhỏ gọn) */}
      <div className="absolute top-1.5 left-1.5 z-20 pointer-events-none flex items-center gap-1 max-w-[calc(100%-3.5rem)] flex-nowrap">
        {isTargetHost && (
          <div
            className="px-1 py-0.5 rounded bg-amber-500/90 text-slate-950 font-bold text-[9px] flex items-center gap-0.5 shadow-sm border border-amber-300 pointer-events-auto shrink-0 whitespace-nowrap"
            title="Trưởng phòng"
          >
            <CrownIcon className="w-2.5 h-2.5 text-slate-950 shrink-0" weight="fill" />
            <span>Host</span>
          </div>
        )}

        {isTargetCoHost && (
          <div
            className="px-1 py-0.5 rounded bg-sky-500/90 text-white font-bold text-[9px] flex items-center gap-0.5 shadow-sm border border-sky-300 pointer-events-auto shrink-0 whitespace-nowrap"
            title="Phó phòng"
          >
            <StarIcon className="w-2.5 h-2.5 text-white shrink-0" weight="fill" />
            <span>Phó</span>
          </div>
        )}

        {isHandRaised && (
          <div
            className="px-1 py-0.5 rounded bg-amber-500 text-slate-950 flex items-center justify-center shadow-md border border-amber-300 shrink-0 animate-bounce pointer-events-auto"
            title="Đang giơ tay phát biểu"
          >
            <HandWavingIcon className="w-2.5 h-2.5 text-slate-950 shrink-0" weight="fill" />
          </div>
        )}

        {statusLabel && (
          <div
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border shadow-sm truncate shrink-0 whitespace-nowrap ${
              status === "focus"
                ? "bg-emerald-500/85 text-slate-950 border-emerald-400/50"
                : status === "break"
                ? "bg-amber-500/85 text-slate-950 border-amber-400/50"
                : "bg-rose-500/85 text-white border-rose-400/50"
            }`}
            title={goal ? `Mục tiêu: ${goal}` : undefined}
          >
            {statusLabel}
          </div>
        )}

        {/* Mục tiêu học tập cá nhân hiển thị thực sự trên mobile (tối ưu nền không blur trên video WebRTC) */}
        {goal && (
          <div
            className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-black/85 border border-emerald-400/40 text-emerald-200 shadow-sm flex items-center gap-1 max-w-[80px] truncate pointer-events-auto shrink-0"
            title={`Mục tiêu: ${goal}`}
          >
            <TargetIcon className="w-2.5 h-2.5 text-emerald-400 shrink-0" weight="bold" />
            <span className="truncate">{goal}</span>
          </div>
        )}
      </div>

      {/* Cụm nút hành động nhanh góc trên phải: Ghim video & Quyền điều hành */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 pointer-events-auto">
        {onTogglePin && (
          <button
            type="button"
            onClick={onTogglePin}
            className={`w-7.5 h-7.5 rounded-xl bg-black/75 active:scale-95 border transition-all shadow-sm flex items-center justify-center cursor-pointer ${
              isPinned
                ? "bg-emerald-500/90 border-emerald-400 text-white shadow-emerald-500/20"
                : "border-white/20 text-white/80 active:text-white"
            }`}
            title={isPinned ? "Bỏ ghim" : "Ghim video"}
            aria-label={isPinned ? "Bỏ ghim" : "Ghim video"}
          >
            {isPinned ? (
              <PushPinSlashIcon className="w-3.5 h-3.5" weight="fill" />
            ) : (
              <PushPinIcon className="w-3.5 h-3.5" />
            )}
          </button>
        )}

        {/* Nút chuyển đổi Vừa khung (Fit) / Lấp đầy (Fill) khi có video hoạt động */}
        {isVideoActive && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFit();
            }}
            className={`w-7.5 h-7.5 rounded-xl border transition-all shadow-sm flex items-center justify-center cursor-pointer active:scale-95 ${
              isCover
                ? "bg-amber-500/90 border-amber-300 text-slate-950 shadow-amber-500/20"
                : "bg-black/75 border-white/20 text-white/80 active:text-white"
            }`}
            title={isCover ? "Thu về vừa khung (chạm đúp để đổi)" : "Phóng to lấp đầy (chạm đúp để đổi)"}
            aria-label={isCover ? "Thu về vừa khung" : "Phóng to lấp đầy"}
          >
            {isCover ? (
              <CornersInIcon className="w-3.5 h-3.5" weight="bold" />
            ) : (
              <CornersOutIcon className="w-3.5 h-3.5" weight="bold" />
            )}
          </button>
        )}

        {!isCompact && canModerate && !isLocal && (
          <>
            <button
              type="button"
              onClick={() => identity && onMute(identity)}
              disabled={isActionPending}
              aria-busy={pendingType === "mute" || undefined}
              className="w-7.5 h-7.5 rounded-xl bg-black/75 active:bg-rose-500/80 active:scale-95 text-white border border-white/20 transition-all shadow-sm disabled:opacity-60 flex items-center justify-center cursor-pointer"
              title="Tắt micro"
              aria-label="Tắt micro"
            >
              {pendingType === "mute" ? (
                <CircleNotchIcon className="w-3.5 h-3.5 animate-spin" weight="bold" />
              ) : (
                <MicrophoneSlashIcon className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() =>
                identity &&
                onKick(identity, participant?.name || "Học viên")
              }
              disabled={isActionPending}
              aria-busy={pendingType === "kick" || undefined}
              className="w-7.5 h-7.5 rounded-xl bg-black/75 active:bg-rose-500/80 active:scale-95 text-white border border-white/20 transition-all shadow-sm disabled:opacity-60 flex items-center justify-center cursor-pointer"
              title="Mời rời phòng"
              aria-label="Mời rời phòng"
            >
              {pendingType === "kick" ? (
                <CircleNotchIcon className="w-3.5 h-3.5 animate-spin" weight="bold" />
              ) : (
                <UserMinusIcon className="w-3.5 h-3.5" />
              )}
            </button>
            {isLocalHost && (
              <button
                type="button"
                onClick={() => identity && onToggleCoHost(identity)}
                disabled={isActionPending}
                aria-busy={pendingType === "co-host" || undefined}
                className={`w-7.5 h-7.5 rounded-xl bg-black/75 active:scale-95 text-white border border-white/20 transition-all shadow-sm disabled:opacity-60 flex items-center justify-center cursor-pointer ${
                  isTargetCoHost ? "text-amber-300" : "text-sky-300"
                }`}
                title={isTargetCoHost ? "Hủy quyền Phó phòng" : "Bổ nhiệm Phó phòng"}
                aria-label="Chỉ định hoặc hủy Phó phòng"
              >
                {pendingType === "co-host" ? (
                  <CircleNotchIcon className="w-3.5 h-3.5 animate-spin" weight="bold" />
                ) : (
                  <StarIcon className="w-3.5 h-3.5" weight={isTargetCoHost ? "fill" : "regular"} />
                )}
              </button>
            )}
          </>
        )}
      </div>

      {/* Menu an toàn (báo cáo/chặn) chỉ dành cho thành viên khác */}
      {!isLocal && targetUid ? (
        <MemberSafetyMenu
          variant="mobile"
          getToken={getToken}
          roomName={roomName}
          targetUid={targetUid}
          targetName={participant?.name || "Thành viên"}
          onBlocked={onBlocked}
        />
      ) : null}

      {/* Thông báo phản hồi cử chỉ Vừa khung / Lấp đầy */}
      {feedbackText && (
        <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-white text-xs font-semibold shadow-xl flex items-center gap-1.5">
            {isCover ? (
              <CornersOutIcon className="w-3.5 h-3.5 text-amber-300" weight="bold" />
            ) : (
              <CornersInIcon className="w-3.5 h-3.5 text-emerald-300" weight="bold" />
            )}
            <span>{feedbackText}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Không so sánh object trackRef (LiveKit tạo lại mỗi lần phát event) mà so phần thực sự ảnh hưởng giao diện.
function areParticipantTilePropsEqual(
  prev: MobileParticipantTileProps,
  next: MobileParticipantTileProps
) {
  const prevRef = prev.trackRef;
  const nextRef = next.trackRef;
  return (
    prevRef?.participant === nextRef?.participant &&
    prevRef?.publication === nextRef?.publication &&
    prevRef?.source === nextRef?.source &&
    prevRef?.participant?.attributes === nextRef?.participant?.attributes &&
    prevRef?.participant?.name === nextRef?.participant?.name &&
    prevRef?.publication?.isMuted === nextRef?.publication?.isMuted &&
    prev.localRole === next.localRole &&
    prev.canModerate === next.canModerate &&
    prev.isLocalHost === next.isLocalHost &&
    prev.pendingType === next.pendingType &&
    prev.getToken === next.getToken &&
    prev.roomName === next.roomName &&
    prev.onMute === next.onMute &&
    prev.onKick === next.onKick &&
    prev.onToggleCoHost === next.onToggleCoHost &&
    prev.onBlocked === next.onBlocked &&
    prev.isPinned === next.isPinned &&
    prev.onTogglePin === next.onTogglePin &&
    prev.isCompact === next.isCompact
  );
}

const MobileParticipantTile = memo(
  MobileParticipantTileBase,
  areParticipantTilePropsEqual
);

function MobileRoomViewBase({
  roomName,
  onLeave,
  remainingMinutes,
  sessionMaxMinutes = 120,
  audioDeviceId,
  videoDeviceId,
  soundEnabled,
  soundType,
  userRole = "member",
  isHost = false,
  isCoHost = false,
  initialIsLocked = false,
  initialHasPassword = false,
  getIdToken,
}: MobileRoomViewProps) {
  const room = useRoomContext();
  const studyState = useMeetStudyState({ soundEnabled, soundType });
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [canShareScreen, setCanShareScreen] = useState(false);
  const [kickTarget, setKickTarget] = useState<{ identity: string; name: string } | null>(null);
  const [isHostControlsOpen, setIsHostControlsOpen] = useState(false);
  const [isRoomMenuOpen, setIsRoomMenuOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLockedState, setIsLockedState] = useState(initialIsLocked);
  const [hasPasswordState, setHasPasswordState] = useState(initialHasPassword);
  const [layoutMode, setLayoutMode] = useState<MobileRoomLayoutMode>("grid");
  const [pinnedTrackId, setPinnedTrackId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    { type: PendingActionType; identity: string } | null
  >(null);
  const pendingActionRef = useRef(false);

  const beginMemberAction = useCallback((type: PendingActionType, identity?: string) => {
    if (!identity || pendingActionRef.current) return false;
    pendingActionRef.current = true;
    setPendingAction({ type, identity });
    return true;
  }, []);

  const endMemberAction = useCallback(() => {
    pendingActionRef.current = false;
    setPendingAction(null);
  }, []);

  const handleTogglePinTrack = useCallback((trackId: string) => {
    setPinnedTrackId((prev) => {
      if (prev === trackId) {
        return null;
      }
      setLayoutMode("speaker");
      return trackId;
    });
  }, []);

  const handleMuteParticipant = useCallback(
    async (identity: string) => {
      const { baseUrl } = getMeetEndpoints();
      if (!baseUrl || !getIdToken || !beginMemberAction("mute", identity)) return;
      try {
        const token = await getIdToken();
        if (!token) throw new Error("Chưa đăng nhập.");
        const res = await fetch(`${baseUrl}/rooms/${encodeURIComponent(roomName)}/mute`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ identity }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Không thể tắt micro.");
        toast.success("Đã gửi yêu cầu tắt micro");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Thao tác thất bại");
      } finally {
        endMemberAction();
      }
    },
    [getIdToken, roomName, beginMemberAction, endMemberAction]
  );

  const handleKickParticipant = useCallback(
    async (identity: string) => {
      const { baseUrl } = getMeetEndpoints();
      if (!baseUrl || !getIdToken || !beginMemberAction("kick", identity)) return;
      try {
        const token = await getIdToken();
        if (!token) throw new Error("Chưa đăng nhập.");
        const res = await fetch(`${baseUrl}/rooms/${encodeURIComponent(roomName)}/kick`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ identity }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Không thể mời rời phòng.");
        toast.success("Đã mời học viên rời khỏi phòng");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Thao tác thất bại");
      } finally {
        setKickTarget(null);
        endMemberAction();
      }
    },
    [getIdToken, roomName, beginMemberAction, endMemberAction]
  );

  const handleToggleCoHost = useCallback(
    async (targetIdentity: string) => {
      const { baseUrl } = getMeetEndpoints();
      if (!baseUrl || !getIdToken || !beginMemberAction("co-host", targetIdentity)) return;
      const targetUid = targetIdentity.replace(/^user-/, "");
      const targetPart = room.getParticipantByIdentity(targetIdentity);
      const isCurrentlyCoHost = targetPart?.attributes?.["zen.role"] === "co-host";
      const method = isCurrentlyCoHost ? "DELETE" : "POST";

      try {
        const token = await getIdToken();
        if (!token) throw new Error("Chưa đăng nhập.");
        const res = await fetch(`${baseUrl}/rooms/${encodeURIComponent(roomName)}/co-host`, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ targetUid, targetIdentity }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Không thể cập nhật quyền Phó phòng.");
        toast.success(isCurrentlyCoHost ? "Đã hủy quyền Phó phòng" : "Đã bổ nhiệm làm Phó phòng ⭐");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Thao tác thất bại");
      } finally {
        endMemberAction();
      }
    },
    [room, getIdToken, roomName, beginMemberAction, endMemberAction]
  );

  const handleSelectKickTarget = useCallback((identity: string, name: string) => {
    setKickTarget({ identity, name });
  }, []);

  // Kích hoạt đúng microphone và camera mà người dùng đã chọn từ bước xem trước (Pre-join)
  useEffect(() => {
    if (!room) return;
    applyChosenDevices(room, { audioDeviceId, videoDeviceId });
  }, [room, audioDeviceId, videoDeviceId]);

  // Kiểm tra hỗ trợ chia sẻ màn hình trên thiết bị mobile (iOS Safari không hỗ trợ getDisplayMedia)
  useEffect(() => {
    if (
      typeof navigator !== "undefined" &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getDisplayMedia === "function"
    ) {
      setCanShareScreen(true);
    }
  }, []);

  // Lắng nghe trạng thái tái kết nối (Reconnect)
  useEffect(() => {
    const handleReconnecting = () => setIsReconnecting(true);
    const handleReconnected = () => setIsReconnecting(false);
    const handleDisconnected = () => setIsReconnecting(false);

    room.on(RoomEvent.Reconnecting, handleReconnecting);
    room.on(RoomEvent.Reconnected, handleReconnected);
    room.on(RoomEvent.Disconnected, handleDisconnected);

    return () => {
      room.off(RoomEvent.Reconnecting, handleReconnecting);
      room.off(RoomEvent.Reconnected, handleReconnected);
      room.off(RoomEvent.Disconnected, handleDisconnected);
    };
  }, [room]);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  // Lưới thích ứng: 1–2 người xếp dọc, từ 3 người chia 2 cột để tile không bị đè/cắt
  const videoColumns = tracks.length <= 2 ? 1 : 2;
  const videoRows = Math.max(1, Math.ceil(tracks.length / videoColumns));

  const { chatMessages, send } = useChat();
  const [chatOpen, setChatOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const sendingRef = useRef(false);
  const [seenCount, setSeenCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const hasExpiredRef = useRef(false);

  // Chặn xong thì rời phòng hiện tại.
  const handleBlockedMember = useCallback(() => {
    try {
      room.disconnect();
    } catch {}
    onLeave();
  }, [room, onLeave]);

  const handleSessionExpire = useCallback(() => {
    if (hasExpiredRef.current) return;
    hasExpiredRef.current = true;
    toast.error(`Phiên học đã đạt giới hạn ${sessionMaxMinutes} phút`);
    try {
      room.disconnect();
    } catch {}
    onLeave();
  }, [room, onLeave, sessionMaxMinutes]);

  const unreadCount =
    !chatOpen && chatMessages.length > seenCount
      ? chatMessages.length - seenCount
      : 0;

  const toggleChat = () => {
    setChatOpen((v) => {
      const next = !v;
      if (next) setSeenCount(chatMessages.length);
      return next;
    });
  };

  useEffect(() => {
    if (chatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, chatOpen]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sendingRef.current) return;
    sendingRef.current = true;
    setIsSending(true);
    try {
      await send(text);
      setDraft("");
    } catch {
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  };

  const handleCopyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(buildInviteLink(roomName));
      setCopied(true);
      toast.success("Đã copy link mời");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Không thể copy link mời");
    }
  };

  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [camEnabled, setCamEnabled] = useState(false);

  const handleLeaveRoom = () => {
    setIsLeaveConfirmOpen(true);
  };

  return (
    <div className="mobile-room-shell relative flex flex-col h-full w-full bg-transparent text-white overflow-hidden select-none [--lk-bg:transparent] [--lk-bg2:rgba(255,255,255,0.06)]">
      {/* Phát âm thanh LiveKit */}
      <RoomAudioRenderer />

      {/* Banner cảnh báo khi phòng đang kết nối lại (Reconnect) */}
      {isReconnecting && (
        <div className="bg-amber-500/90 text-slate-950 font-bold text-xs py-1.5 px-3 text-center shrink-0 flex items-center justify-center gap-2 animate-pulse shadow-md z-30">
          <CircleNotchIcon className="w-4 h-4 animate-spin text-slate-950" />
          <span>Đang kết nối lại...</span>
        </div>
      )}

      {/* Thông báo nếu trình duyệt chặn tự phát âm thanh.
          LiveKit mặc định ghim nút này giữa màn hình (position:fixed), đè lên video;
          selector ở khung ngoài đưa nó về dòng banner để không che tile/tên thành viên. */}
      <StartAudio
        label="🔊 Chạm vào đây để nghe tiếng bạn bè"
        className="mx-3 mt-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-medium cursor-pointer text-center shrink-0 z-30"
      />

      {/* Thanh trạng thái phụ: số người, timer phiên và tiện ích phòng */}
      <div className="flex items-center justify-between px-3.5 py-1.5 text-xs border-b border-white/[0.08] shrink-0 bg-transparent gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/10 text-slate-200 text-[11px] font-medium shrink-0 shadow-sm"
            title={`${room.numParticipants} thành viên đang trong phòng`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            <span className="tabular-nums font-semibold">{room.numParticipants}</span>
            <span className="text-slate-400 text-[10px]">bạn</span>
          </div>

          {/* Đồng hồ phiên cô lập: tính theo Date.now(), chuyển tab không mất giờ, ngắt 1 lần */}
          <RoomSessionTimer
            sessionMaxMinutes={sessionMaxMinutes}
            onExpire={handleSessionExpire}
            compact
          />
          {typeof remainingMinutes === "number" && remainingMinutes < 300 && (
            <span className="text-[10px] text-amber-300 bg-amber-500/15 border border-amber-400/25 px-2 py-0.5 rounded-full shrink-0 font-medium">
              ~{remainingMinutes}p
            </span>
          )}
        </div>

        {/* Cụm 1 nút tiện ích phòng duy nhất */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIsRoomMenuOpen((v) => !v)}
            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-sm shrink-0 active:scale-95 ${
              isRoomMenuOpen
                ? "bg-white/15 border-white/30 text-white"
                : "bg-white/[0.05] hover:bg-white/[0.12] border-white/10 text-slate-200 hover:text-white"
            }`}
            title="Tiện ích phòng (Mời, Lịch sử, Quản lý)"
            aria-label="Tiện ích phòng"
          >
            <DotsThreeVerticalIcon className="w-4 h-4 text-emerald-400" weight="bold" />
          </button>

          {isRoomMenuOpen && (
            <>
              {/* Backdrop bắt chạm ra ngoài để đóng */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsRoomMenuOpen(false)}
              />

              {/* Menu popup tiện ích & bố cục (đồng bộ surface-frost theo mobile style guide) */}
              <div className="absolute right-0 top-full mt-1.5 z-50 w-52 py-1.5 rounded-2xl surface-frost border shadow-[0_16px_40px_rgba(0,0,0,0.85)] select-none">
                {/* Phần 1: Bố cục hiển thị */}
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/[0.08] mb-1">
                  Bố cục hiển thị
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setLayoutMode("grid");
                    setPinnedTrackId(null);
                    setIsRoomMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <SquaresFourIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Lưới đều</span>
                  </div>
                  {layoutMode === "grid" && (
                    <CheckIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" weight="bold" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLayoutMode("speaker");
                    setIsRoomMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <PresentationIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Tiêu điểm</span>
                  </div>
                  {layoutMode === "speaker" && (
                    <CheckIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" weight="bold" />
                  )}
                </button>

                {/* Phần 2: Tiện ích phòng */}
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-y border-white/[0.08] my-1">
                  Tiện ích phòng
                </div>

                <button
                  type="button"
                  onClick={() => {
                    handleCopyInviteLink();
                    setTimeout(() => setIsRoomMenuOpen(false), 900);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
                >
                  {copied ? (
                    <CheckIcon className="w-4 h-4 text-emerald-400 shrink-0" weight="bold" />
                  ) : (
                    <LinkSimpleIcon className="w-4 h-4 text-emerald-400 shrink-0" weight="bold" />
                  )}
                  <span className={copied ? "text-emerald-300 font-semibold" : ""}>
                    {copied ? "Đã chép link mời" : "Sao chép link mời"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsRoomMenuOpen(false);
                    setIsHistoryOpen(true);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <ClockCounterClockwiseIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Lịch sử phòng</span>
                </button>

                {(isHost || isCoHost) && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsRoomMenuOpen(false);
                      setIsHostControlsOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-amber-300 hover:bg-amber-500/15 transition-colors flex items-center gap-2 cursor-pointer border-t border-white/[0.08] mt-1 pt-2"
                  >
                    <ShieldCheckIcon className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Quản lý phòng</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Thanh công cụ tương tác học tập di động: Pomodoro, Trạng thái, Mục tiêu, Reaction (Phase 2) */}
      <RoomStudyLayer
        compact
        soundEnabled={soundEnabled}
        soundType={soundType}
        studyState={studyState}
        hideHandButton
      />

      {/* Vùng hiển thị Video các thành viên (Mở rộng tối đa không gian) */}
      <main className="flex-1 min-h-0 relative p-2 overflow-hidden flex flex-col justify-center">
        {(() => {
          if (tracks.length === 0) {
            return (
              <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                <div className="relative mb-2.5">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center text-emerald-300 shadow-[0_0_25px_rgba(52,211,153,0.2)] animate-pulse">
                    <SparkleIcon className="w-7 h-7" />
                  </div>
                </div>
                <h3 className="text-xs font-bold text-white mb-0.5">
                  Đang đợi bạn bè tham gia
                </h3>
                <p className="text-[11px] text-slate-400 max-w-[220px] leading-relaxed mb-3">
                  Gửi link mời phòng{" "}
                  <strong className="text-emerald-300 font-mono font-semibold">
                    {roomName}
                  </strong>{" "}
                  để cùng học nhé.
                </p>
                <button
                  type="button"
                  onClick={handleCopyInviteLink}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 border border-white/15 text-[11px] font-semibold text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  {copied ? (
                    <>
                      <CheckIcon className="w-3 h-3 text-emerald-400" />
                      <span>Đã chép link!</span>
                    </>
                  ) : (
                    <>
                      <LinkSimpleIcon className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Sao chép link mời</span>
                    </>
                  )}
                </button>
              </div>
            );
          }

          const renderParticipantTile = (
            track: TrackReferenceOrPlaceholder,
            isCompact = false
          ) => {
            const trackId = getTrackReferenceId(track);
            const isPinned = pinnedTrackId === trackId;
            const isHandRaised = track.participant?.attributes?.[MEET_ATTR.hand] === "1";
            return (
              <div
                key={trackId}
                className={`relative w-full h-full min-h-0 min-w-0 rounded-2xl border border-white/15 bg-white/[0.04] shadow-md ${
                  isHandRaised ? "z-20" : "z-0"
                }`}
              >
                <MobileParticipantTile
                  trackRef={track}
                  localRole={userRole}
                  canModerate={isHost || isCoHost}
                  isLocalHost={isHost}
                  pendingType={
                    pendingAction?.identity === track.participant?.identity
                      ? pendingAction.type
                      : null
                  }
                  getToken={getIdToken}
                  roomName={roomName}
                  onMute={handleMuteParticipant}
                  onKick={handleSelectKickTarget}
                  onToggleCoHost={handleToggleCoHost}
                  onBlocked={handleBlockedMember}
                  isPinned={isPinned}
                  onTogglePin={() => handleTogglePinTrack(trackId)}
                  isCompact={isCompact}
                />
              </div>
            );
          };

          const screenShareTrack = tracks.find((t) => t.source === Track.Source.ScreenShare);
          const pinnedTrack = pinnedTrackId ? tracks.find((t) => getTrackReferenceId(t) === pinnedTrackId) : null;
          const mainTrack = screenShareTrack || pinnedTrack || tracks[0];
          const otherTracks = tracks.filter((t) => getTrackReferenceId(t) !== getTrackReferenceId(mainTrack));

          // Chế độ Tiêu điểm (Speaker): 1 ô lớn ở trên, dải trượt ngang các bạn khác ở dưới
          if (layoutMode === "speaker" && mainTrack) {
            return (
              <div className="flex flex-col gap-2 h-full w-full min-h-0">
                <div className="flex-1 min-h-0 w-full rounded-2xl">
                  {renderParticipantTile(mainTrack, false)}
                </div>
                {otherTracks.length > 0 && (
                  <div className="h-24 shrink-0 flex gap-2 overflow-x-auto custom-study-scroll pb-1 pt-2">
                    {otherTracks.map((track) => (
                      <div key={getTrackReferenceId(track)} className="h-full aspect-[4/3] shrink-0">
                        {renderParticipantTile(track, true)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          // Chế độ Lưới đều (Grid - mặc định)
          return (
            <div
              className={`w-full h-full overflow-y-auto custom-study-scroll rounded-2xl grid gap-2 p-1 ${
                videoColumns === 2 && tracks.length % 2 === 1
                  ? "[&>*:last-child]:col-span-2"
                  : ""
              }`}
              style={{
                gridTemplateColumns: `repeat(${videoColumns}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${videoRows}, minmax(0, 1fr))`,
              }}
            >
              {tracks.map((track) => renderParticipantTile(track))}
            </div>
          );
        })()}
      </main>

      {/* Thanh điều khiển cuộc gọi dưới đáy (đồng bộ viên kính surface-frost) */}
      <footer className="shrink-0 py-1.5 px-3 flex items-center justify-center z-20">
        <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-full surface-frost border shadow-[0_8px_30px_rgba(0,0,0,0.7)]">
          {/* Nút Micro */}
          <TrackToggle
            source={Track.Source.Microphone}
            onChange={(enabled) => setMicEnabled(enabled)}
            className={`w-9 h-9 p-0 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-all [&_svg]:w-4 [&_svg]:h-4 [&_svg]:scale-110 [&_svg]:shrink-0 ${
              micEnabled
                ? "bg-emerald-400/15 border border-emerald-400/70 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.35)]"
                : "bg-white/[0.08] hover:bg-white/[0.16] border border-white/20 text-white/90"
            }`}
          />

          {/* Nút Camera */}
          <TrackToggle
            source={Track.Source.Camera}
            captureOptions={{ facingMode: "user" }}
            onChange={(enabled) => setCamEnabled(enabled)}
            onDeviceError={(error) => {
              const name = error?.name || "";
              const message =
                name === "NotAllowedError"
                  ? "Bạn chưa cấp quyền camera"
                  : name === "NotFoundError"
                  ? "Không tìm thấy camera"
                  : name === "NotReadableError"
                  ? "Camera đang được ứng dụng khác sử dụng"
                  : name === "OverconstrainedError"
                  ? "Camera không hỗ trợ chế độ này"
                  : name === "TypeError"
                  ? "Trình duyệt không hỗ trợ camera"
                  : "Không bật được camera";
              toast.error(message);
            }}
            className={`w-9 h-9 p-0 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-all [&_svg]:w-4 [&_svg]:h-4 [&_svg]:scale-110 [&_svg]:shrink-0 ${
              camEnabled
                ? "bg-emerald-400/15 border border-emerald-400/70 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.35)]"
                : "bg-white/[0.08] hover:bg-white/[0.16] border border-white/20 text-white/90"
            }`}
          />

          {/* Nút Chia sẻ màn hình Mobile (chỉ hiện khi trình duyệt hỗ trợ getDisplayMedia) */}
          {canShareScreen && (
            <TrackToggle
              source={Track.Source.ScreenShare}
              captureOptions={{ audio: true }}
              className="w-9 h-9 p-0 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/20 text-white/90 flex items-center justify-center cursor-pointer active:scale-95 transition-all [&_svg]:w-4.5 [&_svg]:h-3.5 [&_svg]:shrink-0 aria-pressed:bg-emerald-400/15 aria-pressed:border-emerald-400/70 aria-pressed:text-emerald-300 aria-pressed:shadow-[0_0_20px_rgba(52,211,153,0.35)]"
              title="Chia sẻ màn hình"
            />
          )}

          {/* Nút Giơ tay */}
          <button
            type="button"
            onClick={studyState.toggleHand}
            className={`relative w-9 h-9 p-0 rounded-full border flex items-center justify-center cursor-pointer active:scale-95 transition-all ${
              studyState.local.handRaised
                ? "bg-amber-500/25 border-amber-400/70 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.35)]"
                : "bg-white/[0.08] hover:bg-white/[0.16] border-white/20 text-white/90"
            }`}
            title={studyState.local.handRaised ? "Hạ tay xuống" : "Giơ tay phát biểu"}
            aria-label={studyState.local.handRaised ? "Hạ tay" : "Giơ tay"}
          >
            <HandWavingIcon
              className={`w-4.5 h-4.5 ${studyState.local.handRaised ? "text-amber-300 animate-bounce" : "text-white/90"}`}
              weight={studyState.local.handRaised ? "fill" : "bold"}
            />
            {studyState.handRaisedCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-3.5 h-3.5 px-0.5 rounded-full bg-amber-500 text-slate-950 text-[9px] font-bold flex items-center justify-center shadow-md">
                {studyState.handRaisedCount}
              </span>
            )}
          </button>

          {/* Nút Chat */}
          <button
            type="button"
            onClick={toggleChat}
            className={`relative w-9 h-9 rounded-full border flex items-center justify-center cursor-pointer active:scale-95 transition-all ${
              chatOpen
                ? "bg-emerald-500 border-emerald-400 text-slate-950 shadow-[0_0_12px_rgba(52,211,153,0.5)]"
                : "bg-white/10 hover:bg-white/20 border-white/20 text-white"
            }`}
            title="Trò chuyện"
            aria-label="Trò chuyện"
          >
            <ChatTextIcon className="w-4.5 h-4.5" weight={chatOpen ? "fill" : "regular"} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-3.5 h-3.5 px-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center animate-bounce shadow-md">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Vạch ngăn cách tinh tế */}
          <span className="w-[1px] h-5 bg-white/20" aria-hidden="true" />

          {/* Nút Rời phòng (End Call - Màu đỏ dứt khoát) */}
          <button
            type="button"
            onClick={handleLeaveRoom}
            className="w-9 h-9 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-95 text-white flex items-center justify-center cursor-pointer transition-all shadow-[0_0_12px_rgba(225,29,72,0.4)] border border-rose-400/40"
            title="Rời phòng học"
            aria-label="Rời phòng học"
          >
            <SignOutIcon className="w-4.5 h-4.5" weight="bold" />
          </button>
        </div>
      </footer>

      {/* Khung chat trượt lên từ đáy (In-Room Mobile Chat Drawer - đồng bộ surface-frost) */}
      {chatOpen && (
        <div className="absolute inset-x-0 bottom-0 h-[65%] surface-frost border-t border-white/25 rounded-t-3xl shadow-[0_-16px_50px_rgba(0,0,0,0.85)] flex flex-col z-30 animate-in slide-in-from-bottom duration-250 ease-out">
          {/* Header Chat */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <ChatTextIcon className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-white">Tin nhắn phòng học</h3>
              <span className="text-[11px] text-slate-400">
                ({chatMessages.length})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
              title="Đóng chat"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Danh sách tin nhắn */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-2.5 custom-study-scroll select-text">
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <p className="text-xs text-slate-400">Chưa có tin nhắn nào.</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Gửi lời chào đầu tiên tới các bạn học nhé! 👋
                </p>
              </div>
            ) : (
              chatMessages.map((m) => (
                <MobileChatMessageRow
                  key={m.id}
                  message={m}
                  isMe={m.from?.identity === room.localParticipant.identity}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Ô nhập tin nhắn */}
          <div className="p-2.5 bg-black/60 border-t border-white/10 flex items-center gap-2 pb-[calc(env(safe-area-inset-bottom,0.5rem)+0.5rem)] shrink-0">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              placeholder="Nhắn tin cho cả phòng..."
              maxLength={500}
              className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white/[0.08] border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400/50"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!draft.trim() || isSending}
              aria-busy={isSending || undefined}
              className="w-8.5 h-8.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              title={isSending ? "Đang gửi…" : "Gửi tin nhắn"}
            >
              {isSending ? (
                <CircleNotchIcon className="w-3.5 h-3.5 animate-spin" weight="bold" />
              ) : (
                <PaperPlaneTiltIcon className="w-3.5 h-3.5" weight="fill" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Hộp thoại xác nhận rời phòng học dạng alertdialog */}
      <ConfirmDeleteModal
        isOpen={isLeaveConfirmOpen}
        onClose={() => setIsLeaveConfirmOpen(false)}
        onConfirm={() => {
          try {
            room.disconnect();
          } catch {}
          onLeave();
          toast.info("Đã rời phòng học nhóm");
        }}
        title="Xác nhận rời phòng học"
        description={`Bạn có chắc muốn rời khỏi phòng "${roomName}" không?`}
        confirmText="Rời phòng"
        cancelText="Ở lại"
      />

      {/* Hộp thoại xác nhận mời học viên ra khỏi phòng */}
      <ConfirmDeleteModal
        isOpen={Boolean(kickTarget)}
        pending={pendingAction?.type === "kick"}
        onClose={() => {
          if (pendingActionRef.current) return;
          setKickTarget(null);
        }}
        onConfirm={() => kickTarget && handleKickParticipant(kickTarget.identity)}
        title="Mời ra khỏi phòng học"
        description={`Bạn có chắc muốn mời "${kickTarget?.name}" rời khỏi phòng học này không?`}
        confirmText="Mời rời phòng"
        cancelText="Hủy"
      />

      {/* Modal Quản trị phòng học */}
      <RoomHostControlsModal
        isOpen={isHostControlsOpen}
        onClose={() => setIsHostControlsOpen(false)}
        roomName={roomName}
        isHost={Boolean(isHost)}
        isCoHost={Boolean(isCoHost)}
        isLocked={isLockedState}
        hasPassword={hasPasswordState}
        onUpdateLockState={(l) => setIsLockedState(l)}
        onUpdatePasswordState={(p) => setHasPasswordState(p)}
        getIdToken={getIdToken || (async () => null)}
      />

      {/* Modal Xem lịch sử giờ học của phòng */}
      <RoomHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        roomName={roomName}
        getIdToken={getIdToken || (async () => null)}
      />
    </div>
  );
}

export const MobileRoomView = memo(MobileRoomViewBase);
