"use client";

import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import {
  ParticipantTile,
  useMaybeTrackRefContext,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  CrownIcon,
  StarIcon,
  HandWavingIcon,
  TargetIcon,
  PushPinIcon,
  PushPinSlashIcon,
  CornersInIcon,
  CornersOutIcon,
  CircleNotchIcon,
  MicrophoneSlashIcon,
  UserMinusIcon,
} from "@phosphor-icons/react";
import { MEET_ATTR } from "../../../rooms/utils/meet-protocol";
import { MemberSafetyMenu } from "../../../rooms/components/MemberSafetyMenu";

export type PendingActionType = "mute" | "kick" | "co-host";

export interface MobileParticipantTileProps {
  trackRef?: TrackReferenceOrPlaceholder | null;
  localRole: "host" | "co-host" | "member";
  canModerate: boolean;
  isLocalHost: boolean;
  pendingType: PendingActionType | null;
  getToken?: () => Promise<string | null>;
  roomName: string;
  onMute: (identity: string) => void;
  onKick: (identity: string, name: string) => void;
  onToggleCoHost: (identity: string, name: string, isCoHost: boolean) => void;
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
        } [&_.lk-participant-placeholder]:bg-white/[0.04] [&_.lk-participant-metadata]:whitespace-nowrap [&_.lk-participant-metadata]:flex-nowrap [&_.lk-participant-metadata-item]:max-w-[calc(100%-4.5rem)] [&_.lk-participant-metadata-item]:whitespace-nowrap [&_.lk-participant-metadata-item]:flex-nowrap [&_.lk-participant-metadata-item]:overflow-hidden [&_.lk-participant-name]:whitespace-nowrap [&_.lk-participant-name]:truncate [&_.lk-participant-name]:block [&_.lk-connection-quality]:hidden`}
      />

      {/* Huy hiệu vai trò, trạng thái, giơ tay và mục tiêu góc trên trái */}
      <div className="absolute top-1.5 left-1.5 z-20 pointer-events-none flex items-center gap-1 max-w-[calc(100%-3.5rem)] flex-nowrap">
        {isTargetHost && (
          <div
            className="px-1.5 py-0.5 rounded-full bg-amber-500/15 backdrop-blur-md border border-amber-400/30 text-amber-300 font-semibold text-[9px] flex items-center gap-1 shadow-[0_0_10px_rgba(245,158,11,0.15)] pointer-events-auto shrink-0 whitespace-nowrap"
            title="Trưởng phòng"
          >
            <CrownIcon className="w-2.5 h-2.5 text-amber-400 shrink-0" weight="fill" />
            <span>Host</span>
          </div>
        )}

        {isTargetCoHost && (
          <div
            className="px-1.5 py-0.5 rounded-full bg-sky-500/15 backdrop-blur-md border border-sky-400/30 text-sky-300 font-semibold text-[9px] flex items-center gap-1 shadow-[0_0_10px_rgba(56,189,248,0.15)] pointer-events-auto shrink-0 whitespace-nowrap"
            title="Phó phòng"
          >
            <StarIcon className="w-2.5 h-2.5 text-sky-400 shrink-0" weight="fill" />
            <span>Phó</span>
          </div>
        )}

        {isHandRaised && (
          <div
            className="px-1.5 py-0.5 rounded-full bg-amber-500/20 backdrop-blur-md border border-amber-400/40 text-amber-300 flex items-center justify-center shadow-md shrink-0 animate-bounce pointer-events-auto"
            title="Đang giơ tay phát biểu"
          >
            <HandWavingIcon className="w-2.5 h-2.5 text-amber-400 shrink-0" weight="fill" />
          </div>
        )}

        {statusLabel && (
          <div
            className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold border backdrop-blur-md shadow-sm truncate shrink-0 whitespace-nowrap ${
              status === "focus"
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30 shadow-[0_0_8px_rgba(52,211,153,0.1)]"
                : status === "break"
                ? "bg-amber-500/15 text-amber-300 border-amber-400/30 shadow-[0_0_8px_rgba(245,158,11,0.1)]"
                : "bg-rose-500/15 text-rose-300 border-rose-400/30"
            }`}
            title={goal ? `Mục tiêu: ${goal}` : undefined}
          >
            {statusLabel}
          </div>
        )}

        {/* Mục tiêu học tập cá nhân */}
        {goal && (
          <div
            className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-black/60 backdrop-blur-md border border-emerald-400/30 text-emerald-300 shadow-sm flex items-center gap-1 max-w-[80px] truncate pointer-events-auto shrink-0"
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
                onClick={() => identity && onToggleCoHost(identity, participant?.name || "Thành viên", isTargetCoHost)}
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

      {/* Menu an toàn */}
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

      {/* Thông báo phản hồi cử chỉ */}
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

/**
 * Tile hiển thị một thành viên trong phòng học trên điện thoại.
 * Tối ưu hiệu năng bằng so sánh props chọn lọc.
 */
export const MobileParticipantTile = memo(
  MobileParticipantTileBase,
  areParticipantTilePropsEqual
);
