"use client";

import { useState, useEffect } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import {
  LockKeyIcon,
  LockKeyOpenIcon,
  KeyIcon,
  XIcon,
  EyeIcon,
  EyeSlashIcon,
  CircleNotchIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { getMeetEndpoints } from "@/lib/meet-invite";

interface RoomHostControlsModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomName: string;
  isHost: boolean;
  isCoHost: boolean;
  isLocked: boolean;
  hasPassword: boolean;
  onUpdateLockState?: (locked: boolean) => void;
  onUpdatePasswordState?: (hasPass: boolean) => void;
  getIdToken: () => Promise<string | null>;
}

export function RoomHostControlsModal({
  isOpen,
  onClose,
  roomName,
  isHost,
  isLocked: initialLocked,
  hasPassword: initialHasPassword,
  onUpdateLockState,
  onUpdatePasswordState,
  getIdToken,
}: RoomHostControlsModalProps) {
  const [locked, setLocked] = useState(initialLocked);
  const [hasPassword, setHasPassword] = useState(initialHasPassword);

  useEffect(() => {
    setLocked(initialLocked);
  }, [initialLocked]);

  useEffect(() => {
    setHasPassword(initialHasPassword);
  }, [initialHasPassword]);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loadingLock, setLoadingLock] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  const { baseUrl } = getMeetEndpoints();

  const handleToggleLock = async () => {
    if (!baseUrl) return;
    setLoadingLock(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Chưa đăng nhập.");
      const nextAction = locked ? "unlock" : "lock";
      const res = await fetch(`${baseUrl}/rooms/${encodeURIComponent(roomName)}/${nextAction}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Không thể đổi trạng thái khóa phòng.");

      const nextLocked = !locked;
      setLocked(nextLocked);
      onUpdateLockState?.(nextLocked);
      toast.success(nextLocked ? "Đã khóa phòng học (chỉ Host/Phó phòng vào được)" : "Đã mở khóa phòng học");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Thao tác thất bại");
    } finally {
      setLoadingLock(false);
    }
  };

  const handleSavePassword = async () => {
    if (!baseUrl || !newPassword.trim()) return;
    setLoadingPassword(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Chưa đăng nhập.");
      const res = await fetch(`${baseUrl}/rooms/${encodeURIComponent(roomName)}/password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: newPassword.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Không thể đặt mật khẩu.");

      setHasPassword(true);
      setNewPassword("");
      onUpdatePasswordState?.(true);
      toast.success("Đã đặt mật khẩu mới cho phòng học");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Đặt mật khẩu thất bại");
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleRemovePassword = async () => {
    if (!baseUrl) return;
    setLoadingPassword(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Chưa đăng nhập.");
      const res = await fetch(`${baseUrl}/rooms/${encodeURIComponent(roomName)}/password`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Không thể xóa mật khẩu.");

      setHasPassword(false);
      setNewPassword("");
      onUpdatePasswordState?.(false);
      toast.success("Đã gỡ mật khẩu phòng học");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xóa mật khẩu thất bại");
    } finally {
      setLoadingPassword(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Bảng quản lý phòng học"
      backdropClassName="z-[190] bg-black/60 backdrop-blur-md"
      panelClassName="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-sm rounded-2xl border border-white/15 bg-neutral-950/88 text-white z-[200] flex flex-col overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.75),inset_0_1px_1.5px_rgba(255,255,255,0.18)]"
    >
      <div className="absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none z-10" />

      {/* Header chuẩn hóa */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">Quản lý phòng</h2>
          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono text-xs">
            {roomName}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-7 w-7 shrink-0 grid place-items-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Đóng"
        >
          <XIcon size={14} weight="bold" aria-hidden="true" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Hàng 1: Khóa phòng học */}
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/[0.05] border border-white/10 text-zinc-300 shrink-0">
              {locked ? (
                <LockKeyIcon size={15} weight="fill" className="text-rose-400" />
              ) : (
                <LockKeyOpenIcon size={15} weight="bold" className="text-emerald-400" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-white block">Khóa phòng học</span>
              <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                {locked
                  ? "Đang khóa: Chỉ Host và Phó phòng được vào"
                  : "Đang mở: Bất kỳ ai có liên kết đều vào được"}
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={locked}
            disabled={loadingLock}
            onClick={() => void handleToggleLock()}
            title={locked ? "Bấm để mở khóa phòng" : "Bấm để khóa phòng"}
            aria-label="Khóa phòng học"
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-wait ${
              locked
                ? "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.35)]"
                : "bg-white/15 border border-white/10"
            }`}
          >
            {loadingLock ? (
              <span className="w-full flex items-center justify-center">
                <CircleNotchIcon className="w-3.5 h-3.5 animate-spin text-white" />
              </span>
            ) : (
              <span
                className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                  locked ? "translate-x-5" : "translate-x-0"
                }`}
              />
            )}
          </button>
        </div>

        {/* Hàng 2: Mật khẩu phòng */}
        <div className="space-y-2.5 pb-4 border-b border-white/[0.08]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/[0.05] border border-white/10 text-amber-300 shrink-0">
                <KeyIcon size={15} weight="fill" />
              </span>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-white block">Mật khẩu phòng</span>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                  {hasPassword ? "Yêu cầu mật khẩu khi vào phòng" : "Bảo vệ phòng bằng mật khẩu"}
                </p>
              </div>
            </div>

            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${
                hasPassword
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : "bg-white/[0.04] text-zinc-400 border-white/10"
              }`}
            >
              {hasPassword ? "Đang bật" : "Chưa đặt"}
            </span>
          </div>

          {isHost ? (
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={hasPassword ? "Nhập mật khẩu mới..." : "Đặt mật khẩu phòng..."}
                    className="w-full h-9 px-3.5 pr-8 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/25 focus:ring-1 focus:ring-white/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title={showNewPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    aria-label={showNewPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showNewPassword ? (
                      <EyeSlashIcon className="w-3.5 h-3.5" />
                    ) : (
                      <EyeIcon className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleSavePassword}
                  disabled={loadingPassword || !newPassword.trim()}
                  className={`h-9 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 active:scale-95 ${
                    newPassword.trim()
                      ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm shadow-emerald-500/25"
                      : "bg-white/[0.06] text-zinc-500 border border-white/10 cursor-not-allowed opacity-50"
                  }`}
                >
                  {loadingPassword ? (
                    <CircleNotchIcon className="w-3.5 h-3.5 animate-spin" />
                  ) : hasPassword ? (
                    "Đổi"
                  ) : (
                    "Lưu"
                  )}
                </button>
              </div>

              {hasPassword && (
                <div className="flex justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={handleRemovePassword}
                    disabled={loadingPassword}
                    className="text-[11px] text-rose-400 hover:text-rose-300 transition-colors cursor-pointer disabled:opacity-40"
                  >
                    Xóa mật khẩu
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-zinc-500">
              Chỉ Trưởng phòng mới có quyền đổi mật khẩu.
            </p>
          )}
        </div>

        {/* Footer: Thông tin vai trò & quyền hạn */}
        <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-0.5">
          <span>Vai trò của bạn:</span>
          <span className="text-zinc-200 font-medium">
            {isHost ? "Trưởng phòng (Toàn quyền)" : "Phó phòng (Hỗ trợ điều phối)"}
          </span>
        </div>
      </div>
    </ModalShell>
  );
}
