"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { LiveKitRoom } from "@livekit/components-react";
import "@livekit/components-styles";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { useFloatingSize } from "@/lib/use-floating-size";
import { useAuth } from "@/components/study/auth";
import { useIsMobile } from "@/components/study/mobile/hooks/useIsMobile";
import { MobileRoomsSheet } from "@/components/study/mobile/sheets/MobileRoomsSheet";
import type { PomodoroSoundType } from "@/components/study/study-sound";
import { StudyRoomView } from "./components/StudyRoomView";
import { RoomPreJoinView } from "./components/RoomPreJoinView";
import { RoomLobbyView } from "./components/RoomLobbyView";
import {
  clampRoom,
  getCenter,
  getLiveKitEndpoints,
  DEFAULT_ROOM_W,
  DEFAULT_ROOM_H,
  MIN_ROOM_W,
  MIN_ROOM_H,
} from "./utils/floating-panel";
import { useStudyRoomSession } from "./hooks/useStudyRoomSession";
import { configureLiveKitLogging } from "@/lib/livekit-log";

configureLiveKitLogging();

export interface StudyRoomsWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  onBack?: () => void;
  backLabel?: string;
  soundEnabled?: boolean;
  soundType?: PomodoroSoundType;
  zIndex?: number;
  onFocus?: () => void;
}

/**
 * Phòng học nhóm dạng thẻ bay: kéo đi được, đổi cỡ được,
 * nhớ vị trí trên màn hình desktop và hiển thị dạng Sheet trên di động.
 */
export const StudyRoomsWidget = memo(function StudyRoomsWidget({
  isOpen,
  onClose,
  onOpen,
  onBack,
  backLabel,
  soundEnabled,
  soundType,
  zIndex = 70,
  onFocus,
}: StudyRoomsWidgetProps) {
  const {
    user,
    loading: authLoading,
    isSigningIn,
    authError,
    signIn,
    getToken,
  } = useAuth();

  const isMobile = useIsMobile();

  const onCloseRef = useRef(onClose);
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onCloseRef.current = onClose;
    onOpenRef.current = onOpen;
  }, [onClose, onOpen]);
  const stableOnClose = useCallback(() => onCloseRef.current(), []);
  const stableOnOpen = useCallback(() => onOpenRef.current?.(), []);

  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isFullscreenRef = useRef(false);
  useEffect(() => {
    isFullscreenRef.current = isFullscreen;
  }, [isFullscreen]);

  const toggleFullscreen = useCallback(() => {
    const next = !isFullscreenRef.current;
    if (typeof document !== "undefined") {
      try {
        if (next) {
          if (!document.fullscreenElement) {
            const el = document.documentElement as HTMLElement & {
              requestFullscreen?: () => Promise<void>;
              webkitRequestFullscreen?: () => void;
            };
            const req = el.requestFullscreen || el.webkitRequestFullscreen;
            if (typeof req === "function") {
              const result = req.call(el);
              if (result && typeof (result as Promise<void>).catch === "function") {
                (result as Promise<void>).catch(() => {});
              }
            }
          }
        } else {
          const doc = document as Document & {
            exitFullscreen?: () => Promise<void>;
            webkitExitFullscreen?: () => void;
          };
          if (document.fullscreenElement && (doc.exitFullscreen || doc.webkitExitFullscreen)) {
            const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
            if (typeof exit === "function") {
              const result = exit.call(doc);
              if (result && typeof (result as Promise<void>).catch === "function") {
                (result as Promise<void>).catch(() => {});
              }
            }
          }
        }
      } catch {}
    }
    setIsFullscreen(next);
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      if (typeof document === "undefined") return;
      if (!document.fullscreenElement && isFullscreenRef.current) {
        setIsFullscreen(false);
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("fullscreenchange", onFsChange);
      document.addEventListener("webkitfullscreenchange", onFsChange);
    }
    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("fullscreenchange", onFsChange);
        document.removeEventListener("webkitfullscreenchange", onFsChange);
      }
    };
  }, [isFullscreen]);

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

  // Thu nhỏ cửa sổ thì kẹp thẻ vào trong
  useEffect(() => {
    const onResize = () => {
      setRoomPos((prev) => clampRoom(prev.x, prev.y, roomSize.width, roomSize.height));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [roomSize.width, roomSize.height]);

  // Kết nối và quản lý phiên phòng học
  const session = useStudyRoomSession({
    user,
    authLoading,
    getToken,
    isOpen,
    stableOnOpen,
    stableOnClose,
    roomSize,
    setRoomSize,
    setRoomPos,
    setIsFullscreen,
  });

  // Esc chỉ đóng bảng chờ, đang gọi thì giữ máy (tránh rớt cuộc gọi)
  useEffect(() => {
    if (!isOpen || session.token) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        stableOnClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, session.token, stableOnClose]);

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

  if (isMobile) {
    return (
      <MobileRoomsSheet
        isOpen={isOpen}
        onClose={stableOnClose}
        onOpen={stableOnOpen}
        onBack={onBack}
        backLabel={backLabel}
        soundEnabled={soundEnabled}
        soundType={soundType}
        user={user}
        authLoading={authLoading}
        isSigningIn={isSigningIn}
        authError={authError}
        signIn={signIn}
        displayName={session.displayName}
        setDisplayName={session.setDisplayName}
        roomName={session.roomName}
        setRoomName={session.setRoomName}
        openRooms={session.openRooms}
        loadingRooms={session.loadingRooms}
        loadOpenRooms={session.loadOpenRooms}
        handleJoinListed={session.handleJoinListed}
        handleJoin={session.handleJoin}
        canJoin={session.canJoin}
        joining={session.joining}
        error={session.error}
        token={session.token}
        serverUrl={session.serverUrl}
        joinedRoom={session.joinedRoom}
        handleLeave={session.handleLeave}
        exitNotice={session.exitNotice}
        onDismissExitNotice={session.handleDismissExitNotice}
        onRejoinExitNotice={session.handleRejoinFromNotice}
        isAvailable={getLiveKitEndpoints().isAvailable}
        maxParticipants={session.maxParticipants}
        remainingMinutes={session.remainingMinutes}
        quotaStatus={session.quotaStatus}
        sessionMaxMinutes={session.sessionMaxMinutes}
        preJoinConfig={session.preJoinConfig}
        onPreJoinSubmit={session.handlePreJoinSubmit}
        onPreJoinCancel={session.handlePreJoinCancel}
        initialMedia={session.initialMedia}
        handleCopyLobbyInvite={session.handleCopyLobbyInvite}
        userRole={session.userRole}
        isHost={session.isHost}
        isCoHost={session.isCoHost}
        initialIsLocked={session.isRoomLocked}
        initialHasPassword={session.roomHasPassword}
        getIdToken={getToken}
      />
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          style={{ zIndex: isFullscreen ? 90 : zIndex }}
          className="hidden sm:block fixed inset-0 pointer-events-none overflow-hidden"
        >
          <motion.div
            ref={panelRef}
            key="rooms-panel"
            drag={!isFullscreen}
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            dragElastic={0}
            onPointerDownCapture={onFocus}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={(_, info) => {
              if (isFullscreen) return;
              setIsDragging(false);
              if (Math.hypot(info.offset.x, info.offset.y) < 2) return;
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
            animate={isFullscreen ? { opacity: 1, scale: 1, x: 0, y: 0 } : { opacity: 1, scale: 1 }}
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
                    zIndex: 90,
                  }
                : {
                    top: 0,
                    left: 0,
                    x: roomPos.x,
                    y: roomPos.y,
                    width: session.token ? roomSize.width : 400,
                    height: session.token ? roomSize.height : "auto",
                    zIndex,
                  }
            }
            className={`hidden sm:flex pointer-events-auto fixed flex-col select-none will-change-transform ${
              isFullscreen ? "" : "transform-gpu"
            } ${
              isFullscreen
                ? "inset-0 w-screen h-screen rounded-none bg-neutral-950/95 backdrop-blur-3xl z-[90] border-none shadow-none"
                : `min-w-[300px] min-h-[240px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-120px)] rounded-3xl bg-black/60 hover:bg-black/65 backdrop-blur-2xl border overflow-hidden ${
                    isDragging
                      ? "shadow-[0_30px_80px_rgba(0,0,0,0.65)] ring-2 ring-emerald-500/40 cursor-grabbing border-white/15"
                      : "shadow-[0_20px_50px_rgba(0,0,0,0.6)] border-white/15"
                  }`
            }`}
          >
            {!isFullscreen && (
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none z-10" />
            )}

            {!session.token ? (
              session.preJoinConfig ? (
                <div className="flex-1 min-h-0 overflow-y-auto custom-study-scroll flex flex-col">
                  <RoomPreJoinView
                    roomName={session.preJoinConfig.room}
                    displayName={session.preJoinConfig.name}
                    passwordMode={session.preJoinConfig.passwordMode}
                    onJoin={session.handlePreJoinSubmit}
                    onCancel={session.handlePreJoinCancel}
                    onDragStart={(e) => dragControls.start(e)}
                    joining={session.joining}
                  />
                </div>
              ) : (
                <RoomLobbyView
                  user={user}
                  authLoading={authLoading}
                  isSigningIn={isSigningIn}
                  authError={authError}
                  signIn={signIn}
                  displayName={session.displayName}
                  setDisplayName={session.setDisplayName}
                  roomName={session.roomName}
                  setRoomName={session.setRoomName}
                  openRooms={session.openRooms}
                  loadingRooms={session.loadingRooms}
                  loadOpenRooms={session.loadOpenRooms}
                  handleJoinListed={session.handleJoinListed}
                  handleJoin={session.handleJoin}
                  canJoin={session.canJoin}
                  joining={session.joining}
                  error={session.error}
                  exitNotice={session.exitNotice}
                  onDismissExitNotice={session.handleDismissExitNotice}
                  onRejoinExitNotice={session.handleRejoinFromNotice}
                  maxParticipants={session.maxParticipants}
                  quotaStatus={session.quotaStatus}
                  handleCopyLobbyInvite={session.handleCopyLobbyInvite}
                  onClose={onClose}
                  onDragStart={(e) => dragControls.start(e)}
                  isDragging={isDragging}
                  isFullscreen={isFullscreen}
                />
              )
            ) : (
              <LiveKitRoom
                token={session.token}
                serverUrl={session.serverUrl}
                connect
                audio={
                  session.initialMedia.audio
                    ? session.initialMedia.audioDeviceId
                      ? { deviceId: session.initialMedia.audioDeviceId }
                      : true
                    : false
                }
                video={
                  session.initialMedia.video
                    ? session.initialMedia.videoDeviceId
                      ? { deviceId: session.initialMedia.videoDeviceId }
                      : true
                    : false
                }
                options={{
                  audioCaptureDefaults: session.initialMedia.audioDeviceId
                    ? { deviceId: session.initialMedia.audioDeviceId }
                    : undefined,
                  videoCaptureDefaults: undefined,
                  adaptiveStream: true,
                  dynacast: true,
                }}
                className="flex flex-col h-full min-h-0"
                onDisconnected={session.handleLeave}
              >
                <StudyRoomView
                  roomName={session.joinedRoom}
                  onLeave={session.handleLeave}
                  sideBySide={isFullscreen || wide}
                  onDragStart={(e) => dragControls.start(e)}
                  isFullscreen={isFullscreen}
                  onToggleFullscreen={toggleFullscreen}
                  remainingMinutes={session.remainingMinutes}
                  sessionMaxMinutes={session.sessionMaxMinutes}
                  audioDeviceId={session.initialMedia.audioDeviceId}
                  videoDeviceId={session.initialMedia.videoDeviceId}
                  soundEnabled={soundEnabled}
                  soundType={soundType}
                  userRole={session.userRole}
                  isHost={session.isHost}
                  isCoHost={session.isCoHost}
                  initialIsLocked={session.isRoomLocked}
                  initialHasPassword={session.roomHasPassword}
                  getIdToken={getToken}
                />
              </LiveKitRoom>
            )}

            {/* Tay kéo to/nhỏ */}
            {session.token && !isFullscreen && (
              <div
                onPointerDown={handleResizePointerDown}
                className="absolute bottom-1 right-1 w-6 h-6 cursor-nwse-resize touch-none z-20 flex items-end justify-end opacity-60 hover:opacity-100 transition-opacity"
                title="Kéo để đổi cỡ"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" className="text-slate-400">
                  <path
                    d="M11 1 L1 11 M11 5 L5 11 M11 9 L9 11"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});
