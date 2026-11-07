"use client";

import { useState, useRef, useEffect, useCallback, startTransition, memo } from "react";
import {
  useChat,
  useRoomContext,
  useTracks,
  RoomAudioRenderer,
  StartAudio,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { Track, RoomEvent } from "livekit-client";
import { getTrackReferenceId } from "@livekit/components-core";
import {
  SparkleIcon,
  CircleNotchIcon,
  LinkSimpleIcon,
  CheckIcon,
  ArrowsInSimpleIcon,
  ArrowsOutSimpleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
import { useMobileSheetShell } from "../sheets/core";
import {
  MobileParticipantTile,
  type PendingActionType,
} from "./components/MobileParticipantTile";
import { MobileRoomChatDrawer } from "./components/MobileRoomChatDrawer";
import { MobileRoomControlBar } from "./components/MobileRoomControlBar";
import { MobileRoomMenu } from "./components/MobileRoomMenu";

export type MobileRoomLayoutMode = "grid" | "speaker";

interface MobileRoomViewProps {
  roomName: string;
  onLeave: () => void;
  onClose?: () => void;
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
 * Màn hình phòng học nhóm trên điện thoại (Mobile Room View).
 * Điều phối lưới video, thanh công cụ điều khiển, menu tiện ích và ngăn kéo chat.
 */
function MobileRoomViewBase({
  roomName,
  onLeave,
  onClose,
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
  const sheetShell = useMobileSheetShell();
  const handleCloseSheet = onClose || sheetShell?.onClose;
  const studyState = useMeetStudyState({ soundEnabled, soundType });
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [canShareScreen, setCanShareScreen] = useState(false);
  const [kickTarget, setKickTarget] = useState<{ identity: string; name: string } | null>(null);
  const [coHostTarget, setCoHostTarget] = useState<{
    identity: string;
    name: string;
    isCoHost: boolean;
  } | null>(null);
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
        setLayoutMode("grid");
        return null;
      }
      setLayoutMode("speaker");
      return trackId;
    });
  }, []);

  const handleSelectLayout = useCallback((mode: MobileRoomLayoutMode) => {
    setLayoutMode(mode);
    if (mode === "grid") {
      setPinnedTrackId(null);
    }
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
        setCoHostTarget(null);
        endMemberAction();
      }
    },
    [room, getIdToken, roomName, beginMemberAction, endMemberAction]
  );

  const handleSelectKickTarget = useCallback((identity: string, name: string) => {
    setKickTarget({ identity, name });
  }, []);

  const handleSelectCoHostTarget = useCallback(
    (identity: string, name: string, isCoHost: boolean) => {
      setCoHostTarget({ identity, name, isCoHost });
    },
    []
  );

  // Kích hoạt đúng mic/cam
  useEffect(() => {
    if (!room) return;
    applyChosenDevices(room, { audioDeviceId, videoDeviceId });
  }, [room, audioDeviceId, videoDeviceId]);

  // Kiểm tra hỗ trợ chia sẻ màn hình trên mobile
  useEffect(() => {
    if (
      typeof navigator !== "undefined" &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getDisplayMedia === "function"
    ) {
      setCanShareScreen(true);
    }
  }, []);

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

  // Tự động chuyển về Lưới đều nếu thành viên được ghim rời phòng
  useEffect(() => {
    if (pinnedTrackId && !tracks.some((t) => getTrackReferenceId(t) === pinnedTrackId)) {
      setPinnedTrackId(null);
      setLayoutMode("grid");
    }
  }, [tracks, pinnedTrackId]);

  const videoColumns = tracks.length <= 2 ? 1 : 2;
  const videoRows = Math.max(1, Math.ceil(tracks.length / videoColumns));

  const { chatMessages, send } = useChat();
  const [chatOpen, setChatOpen] = useState(false);
  const [seenCount, setSeenCount] = useState(0);
  const [copied, setCopied] = useState(false);

  const hasExpiredRef = useRef(false);

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

  const handleSendChatMessage = useCallback(
    async (text: string) => {
      await send(text);
    },
    [send]
  );

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

      {/* Banner cảnh báo khi phòng đang kết nối lại */}
      {isReconnecting && (
        <div className="bg-amber-500/90 text-slate-950 font-bold text-xs py-1.5 px-3 text-center shrink-0 flex items-center justify-center gap-2 animate-pulse shadow-md z-30">
          <CircleNotchIcon className="w-4 h-4 animate-spin text-slate-950" />
          <span>Đang kết nối lại...</span>
        </div>
      )}

      {/* Thông báo nếu trình duyệt chặn tự phát âm thanh */}
      <StartAudio
        label="🔊 Chạm vào đây để nghe tiếng bạn bè"
        className="mx-3 mt-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-medium cursor-pointer text-center shrink-0 z-30"
      />

      {/* Thanh tiêu đề hợp nhất (Dòng 1): Tên phòng + Capsule Thời gian & Số người + Menu phòng + Zen Mode + Đóng */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.12] shrink-0 bg-transparent gap-2 select-none">
        {/* Bên trái: Tên phòng + Vạch ngăn + Capsule số người & thời gian + badge còn lại */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1 justify-start">
          <h2
            className="text-sm font-bold text-white tracking-tight truncate max-w-[120px] sm:max-w-[160px]"
            title={roomName}
          >
            {roomName}
          </h2>

          <div className="h-3 w-px bg-white/15 shrink-0" />

          <RoomSessionTimer
            sessionMaxMinutes={sessionMaxMinutes}
            onExpire={handleSessionExpire}
            participantsCount={room.numParticipants}
            compact
          />

          {typeof remainingMinutes === "number" && remainingMinutes < 300 && (
            <span className="text-[10px] text-amber-300 bg-amber-500/15 border border-amber-400/25 px-1.5 py-0.5 rounded-full shrink-0 font-medium">
              ~{remainingMinutes}p
            </span>
          )}
        </div>

        {/* Bên phải: Nút Tiện ích phòng (⋮) + Nút Zen mode + Nút Đóng */}
        <div className="flex items-center justify-end gap-1.5 shrink-0">
          <MobileRoomMenu
            isOpen={isRoomMenuOpen}
            onToggle={() => setIsRoomMenuOpen((v) => !v)}
            onClose={() => setIsRoomMenuOpen(false)}
            layoutMode={layoutMode}
            onSelectLayout={handleSelectLayout}
            onCopyInvite={handleCopyInviteLink}
            copied={copied}
            onOpenHistory={() => setIsHistoryOpen(true)}
            onOpenHostControls={() => setIsHostControlsOpen(true)}
            canModerate={isHost || isCoHost}
          />

          {sheetShell && (
            <button
              type="button"
              onClick={() => {
                startTransition(() => {
                  sheetShell.toggleZenMode();
                });
              }}
              title={sheetShell.isZenMode ? "Thu gọn về dạng khay đáy" : "Mở rộng không gian Zen (Toàn màn hình)"}
              aria-label="Chuyển chế độ xem"
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 border border-white/15 flex items-center justify-center text-white/80 hover:text-white transition-[background-color,border-color,transform] duration-75 shadow-sm cursor-pointer touch-manipulation"
            >
              <span className={cn("inline-flex transition-transform duration-300 ease-out", sheetShell.isZenMode ? "rotate-180 scale-105" : "rotate-0 scale-100")}>
                {sheetShell.isZenMode ? (
                  <ArrowsInSimpleIcon className="w-3.5 h-3.5" weight="bold" />
                ) : (
                  <ArrowsOutSimpleIcon className="w-3.5 h-3.5" weight="bold" />
                )}
              </span>
            </button>
          )}

          {handleCloseSheet && (
            <button
              type="button"
              onClick={() => {
                startTransition(() => {
                  handleCloseSheet();
                });
              }}
              aria-label={`Đóng ${roomName}`}
              title="Đóng bảng"
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 border border-white/15 flex items-center justify-center text-white/80 hover:text-white transition-[background-color,border-color,transform] duration-75 shadow-sm cursor-pointer touch-manipulation"
            >
              <XIcon className="w-4 h-4" weight="bold" />
            </button>
          )}
        </div>
      </div>

      {/* Thanh tương tác học tập di động: Pomodoro, Trạng thái, Mục tiêu */}
      <RoomStudyLayer
        compact
        soundEnabled={soundEnabled}
        soundType={soundType}
        studyState={studyState}
        hideHandButton
      />

      {/* Vùng hiển thị Video các thành viên */}
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
                className={`relative w-full h-full min-h-0 min-w-0 rounded-2xl border bg-white/[0.04] transition-all duration-300 ease-out ${
                  isPinned
                    ? "border-emerald-400/50 shadow-[0_0_12px_rgba(52,211,153,0.12)]"
                    : "border-white/15 shadow-md"
                } ${
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
                  onToggleCoHost={handleSelectCoHostTarget}
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

          // Chế độ Tiêu điểm (Speaker) khi ghim màn hình hoặc chọn tiêu điểm
          if (layoutMode === "speaker" && mainTrack) {
            return (
              <div className="flex flex-col gap-2 h-full w-full min-h-0 animate-in fade-in-50 duration-300 ease-out">
                <div className="flex-1 min-h-0 w-full rounded-2xl transition-all duration-300 ease-out animate-in zoom-in-[0.98]">
                  {renderParticipantTile(mainTrack, false)}
                </div>
                {otherTracks.length > 0 && (
                  <div className="h-24 shrink-0 flex gap-2 overflow-x-auto custom-study-scroll pb-1 pt-2 animate-in slide-in-from-bottom-2 fade-in-50 duration-300 ease-out">
                    {otherTracks.map((track) => (
                      <div key={getTrackReferenceId(track)} className="h-full aspect-[4/3] shrink-0 transition-transform duration-200">
                        {renderParticipantTile(track, true)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          // Chế độ Lưới đều (Grid)
          return (
            <div
              className={`w-full h-full overflow-y-auto custom-study-scroll rounded-2xl grid gap-2 p-1 animate-in fade-in-50 zoom-in-[0.99] duration-300 ease-out ${
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

      {/* Thanh điều khiển cuộc gọi dưới đáy */}
      <MobileRoomControlBar
        micEnabled={micEnabled}
        setMicEnabled={setMicEnabled}
        camEnabled={camEnabled}
        setCamEnabled={setCamEnabled}
        canShareScreen={canShareScreen}
        studyState={studyState}
        chatOpen={chatOpen}
        onToggleChat={toggleChat}
        unreadCount={unreadCount}
        onLeaveRoom={handleLeaveRoom}
      />

      {/* Ngăn kéo chat trượt lên từ đáy */}
      <MobileRoomChatDrawer
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        chatMessages={chatMessages}
        localIdentity={room?.localParticipant?.identity}
        onSend={handleSendChatMessage}
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

      {/* Hộp thoại xác nhận bổ nhiệm hoặc hủy Phó phòng */}
      <ConfirmDeleteModal
        isOpen={Boolean(coHostTarget)}
        pending={pendingAction?.type === "co-host"}
        onClose={() => {
          if (pendingActionRef.current) return;
          setCoHostTarget(null);
        }}
        onConfirm={() => coHostTarget && handleToggleCoHost(coHostTarget.identity)}
        title={coHostTarget?.isCoHost ? "Hủy quyền Phó phòng" : "Bổ nhiệm Phó phòng"}
        description={
          coHostTarget?.isCoHost
            ? `Bạn có chắc muốn hủy quyền Phó phòng của "${coHostTarget?.name}" không?`
            : `Bạn có chắc muốn bổ nhiệm "${coHostTarget?.name}" làm Phó phòng không? Phó phòng có thể hỗ trợ quản lý phòng học và tắt micro thành viên khác.`
        }
        confirmText={coHostTarget?.isCoHost ? "Hủy quyền" : "Bổ nhiệm"}
        cancelText="Hủy"
        confirmClassName={
          coHostTarget?.isCoHost
            ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/30"
            : "bg-sky-600 hover:bg-sky-500 shadow-sky-600/30"
        }
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
