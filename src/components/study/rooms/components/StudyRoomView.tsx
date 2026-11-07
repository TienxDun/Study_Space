"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import {
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
  CornersOutIcon,
  CornersInIcon,
  LinkSimpleIcon,
  CircleNotchIcon,
  ShieldCheckIcon,
  ClockCounterClockwiseIcon,
  SquaresFourIcon,
  PresentationIcon,
  SidebarSimpleIcon,
  CaretDownIcon,
  DotsThreeVerticalIcon,
  CheckIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import type { PomodoroSoundType } from "@/components/study/study-sound";
import { RoomSessionTimer } from "./RoomSessionTimer";
import { buildInviteLink, getMeetEndpoints } from "@/lib/meet-invite";
import { RoomStudyLayer } from "./RoomStudyLayer";
import { useMeetStudyState } from "../hooks/useMeetStudyState";
import { applyChosenDevices } from "../utils/room-devices";
import { RoomHostControlsModal } from "./RoomHostControlsModal";
import { MemberSafetyMenu } from "./MemberSafetyMenu";
import { RoomHistoryModal } from "./RoomHistoryModal";
import { RoomParticipantTile } from "./RoomParticipantTile";
import { RoomChatSidebar } from "./RoomChatSidebar";
import { RoomControlBar } from "./RoomControlBar";

export type RoomLayoutMode = "grid" | "speaker" | "sidebar";

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

/**
 * Giao diện chính của phòng học video trực tuyến (Desktop Room View).
 * Điều phối bố cục video (lưới đều, tiêu điểm, thanh bên), chat, điều khiển mic/cam và bảo vệ phòng.
 */
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

  // Kích hoạt đúng microphone và camera mà người dùng đã chọn
  useEffect(() => {
    if (!room) return;
    applyChosenDevices(room, { audioDeviceId, videoDeviceId });
  }, [room, audioDeviceId, videoDeviceId]);

  // Lắng nghe trạng thái tái kết nối
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

  return (
    <div className="relative flex flex-col h-full">
      {/* Phát âm thanh của các thành viên khác trong phòng */}
      <RoomAudioRenderer />

      {/* Banner cảnh báo khi phòng đang kết nối lại */}
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
          {/* Menu 1: Chọn bố cục phòng học */}
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

          {/* Menu 2: Tùy chọn khác */}
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
            onClick={() => setIsLeaveConfirmOpen(true)}
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

      {/* Thân phòng: video và thanh chat */}
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
          <RoomChatSidebar
            sideBySide={sideBySide}
            chatMessages={chatMessages}
            onClose={() => setChatOpen(false)}
            onSend={handleSendMessage}
          />
        )}
      </div>

      {/* Đáy: mic, cam, chia sẻ, giơ tay, nhắn tin */}
      <RoomControlBar
        studyState={studyState}
        chatOpen={chatOpen}
        onToggleChat={toggleChat}
        unreadCount={unreadCount}
      />

      {/* Hộp thoại xác nhận rời phòng học */}
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
