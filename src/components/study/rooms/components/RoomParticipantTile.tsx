"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { ParticipantTile } from "@livekit/components-react";
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
import { MEET_ATTR } from "../utils/meet-protocol";

export interface RoomParticipantTileProps {
  trackRef: any;
  localRole?: "host" | "co-host" | "member";
  canModerate?: boolean;
  isLocalHost?: boolean;
  onMute?: (identity: string) => void;
  onKick?: (identity: string, name: string) => void;
  onToggleCoHost?: (identity: string) => void;
  pendingAction?: { type: "mute" | "kick" | "co-host"; identity: string } | null;
  safetyMenu?: React.ReactNode;
  isPinned?: boolean;
  onTogglePin?: () => void;
  isCompact?: boolean;
  [key: string]: any;
}

/**
 * Tile người tham gia kèm chỉ báo chất lượng mạng ở góc trên phải
 * và huy hiệu trạng thái / giơ tay ở góc trên trái.
 */
export function RoomParticipantTile({
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
}: RoomParticipantTileProps) {
  const attrs = trackRef?.participant?.attributes;
  const status = attrs?.[MEET_ATTR.status];
  const isHandRaised = attrs?.[MEET_ATTR.hand] === "1";
  const goal = (attrs?.[MEET_ATTR.goal] || "").trim();
  const isLocal = trackRef?.participant?.isLocal;
  const pendingType =
    pendingAction?.identity === trackRef?.participant?.identity ? pendingAction?.type : null;
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

        {/* Mục tiêu học tập cá nhân */}
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

        {/* Nút hành động nhanh của Host & Phó phòng trên thành viên khác */}
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
