"use client";

import { useState } from "react";
import {
  GridLayout,
  ParticipantTile,
  TrackToggle,
  useChat,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  SignOutIcon,
  ChatTextIcon,
  PaperPlaneTiltIcon,
  XIcon,
} from "@phosphor-icons/react";

interface StudyRoomViewProps {
  roomName: string;
  onLeave: () => void;
  // true: chat đứng cạnh video, false: chat nằm dưới (thẻ hẹp)
  sideBySide?: boolean;
  onDragStart?: (e: React.PointerEvent) => void;
}

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

// Khung gọi tiếng Việt: lưới mặt, hàng nút mic/cam/chia sẻ/nhắn tin,
// bảng chat trượt bên phải. Chỉ giữ 1 nút rời phòng duy nhất.
export const StudyRoomView = ({ roomName, onLeave, sideBySide = true, onDragStart }: StudyRoomViewProps) => {
  const room = useRoomContext();
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);
  const { chatMessages, send } = useChat();
  const [chatOpen, setChatOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [seenCount, setSeenCount] = useState(0);
  const unreadCount = !chatOpen && chatMessages.length > seenCount
    ? chatMessages.length - seenCount
    : 0;

  const toggleChat = () => {
    setChatOpen((v) => {
      if (!v) setSeenCount(chatMessages.length);
      return !v;
    });
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    try {
      await send(text);
      setDraft("");
    } catch {}
  };

  return (
    <div className="flex flex-col h-full">
      {/* Đầu phòng: tên + nút rời duy nhất, cả thanh để kéo thẻ */}
      <div
        onPointerDown={onDragStart}
        className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/10 shrink-0 cursor-grab active:cursor-grabbing touch-none"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] shrink-0" />
          <h2 className="text-sm font-bold truncate">Phòng: {roomName}</h2>
          <span className="text-[11px] text-slate-400 shrink-0">
            {room.numParticipants} người
          </span>
        </div>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            try {
              room.disconnect();
            } catch {}
            onLeave();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-rose-200 text-xs font-bold transition-colors cursor-pointer shrink-0"
          title="Rời phòng"
        >
          <SignOutIcon className="w-3.5 h-3.5" /> Rời phòng
        </button>
      </div>

      {/* Giữa: thẻ rộng thì chat đứng cạnh, thẻ hẹp thì chat nằm dưới */}
      <div className={`flex-1 min-h-0 flex ${sideBySide ? "flex-row" : "flex-col"}`}>
        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto p-3 sm:p-4 custom-study-scroll">
          {tracks.length > 0 ? (
            <GridLayout tracks={tracks} className="h-full">
              <ParticipantTile className="rounded-2xl overflow-hidden border border-white/10" />
            </GridLayout>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-xs text-slate-400">Đang chờ mọi người vào...</p>
            </div>
          )}
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
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5 custom-study-scroll">
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
                disabled={!draft.trim()}
                className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-emerald-200 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1"
                title="Gửi"
              >
                <PaperPlaneTiltIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Gửi</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Đáy: mic, cam, chia sẻ, nhắn tin */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 px-3 py-3 border-t border-white/10 shrink-0">
        <div className="flex flex-col items-center gap-1">
          <TrackToggle
            source={Track.Source.Microphone}
            className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 text-white flex items-center justify-center cursor-pointer shadow-[0_2px_12px_rgba(0,0,0,0.6)] [&_svg]:w-5 [&_svg]:h-5"
          />
          <span className="text-[10px] text-slate-400 font-medium">Mic</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <TrackToggle
            source={Track.Source.Camera}
            className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 text-white flex items-center justify-center cursor-pointer shadow-[0_2px_12px_rgba(0,0,0,0.6)] [&_svg]:w-5 [&_svg]:h-5"
          />
          <span className="text-[10px] text-slate-400 font-medium">Cam</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <TrackToggle
            source={Track.Source.ScreenShare}
            captureOptions={{ audio: true }}
            className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 text-white flex items-center justify-center cursor-pointer shadow-[0_2px_12px_rgba(0,0,0,0.6)] [&_svg]:w-5 [&_svg]:h-5"
          />
          <span className="text-[10px] text-slate-400 font-medium">Chia sẻ</span>
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
    </div>
  );
};
