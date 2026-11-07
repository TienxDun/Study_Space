"use client";

import React from "react";
import {
  UsersIcon,
  XIcon,
  CircleNotchIcon,
  ArrowClockwiseIcon,
  SignInIcon,
  LockKeyIcon,
  KeyIcon,
  VideoCameraIcon,
  LinkSimpleIcon,
} from "@phosphor-icons/react";
import { GoogleIcon } from "@/components/study/auth";
import { RoomExitNotice } from "./RoomExitNotice";
import type { RoomExitNotice as RoomExitNoticeData } from "../utils/room-exit";
import { getLiveKitEndpoints } from "../utils/floating-panel";

export interface RoomLobbyViewProps {
  user: { displayName?: string | null; email?: string | null } | null;
  authLoading: boolean;
  isSigningIn: boolean;
  authError?: string | null;
  signIn: () => void;
  displayName: string;
  setDisplayName: (val: string) => void;
  roomName: string;
  setRoomName: (val: string) => void;
  openRooms: Array<{ name: string; count: number; isLocked?: boolean; hasPassword?: boolean }>;
  loadingRooms: boolean;
  loadOpenRooms: () => void;
  handleJoinListed: (roomItem: { name: string; hasPassword?: boolean }) => void;
  handleJoin: () => void;
  canJoin: boolean;
  joining: boolean;
  error: string | null;
  exitNotice: RoomExitNoticeData | null;
  onDismissExitNotice: () => void;
  onRejoinExitNotice: () => void;
  maxParticipants: number;
  quotaStatus: string;
  handleCopyLobbyInvite: () => void;
  onClose: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  isDragging: boolean;
  isFullscreen: boolean;
}

/**
 * Giao diện sảnh chờ phòng học nhóm (Desktop Lobby View).
 * Hiển thị màn hình đăng nhập Google nếu chưa đăng nhập,
 * hoặc form nhập tên, danh sách phòng đang mở và nút tạo phòng mới.
 */
export const RoomLobbyView = React.memo(function RoomLobbyView({
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
  exitNotice,
  onDismissExitNotice,
  onRejoinExitNotice,
  maxParticipants,
  quotaStatus,
  handleCopyLobbyInvite,
  onClose,
  onDragStart,
  isDragging,
  isFullscreen,
}: RoomLobbyViewProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto custom-study-scroll flex flex-col">
      {/* Thanh kéo / Header */}
      <div
        onPointerDown={onDragStart}
        className="relative group/header flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/10 cursor-grab active:cursor-grabbing touch-none shrink-0"
      >
        {/* Vạch kéo ở giữa mép trên - span rộng khi hover vào thanh tiêu đề */}
        {!isFullscreen && (
          <div
            className="absolute top-1.5 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center pointer-events-none"
            aria-hidden="true"
          >
            <span
              className={`block h-1 rounded-full transition-all duration-200 ease-out ${
                isDragging
                  ? "w-16 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]"
                  : "w-10 bg-white/30 group-hover/header:w-16 group-hover/header:bg-white/70"
              }`}
            />
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
            <UsersIcon className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-white">Phòng học nhóm</h2>
            <p className="text-xs text-slate-400">
              Vào phòng là thấy nhau, tối đa {maxParticipants} người
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 flex items-center justify-center text-white/70 hover:text-white transition-all shadow-sm cursor-pointer"
            title="Đóng (Esc)"
            aria-label="Đóng phòng học nhóm"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {quotaStatus === "unknown" && (
        <div className="mx-4 sm:mx-5 mt-2.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-200 text-xs text-center font-medium">
          Không kiểm tra được hạn mức tháng
        </div>
      )}

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
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span>Trò chuyện và học cùng nhau</span>
            </div>
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
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
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold truncate">{r.name}</p>
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
                        <p className="text-[11px] text-emerald-300/90">
                          {r.count} người đang học
                        </p>
                      </div>
                      <button
                        onClick={() => handleJoinListed(r)}
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
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-slate-300">Hoặc tạo phòng mới</p>
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
              </div>
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
                    Có thể xem trước và tùy chỉnh mic/camera trước khi vào phòng.
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

          {exitNotice && (
            <RoomExitNotice
              notice={exitNotice}
              onDismiss={onDismissExitNotice}
              onRejoin={onRejoinExitNotice}
            />
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
  );
});
