"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { LiveKitRoom } from "@livekit/components-react";
import "@livekit/components-styles";
import { Users, X, Loader2, RefreshCw, LogIn } from "lucide-react";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { StudyRoomView } from "./StudyRoomView";

export interface StudyRoomsWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROOM_MARGIN = 16;
const DEFAULT_ROOM_W = 720;
const DEFAULT_ROOM_H = 540;
// Vào phòng mà thẻ nhỏ hơn cỡ này thì tự nở ra cho xem rõ
const MIN_JOIN_W = 680;
const MIN_JOIN_H = 500;
const MIN_ROOM_W = 380;
const MIN_ROOM_H = 360;

// Giữ thẻ luôn nằm trong màn hình
const clampRoom = (
  x: number,
  y: number,
  w: number,
  h: number
): { x: number; y: number } => {
  if (typeof window === "undefined") return { x: Math.round(x), y: Math.round(y) };
  const maxX = Math.max(ROOM_MARGIN, window.innerWidth - w - ROOM_MARGIN);
  const maxY = Math.max(ROOM_MARGIN, window.innerHeight - h - ROOM_MARGIN);
  return {
    x: Math.round(Math.max(ROOM_MARGIN, Math.min(maxX, x))),
    y: Math.round(Math.max(ROOM_MARGIN, Math.min(maxY, y))),
  };
};

const getCenter = (w: number, h: number) => {
  if (typeof window === "undefined") return { x: 100, y: 100 };
  return clampRoom((window.innerWidth - w) / 2, (window.innerHeight - h) / 2, w, h);
};

// Phòng học nhóm dạng thẻ bay: kéo đi được, đổi cỡ được,
// nhớ chỗ y như thẻ ghi chú.
export const StudyRoomsWidget = ({ isOpen, onClose }: StudyRoomsWidgetProps) => {
  const [displayName, setDisplayName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState("");
  const [joinedRoom, setJoinedRoom] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openRooms, setOpenRooms] = useState<{ name: string; count: number }[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [roomSize, setRoomSize] = useState({ width: DEFAULT_ROOM_W, height: DEFAULT_ROOM_H });
  const [roomPos, setRoomPos] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.roomsPos);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
            return clampRoom(parsed.x, parsed.y, DEFAULT_ROOM_W, DEFAULT_ROOM_H);
          }
        }
      } catch {}
      return getCenter(DEFAULT_ROOM_W, DEFAULT_ROOM_H);
    }
    return { x: 100, y: 100 };
  });

  const panelRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const wide = roomSize.width >= 600;

  useEffect(() => {
    setIsMounted(true);
    try {
      let nextSize = { width: DEFAULT_ROOM_W, height: DEFAULT_ROOM_H };
      const savedSize = localStorage.getItem(STORAGE_KEYS.roomsSize);
      if (savedSize) {
        const parsed = JSON.parse(savedSize);
        if (parsed?.width && parsed?.height) {
          nextSize = {
            width: Math.max(MIN_ROOM_W, Math.min(parsed.width, window.innerWidth - 32)),
            height: Math.max(MIN_ROOM_H, Math.min(parsed.height, window.innerHeight - 120)),
          };
          setRoomSize(nextSize);
        }
      }
      const savedPos = localStorage.getItem(STORAGE_KEYS.roomsPos);
      if (savedPos) {
        const parsed = JSON.parse(savedPos);
        if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
          setRoomPos(clampRoom(parsed.x, parsed.y, nextSize.width, nextSize.height));
        } else {
          setRoomPos(getCenter(nextSize.width, nextSize.height));
        }
      } else {
        setRoomPos(getCenter(nextSize.width, nextSize.height));
      }
    } catch {}
  }, []);

  // Thu nhỏ cửa sổ thì kéo thẻ vào trong
  useEffect(() => {
    const onResize = () => {
      setRoomSize((prev) => {
        const nextW = Math.max(MIN_ROOM_W, Math.min(prev.width, window.innerWidth - 32));
        const nextH = Math.max(MIN_ROOM_H, Math.min(prev.height, window.innerHeight - 120));
        if (nextW === prev.width && nextH === prev.height) return prev;
        return { width: nextW, height: nextH };
      });
      setRoomPos((prev) => clampRoom(prev.x, prev.y, roomSize.width, roomSize.height));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [roomSize.width, roomSize.height]);

  // Esc chỉ đóng bảng chờ, đang gọi thì giữ máy (tránh rớt cuộc gọi)
  useEffect(() => {
    if (!isOpen || token) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, token, onClose]);

const getLiveKitEndpoints = () => {
  const raw = (process.env.NEXT_PUBLIC_LIVEKIT_TOKEN_URL || "").trim().replace(/\/+$/, "");
  if (!raw) {
    const isDev = process.env.NODE_ENV === "development";
    return {
      tokenUrl: isDev ? "/api/livekit-token/" : "",
      roomsUrl: isDev ? "/api/livekit-rooms/" : "",
      isAvailable: isDev,
    };
  }
  const base = raw.replace(/\/(token|rooms)$/, "");
  return {
    tokenUrl: `${base}/token`,
    roomsUrl: `${base}/rooms`,
    isAvailable: true,
  };
};

  const doJoin = useCallback(async (room: string, name: string) => {
    const { tokenUrl, isAvailable } = getLiveKitEndpoints();
    if (!isAvailable || !tokenUrl) {
      setError("Chưa cấu hình máy chủ phòng học nhóm (NEXT_PUBLIC_LIVEKIT_TOKEN_URL).");
      return;
    }
    setJoining(true);
    setError(null);
    try {
      const res = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room, name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Vào phòng thất bại.");
      setToken(data.token);
      setServerUrl(data.url);
      setJoinedRoom(data.room);
      // Vào phòng thì nở thẻ ra cỡ xem được, khỏi giữ cỡ nhỏ của bảng chờ
      const grown = {
        width: Math.max(roomSize.width, MIN_JOIN_W),
        height: Math.max(roomSize.height, MIN_JOIN_H),
      };
      if (grown.width !== roomSize.width || grown.height !== roomSize.height) {
        setRoomSize(grown);
        try {
          localStorage.setItem(STORAGE_KEYS.roomsSize, JSON.stringify(grown));
        } catch {}
        setRoomPos((p) => {
          const fixed = clampRoom(p.x, p.y, grown.width, grown.height);
          if (fixed.x === p.x && fixed.y === p.y) return p;
          try {
            localStorage.setItem(STORAGE_KEYS.roomsPos, JSON.stringify(fixed));
          } catch {}
          return fixed;
        });
      }
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setJoining(false);
    }
  }, [roomSize]);

  const handleJoin = useCallback(async () => {
    if (!displayName.trim() || !roomName.trim() || joining) return;
    await doJoin(roomName.trim(), displayName.trim());
  }, [displayName, roomName, joining, doJoin]);

  // Lấy phòng đang mở mỗi lần mở bảng + bấm tải lại
  const loadOpenRooms = useCallback(async () => {
    const { roomsUrl, isAvailable } = getLiveKitEndpoints();
    if (!isAvailable || !roomsUrl) {
      setOpenRooms([]);
      return;
    }
    setLoadingRooms(true);
    try {
      const res = await fetch(roomsUrl, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setOpenRooms(data.rooms || []);
    } catch {}
    finally {
      setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && !token) loadOpenRooms();
  }, [isOpen, token, loadOpenRooms]);

  const handleJoinListed = (name: string) => {
    if (!displayName.trim()) {
      setError("Nhập tên của bạn ở dưới trước rồi bấm Vào.");
      return;
    }
    setRoomName(name);
    doJoin(name, displayName.trim());
  };

  const handleLeave = useCallback(() => {
    setToken(null);
    setServerUrl("");
    setJoinedRoom("");
    setError(null);
    onClose();
  }, [onClose]);

  // Kéo to/nhỏ ở góc dưới phải
  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = roomSize.width;
      const startH = roomSize.height;
      const cardLeft = roomPos.x;
      const cardTop = roomPos.y;
      let latest = { width: startW, height: startH };
      let rafId: number | null = null;

      const onMove = (ev: PointerEvent) => {
        const maxW = Math.max(MIN_ROOM_W, window.innerWidth - cardLeft - 16);
        const maxH = Math.max(MIN_ROOM_H, window.innerHeight - cardTop - 16);
        latest = {
          width: Math.round(Math.max(MIN_ROOM_W, Math.min(maxW, startW + (ev.clientX - startX)))),
          height: Math.round(Math.max(MIN_ROOM_H, Math.min(maxH, startH + (ev.clientY - startY)))),
        };
        if (!rafId) {
          rafId = requestAnimationFrame(() => {
            setRoomSize(latest);
            rafId = null;
          });
        }
      };
      const onUp = () => {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        setRoomSize(latest);
        const fixedPos = clampRoom(cardLeft, cardTop, latest.width, latest.height);
        setRoomPos(fixedPos);
        try {
          localStorage.setItem(STORAGE_KEYS.roomsSize, JSON.stringify(latest));
          localStorage.setItem(STORAGE_KEYS.roomsPos, JSON.stringify(fixedPos));
        } catch {}
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [roomSize.width, roomSize.height, roomPos.x, roomPos.y]
  );

  const canJoin = displayName.trim().length > 0 && roomName.trim().length > 0 && !joining;
  if (!isMounted) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] pointer-events-none overflow-hidden">
          <motion.div
            ref={panelRef}
            key="rooms-panel"
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            dragElastic={0}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={(_, info) => {
              setIsDragging(false);
              if (Math.hypot(info.offset.x, info.offset.y) < 2) return;
              // Đo cỡ thật của thẻ lúc thả để kẹp cho khít
              const rect = panelRef.current?.getBoundingClientRect();
              const w = rect?.width || roomSize.width;
              const h = rect?.height || roomSize.height;
              setRoomPos((prev) => {
                const next = clampRoom(prev.x + info.offset.x, prev.y + info.offset.y, w, h);
                if (next.x === prev.x && next.y === prev.y) return prev;
                try {
                  localStorage.setItem(STORAGE_KEYS.roomsPos, JSON.stringify(next));
                } catch {}
                return next;
              });
            }}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{
              opacity: { duration: 0.16, ease: "easeOut" },
              scale: { duration: 0.16, ease: "easeOut" },
            }}
            style={{
              top: 0,
              left: 0,
              x: roomPos.x,
              y: roomPos.y,
              // Bảng chờ nhỏ gọn cố định, vào phòng mới theo cỡ đã lưu
              width: token ? roomSize.width : 400,
              height: token ? roomSize.height : "auto",
            }}
            className={`pointer-events-auto fixed min-w-[300px] min-h-[240px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-120px)] flex flex-col rounded-3xl bg-black/60 backdrop-blur-2xl border overflow-hidden select-none transform-gpu will-change-transform z-[70] ${
              isDragging
                ? "shadow-[0_30px_80px_rgba(0,0,0,0.65)] ring-2 ring-emerald-500/40 cursor-grabbing border-white/15"
                : "shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-white/15"
            }`}
          >
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none z-10" />

            {/* Vạch kéo ở giữa mép trên cho biết thẻ di chuyển được */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="absolute top-1 left-1/2 -translate-x-1/2 z-20 h-5 px-3 flex items-start justify-center cursor-grab active:cursor-grabbing touch-none group/grab"
              title="Kéo để di chuyển"
            >
              <span
                className={`block h-1 rounded-full transition-all duration-150 ${
                  isDragging
                    ? "w-14 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]"
                    : "w-10 bg-white/30 group-hover/grab:w-12 group-hover/grab:bg-white/60"
                }`}
              />
            </div>

            {!token ? (
              <div className="flex-1 min-h-0 overflow-y-auto custom-study-scroll">
                {/* Thanh kéo */}
                <div
                  onPointerDown={(e) => dragControls.start(e)}
                  className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/10 cursor-grab active:cursor-grabbing touch-none"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
                      <Users className="w-5 h-5" />
                    </span>
                    <div>
                      <h2 className="text-sm font-bold">Phòng học nhóm</h2>
                      <p className="text-xs text-slate-400">Vào phòng là thấy nhau, tối đa 10 người</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    title="Đóng (Esc)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 sm:p-6 space-y-4">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-300 mb-1">Tên của bạn</p>
                      <input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleJoin();
                        }}
                        placeholder="Ví dụ: An"
                        maxLength={30}
                        className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-white/30"
                      />
                    </div>

                    {/* Phòng đang mở: bấm Vào là xong, khỏi gõ tên */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-semibold text-slate-300">
                          Phòng đang mở ({openRooms.length})
                        </p>
                        <button
                          onClick={loadOpenRooms}
                          disabled={loadingRooms}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                          title="Tải lại danh sách"
                        >
                          <RefreshCw className={`w-3 h-3 ${loadingRooms ? "animate-spin" : ""}`} />
                          Tải lại
                        </button>
                      </div>
                      {openRooms.length === 0 ? (
                        <p className="text-[11px] text-slate-500 px-1 py-2">
                          {loadingRooms
                            ? "Đang tìm..."
                            : !getLiveKitEndpoints().isAvailable
                            ? "Chưa cấu hình Cloudflare Worker cho phòng học (NEXT_PUBLIC_LIVEKIT_TOKEN_URL)."
                            : "Chưa có phòng nào mở. Tạo phòng mới ở dưới nhé."}
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-36 overflow-y-auto custom-study-scroll pr-0.5">
                          {openRooms.map((r) => (
                            <div
                              key={r.name}
                              className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate">{r.name}</p>
                                <p className="text-[11px] text-emerald-300/90">
                                  {r.count} người đang học
                                </p>
                              </div>
                              <button
                                onClick={() => handleJoinListed(r.name)}
                                disabled={joining}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-emerald-200 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 shrink-0"
                              >
                                <LogIn className="w-3.5 h-3.5" /> Vào
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-300 mb-1">Hoặc tạo phòng mới</p>
                      <input
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleJoin();
                        }}
                        placeholder="Ví dụ: on-thi-cuoi-ky"
                        maxLength={32}
                        className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-white/30"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        Ai gõ cùng tên phòng là vào chung. Trình duyệt sẽ hỏi bật mic và camera.
                      </p>
                    </div>
                  </div>

                  {error && (
                    <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-xl px-3 py-2">
                      {error}
                    </p>
                  )}

                  <button
                    onClick={handleJoin}
                    disabled={!canJoin}
                    className="w-full py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-emerald-200 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {joining ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Đang vào...
                      </>
                    ) : (
                      "Vào phòng học"
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <LiveKitRoom
                token={token}
                serverUrl={serverUrl}
                connect
                audio
                video
                className="flex flex-col h-full min-h-0"
                onDisconnected={handleLeave}
              >
                <StudyRoomView
                  roomName={joinedRoom}
                  onLeave={handleLeave}
                  sideBySide={wide}
                  onDragStart={(e) => dragControls.start(e)}
                />
              </LiveKitRoom>
            )}

            {/* Tay kéo to/nhỏ: chỉ hiện khi đã vào phòng */}
            {token && (
              <div
                onPointerDown={handleResizePointerDown}
                className="absolute bottom-1 right-1 w-6 h-6 cursor-nwse-resize touch-none z-20 flex items-end justify-end opacity-60 hover:opacity-100 transition-opacity"
                title="Kéo để đổi cỡ"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" className="text-slate-400">
                  <path d="M11 1 L1 11 M11 5 L5 11 M11 9 L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
