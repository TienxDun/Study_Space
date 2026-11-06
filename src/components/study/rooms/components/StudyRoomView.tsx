"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import {
  ParticipantTile,
  TrackToggle,
  useChat,
  useRoomContext,
  useTracks,
  RoomAudioRenderer,
  StartAudio,
} from "@livekit/components-react";
import { Track, RoomEvent } from "livekit-client";
import { getTrackReferenceId } from "@livekit/components-core";
import {
  SignOutIcon,
  ChatTextIcon,
  PaperPlaneTiltIcon,
  XIcon,
  CornersOutIcon,
  CornersInIcon,
  LinkSimpleIcon,
  CircleNotchIcon,
  HandWavingIcon,
  TargetIcon,
  CrownIcon,
  StarIcon,
  ShieldCheckIcon,
  ClockCounterClockwiseIcon,
  MicrophoneSlashIcon,
  UserMinusIcon,
  SquaresFourIcon,
  PresentationIcon,
  SidebarSimpleIcon,
  PushPinIcon,
  PushPinSlashIcon,
  CaretDownIcon,
  DotsThreeVerticalIcon,
  CheckIcon,
} from "@phosphor-icons/react";

export type RoomLayoutMode = "grid" | "speaker" | "sidebar";
import { toast } from "sonner";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import type { PomodoroSoundType } from "@/components/study/study-sound";
import { RoomSessionTimer } from "./RoomSessionTimer";
import { buildInviteLink, getMeetEndpoints } from "@/lib/meet-invite";
import { RoomStudyLayer } from "./RoomStudyLayer";
import { useMeetStudyState } from "../hooks/useMeetStudyState";
import { MEET_ATTR } from "../utils/meet-protocol";
import { applyChosenDevices } from "../utils/room-devices";
import { RoomHostControlsModal } from "./RoomHostControlsModal";
import { MemberSafetyMenu } from "./MemberSafetyMenu";
import { RoomHistoryModal } from "./RoomHistoryModal";

interface StudyRoomViewProps {
  roomName: string;
  onLeave: () => void;
  // true: chat đứng cạnh video, false: chat nằm dưới (thẻ hẹp)
  sideBySide?: boolean;
  onDragStart?: (e: React.PointerEvent) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
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

/**
 * Tile người tham gia kèm chỉ báo chất lượng mạng ở góc trên phải
 * và huy hiệu trạng thái / giơ tay ở góc trên trái (Phase 2).
 */
function RoomParticipantTile({
  trackRef,
  localRole,
  canModerate,
  isLocalHost,
  onMute,
  onKick,
  onToggleCoHost,
  pendingAction,
  safetyMenu,
  isPinned,
  onTogglePin,
  isCompact = false,
  ...rest
}: any) {
  const attrs = trackRef?.participant?.attributes;
  const status = attrs?.[MEET_ATTR.status];
  const isHandRaised = attrs?.[MEET_ATTR.hand] === "1";
  const goal = (attrs?.[MEET_ATTR.goal] || "").trim();
  const isLocal = trackRef?.participant?.isLocal;
  const pendingType =
    pendingAction?.identity === trackRef?.participant?.identity ? pendingAction.type : null;
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

  const isVideoActive = Boolean(
    trackRef?.publication &&
    !trackRef.publication.isMuted &&
    (trackRef.source === Track.Source.Camera || trackRef.source === Track.Source.ScreenShare)
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
      onDoubleClick={handleDoubleClick}
    >
      <ParticipantTile
        trackRef={trackRef}
        className={`w-full h-full rounded-2xl overflow-hidden border border-white/10 ${
          isCover ? "tile-fit-cover" : "tile-fit-contain"
        } [&_.lk-participant-metadata]:whitespace-nowrap [&_.lk-participant-metadata]:flex-nowrap [&_.lk-participant-metadata-item]:max-w-[calc(100%-5rem)] [&_.lk-participant-metadata-item]:whitespace-nowrap [&_.lk-participant-metadata-item]:flex-nowrap [&_.lk-participant-metadata-item]:overflow-hidden [&_.lk-participant-name]:whitespace-nowrap [&_.lk-participant-name]:truncate [&_.lk-participant-name]:block ${safetyMenu ? "[&_.lk-connection-quality]:mr-8" : ""}`}
        {...rest}
      />

      {/* Huy hiệu vai trò, trạng thái, giơ tay và mục tiêu góc trên trái */}
      <div className="absolute top-2 left-2 z-20 pointer-events-none flex items-center gap-1.5 max-w-[calc(100%-3.5rem)] flex-nowrap">
        {isTargetHost && (
          <div
            className="px-1.5 py-0.5 rounded-md bg-amber-500/90 text-slate-950 font-bold text-[10px] flex items-center gap-1 shadow-sm border border-amber-300 pointer-events-auto shrink-0 whitespace-nowrap"
            title="Trưởng phòng"
          >
            <CrownIcon className="w-3 h-3 text-slate-950 shrink-0" weight="fill" />
            <span>Host</span>
          </div>
        )}

        {isTargetCoHost && (
          <div
            className="px-1.5 py-0.5 rounded-md bg-sky-500/90 text-white font-bold text-[10px] flex items-center gap-1 shadow-sm border border-sky-300 pointer-events-auto shrink-0 whitespace-nowrap"
            title="Phó phòng"
          >
            <StarIcon className="w-3 h-3 text-white shrink-0" weight="fill" />
            <span>Phó</span>
          </div>
        )}

        {isHandRaised && (
          <div
            className="px-1.5 py-0.5 rounded-md bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg border border-amber-300 shrink-0 animate-bounce pointer-events-auto"
            title="Đang giơ tay phát biểu"
          >
            <HandWavingIcon className="w-3.5 h-3.5 text-slate-950 shrink-0" weight="fill" />
          </div>
        )}

        {statusLabel && (
          <div
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border backdrop-blur-md shadow-sm truncate shrink-0 whitespace-nowrap ${
              status === "focus"
                ? "bg-emerald-500/80 text-slate-950 border-emerald-400/50"
                : status === "break"
                ? "bg-amber-500/80 text-slate-950 border-amber-400/50"
                : "bg-rose-500/80 text-white border-rose-400/50"
            }`}
            title={goal ? `Mục tiêu: ${goal}` : undefined}
          >
            {statusLabel}
          </div>
        )}

        {/* Mục tiêu học tập cá nhân hiển thị thực sự cho cả phòng cùng thấy */}
        {goal && (
          <div
            className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-black/70 backdrop-blur-md border border-emerald-400/40 text-emerald-200 shadow-sm flex items-center gap-1 max-w-[100px] sm:max-w-[140px] truncate pointer-events-auto shrink-0"
            title={`Mục tiêu: ${goal}`}
          >
            <TargetIcon className="w-3 h-3 text-emerald-400 shrink-0" weight="bold" />
            <span className="truncate">{goal}</span>
          </div>
        )}
      </div>

      {/* Cụm nút hành động nhanh góc trên phải: Ghim video & Quyền điều hành */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 pointer-events-auto">
        {/* Nút Ghim (Pin) nhanh thành viên lên tiêu điểm */}
        {onTogglePin && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            className={`w-7 h-7 rounded-lg border shadow-sm transition-all cursor-pointer flex items-center justify-center ${
              isPinned
                ? "bg-emerald-500/90 text-slate-950 border-emerald-400 opacity-100"
                : "bg-black/70 hover:bg-black/90 text-white/80 hover:text-white border-white/20 opacity-0 group-hover/tile:opacity-100 focus-within:opacity-100"
            }`}
            title={isPinned ? "Bỏ ghim thành viên" : "Ghim thành viên này"}
            aria-label={isPinned ? "Bỏ ghim" : "Ghim"}
          >
            {isPinned ? (
              <PushPinSlashIcon className="w-3.5 h-3.5" weight="fill" />
            ) : (
              <PushPinIcon className="w-3.5 h-3.5" weight="bold" />
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
            className={`w-7 h-7 rounded-lg border shadow-sm transition-all cursor-pointer flex items-center justify-center ${
              isCover
                ? "bg-amber-500/90 text-slate-950 border-amber-300 opacity-100 shadow-amber-500/20"
                : "bg-black/70 hover:bg-black/90 text-white/80 hover:text-white border-white/20 opacity-0 group-hover/tile:opacity-100 focus-within:opacity-100"
            }`}
            title={isCover ? "Thu về vừa khung (nhấp đúp để đổi)" : "Phóng to lấp đầy (nhấp đúp để đổi)"}
            aria-label={isCover ? "Thu về vừa khung" : "Phóng to lấp đầy"}
          >
            {isCover ? (
              <CornersInIcon className="w-3.5 h-3.5" weight="bold" />
            ) : (
              <CornersOutIcon className="w-3.5 h-3.5" weight="bold" />
            )}
          </button>
        )}

        {/* Nút hành động nhanh của Host & Phó phòng trên thành viên khác (ẩn bớt trên thumbnail nhỏ) */}
        {!isCompact && canModerate && !isLocal && (
          <div className="flex items-center gap-1.5 opacity-0 group-hover/tile:opacity-100 focus-within:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onMute?.(trackRef?.participant?.identity)}
              disabled={isActionPending}
              aria-busy={pendingType === "mute" || undefined}
              className="w-7 h-7 rounded-lg bg-black/70 hover:bg-rose-500/80 text-white border border-white/20 hover:border-rose-400 transition-colors shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-wait flex items-center justify-center"
              title="Tắt micro người này"
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
                onKick?.(
                  trackRef?.participant?.identity,
                  trackRef?.participant?.name || "Học viên"
                )
              }
              disabled={isActionPending}
              aria-busy={pendingType === "kick" || undefined}
              className="w-7 h-7 rounded-lg bg-black/70 hover:bg-rose-500/80 text-white border border-white/20 hover:border-rose-400 transition-colors shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-wait flex items-center justify-center"
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
                onClick={() => onToggleCoHost?.(trackRef?.participant?.identity)}
                disabled={isActionPending}
                aria-busy={pendingType === "co-host" || undefined}
                className={`w-7 h-7 rounded-lg bg-black/70 text-white border border-white/20 transition-colors shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-wait flex items-center justify-center ${
                  isTargetCoHost
                    ? "hover:bg-amber-500/80 text-amber-300"
                    : "hover:bg-sky-500/80 text-sky-300"
                }`}
                title={isTargetCoHost ? "Hủy quyền Phó phòng" : "Bổ nhiệm làm Phó phòng"}
                aria-label="Chỉ định hoặc hủy Phó phòng"
              >
                {pendingType === "co-host" ? (
                  <CircleNotchIcon className="w-3.5 h-3.5 animate-spin" weight="bold" />
                ) : (
                  <StarIcon className="w-3.5 h-3.5" weight={isTargetCoHost ? "fill" : "regular"} />
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {safetyMenu}

      {/* Thông báo phản hồi cử chỉ Vừa khung / Lấp đầy */}
      {feedbackText && (
        <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3.5 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-white text-xs font-semibold shadow-xl flex items-center gap-1.5">
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

// Ô soạn tin tách riêng giữ state `draft` cục bộ: gõ phím chỉ vẽ lại đúng ô này,
// không kéo theo lưới video LiveKit (rất nặng) re-render mỗi ký tự.
function RoomChatComposer({
  onSend,
}: {
  onSend: (text: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const sendingRef = useRef(false);
  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sendingRef.current) return;
    sendingRef.current = true;
    setIsSending(true);
    try {
      await onSend(text);
      setDraft("");
    } catch {
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  };
  return (
    <div className="flex items-center gap-1.5 p-2.5 border-t border-white/10 shrink-0">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSend();
        }}
        placeholder="Nhắn gì đó..."
        maxLength={500}
        className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-white/30"
      />
      <button
        onClick={handleSend}
        disabled={!draft.trim() || isSending}
        aria-busy={isSending || undefined}
        className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-emerald-200 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-wait flex items-center gap-1"
        title={isSending ? "Đang gửi…" : "Gửi"}
      >
        {isSending ? (
          <CircleNotchIcon className="w-3.5 h-3.5 animate-spin" weight="bold" />
        ) : (
          <PaperPlaneTiltIcon className="w-3.5 h-3.5" />
        )}
        <span className="hidden sm:inline">{isSending ? "Đang gửi…" : "Gửi"}</span>
      </button>
    </div>
  );
}

// Khung gọi tiếng Việt: lưới mặt, hàng nút mic/cam/chia sẻ/nhắn tin,
// bảng chat trượt bên phải.
export const StudyRoomView = ({
  roomName,
  onLeave,
  sideBySide = true,
  onDragStart,
  isFullscreen = false,
  onToggleFullscreen,
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
}: StudyRoomViewProps) => {
  const room = useRoomContext();
  const studyState = useMeetStudyState({ soundEnabled, soundType });
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [layoutMode, setLayoutMode] = useState<RoomLayoutMode>("grid");
  const [pinnedTrackId, setPinnedTrackId] = useState<string | null>(null);
  const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const layoutMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi bấm ra ngoài
  useEffect(() => {
    if (!isLayoutMenuOpen && !isMoreMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(target)) {
        setIsLayoutMenuOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(target)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, [isLayoutMenuOpen, isMoreMenuOpen]);
  const [kickTarget, setKickTarget] = useState<{ identity: string; name: string } | null>(null);
  const [isHostControlsOpen, setIsHostControlsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLockedState, setIsLockedState] = useState(initialIsLocked);
  const [hasPasswordState, setHasPasswordState] = useState(initialHasPassword);
  const [pendingAction, setPendingAction] = useState<
    { type: "mute" | "kick" | "co-host"; identity: string } | null
  >(null);
  const pendingActionRef = useRef(false);

  const beginMemberAction = (type: "mute" | "kick" | "co-host", identity?: string) => {
    if (!identity || pendingActionRef.current) return false;
    pendingActionRef.current = true;
    setPendingAction({ type, identity });
    return true;
  };

  const endMemberAction = () => {
    pendingActionRef.current = false;
    setPendingAction(null);
  };

  const handleMuteParticipant = async (identity: string) => {
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
  };

  const handleKickParticipant = async (identity: string) => {
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
  };

  const handleToggleCoHost = async (targetIdentity: string) => {
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
  };

  // Kích hoạt đúng microphone và camera mà người dùng đã chọn từ bước xem trước (Pre-join)
  useEffect(() => {
    if (!room) return;
    applyChosenDevices(room, { audioDeviceId, videoDeviceId });
  }, [room, audioDeviceId, videoDeviceId]);

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
  const { chatMessages, send } = useChat();
  const [chatOpen, setChatOpen] = useState(false);
  const [seenCount, setSeenCount] = useState(0);
  const unreadCount = !chatOpen && chatMessages.length > seenCount
    ? chatMessages.length - seenCount
    : 0;

  const hasExpiredRef = useRef(false);

  const handleSessionExpire = useCallback(() => {
    if (hasExpiredRef.current) return;
    hasExpiredRef.current = true;
    toast.error(`Phiên học đã đạt giới hạn ${sessionMaxMinutes} phút`);
    try {
      room.disconnect();
    } catch {}
    onLeave();
  }, [room, onLeave, sessionMaxMinutes]);

  const toggleChat = () => {
    setChatOpen((v) => {
      if (!v) setSeenCount(chatMessages.length);
      return !v;
    });
  };

  const handleSendMessage = useCallback(
    async (text: string) => {
      await send(text);
    },
    [send]
  );

  // Chặn xong thì rời phòng hiện tại (không ai bị chặn phải ngồi chung).
  const handleBlockedMember = useCallback(() => {
    try {
      room.disconnect();
    } catch {}
    onLeave();
  }, [room, onLeave]);

  const handleCopyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(buildInviteLink(roomName));
      toast.success("Đã copy link mời");
    } catch {
      toast.error("Không thể copy link mời");
    }
  };

  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);

  const handleConfirmLeave = () => {
    setIsLeaveConfirmOpen(true);
  };

  return (
    <div className="relative flex flex-col h-full">
      {/* Phát âm thanh của các thành viên khác trong phòng */}
      <RoomAudioRenderer />

      {/* Banner cảnh báo khi phòng đang kết nối lại (Reconnect) */}
      {isReconnecting && (
        <div className="bg-amber-500/90 text-slate-950 font-bold text-xs py-1.5 px-4 text-center shrink-0 flex items-center justify-center gap-2 animate-pulse shadow-md z-30">
          <CircleNotchIcon className="w-4 h-4 animate-spin text-slate-950" />
          <span>Đang kết nối lại...</span>
        </div>
      )}

      {/* Hiển thị nút bật tiếng nếu trình duyệt chặn tự động phát âm thanh */}
      <StartAudio
        label="🔊 Nhấn vào đây để bật âm thanh phòng học (Trình duyệt đang chặn tự động phát)"
        className="mx-3 mt-2 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-xs font-semibold cursor-pointer transition-colors text-center shrink-0"
      />

      {/* Đầu phòng: tên + nút toàn màn hình + nút rời, cả thanh để kéo thẻ */}
      <div
        onPointerDown={isFullscreen ? undefined : onDragStart}
        className={`relative group/header flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/10 shrink-0 ${
          isFullscreen ? "cursor-default" : "cursor-grab active:cursor-grabbing touch-none"
        }`}
      >
        {!isFullscreen && (
          <div
            className="absolute top-1.5 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center pointer-events-none"
            aria-hidden="true"
          >
            <span className="block h-1 rounded-full transition-all duration-200 ease-out w-10 bg-white/30 group-hover/header:w-16 group-hover/header:bg-white/70" />
          </div>
        )}
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-bold truncate">Phòng: {roomName}</h2>
          <span className="text-[11px] text-slate-400 shrink-0">
            {room.numParticipants} người
          </span>

          {typeof remainingMinutes === "number" && remainingMinutes < 300 && (
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-semibold border border-amber-400/30">
              Còn ~{remainingMinutes}p tháng này
            </span>
          )}

          {/* Đồng hồ phiên: hiển thị thời lượng đã học và đếm ngược hạn mức */}
          <RoomSessionTimer
            sessionMaxMinutes={sessionMaxMinutes}
            onExpire={handleSessionExpire}
          />

          {isFullscreen && (
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold border border-emerald-400/30">
              Toàn màn hình
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Menu 1: Chọn bố cục phòng học (Lưới / Tiêu điểm / Thanh bên) */}
          <div ref={layoutMenuRef} className="relative">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                setIsLayoutMenuOpen((v) => !v);
                setIsMoreMenuOpen(false);
              }}
              className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer select-none active:scale-95 ${
                isLayoutMenuOpen
                  ? "bg-white/20 border-white/30 text-white shadow-sm"
                  : "bg-white/10 hover:bg-white/15 border-white/15 text-white/90 hover:text-white"
              }`}
              title="Thay đổi bố cục phòng học"
              aria-label="Thay đổi bố cục"
              aria-expanded={isLayoutMenuOpen}
            >
              {layoutMode === "grid" ? (
                <SquaresFourIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" weight="bold" />
              ) : layoutMode === "speaker" ? (
                <PresentationIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" weight="bold" />
              ) : (
                <SidebarSimpleIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" weight="bold" />
              )}
              <span className="hidden sm:inline">
                {layoutMode === "grid" ? "Lưới đều" : layoutMode === "speaker" ? "Tiêu điểm" : "Thanh bên"}
              </span>
              <CaretDownIcon className={`w-3 h-3 text-white/60 transition-transform duration-150 ${isLayoutMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {isLayoutMenuOpen && (
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-1.5 z-50 w-52 p-1.5 glass-popover flex flex-col gap-1 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150"
              >
                <div className="px-2.5 py-1 text-[10px] font-bold text-white/50 uppercase tracking-wider">
                  Bố cục phòng học
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLayoutMode("grid");
                    setPinnedTrackId(null);
                    setIsLayoutMenuOpen(false);
                  }}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    layoutMode === "grid" && !pinnedTrackId
                      ? "bg-emerald-500/20 text-emerald-300 font-bold"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <SquaresFourIcon className="w-4 h-4 text-emerald-400 shrink-0" weight="bold" />
                    <span>Lưới đều</span>
                  </div>
                  {layoutMode === "grid" && !pinnedTrackId && <CheckIcon className="w-3.5 h-3.5 text-emerald-400" weight="bold" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLayoutMode("speaker");
                    setIsLayoutMenuOpen(false);
                  }}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    layoutMode === "speaker"
                      ? "bg-emerald-500/20 text-emerald-300 font-bold"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <PresentationIcon className="w-4 h-4 text-emerald-400 shrink-0" weight="bold" />
                    <span>Tiêu điểm</span>
                  </div>
                  {layoutMode === "speaker" && <CheckIcon className="w-3.5 h-3.5 text-emerald-400" weight="bold" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLayoutMode("sidebar");
                    setIsLayoutMenuOpen(false);
                  }}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    layoutMode === "sidebar"
                      ? "bg-emerald-500/20 text-emerald-300 font-bold"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <SidebarSimpleIcon className="w-4 h-4 text-emerald-400 shrink-0" weight="bold" />
                    <span>Thanh bên</span>
                  </div>
                  {layoutMode === "sidebar" && <CheckIcon className="w-3.5 h-3.5 text-emerald-400" weight="bold" />}
                </button>
              </div>
            )}
          </div>

          {/* Menu 2: Tùy chọn khác (Copy link, Lịch sử, Quản lý) */}
          <div ref={moreMenuRef} className="relative">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                setIsMoreMenuOpen((v) => !v);
                setIsLayoutMenuOpen(false);
              }}
              className={`inline-flex items-center justify-center h-8 w-8 rounded-xl border text-xs font-semibold transition-all cursor-pointer select-none active:scale-95 ${
                isMoreMenuOpen
                  ? "bg-white/20 border-white/30 text-white shadow-sm"
                  : "bg-white/10 hover:bg-white/15 border-white/15 text-white/90 hover:text-white"
              }`}
              title="Tùy chọn khác"
              aria-label="Tùy chọn khác"
              aria-expanded={isMoreMenuOpen}
            >
              <DotsThreeVerticalIcon className="w-4 h-4" weight="bold" />
            </button>

            {isMoreMenuOpen && (
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-1.5 z-50 w-52 p-1.5 glass-popover flex flex-col gap-1 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150"
              >
                <div className="px-2.5 py-1 text-[10px] font-bold text-white/50 uppercase tracking-wider">
                  Tùy chọn phòng
                </div>

                <button
                  type="button"
                  onClick={() => {
                    handleCopyInviteLink();
                    setIsMoreMenuOpen(false);
                  }}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-white/85 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-left"
                >
                  <LinkSimpleIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Copy link mời</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsHistoryOpen(true);
                    setIsMoreMenuOpen(false);
                  }}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-white/85 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-left"
                >
                  <ClockCounterClockwiseIcon className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>Lịch sử các phiên học</span>
                </button>

                {(isHost || isCoHost) && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsHostControlsOpen(true);
                      setIsMoreMenuOpen(false);
                    }}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-bold text-amber-300 hover:text-amber-200 hover:bg-amber-500/15 transition-colors cursor-pointer text-left border-t border-white/10 mt-0.5 pt-2"
                  >
                    <ShieldCheckIcon className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Quản lý phòng</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Nút Toàn màn hình */}
          {onToggleFullscreen && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onToggleFullscreen}
              className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 border border-white/15 text-white/90 hover:text-white transition-all cursor-pointer"
              title={isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}
              aria-label={isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}
            >
              {isFullscreen ? (
                <CornersInIcon className="w-4 h-4" />
              ) : (
                <CornersOutIcon className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Nút Rời phòng */}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleConfirmLeave}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 active:scale-95 border border-rose-400/30 text-rose-200 text-xs font-bold transition-all cursor-pointer"
            title="Rời phòng học"
            aria-label="Rời phòng"
          >
            <SignOutIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Rời</span>
          </button>
        </div>
      </div>

      <RoomStudyLayer
        soundEnabled={soundEnabled}
        soundType={soundType}
        studyState={studyState}
        hideHandButton
      />

      {/* Giữa: thẻ rộng thì chat đứng cạnh, thẻ hẹp thì chat nằm dưới */}
      <div className={`flex-1 min-h-0 flex ${sideBySide ? "flex-row" : "flex-col"}`}>
        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto p-3 sm:p-4 custom-study-scroll">
                    {(() => {
            if (tracks.length === 0) {
              return (
                <div className="h-full flex items-center justify-center">
                  <p className="text-xs text-slate-400">Đang chờ mọi người vào...</p>
                </div>
              );
            }

            const handleTogglePinTrack = (trackId: string) => {
              if (pinnedTrackId === trackId) {
                setPinnedTrackId(null);
              } else {
                setPinnedTrackId(trackId);
                if (layoutMode === "grid") {
                  setLayoutMode("speaker");
                }
              }
            };

            const renderParticipantTile = (track: any, isCompact = false) => {
              const trackId = getTrackReferenceId(track);
              const isPinned = pinnedTrackId === trackId;
              return (
                <RoomParticipantTile
                  key={trackId}
                  trackRef={track}
                  localRole={userRole}
                  canModerate={isHost || isCoHost}
                  isLocalHost={isHost}
                  onMute={handleMuteParticipant}
                  onKick={(id: string, name: string) => setKickTarget({ identity: id, name })}
                  onToggleCoHost={handleToggleCoHost}
                  pendingAction={pendingAction}
                  isPinned={isPinned}
                  onTogglePin={() => handleTogglePinTrack(trackId)}
                  isCompact={isCompact}
                  safetyMenu={
                    track.participant && !track.participant.isLocal ? (
                      <MemberSafetyMenu
                        getToken={getIdToken}
                        roomName={roomName}
                        targetUid={String(track.participant.identity || "").replace(/^user-/, "")}
                        targetName={track.participant.name || "Thành viên"}
                        onBlocked={handleBlockedMember}
                      />
                    ) : null
                  }
                />
              );
            };

            // Tìm track chia sẻ màn hình nếu có (ưu tiên số 1)
            const screenShareTrack = tracks.find((t) => t.source === Track.Source.ScreenShare);
            const pinnedTrack = pinnedTrackId ? tracks.find((t) => getTrackReferenceId(t) === pinnedTrackId) : null;
            const mainTrack = screenShareTrack || pinnedTrack || tracks[0];
            const otherTracks = tracks.filter((t) => getTrackReferenceId(t) !== getTrackReferenceId(mainTrack));

            if (layoutMode === "speaker" && mainTrack) {
              return (
                <div className="flex flex-col gap-2 h-full min-h-0">
                  <div className="flex-1 min-h-0 w-full rounded-2xl">
                    {renderParticipantTile(mainTrack, false)}
                  </div>
                  {otherTracks.length > 0 && (
                    <div className="h-28 sm:h-32 shrink-0 flex gap-2 overflow-x-auto custom-study-scroll pb-1 pt-2">
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

            if (layoutMode === "sidebar" && mainTrack) {
              return (
                <div className="flex flex-row gap-2 h-full min-h-0">
                  <div className="flex-1 min-w-0 h-full rounded-2xl">
                    {renderParticipantTile(mainTrack, false)}
                  </div>
                  {otherTracks.length > 0 && (
                    <div className="w-36 sm:w-48 shrink-0 flex flex-col gap-2 overflow-y-auto custom-study-scroll pr-1 pt-2">
                      {otherTracks.map((track) => (
                        <div key={getTrackReferenceId(track)} className="w-full aspect-[4/3] shrink-0">
                          {renderParticipantTile(track, true)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            // Mặc định: Lưới đều
            return (
              <div
                className={`grid gap-2 h-full auto-rows-fr ${
                  tracks.length <= 1
                    ? "grid-cols-1"
                    : tracks.length <= 4
                      ? "grid-cols-2"
                      : "grid-cols-3"
                }`}
              >
                {tracks.map((track) => renderParticipantTile(track))}
              </div>
            );
          })()}
        </div>

        {chatOpen && (
          <div
            className={`shrink-0 flex flex-col bg-black/60 backdrop-blur-2xl overflow-hidden ${
              sideBySide
                ? "w-72 m-2 ml-0 rounded-2xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                : "h-56 border-t border-white/15"
            }`}
          >
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10 shrink-0">
              <h3 className="text-xs font-bold">Nhắn tin</h3>
              <button
                onClick={() => setChatOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Đóng chat"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5 custom-study-scroll select-text">
              {chatMessages.length === 0 && (
                <p className="text-[11px] text-slate-500 text-center pt-6">
                  Chưa có tin nhắn nào. Chào mọi người đi!
                </p>
              )}
              {chatMessages.map((m, idx) => (
                <div key={`${m.timestamp}-${idx}`} className="space-y-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-200 truncate">
                      {m.from?.name || m.from?.identity || "Bạn mới"}
                    </span>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {formatTime(m.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-100 leading-relaxed break-words">
                    {m.message}
                  </p>
                </div>
              ))}
            </div>
            <RoomChatComposer onSend={handleSendMessage} />
          </div>
        )}
      </div>

      {/* Đáy: mic, cam, chia sẻ, nhắn tin */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 px-3 py-3 border-t border-white/10 shrink-0">
        <div className="flex flex-col items-center gap-1">
          <TrackToggle
            source={Track.Source.Microphone}
            className="w-11 h-11 p-0 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 text-white flex items-center justify-center cursor-pointer shadow-[0_2px_12px_rgba(0,0,0,0.6)] [&_svg]:w-4 [&_svg]:h-4 [&_svg]:scale-125 [&_svg]:shrink-0 aria-pressed:bg-emerald-500/25 aria-pressed:border-emerald-400/40 aria-pressed:text-emerald-300"
          />
          <span className="text-[10px] text-slate-400 font-medium">Mic</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <TrackToggle
            source={Track.Source.Camera}
            className="w-11 h-11 p-0 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 text-white flex items-center justify-center cursor-pointer shadow-[0_2px_12px_rgba(0,0,0,0.6)] [&_svg]:w-4 [&_svg]:h-4 [&_svg]:scale-125 [&_svg]:shrink-0 aria-pressed:bg-emerald-500/25 aria-pressed:border-emerald-400/40 aria-pressed:text-emerald-300"
          />
          <span className="text-[10px] text-slate-400 font-medium">Cam</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <TrackToggle
            source={Track.Source.ScreenShare}
            captureOptions={{ audio: true }}
            className="w-11 h-11 p-0 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 text-white flex items-center justify-center cursor-pointer shadow-[0_2px_12px_rgba(0,0,0,0.6)] [&_svg]:w-5 [&_svg]:h-4 [&_svg]:shrink-0 aria-pressed:bg-emerald-500/25 aria-pressed:border-emerald-400/40 aria-pressed:text-emerald-300"
          />
          <span className="text-[10px] text-slate-400 font-medium">Chia sẻ</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={studyState.toggleHand}
            className={`relative w-11 h-11 p-0 rounded-full border flex items-center justify-center cursor-pointer transition-colors shadow-[0_2px_12px_rgba(0,0,0,0.6)] ${
              studyState.local.handRaised
                ? "bg-amber-500/25 border-amber-400/50 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.4)]"
                : "bg-white/15 hover:bg-white/25 border-white/25 text-white"
            }`}
            title={studyState.local.handRaised ? "Hạ tay xuống" : "Giơ tay phát biểu"}
            aria-label={studyState.local.handRaised ? "Hạ tay" : "Giơ tay"}
          >
            <HandWavingIcon
              className={`w-5 h-5 ${studyState.local.handRaised ? "text-amber-300 animate-bounce" : "text-white"}`}
              weight={studyState.local.handRaised ? "fill" : "bold"}
            />
            {studyState.handRaisedCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center shadow-md">
                {studyState.handRaisedCount}
              </span>
            )}
          </button>
          <span className="text-[10px] text-slate-400 font-medium">Giơ tay</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={toggleChat}
            className={`relative w-11 h-11 rounded-full border flex items-center justify-center cursor-pointer transition-colors shadow-[0_2px_12px_rgba(0,0,0,0.6)] ${
              chatOpen
                ? "bg-white/25 border-white/35 text-white"
                : "bg-white/15 hover:bg-white/25 border-white/25 text-white"
            }`}
            title="Nhắn tin"
          >
            <ChatTextIcon className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          <span className="text-[10px] text-slate-400 font-medium">Nhắn tin</span>
        </div>
      </div>

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
        description={`Bạn có chắc chắn muốn ngắt kết nối và rời khỏi phòng "${roomName}" không?`}
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
};
