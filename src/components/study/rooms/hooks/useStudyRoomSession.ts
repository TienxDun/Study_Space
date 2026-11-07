"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { trackEvent } from "@/lib/analytics";
import { buildInviteLink, readInviteRoom } from "@/lib/meet-invite";
import {
  DISCONNECT_REASON_CLIENT_INITIATED,
  getRoomExitNotice,
  type RoomExitNotice as RoomExitNoticeData,
} from "../utils/room-exit";
import {
  MIN_JOIN_W,
  MIN_JOIN_H,
  clampRoom,
  getLiveKitEndpoints,
} from "../utils/floating-panel";
import type { PreJoinChoices } from "../components/RoomPreJoinView";

interface UseStudyRoomSessionOptions {
  user: { displayName?: string | null; email?: string | null } | null;
  authLoading: boolean;
  getToken: () => Promise<string | null>;
  isOpen: boolean;
  stableOnOpen: () => void;
  stableOnClose: () => void;
  roomSize: { width: number; height: number };
  setRoomSize: (size: { width: number; height: number }) => void;
  setRoomPos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  setIsFullscreen: (val: boolean) => void;
}

/**
 * Hook quản lý toàn bộ trạng thái phiên phòng học, kết nối LiveKit,
 * danh sách phòng đang mở, sảnh chờ và tự động kết nối lại khi F5.
 */
export function useStudyRoomSession({
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
}: UseStudyRoomSessionOptions) {
  const [displayName, setDisplayName] = useState(
    () => user?.displayName || user?.email?.split("@")[0] || ""
  );
  const [roomName, setRoomName] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState("");
  const [joinedRoom, setJoinedRoom] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exitNotice, setExitNotice] = useState<RoomExitNoticeData | null>(null);
  const [exitRoomName, setExitRoomName] = useState("");
  const [openRooms, setOpenRooms] = useState<
    { name: string; count: number; isLocked?: boolean; hasPassword?: boolean }[]
  >([]);
  const [userRole, setUserRole] = useState<"host" | "co-host" | "member">("member");
  const [isHost, setIsHost] = useState(false);
  const [isCoHost, setIsCoHost] = useState(false);
  const [isRoomLocked, setIsRoomLocked] = useState(false);
  const [roomHasPassword, setRoomHasPassword] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState<number>(6);
  const [remainingMinutes, setRemainingMinutes] = useState<number | null>(null);
  const [quotaStatus, setQuotaStatus] = useState<string>("ok");
  const [sessionMaxMinutes, setSessionMaxMinutes] = useState<number>(120);
  const [loadingRooms, setLoadingRooms] = useState(false);

  const [preJoinConfig, setPreJoinConfig] = useState<{
    room: string;
    name: string;
    passwordMode: "required" | "optional-create" | "none";
  } | null>(null);

  const [initialMedia, setInitialMedia] = useState<{
    audio: boolean;
    video: boolean;
    audioDeviceId?: string;
    videoDeviceId?: string;
  }>({
    audio: false,
    video: false,
  });

  const processedInviteRef = useRef(false);

  // Đọc query ?room= khi component mount; tự điền và mở panel phòng
  useEffect(() => {
    if (typeof window === "undefined" || processedInviteRef.current) return;
    processedInviteRef.current = true;
    const inviteRoom = readInviteRoom(window.location.search);
    if (inviteRoom) {
      setRoomName(inviteRoom);
      stableOnOpen();
    }
  }, [stableOnOpen]);

  // Cập nhật timestamp phiên gọi video định kỳ & trước khi tải lại trang
  useEffect(() => {
    if (!joinedRoom || !token) return;
    const updateSessionHeartbeat = () => {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEYS.roomsActiveSession);
        if (raw) {
          const parsed = JSON.parse(raw);
          parsed.timestamp = Date.now();
          sessionStorage.setItem(STORAGE_KEYS.roomsActiveSession, JSON.stringify(parsed));
        }
      } catch {}
    };
    const interval = setInterval(updateSessionHeartbeat, 15000);
    window.addEventListener("beforeunload", updateSessionHeartbeat);
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", updateSessionHeartbeat);
    };
  }, [joinedRoom, token]);

  // Tự động gán tên từ tài khoản đăng nhập khi user có sẵn
  useEffect(() => {
    if (user) {
      const preferred = user.displayName || user.email?.split("@")[0] || "";
      if (preferred && !displayName) {
        setDisplayName(preferred);
      }
    }
  }, [user, displayName]);

  const doJoin = useCallback(
    async (room: string, name: string, password?: string) => {
      const { tokenUrl, isAvailable } = getLiveKitEndpoints();
      if (!isAvailable || !tokenUrl) {
        setError("Chưa cấu hình máy chủ phòng học nhóm (NEXT_PUBLIC_LIVEKIT_TOKEN_URL).");
        return;
      }
      setJoining(true);
      setError(null);
      try {
        const idToken = await getToken();
        if (!idToken) throw new Error("Đăng nhập rồi mới vào phòng học nhóm được.");
        const res = await fetch(tokenUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ room, name, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (data?.code === "ROOM_PASSWORD_REQUIRED" || data?.code === "INVALID_PASSWORD") {
            setPreJoinConfig({
              room,
              name,
              passwordMode: "required",
            });
            throw new Error(
              data?.code === "ROOM_PASSWORD_REQUIRED"
                ? "Phòng này yêu cầu mật khẩu. Vui lòng nhập mật khẩu để vào."
                : "Mật khẩu phòng không đúng. Vui lòng thử lại."
            );
          }
          if (data?.code === "ROOM_LOCKED") {
            throw new Error("Phòng đang bị khóa bởi trưởng phòng.");
          }
          if (res.status === 409 || data?.code === "ROOM_FULL") {
            throw new Error(data?.error || "Phòng đã đủ người. Thử phòng khác nhé.");
          }
          if (res.status === 429 || data?.code === "QUOTA_EXCEEDED") {
            throw new Error(
              data?.error || "Phòng học nhóm đã hết hạn mức tháng này. Vui lòng quay lại đầu tháng sau."
            );
          }
          throw new Error(data?.error || "Vào phòng thất bại.");
        }
        setToken(data.token);
        setServerUrl(data.url);
        setJoinedRoom(data.room);
        try {
          sessionStorage.setItem(
            STORAGE_KEYS.roomsActiveSession,
            JSON.stringify({
              room: data.room,
              name,
              password,
              timestamp: Date.now(),
            })
          );
        } catch {}
        trackEvent("room-join");
        setExitNotice(null);
        setUserRole(data.role || "member");
        setIsHost(Boolean(data.isHost));
        setIsCoHost(Boolean(data.isCoHost));
        setIsRoomLocked(Boolean(data.isLocked));
        setRoomHasPassword(Boolean(data.hasPassword));
        if (typeof data.maxParticipants === "number") setMaxParticipants(data.maxParticipants);
        if (typeof data.remainingMinutes === "number") setRemainingMinutes(data.remainingMinutes);
        if (typeof data.sessionMaxMinutes === "number") setSessionMaxMinutes(data.sessionMaxMinutes);
        if (typeof data.quotaStatus === "string") setQuotaStatus(data.quotaStatus);

        // Nở thẻ ra kích thước xem được
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
    },
    [roomSize, getToken, setRoomSize, setRoomPos]
  );

  // Tự động kết nối lại (Auto-rejoin) vào phòng khi vừa F5
  const autoRejoinAttemptedRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || authLoading || autoRejoinAttemptedRef.current) return;
    autoRejoinAttemptedRef.current = true;

    try {
      const raw = sessionStorage.getItem(STORAGE_KEYS.roomsActiveSession);
      if (!raw) return;
      const session = JSON.parse(raw);
      if (session?.room && session?.name && Date.now() - session.timestamp < 120000) {
        if (!user) {
          sessionStorage.removeItem(STORAGE_KEYS.roomsActiveSession);
          return;
        }
        setRoomName(session.room);
        setInitialMedia({ audio: false, video: false });
        stableOnOpen();
        toast.info(`Đang tự động kết nối lại vào phòng ${session.room}...`, { id: "rejoin-room" });
        doJoin(session.room, session.name, session.password).catch(() => {
          try {
            sessionStorage.removeItem(STORAGE_KEYS.roomsActiveSession);
          } catch {}
        });
      } else {
        sessionStorage.removeItem(STORAGE_KEYS.roomsActiveSession);
      }
    } catch {
      try {
        sessionStorage.removeItem(STORAGE_KEYS.roomsActiveSession);
      } catch {}
    }
  }, [authLoading, user, stableOnOpen, doJoin]);

  const resolvedDisplayName =
    displayName.trim() || user?.displayName || user?.email?.split("@")[0] || "";

  const handleCopyLobbyInvite = useCallback(async () => {
    const trimmed = roomName.trim();
    if (!trimmed) {
      toast.error("Nhập tên phòng trước khi copy link mời");
      return;
    }
    try {
      await navigator.clipboard.writeText(buildInviteLink(trimmed));
      toast.success("Đã copy link mời");
    } catch {
      toast.error("Không thể copy link mời");
    }
  }, [roomName]);

  const handleStartJoin = useCallback(
    (
      targetRoom: string,
      targetName: string,
      explicitPasswordMode?: "required" | "optional-create" | "none"
    ) => {
      if (!targetRoom.trim() || !targetName.trim() || joining) return;
      setError(null);

      let mode = explicitPasswordMode;
      if (!mode) {
        const found = openRooms.find((r) => r.name === targetRoom.trim());
        if (found) {
          mode = found.hasPassword ? "required" : "none";
        } else {
          mode = "optional-create";
        }
      }

      setPreJoinConfig({
        room: targetRoom.trim(),
        name: targetName.trim(),
        passwordMode: mode,
      });
    },
    [joining, openRooms]
  );

  const handleJoin = useCallback(() => {
    if (!resolvedDisplayName || !roomName.trim() || joining) return;
    handleStartJoin(roomName.trim(), resolvedDisplayName);
  }, [resolvedDisplayName, roomName, joining, handleStartJoin]);

  const handleJoinListed = useCallback(
    (roomItem: { name: string; hasPassword?: boolean }) => {
      if (!resolvedDisplayName) {
        setError("Nhập tên hiển thị của bạn ở dưới trước rồi bấm Vào.");
        return;
      }
      setRoomName(roomItem.name);
      handleStartJoin(
        roomItem.name,
        resolvedDisplayName,
        roomItem.hasPassword ? "required" : "none"
      );
    },
    [resolvedDisplayName, handleStartJoin]
  );

  const handlePreJoinSubmit = useCallback(
    async (choices: PreJoinChoices) => {
      if (!preJoinConfig) return;
      const { room, name } = preJoinConfig;
      setInitialMedia({
        audio: choices.audioEnabled,
        video: choices.videoEnabled,
        audioDeviceId: choices.audioDeviceId,
        videoDeviceId: choices.videoDeviceId,
      });
      setPreJoinConfig(null);
      await doJoin(room, name, choices.password);
    },
    [preJoinConfig, doJoin]
  );

  const handlePreJoinCancel = useCallback(() => {
    setPreJoinConfig(null);
  }, []);

  const loadOpenRooms = useCallback(async () => {
    const { roomsUrl, isAvailable } = getLiveKitEndpoints();
    if (!isAvailable || !roomsUrl) {
      setOpenRooms([]);
      return;
    }
    setLoadingRooms(true);
    try {
      const idToken = await getToken();
      const res = await fetch(roomsUrl, {
        cache: "no-store",
        ...(idToken ? { headers: { Authorization: `Bearer ${idToken}` } } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setOpenRooms(data.rooms || []);
        if (typeof data.maxParticipants === "number") setMaxParticipants(data.maxParticipants);
        if (typeof data.remainingMinutes === "number") setRemainingMinutes(data.remainingMinutes);
        if (typeof data.quotaStatus === "string") setQuotaStatus(data.quotaStatus);
      }
    } catch {}
    finally {
      setLoadingRooms(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (isOpen && !token) loadOpenRooms();
  }, [isOpen, token, loadOpenRooms]);

  const handleRejoinFromNotice = useCallback(() => {
    if (!exitRoomName || joining) return;
    stableOnOpen();
    handleStartJoin(exitRoomName, resolvedDisplayName);
  }, [exitRoomName, joining, stableOnOpen, resolvedDisplayName, handleStartJoin]);

  const handleDismissExitNotice = useCallback(() => setExitNotice(null), []);

  const leavingRef = useRef(false);

  const handleLeave = useCallback(
    function handleLeave(reason?: number) {
      if (leavingRef.current) return;
      leavingRef.current = true;

      const voluntary =
        arguments.length === 0 || reason === DISCONNECT_REASON_CLIENT_INITIATED;
      const exitedRoom = joinedRoom;

      if (!voluntary) {
        const notice = getRoomExitNotice(reason, exitedRoom);
        if (notice.showNotice) {
          setExitNotice(notice);
          setExitRoomName(exitedRoom);
          toast.warning(notice.title, {
            id: "room-exit-notice",
            description: notice.description,
            duration: 10000,
          });
        }
      }

      if (typeof document !== "undefined" && document.fullscreenElement) {
        const doc = document as Document & {
          exitFullscreen?: () => Promise<void>;
          webkitExitFullscreen?: () => void;
        };
        const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
        if (typeof exit === "function") {
          try {
            const result = exit.call(doc);
            if (result && typeof (result as Promise<void>).catch === "function") {
              (result as Promise<void>).catch(() => {});
            }
          } catch {}
        }
      }
      try {
        sessionStorage.removeItem(STORAGE_KEYS.roomsActiveSession);
      } catch {}
      setIsFullscreen(false);
      setToken(null);
      setServerUrl("");
      setJoinedRoom("");
      setError(null);
      setPreJoinConfig(null);
      setInitialMedia({ audio: false, video: false });
      stableOnClose();
      setTimeout(() => {
        leavingRef.current = false;
      }, 300);
    },
    [stableOnClose, joinedRoom, setIsFullscreen]
  );

  const canJoin = Boolean(
    user && resolvedDisplayName.length > 0 && roomName.trim().length > 0 && !joining
  );

  return {
    displayName,
    setDisplayName,
    roomName,
    setRoomName,
    token,
    serverUrl,
    joinedRoom,
    joining,
    error,
    exitNotice,
    openRooms,
    userRole,
    isHost,
    isCoHost,
    isRoomLocked,
    roomHasPassword,
    maxParticipants,
    remainingMinutes,
    quotaStatus,
    sessionMaxMinutes,
    loadingRooms,
    preJoinConfig,
    initialMedia,
    canJoin,
    loadOpenRooms,
    handleJoinListed,
    handleJoin,
    handleLeave,
    handlePreJoinSubmit,
    handlePreJoinCancel,
    handleCopyLobbyInvite,
    handleRejoinFromNotice,
    handleDismissExitNotice,
  };
}
