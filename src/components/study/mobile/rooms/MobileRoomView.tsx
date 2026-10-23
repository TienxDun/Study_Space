"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ParticipantTile,
  TrackToggle,
  useChat,
  useRoomContext,
  useTracks,
  RoomAudioRenderer,
  StartAudio,
  useMaybeTrackRefContext,
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
  ClockCounterClockwiseIcon,
  MicrophoneSlashIcon,
  UserMinusIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import type { PomodoroSoundType } from "@/components/study/study-sound";
import { RoomSessionTimer } from "../../rooms/components/RoomSessionTimer";
import { buildInviteLink, getMeetEndpoints } from "@/lib/meet-invite";
import { RoomStudyLayer } from "../../rooms/components/RoomStudyLayer";
import { MEET_ATTR } from "../../rooms/utils/meet-protocol";
import { RoomHostControlsModal } from "../../rooms/components/RoomHostControlsModal";
import { RoomHistoryModal } from "../../rooms/components/RoomHistoryModal";

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

function MobileParticipantTile({
  trackRef,
  localRole,
  canModerate,
  isLocalHost,
  onMute,
  onKick,
  onToggleCoHost,
  ...rest
}: any) {
  const contextTrackRef = useMaybeTrackRefContext();
  const resolvedTrackRef = trackRef ?? contextTrackRef;
  const attrs = resolvedTrackRef?.participant?.attributes;
  const status = attrs?.[MEET_ATTR.status];
  const isHandRaised = attrs?.[MEET_ATTR.hand] === "1";
  const goal = (attrs?.[MEET_ATTR.goal] || "").trim();
  const isLocal = resolvedTrackRef?.participant?.isLocal;

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

  return (
    <div className="relative w-full h-full group/tile">
      <ParticipantTile trackRef={resolvedTrackRef} className="w-full h-full" {...rest} />

      {/* Huy hiệu vai trò, trạng thái, giơ tay và mục tiêu góc trên trái (mobile nhỏ gọn) */}
      <div className="absolute top-1.5 left-1.5 z-10 pointer-events-none flex items-center gap-1 max-w-[calc(100%-4rem)] flex-wrap">
        {isTargetHost && (
          <div
            className="px-1 py-0.5 rounded bg-amber-500/90 text-slate-950 font-bold text-[9px] flex items-center gap-0.5 shadow-sm border border-amber-300 pointer-events-auto"
            title="Trưởng phòng"
          >
            <CrownIcon className="w-2.5 h-2.5 text-slate-950" weight="fill" />
            <span>Host</span>
          </div>
        )}

        {isTargetCoHost && (
          <div
            className="px-1 py-0.5 rounded bg-sky-500/90 text-white font-bold text-[9px] flex items-center gap-0.5 shadow-sm border border-sky-300 pointer-events-auto"
            title="Phó phòng"
          >
            <StarIcon className="w-2.5 h-2.5 text-white" weight="fill" />
            <span>Phó</span>
          </div>
        )}

        {isHandRaised && (
          <div
            className="p-0.5 rounded bg-amber-500/90 text-slate-950 flex items-center justify-center shadow-md animate-bounce"
            title="Đang giơ tay phát biểu"
          >
            <HandWavingIcon className="w-3 h-3" weight="fill" />
          </div>
        )}

        {statusLabel && (
          <div
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border backdrop-blur-md shadow-sm truncate ${
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

        {/* Mục tiêu học tập cá nhân hiển thị thực sự trên mobile */}
        {goal && (
          <div
            className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-black/70 backdrop-blur-md border border-teal-400/40 text-teal-200 shadow-sm flex items-center gap-1 max-w-[100px] truncate pointer-events-auto"
            title={`Mục tiêu: ${goal}`}
          >
            <TargetIcon className="w-2.5 h-2.5 text-teal-400 shrink-0" weight="bold" />
            <span className="truncate">{goal}</span>
          </div>
        )}
      </div>

      {/* Nút hành động nhanh của Host & Phó phòng trên mobile */}
      {canModerate && !isLocal && (
        <div className="absolute top-1.5 right-1.5 z-20 flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMute?.(resolvedTrackRef?.participant?.identity)}
            className="p-1 rounded bg-black/70 active:bg-rose-500/80 text-white border border-white/20 transition-colors shadow-sm"
            title="Tắt micro"
            aria-label="Tắt micro"
          >
            <MicrophoneSlashIcon className="w-2.5 h-2.5" />
          </button>
          <button
            type="button"
            onClick={() =>
              onKick?.(
                resolvedTrackRef?.participant?.identity,
                resolvedTrackRef?.participant?.name || "Học viên"
              )
            }
            className="p-1 rounded bg-black/70 active:bg-rose-500/80 text-white border border-white/20 transition-colors shadow-sm"
            title="Mời rời phòng"
            aria-label="Mời rời phòng"
          >
            <UserMinusIcon className="w-2.5 h-2.5" />
          </button>
          {isLocalHost && (
            <button
              type="button"
              onClick={() => onToggleCoHost?.(resolvedTrackRef?.participant?.identity)}
              className={`p-1 rounded bg-black/70 text-white border border-white/20 transition-colors shadow-sm ${
                isTargetCoHost ? "text-amber-300" : "text-sky-300"
              }`}
              title={isTargetCoHost ? "Hủy quyền Phó phòng" : "Bổ nhiệm Phó phòng"}
              aria-label="Chỉ định hoặc hủy Phó phòng"
            >
              <StarIcon className="w-2.5 h-2.5" weight={isTargetCoHost ? "fill" : "regular"} />
            </button>
          )}
        </div>
      )}

    </div>
  );
}

export function MobileRoomView({
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
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [canShareScreen, setCanShareScreen] = useState(false);
  const [kickTarget, setKickTarget] = useState<{ identity: string; name: string } | null>(null);
  const [isHostControlsOpen, setIsHostControlsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLockedState, setIsLockedState] = useState(initialIsLocked);
  const [hasPasswordState, setHasPasswordState] = useState(initialHasPassword);

  const handleMuteParticipant = async (identity: string) => {
    const { baseUrl } = getMeetEndpoints();
    if (!baseUrl || !identity || !getIdToken) return;
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
    }
  };

  const handleKickParticipant = async (identity: string) => {
    const { baseUrl } = getMeetEndpoints();
    if (!baseUrl || !identity || !getIdToken) return;
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
      setKickTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Thao tác thất bại");
    }
  };

  const handleToggleCoHost = async (targetIdentity: string) => {
    const { baseUrl } = getMeetEndpoints();
    if (!baseUrl || !targetIdentity || !getIdToken) return;
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
    }
  };

  // Kích hoạt đúng microphone và camera mà người dùng đã chọn từ bước xem trước (Pre-join)
  useEffect(() => {
    if (!room) return;
    if (audioDeviceId) {
      room.switchActiveDevice("audioinput", audioDeviceId).catch(() => {});
    }
    if (videoDeviceId) {
      room.switchActiveDevice("videoinput", videoDeviceId).catch(() => {});
    }
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

  const { chatMessages, send } = useChat();
  const [chatOpen, setChatOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [seenCount, setSeenCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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
    if (!text) return;
    try {
      await send(text);
      setDraft("");
    } catch {}
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
    <div className="relative flex flex-col h-full w-full bg-[#111827] text-white overflow-hidden select-none">
      {/* Phát âm thanh LiveKit */}
      <RoomAudioRenderer />

      {/* Banner cảnh báo khi phòng đang kết nối lại (Reconnect) */}
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

      {/* Thanh trạng thái phụ siêu tinh gọn (chỉ hiện số người, đồng hồ phiên độc lập & nút copy link mời) */}
      <div className="flex items-center justify-between px-3.5 py-1.5 text-xs border-b border-white/[0.08] shrink-0 bg-white/[0.02] gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-[11px] text-slate-300 font-medium truncate">
            {room.numParticipants} bạn
          </span>
          {/* Đồng hồ phiên cô lập: tính theo Date.now(), chuyển tab không mất giờ, ngắt 1 lần */}
          <RoomSessionTimer
            sessionMaxMinutes={sessionMaxMinutes}
            onExpire={handleSessionExpire}
            compact
          />
          {typeof remainingMinutes === "number" && remainingMinutes < 300 && (
            <span className="text-[10px] text-amber-300 bg-amber-500/15 border border-amber-400/25 px-1.5 py-0.5 rounded truncate">
              Còn ~{remainingMinutes}p
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            className="h-6 px-1.5 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-[10px] font-medium text-slate-300 hover:text-white flex items-center gap-1 transition-all cursor-pointer"
            title="Lịch sử phòng"
          >
            <ClockCounterClockwiseIcon className="w-3 h-3 text-emerald-400" />
            <span>Lịch sử</span>
          </button>

          {(isHost || isCoHost) && (
            <button
              type="button"
              onClick={() => setIsHostControlsOpen(true)}
              className="h-6 px-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 active:scale-95 border border-amber-400/25 text-[10px] font-bold text-amber-300 flex items-center gap-1 transition-all cursor-pointer"
              title="Quản lý phòng"
            >
              <ShieldCheckIcon className="w-3 h-3 text-amber-400" />
              <span>Quản lý</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyInviteLink}
            className="h-6 px-2 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-[11px] font-medium text-slate-300 hover:text-white flex items-center gap-1 transition-all cursor-pointer shrink-0"
            title="Sao chép link mời phòng"
          >
            {copied ? (
              <>
                <CheckIcon className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Đã chép</span>
              </>
            ) : (
              <>
                <LinkSimpleIcon className="w-3 h-3 text-emerald-400" />
                <span>Link mời</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Thanh công cụ tương tác học tập di động: Pomodoro, Trạng thái, Giơ tay, Mục tiêu, Reaction (Phase 2) */}
      <RoomStudyLayer compact soundEnabled={soundEnabled} soundType={soundType} />

      {/* Vùng hiển thị Video các thành viên (Mở rộng tối đa không gian) */}
      <main className="flex-1 min-h-0 relative p-2 overflow-hidden flex flex-col justify-center">
        {tracks.length > 0 ? (
          <div className="w-full h-full overflow-y-auto custom-study-scroll rounded-2xl grid gap-2 grid-cols-1 p-2 content-start">
            {tracks.map((track) => (
              <div
                key={getTrackReferenceId(track)}
                className="rounded-2xl border border-white/15 overflow-hidden bg-slate-900/90 shadow-md aspect-video"
              >
                <MobileParticipantTile
                  trackRef={track}
                  localRole={userRole}
                  canModerate={isHost || isCoHost}
                  isLocalHost={isHost}
                  onMute={handleMuteParticipant}
                  onKick={(id: string, name: string) => setKickTarget({ identity: id, name })}
                  onToggleCoHost={handleToggleCoHost}
                />
              </div>
            ))}
          </div>
        ) : (
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
        )}
      </main>

      {/* Thanh điều khiển cuộc gọi dưới đáy */}
      <footer className="shrink-0 py-1.5 px-3 flex items-center justify-center z-20">
        <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-full bg-slate-900/95 backdrop-blur-2xl border border-white/20 shadow-[0_8px_30px_rgba(0,0,0,0.85)]">
          {/* Nút Micro */}
          <TrackToggle
            source={Track.Source.Microphone}
            onChange={(enabled) => setMicEnabled(enabled)}
            className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-all [&_svg]:w-4.5 [&_svg]:h-4.5 ${
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
            className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-all [&_svg]:w-4.5 [&_svg]:h-4.5 ${
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
              className="w-9 h-9 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/20 text-white/90 flex items-center justify-center cursor-pointer active:scale-95 transition-all [&_svg]:w-4.5 [&_svg]:h-4.5 aria-pressed:bg-emerald-400/15 aria-pressed:border-emerald-400/70 aria-pressed:text-emerald-300 aria-pressed:shadow-[0_0_20px_rgba(52,211,153,0.35)]"
              title="Chia sẻ màn hình"
            />
          )}

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

      {/* Khung chat trượt lên từ đáy (In-Room Mobile Chat Drawer) */}
      {chatOpen && (
        <div className="absolute inset-x-0 bottom-0 h-[65%] bg-slate-950/95 backdrop-blur-3xl border-t border-white/20 rounded-t-3xl shadow-[0_-16px_50px_rgba(0,0,0,0.85)] flex flex-col z-30 animate-in slide-in-from-bottom duration-250 ease-out">
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
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-2.5 custom-study-scroll">
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <p className="text-xs text-slate-400">Chưa có tin nhắn nào.</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Gửi lời chào đầu tiên tới các bạn học nhé! 👋
                </p>
              </div>
            ) : (
              chatMessages.map((m, idx) => {
                const isMe = m.from?.identity === room.localParticipant.identity;
                return (
                  <div
                    key={`${m.timestamp}-${idx}`}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-baseline gap-1.5 mb-0.5 px-1">
                      <span className="text-[11px] font-bold text-slate-300">
                        {isMe ? "Bạn" : m.from?.name || m.from?.identity || "Thành viên"}
                      </span>
                      <span className="text-[9px] text-slate-500">
                        {formatTime(m.timestamp)}
                      </span>
                    </div>
                    <div
                      className={`max-w-[82%] px-3 py-1.5 rounded-2xl text-xs leading-relaxed break-words ${
                        isMe
                          ? "bg-emerald-500/25 border border-emerald-400/30 text-emerald-100 rounded-tr-sm"
                          : "bg-white/10 border border-white/10 text-slate-100 rounded-tl-sm"
                      }`}
                    >
                      {m.message}
                    </div>
                  </div>
                );
              })
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
              disabled={!draft.trim()}
              className="w-8.5 h-8.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              title="Gửi tin nhắn"
            >
              <PaperPlaneTiltIcon className="w-3.5 h-3.5" weight="fill" />
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
        onClose={() => setKickTarget(null)}
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
