"use client";

import React, { memo } from "react";
import { TrackToggle } from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  HandWavingIcon,
  ChatTextIcon,
  SignOutIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import type { useMeetStudyState } from "../../../rooms/hooks/useMeetStudyState";

export interface MobileRoomControlBarProps {
  micEnabled: boolean;
  setMicEnabled: (val: boolean) => void;
  camEnabled: boolean;
  setCamEnabled: (val: boolean) => void;
  canShareScreen: boolean;
  studyState: ReturnType<typeof useMeetStudyState>;
  chatOpen: boolean;
  onToggleChat: () => void;
  unreadCount: number;
  onLeaveRoom: () => void;
}

/**
 * Thanh điều khiển cuộc gọi dưới đáy phòng học trên điện thoại:
 * Mic, Camera, Chia sẻ màn hình, Giơ tay, Chat và Rời phòng.
 */
export const MobileRoomControlBar = memo(function MobileRoomControlBar({
  micEnabled,
  setMicEnabled,
  camEnabled,
  setCamEnabled,
  canShareScreen,
  studyState,
  chatOpen,
  onToggleChat,
  unreadCount,
  onLeaveRoom,
}: MobileRoomControlBarProps) {
  return (
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

        {/* Nút Chia sẻ màn hình Mobile (nếu hỗ trợ) */}
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
          onClick={onToggleChat}
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

        {/* Vạch ngăn cách */}
        <span className="w-[1px] h-5 bg-white/20" aria-hidden="true" />

        {/* Nút Rời phòng */}
        <button
          type="button"
          onClick={onLeaveRoom}
          className="w-9 h-9 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-95 text-white flex items-center justify-center cursor-pointer transition-all shadow-[0_0_12px_rgba(225,29,72,0.4)] border border-rose-400/40"
          title="Rời phòng học"
          aria-label="Rời phòng học"
        >
          <SignOutIcon className="w-4.5 h-4.5" weight="bold" />
        </button>
      </div>
    </footer>
  );
});
