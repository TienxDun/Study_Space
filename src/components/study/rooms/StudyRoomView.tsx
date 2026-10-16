"use client";

import { useState } from "react";
import {
  GridLayout,
  ParticipantTile,
  TrackToggle,
  useChat,
  useRoomContext,
  useTracks,
  RoomAudioRenderer,
  StartAudio,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  SignOutIcon,
  ChatTextIcon,
  PaperPlaneTiltIcon,
  XIcon,
  CornersOutIcon,
  CornersInIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";

interface StudyRoomViewProps {
  roomName: string;
  onLeave: () => void;
  // true: chat đứng cạnh video, false: chat nằm dưới (thẻ hẹp)
  sideBySide?: boolean;
  onDragStart?: (e: React.PointerEvent) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

// Khung gọi tiếng Việt: lưới mặt, hàng nút mic/cam/chia sẻ/nhắn tin,
// bảng chat trượt bên phải.
export const StudyRoomView = ({
  roomName,
  onLeave,
  sideBySide = true,
  onDragStart,
  isFullscreen = false,
  onToggleFullscreen,
}: StudyRoomViewProps) => {
  const room = useRoomContext();
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

  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);

  const handleConfirmLeave = () => {
    setIsLeaveConfirmOpen(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Phát âm thanh của các thành viên khác trong phòng */}
      <RoomAudioRenderer />

      {/* Hiển thị nút bật tiếng nếu trình duyệt chặn tự động phát âm thanh */}
      <StartAudio
        label="🔊 Nhấn vào đây để bật âm thanh phòng học (Trình duyệt đang chặn tự động phát)"
        className="mx-3 mt-2 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-xs font-semibold cursor-pointer transition-colors text-center shrink-0"
      />

      {/* Đầu phòng: tên + nút toàn màn hình + nút rời, cả thanh để kéo thẻ */}
      <div
        onPointerDown={isFullscreen ? undefined : onDragStart}
        className={`flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/10 shrink-0 ${
          isFullscreen ? "cursor-default" : "cursor-grab active:cursor-grabbing touch-none"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-bold truncate">Phòng: {roomName}</h2>
          <span className="text-[11px] text-slate-400 shrink-0">
            {room.numParticipants} người
          </span>
          {isFullscreen && (
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold border border-emerald-400/30">
              Toàn màn hình
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {onToggleFullscreen && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onToggleFullscreen}
              className="group inline-flex items-center h-8 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 text-white text-xs font-semibold transition-all duration-200 cursor-pointer overflow-hidden"
              title={isFullscreen ? "Thu nhỏ cửa sổ" : "Mở toàn màn hình"}
              aria-label={isFullscreen ? "Thu nhỏ cửa sổ" : "Mở toàn màn hình"}
            >
              {isFullscreen ? (
                <>
                  <CornersInIcon className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                  <span className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap group-hover:max-w-28 group-hover:opacity-100 group-hover:ml-1.5 group-focus-visible:max-w-28 group-focus-visible:opacity-100 group-focus-visible:ml-1.5 transition-all duration-200 ease-out">
                    Thu nhỏ
                  </span>
                </>
              ) : (
                <>
                  <CornersOutIcon className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                  <span className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap group-hover:max-w-32 group-hover:opacity-100 group-hover:ml-1.5 group-focus-visible:max-w-32 group-focus-visible:opacity-100 group-focus-visible:ml-1.5 transition-all duration-200 ease-out">
                    Toàn màn hình
                  </span>
                </>
              )}
            </button>
          )}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleConfirmLeave}
            className="group inline-flex items-center h-8 px-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 active:scale-95 border border-rose-400/30 text-rose-200 text-xs font-bold transition-all duration-200 cursor-pointer overflow-hidden"
            title="Rời phòng"
            aria-label="Rời phòng"
          >
            <SignOutIcon className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
            <span className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap group-hover:max-w-24 group-hover:opacity-100 group-hover:ml-1.5 group-focus-visible:max-w-24 group-focus-visible:opacity-100 group-focus-visible:ml-1.5 transition-all duration-200 ease-out">
              Rời phòng
            </span>
          </button>
        </div>
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
            className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 text-white flex items-center justify-center cursor-pointer shadow-[0_2px_12px_rgba(0,0,0,0.6)] [&_svg]:w-5 [&_svg]:h-5 aria-pressed:bg-emerald-500/25 aria-pressed:border-emerald-400/40 aria-pressed:text-emerald-300"
          />
          <span className="text-[10px] text-slate-400 font-medium">Mic</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <TrackToggle
            source={Track.Source.Camera}
            className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 text-white flex items-center justify-center cursor-pointer shadow-[0_2px_12px_rgba(0,0,0,0.6)] [&_svg]:w-5 [&_svg]:h-5 aria-pressed:bg-emerald-500/25 aria-pressed:border-emerald-400/40 aria-pressed:text-emerald-300"
          />
          <span className="text-[10px] text-slate-400 font-medium">Cam</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <TrackToggle
            source={Track.Source.ScreenShare}
            captureOptions={{ audio: true }}
            className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 text-white flex items-center justify-center cursor-pointer shadow-[0_2px_12px_rgba(0,0,0,0.6)] [&_svg]:w-5 [&_svg]:h-5 aria-pressed:bg-emerald-500/25 aria-pressed:border-emerald-400/40 aria-pressed:text-emerald-300"
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
    </div>
  );
};
