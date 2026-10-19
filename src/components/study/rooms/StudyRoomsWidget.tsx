"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { LiveKitRoom } from "@livekit/components-react";
import "@livekit/components-styles";
import {
  UsersIcon,
  XIcon,
  CircleNotchIcon,
  ArrowClockwiseIcon,
  SignInIcon,
  LockKeyIcon,
  VideoCameraIcon,
} from "@phosphor-icons/react";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { useFloatingSize } from "@/lib/use-floating-size";
import { useAuth, GoogleIcon } from "@/components/study/auth";
import { useIsMobile } from "@/components/study/mobile/hooks/useIsMobile";
import { MobileRoomsSheet } from "@/components/study/mobile/sheets/MobileRoomsSheet";
import { StudyRoomView } from "./StudyRoomView";

export interface StudyRoomsWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  onBack?: () => void;
  backLabel?: string;
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
export const StudyRoomsWidget = ({ isOpen, onClose, onOpen, onBack, backLabel }: StudyRoomsWidgetProps) => {
  const {
    user,
    loading: authLoading,
    isSigningIn,
    authError,
    signIn,
    getToken,
  } = useAuth();

  const isMobile = useIsMobile();

  const [displayName, setDisplayName] = useState(
    () => user?.displayName || user?.email?.split("@")[0] || ""
  );
  const [roomName, setRoomName] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState("");
  const [joinedRoom, setJoinedRoom] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openRooms, setOpenRooms] = useState<{ name: string; count: number }[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => {
      const next = !prev;
      if (typeof document !== "undefined") {
        if (next) {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          }
        } else {
          if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          }
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [isFullscreen]);

  // Tự động gán tên từ tài khoản đăng nhập khi user có sẵn
  useEffect(() => {
    if (user) {
      const preferred = user.displayName || user.email?.split("@")[0] || "";
      if (preferred && !displayName) {
        setDisplayName(preferred);
      }
    }
  }, [user, displayName]);

  // Cỡ khung do hook chung lo (nhớ + kẹp + kéo góc); chỗ đứng tự lo ở dưới
  const {
    size: roomSize,
    setSize: setRoomSize,
    beginResize: beginRoomResize,
  } = useFloatingSize({
    minWidth: MIN_ROOM_W,
    minHeight: MIN_ROOM_H,
    defaultWidth: DEFAULT_ROOM_W,
    defaultHeight: DEFAULT_ROOM_H,
    storageKey: STORAGE_KEYS.roomsSize,
  });
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
    try {
      const savedPos = localStorage.getItem(STORAGE_KEYS.roomsPos);
      if (savedPos) {
        const parsed = JSON.parse(savedPos);
        if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
          setRoomPos(clampRoom(parsed.x, parsed.y, roomSize.width, roomSize.height));
        } else {
          setRoomPos(getCenter(roomSize.width, roomSize.height));
        }
      } else {
        setRoomPos(getCenter(roomSize.width, roomSize.height));
      }
    } catch {}
  }, []);

  // Thu nhỏ cửa sổ thì kéo thẻ vào trong (co cỡ do hook lo)

  // Thu nhỏ cửa sổ thì kéo thẻ vào trong (co cỡ do hook lo)
  useEffect(() => {
    const onResize = () => {
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
      // Worker tự kiểm vé Firebase và lấy danh tính từ uid trong vé.
      const idToken = await getToken();
      if (!idToken) throw new Error("Đăng nhập rồi mới vào phòng học nhóm được.");
      const res = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
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
  }, [roomSize, getToken]);

  const resolvedDisplayName =
    displayName.trim() || user?.displayName || user?.email?.split("@")[0] || "";

  const handleJoin = useCallback(async () => {
    if (!resolvedDisplayName || !roomName.trim() || joining) return;
    await doJoin(roomName.trim(), resolvedDisplayName);
  }, [resolvedDisplayName, roomName, joining, doJoin]);

  // Lấy phòng đang mở mỗi lần mở bảng + bấm tải lại
  const loadOpenRooms = useCallback(async () => {
    const { roomsUrl, isAvailable } = getLiveKitEndpoints();
    if (!isAvailable || !roomsUrl) {
      setOpenRooms([]);
      return;
    }
    setLoadingRooms(true);
    try {
      // Danh sách phòng cũng cần vé Firebase (worker tự kiểm).
      const idToken = await getToken();
      const res = await fetch(roomsUrl, {
        cache: "no-store",
        ...(idToken ? { headers: { Authorization: `Bearer ${idToken}` } } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setOpenRooms(data.rooms || []);
    } catch {}
    finally {
      setLoadingRooms(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (isOpen && !token) loadOpenRooms();
  }, [isOpen, token, loadOpenRooms]);

  const handleJoinListed = (name: string) => {
    if (!resolvedDisplayName) {
      setError("Nhập tên hiển thị của bạn ở dưới trước rồi bấm Vào.");
      return;
    }
    setRoomName(name);
    doJoin(name, resolvedDisplayName);
  };

  const handleLeave = useCallback(() => {
    if (typeof document !== "undefined" && document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    setIsFullscreen(false);
    setToken(null);
    setServerUrl("");
    setJoinedRoom("");
    setError(null);
    onClose();
  }, [onClose]);

  // Kéo to/nhỏ ở góc dưới phải (logic gom trong hook chung, đây chỉ kẹp lại chỗ đứng)
  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      beginRoomResize(e, { x: roomPos.x, y: roomPos.y }, (latest) => {
        const fixedPos = clampRoom(roomPos.x, roomPos.y, latest.width, latest.height);
        setRoomPos(fixedPos);
        try {
          localStorage.setItem(STORAGE_KEYS.roomsPos, JSON.stringify(fixedPos));
        } catch {}
      });
    },
    [beginRoomResize, roomPos.x, roomPos.y]
  );

  const canJoin = Boolean(
    user && resolvedDisplayName.length > 0 && roomName.trim().length > 0 && !joining
  );

  if (isMobile) {
    return (
      <MobileRoomsSheet
        isOpen={isOpen}
        onClose={onClose}
        onOpen={onOpen}
        onBack={onBack}
        backLabel={backLabel}
        user={user}
        authLoading={authLoading}
        isSigningIn={isSigningIn}
        authError={authError}
        signIn={signIn}
        displayName={displayName}
        setDisplayName={setDisplayName}
        roomName={roomName}
        setRoomName={setRoomName}
        openRooms={openRooms}
        loadingRooms={loadingRooms}
        loadOpenRooms={loadOpenRooms}
        handleJoinListed={handleJoinListed}
        handleJoin={handleJoin}
        canJoin={canJoin}
        joining={joining}
        error={error}
        token={token}
        serverUrl={serverUrl}
        joinedRoom={joinedRoom}
        handleLeave={handleLeave}
        isAvailable={getLiveKitEndpoints().isAvailable}
      />
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="hidden sm:block fixed inset-0 z-[70] pointer-events-none overflow-hidden">
          <motion.div
            ref={panelRef}
            key="rooms-panel"
            drag={!isFullscreen}
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            dragElastic={0}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={(_, info) => {
              if (isFullscreen) return;
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
            style={
              isFullscreen
                ? {
                    top: 0,
                    left: 0,
                    x: 0,
                    y: 0,
                    width: "100vw",
                    height: "100vh",
                  }
                : {
                    top: 0,
                    left: 0,
                    x: roomPos.x,
                    y: roomPos.y,
                    width: token ? roomSize.width : 400,
                    height: token ? roomSize.height : "auto",
                  }
            }
            className={`hidden sm:flex pointer-events-auto fixed flex-col select-none transform-gpu will-change-transform ${
              isFullscreen
                ? "inset-0 w-screen h-screen rounded-none bg-slate-950/95 backdrop-blur-3xl z-[90] border-none shadow-none"
                : `min-w-[300px] min-h-[240px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-120px)] rounded-3xl bg-black/60 backdrop-blur-2xl border overflow-hidden z-[70] ${
                    isDragging
                      ? "shadow-[0_30px_80px_rgba(0,0,0,0.65)] ring-2 ring-emerald-500/40 cursor-grabbing border-white/15"
                      : "shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-white/15"
                  }`
            }`}
          >
            {!isFullscreen && (
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none z-10" />
            )}

            {/* Vạch kéo ở giữa mép trên cho biết thẻ di chuyển được */}
            {!isFullscreen && (
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
            )}

            {!token ? (
              <div className="flex-1 min-h-0 overflow-y-auto custom-study-scroll flex flex-col">
                {/* Thanh kéo / Header */}
                <div
                  onPointerDown={(e) => dragControls.start(e)}
                  className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/10 cursor-grab active:cursor-grabbing touch-none shrink-0"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
                      <UsersIcon className="w-5 h-5" />
                    </span>
                    <div>
                      <h2 className="text-sm font-bold text-white">Phòng học nhóm</h2>
                      <p className="text-xs text-slate-400">Vào phòng là thấy nhau, tối đa 10 người</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={onClose}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      title="Đóng (Esc)"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {authLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 text-xs my-auto">
                    <CircleNotchIcon className="w-6 h-6 animate-spin text-emerald-400 mb-2.5" />
                    <span>Đang kiểm tra tài khoản...</span>
                  </div>
                ) : !user ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 text-center select-none my-auto">
                    <div className="relative mb-4">
                      <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shadow-[0_0_28px_rgba(52,211,153,0.35)]">
                        <UsersIcon className="w-8 h-8" />
                      </div>
                      <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center text-slate-950 shadow-md">
                        <LockKeyIcon className="w-3.5 h-3.5" />
                      </span>
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-white mb-1.5 tracking-tight">
                      Đăng nhập để vào phòng học nhóm
                    </h3>
                    <p className="text-xs text-slate-300 max-w-sm leading-relaxed mb-6">
                      Để giữ môi trường học tập an toàn, văn minh và tự động nhận diện thành viên, bạn cần đăng nhập tài khoản Google trước khi tham gia lớp học.
                    </p>

                    <div className="w-full max-w-xs space-y-2 mb-6 text-left">
                      <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                        <span>Bật camera & micro cùng bạn bè tập trung</span>
                      </div>
                      <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-200">
                        <span className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />
                        <span>Đồng bộ đồng hồ Pomodoro nhóm cùng học</span>
                      </div>
                      <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-200">
                        <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                        <span>Tự động định danh thành viên, chống người lạ</span>
                      </div>
                    </div>

                    {authError && (
                      <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-xl px-3.5 py-2 mb-4 max-w-xs">
                        {authError}
                      </p>
                    )}

                    <button
                      onClick={signIn}
                      disabled={isSigningIn}
                      className="relative group overflow-hidden w-full max-w-xs px-5 py-2.5 rounded-full text-xs font-bold text-slate-950 bg-white hover:bg-slate-100 shadow-[0_0_20px_rgba(255,255,255,0.4)] transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-95 disabled:opacity-60"
                    >
                      {isSigningIn ? (
                        <>
                          <CircleNotchIcon className="w-4 h-4 animate-spin text-slate-700" />
                          <span>Đang mở Google...</span>
                        </>
                      ) : (
                        <>
                          <GoogleIcon />
                          <span>Đăng nhập với Google</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="p-5 sm:p-6 space-y-4">
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold text-slate-300">Tên hiển thị trong phòng</p>
                          <span className="text-[11px] text-emerald-300/80 truncate max-w-[200px]">
                            {user.email}
                          </span>
                        </div>
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
                            <ArrowClockwiseIcon className={`w-3 h-3 ${loadingRooms ? "animate-spin" : ""}`} />
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
                                  <SignInIcon className="w-3.5 h-3.5" /> Vào
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
                        <div className="mt-2 space-y-1.5">
                          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
                            <UsersIcon className="w-3.5 h-3.5 mt-[1px] shrink-0 text-emerald-400/80" weight="bold" />
                            <span>
                              Ai gõ <span className="font-semibold text-slate-200">cùng tên phòng</span> là vào chung.
                            </span>
                          </p>
                          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
                            <VideoCameraIcon className="w-3.5 h-3.5 mt-[1px] shrink-0 text-slate-500" weight="bold" />
                            <span>
                              Mic và camera <span className="font-semibold text-slate-200">mặc định tắt</span> khi vào phòng.
                            </span>
                          </p>
                        </div>
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
                          <CircleNotchIcon className="w-4 h-4 animate-spin" /> Đang vào...
                        </>
                      ) : (
                        "Vào phòng học"
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <LiveKitRoom
                token={token}
                serverUrl={serverUrl}
                connect
                audio={false}
                video={false}
                className="flex flex-col h-full min-h-0"
                onDisconnected={handleLeave}
              >
                <StudyRoomView
                  roomName={joinedRoom}
                  onLeave={handleLeave}
                  sideBySide={isFullscreen || wide}
                  onDragStart={(e) => dragControls.start(e)}
                  isFullscreen={isFullscreen}
                  onToggleFullscreen={toggleFullscreen}
                />
              </LiveKitRoom>
            )}

            {/* Tay kéo to/nhỏ: chỉ hiện khi đã vào phòng và không toàn màn hình */}
            {token && !isFullscreen && (
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
