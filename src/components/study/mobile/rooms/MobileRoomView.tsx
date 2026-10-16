"use client";

import { useState, useRef, useEffect } from "react";
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
  CopyIcon,
  CheckIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";

interface MobileRoomViewProps {
  roomName: string;
  onLeave: () => void;
}

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

export function MobileRoomView({ roomName, onLeave }: MobileRoomViewProps) {
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
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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

  const handleCopyRoomName = async () => {
    try {
      await navigator.clipboard.writeText(roomName);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);

  const handleLeaveRoom = () => {
    setIsLeaveConfirmOpen(true);
  };

  return (
    <div className="relative flex flex-col h-full w-full bg-slate-950 text-white overflow-hidden select-none">
      {/* Phát âm thanh LiveKit */}
      <RoomAudioRenderer />

      {/* Thông báo nếu trình duyệt chặn tự phát âm thanh */}
      <StartAudio
        label="🔊 Chạm vào đây để nghe tiếng bạn bè"
        className="mx-3 mt-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-medium cursor-pointer text-center shrink-0 z-30"
      />

      {/* Thanh trạng thái phụ siêu tinh gọn (chỉ hiện số người & nút copy, không chiếm diện tích) */}
      <div className="flex items-center justify-between px-3.5 py-1.5 text-xs border-b border-white/[0.08] shrink-0 bg-white/[0.02]">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] text-slate-300 font-medium">
            {room.numParticipants} thành viên đang học
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopyRoomName}
          className="h-6 px-2 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-[11px] font-medium text-slate-300 hover:text-white flex items-center gap-1 transition-all cursor-pointer"
          title="Sao chép tên phòng"
        >
          {copied ? (
            <>
              <CheckIcon className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Đã sao chép</span>
            </>
          ) : (
            <>
              <CopyIcon className="w-3 h-3 text-slate-400" />
              <span>Chép mã phòng</span>
            </>
          )}
        </button>
      </div>

      {/* Vùng hiển thị Video các thành viên (Mở rộng tối đa không gian) */}
      <main className="flex-1 min-h-0 relative p-2 overflow-hidden flex flex-col justify-center">
        {tracks.length > 0 ? (
          <div className="w-full h-full overflow-y-auto custom-study-scroll rounded-2xl [&_.lk-grid-layout]:gap-2 [&_.lk-participant-tile]:rounded-2xl [&_.lk-participant-tile]:border [&_.lk-participant-tile]:border-white/15 [&_.lk-participant-tile]:overflow-hidden [&_.lk-participant-tile]:bg-slate-900/90 [&_.lk-participant-tile]:shadow-md">
            <GridLayout tracks={tracks} className="h-full">
              <ParticipantTile />
            </GridLayout>
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
              Gửi tên phòng{" "}
              <strong className="text-emerald-300 font-mono font-semibold">
                {roomName}
              </strong>{" "}
              để cùng học nhé.
            </p>
            <button
              type="button"
              onClick={handleCopyRoomName}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 border border-white/15 text-[11px] font-semibold text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              {copied ? (
                <>
                  <CheckIcon className="w-3 h-3 text-emerald-400" />
                  <span>Đã sao chép!</span>
                </>
              ) : (
                <>
                  <CopyIcon className="w-3 h-3" />
                  <span>Sao chép tên phòng</span>
                </>
              )}
            </button>
          </div>
        )}
      </main>

      {/* Thanh điều khiển cuộc gọi dưới đáy: ĐÃ GIẢM ĐỘ DÀY (Mỏng gọn, thanh lịch, chuẩn ProMax) */}
      <footer className="shrink-0 py-1.5 px-3 flex items-center justify-center z-20">
        <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-full bg-slate-900/95 backdrop-blur-2xl border border-white/20 shadow-[0_8px_30px_rgba(0,0,0,0.85)]">
          {/* Nút Micro */}
          <TrackToggle
            source={Track.Source.Microphone}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center cursor-pointer active:scale-95 transition-all [&_svg]:w-4.5 [&_svg]:h-4.5 aria-pressed:bg-emerald-500 aria-pressed:border-emerald-400 aria-pressed:text-slate-950 aria-pressed:shadow-[0_0_12px_rgba(52,211,153,0.5)]"
          />

          {/* Nút Camera */}
          <TrackToggle
            source={Track.Source.Camera}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center cursor-pointer active:scale-95 transition-all [&_svg]:w-4.5 [&_svg]:h-4.5 aria-pressed:bg-emerald-500 aria-pressed:border-emerald-400 aria-pressed:text-slate-950 aria-pressed:shadow-[0_0_12px_rgba(52,211,153,0.5)]"
          />

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
    </div>
  );
}
