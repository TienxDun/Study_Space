"use client";

import React from "react";
import { TrackToggle } from "@livekit/components-react";
import { Track } from "livekit-client";
import { HandWavingIcon, ChatTextIcon } from "@phosphor-icons/react";
import type { useMeetStudyState } from "../hooks/useMeetStudyState";

export interface RoomControlBarProps {
  studyState: ReturnType<typeof useMeetStudyState>;
  chatOpen: boolean;
  onToggleChat: () => void;
  unreadCount: number;
}

/**
 * Thanh công cụ điều khiển phía đáy phòng học:
 * Micro, Camera, Chia sẻ màn hình, Giơ tay, Bật/Tắt chat.
 */
export function RoomControlBar({
  studyState,
  chatOpen,
  onToggleChat,
  unreadCount,
}: RoomControlBarProps) {
  return (
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
          onClick={onToggleChat}
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
  );
}
