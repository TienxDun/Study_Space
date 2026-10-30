"use client";

import React from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import "@livekit/components-styles";
import {
  UsersIcon,
  CircleNotchIcon,
  ArrowClockwiseIcon,
  SignInIcon,
  LockKeyIcon,
  KeyIcon,
  SparkleIcon,
  VideoCameraIcon,
  ShieldCheckIcon,
  LinkSimpleIcon,
} from "@phosphor-icons/react";
import { GoogleIcon } from "@/components/study/auth";
import { MobileSheetShell } from "./MobileSheetShell";
import { MobileRoomView } from "../rooms/MobileRoomView";
import { MobileActiveRoomPill } from "../rooms/MobileActiveRoomPill";
import { RoomPreJoinView, type PreJoinChoices } from "@/components/study/rooms/components/RoomPreJoinView";
import { RoomExitNotice } from "@/components/study/rooms/components/RoomExitNotice";
import type { RoomExitNotice as RoomExitNoticeData } from "@/components/study/rooms/utils/room-exit";
import type { PomodoroSoundType } from "@/components/study/study-sound";
import type { User } from "firebase/auth";

export interface MobileRoomsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  user: User | null;
  authLoading: boolean;
  isSigningIn: boolean;
  authError: string | null;
  signIn: () => void;
  displayName: string;
  setDisplayName: (val: string) => void;
  roomName: string;
  setRoomName: (val: string) => void;
  openRooms: { name: string; count: number; isLocked?: boolean; hasPassword?: boolean }[];
  loadingRooms: boolean;
  loadOpenRooms: () => void;
  handleJoinListed: (roomItem: { name: string; hasPassword?: boolean }) => void;
  handleJoin: () => void;
  canJoin: boolean;
  joining: boolean;
  error: string | null;
  token: string | null;
  serverUrl: string;
  joinedRoom: string;
  handleLeave: (reason?: number) => void;
  exitNotice?: RoomExitNoticeData | null;
  onDismissExitNotice?: () => void;
  onRejoinExitNotice?: () => void;
  isAvailable: boolean;
  onBack?: () => void;
  backLabel?: string;
  maxParticipants?: number;
  remainingMinutes?: number | null;
  quotaStatus?: string;
  sessionMaxMinutes?: number;
  preJoinConfig?: {
    room: string;
    name: string;
    passwordMode: "required" | "optional-create" | "none";
  } | null;
  onPreJoinSubmit?: (choices: PreJoinChoices) => void;
  onPreJoinCancel?: () => void;
  initialMedia?: {
    audio: boolean;
    video: boolean;
    audioDeviceId?: string;
    videoDeviceId?: string;
  };
  handleCopyLobbyInvite?: () => void;
  soundEnabled?: boolean;
  soundType?: PomodoroSoundType;
  userRole?: "host" | "co-host" | "member";
  isHost?: boolean;
  isCoHost?: boolean;
  initialIsLocked?: boolean;
  initialHasPassword?: boolean;
  getIdToken?: () => Promise<string | null>;
}

export function MobileRoomsSheet({
  isOpen,
  onClose,
  onOpen,
  onBack,
  backLabel,
  user,
  authLoading,
  isSigningIn,
  authError,
  signIn,
  displayName,
  setDisplayName,
  roomName,
  setRoomName,
  openRooms,
  loadingRooms,
  loadOpenRooms,
  handleJoinListed,
  handleJoin,
  canJoin,
  joining,
  error,
  token,
  serverUrl,
  joinedRoom,
  handleLeave,
  exitNotice = null,
  onDismissExitNotice,
  onRejoinExitNotice,
  isAvailable,
  maxParticipants = 6,
  remainingMinutes,
  quotaStatus = "ok",
  sessionMaxMinutes = 120,
  preJoinConfig = null,
  onPreJoinSubmit,
  onPreJoinCancel,
  initialMedia = { audio: false, video: false },
  handleCopyLobbyInvite,
  soundEnabled,
  soundType,
  userRole = "member",
  isHost = false,
  isCoHost = false,
  initialIsLocked = false,
  initialHasPassword = false,
  getIdToken,
}: MobileRoomsSheetProps) {
  // Khi ĐÃ VÀO PHÒNG: LiveKitRoom luôn giữ kết nối ngầm kể cả khi đóng bảng để chuyển tab
  if (token) {
    return (
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect
        audio={
          initialMedia.audio
            ? (initialMedia.audioDeviceId ? { deviceId: initialMedia.audioDeviceId } : true)
            : false
        }
        video={
          initialMedia.video
            ? (initialMedia.videoDeviceId ? { deviceId: initialMedia.videoDeviceId } : true)
            : false
        }
        options={{
          audioCaptureDefaults: initialMedia.audioDeviceId ? { deviceId: initialMedia.audioDeviceId } : undefined,
          videoCaptureDefaults: initialMedia.videoDeviceId ? { deviceId: initialMedia.videoDeviceId } : undefined,
          adaptiveStream: true,
          dynacast: true,
        }}
        className="w-full h-full min-h-0"
        onDisconnected={handleLeave}
      >
        {/* Âm thanh phòng học luôn phát ngầm để bạn vẫn nghe tiếng bạn bè khi chuyển tab */}
        <RoomAudioRenderer />

        {/* Bảng trượt đáy phòng học (Cao ~85% màn hình, nằm trên thanh 5 nút navbar) */}
        <MobileSheetShell
          isOpen={isOpen}
          onClose={onClose}
          onBack={onBack}
          backLabel={backLabel}
          sheetId="rooms"
          title={
            <span className="text-sm font-bold text-white tracking-tight truncate">
              {joinedRoom}
            </span>
          }
          heightClassName="h-[84dvh] max-h-[88dvh]"
        >
          <MobileRoomView
            roomName={joinedRoom}
            onLeave={handleLeave}
            remainingMinutes={remainingMinutes}
            sessionMaxMinutes={sessionMaxMinutes}
            audioDeviceId={initialMedia.audioDeviceId}
            videoDeviceId={initialMedia.videoDeviceId}
            soundEnabled={soundEnabled}
            soundType={soundType}
            userRole={userRole}
            isHost={isHost}
            isCoHost={isCoHost}
            initialIsLocked={initialIsLocked}
            initialHasPassword={initialHasPassword}
            getIdToken={getIdToken}
          />
        </MobileSheetShell>

        {/* Thanh capsule nhỏ nổi trên thanh navbar khi đóng bảng để làm việc khác */}
        {!isOpen && (
          <MobileActiveRoomPill
            roomName={joinedRoom}
            onReopen={() => onOpen?.()}
            onLeave={handleLeave}
          />
        )}
      </LiveKitRoom>
    );
  }

  // Khi ĐANG Ở BƯỚC PRE-JOIN: Hiển thị giao diện kiểm tra mic/cam
  if (preJoinConfig && onPreJoinSubmit && onPreJoinCancel) {
    return (
        <MobileSheetShell
          isOpen={isOpen}
          onClose={onClose}
          onBack={onBack}
          backLabel={backLabel}
          sheetId="rooms"
          title={
            <span className="flex items-center gap-2">
              <span>Kiểm tra thiết bị</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-400/30 shrink-0">
                Bước xem trước
              </span>
            </span>
          }
          maxHeightClassName="h-auto max-h-[88dvh]"
        >
          <RoomPreJoinView
            roomName={preJoinConfig.room}
            displayName={preJoinConfig.name}
            passwordMode={preJoinConfig.passwordMode}
            onJoin={onPreJoinSubmit}
            onCancel={onPreJoinCancel}
            joining={joining}
            hideHeader
          />
      </MobileSheetShell>
    );
  }

  // Khi CHƯA VÀO PHÒNG: Hiển thị sảnh chờ (Lobby: Đăng nhập Google / Chọn phòng / Tạo phòng)
  return (
    <MobileSheetShell
      isOpen={isOpen}
      onClose={onClose}
      onBack={onBack}
      backLabel={backLabel}
      sheetId="rooms"
      title="Phòng học nhóm"
      maxHeightClassName="h-auto max-h-[85dvh]"
      headerRight={
        user ? (
          <button
            type="button"
            onClick={loadOpenRooms}
            disabled={loadingRooms}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-white bg-white/5 border border-white/10 active:scale-90 transition-all cursor-pointer disabled:opacity-40"
            title="Làm mới danh sách phòng"
          >
            <ArrowClockwiseIcon
              className={`w-4 h-4 ${loadingRooms ? "animate-spin text-emerald-400" : ""}`}
            />
          </button>
        ) : undefined
      }
    >
      <div className="flex-1 flex flex-col px-3 pt-2 pb-4 space-y-4 text-white">
        {quotaStatus === "unknown" && (
          <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-400/30 text-amber-200 text-xs text-center font-medium">
            Không kiểm tra được hạn mức tháng
          </div>
        )}

        {authLoading ? (
          /* Trạng thái đang kiểm tra phiên đăng nhập */
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center text-slate-400 text-xs">
            <CircleNotchIcon className="w-7 h-7 animate-spin text-emerald-400 mb-3" />
            <span className="font-medium">Đang kiểm tra tài khoản...</span>
          </div>
        ) : !user ? (
          /* Trạng thái chưa đăng nhập Google */
          <div className="flex-1 flex flex-col items-center justify-center py-6 px-2 text-center select-none">
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shadow-[0_0_30px_rgba(52,211,153,0.3)]">
                <UsersIcon className="w-8 h-8" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center text-slate-950 shadow-md">
                <LockKeyIcon className="w-3.5 h-3.5" />
              </span>
            </div>

            <h3 className="text-base font-bold text-white mb-1.5 tracking-tight">
              Đăng nhập để vào phòng học
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-5 max-w-[280px]">
              Để giữ môi trường học tập văn minh và an toàn, vui lòng kết nối tài
              khoản Google để tham gia cùng các bạn (tối đa {maxParticipants} người/phòng).
            </p>

            {/* 3 tính năng nổi bật phong cách Liquid Glass */}
            <div className="w-full space-y-2 mb-6 text-left">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center shrink-0">
                  <VideoCameraIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">Bật camera & mic</p>
                  <p className="text-[11px] text-slate-400">Tạo không khí học tập như ở thư viện</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center shrink-0">
                  <SparkleIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">Trò chuyện cùng nhau</p>
                  <p className="text-[11px] text-slate-400">Trò chuyện và học cùng nhau</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center shrink-0">
                  <ShieldCheckIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">Bảo mật danh tính</p>
                  <p className="text-[11px] text-slate-400">Tránh người lạ quấy rầy phiên học</p>
                </div>
              </div>
            </div>

            {authError && (
              <p className="text-xs text-rose-300 bg-rose-500/15 border border-rose-400/30 rounded-xl px-3.5 py-2 mb-4 w-full text-center">
                {authError}
              </p>
            )}

            {/* Nút đăng nhập Google to bản thân thiện ngón cái */}
            <button
              type="button"
              onClick={signIn}
              disabled={isSigningIn}
              className="w-full min-h-[48px] py-3.5 px-5 rounded-2xl text-xs font-bold text-slate-950 bg-white hover:bg-slate-100 active:scale-[0.98] shadow-[0_8px_25px_rgba(255,255,255,0.25)] transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
            >
              {isSigningIn ? (
                <>
                  <CircleNotchIcon className="w-4 h-4 animate-spin text-slate-800" />
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
          /* Trạng thái đã đăng nhập Google */
          <div className="space-y-4">
            {/* 1. Tên hiển thị cá nhân */}
            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="mobile-display-name"
                  className="text-xs font-bold text-slate-200"
                >
                  Tên của bạn trong phòng
                </label>
                <span className="text-[11px] text-emerald-400 truncate max-w-[160px]">
                  {user.email}
                </span>
              </div>
              <input
                id="mobile-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleJoin();
                }}
                placeholder="Nhập tên hiển thị (VD: Lan Anh)"
                maxLength={30}
                className="w-full min-h-[42px] px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400/50 transition-colors"
              />
            </div>

            {/* 2. Danh sách phòng đang mở */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-200">
                    Phòng đang mở (tối đa {maxParticipants} người)
                  </span>
                  {openRooms.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-400/30">
                      {openRooms.length}
                    </span>
                  )}
                </div>
              </div>

              {!isAvailable ? (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-400/25 text-amber-200 text-xs leading-relaxed">
                  Chưa cấu hình máy chủ phòng học LiveKit.
                </div>
              ) : openRooms.length === 0 ? (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center space-y-1">
                  <p className="text-xs text-slate-400">
                    {loadingRooms
                      ? "Đang tìm phòng..."
                      : "Chưa có phòng nào đang mở."}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Tạo phòng mới bên dưới để bắt đầu học cùng bạn bè!
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto custom-study-scroll pr-0.5">
                  {openRooms.map((r) => (
                    <div
                      key={r.name}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-white truncate">
                            {r.name}
                          </p>
                          {r.isLocked && (
                            <span className="p-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px]" title="Phòng đang khóa">
                              <LockKeyIcon className="w-3 h-3" weight="fill" />
                            </span>
                          )}
                          {r.hasPassword && (
                            <span className="p-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px]" title="Có mật khẩu bảo vệ">
                              <KeyIcon className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-[11px] text-emerald-300/90 font-medium">
                            {r.count} người đang học
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleJoinListed(r)}
                        disabled={joining}
                        className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5 shrink-0 shadow-sm"
                      >
                        <SignInIcon className="w-3.5 h-3.5" weight="bold" />
                        <span>Vào ngay</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Hoặc Tạo phòng mới */}
            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="mobile-room-name"
                  className="text-xs font-bold text-slate-200"
                >
                  Hoặc tạo phòng mới
                </label>
                {handleCopyLobbyInvite && (
                  <button
                    type="button"
                    onClick={handleCopyLobbyInvite}
                    disabled={!roomName.trim()}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer disabled:opacity-40"
                    title={roomName.trim() ? "Sao chép link mời phòng này" : "Nhập tên phòng trước"}
                  >
                    <LinkSimpleIcon className="w-3.5 h-3.5" />
                    <span>Copy link mời</span>
                  </button>
                )}
              </div>
              <input
                id="mobile-room-name"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleJoin();
                }}
                placeholder="Đặt tên phòng (VD: on-thi-toan)"
                maxLength={32}
                className="w-full min-h-[42px] px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400/50 transition-colors"
              />
              <div className="pt-1 space-y-1.5">
                <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
                  <UsersIcon className="w-3.5 h-3.5 mt-[1px] shrink-0 text-emerald-400/80" weight="bold" />
                  <span>
                    Ai nhập <span className="font-semibold text-slate-200">cùng tên phòng</span> sẽ tự động gặp nhau.
                  </span>
                </p>
                <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
                  <VideoCameraIcon className="w-3.5 h-3.5 mt-[1px] shrink-0 text-slate-500" weight="bold" />
                  <span>
                    Có thể xem trước và tùy chỉnh mic/camera trước khi vào.
                  </span>
                </p>
              </div>
            </div>

            {/* Thông báo lỗi nếu có */}
            {error && (
              <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-400/30 text-rose-300 text-xs">
                {error}
              </div>
            )}

            {/* Vì sao lần trước người dùng bị đưa ra khỏi phòng */}
            {exitNotice && onDismissExitNotice && (
              <RoomExitNotice
                notice={exitNotice}
                onDismiss={onDismissExitNotice}
                onRejoin={onRejoinExitNotice}
              />
            )}

            {/* Nút hành động chính dưới đáy */}
            <button
              type="button"
              onClick={handleJoin}
              disabled={!canJoin}
              className="w-full min-h-[48px] py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(52,211,153,0.3)]"
            >
              {joining ? (
                <>
                  <CircleNotchIcon className="w-4 h-4 animate-spin text-slate-900" />
                  <span>Đang kết nối vào phòng...</span>
                </>
              ) : (
                <>
                  <UsersIcon className="w-4 h-4" weight="bold" />
                  <span>Vào phòng học</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </MobileSheetShell>
  );
}
