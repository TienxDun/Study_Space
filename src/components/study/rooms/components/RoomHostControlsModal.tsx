"use client";

import { useState, useEffect } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import {
  ShieldCheckIcon,
  XIcon,
  LockKeyIcon,
  LockKeyOpenIcon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
  TrashIcon,
  CheckIcon,
  CircleNotchIcon,
  CrownIcon,
  StarIcon,
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
      backdropClassName="z-[190] bg-black/50 backdrop-blur-md"
      panelClassName="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md glass-panel p-0 text-white z-[200] overflow-hidden"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent pointer-events-none z-10" />

      <div className="relative px-5 pt-5 pb-4 border-b border-white/10 bg-white/[0.02]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
              <ShieldCheckIcon className="w-5 h-5" weight="fill" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-white flex items-center gap-1.5 truncate">
                <span>Quản lý phòng</span>
                <span className="text-emerald-400 font-mono truncate">{roomName}</span>
              </h2>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] border border-white/10 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                  {isHost ? "Trưởng phòng" : "Phó phòng"}
                </span>
                <span className="text-[10px] text-slate-500">
                  {isHost ? "Toàn quyền quản trị" : "Hỗ trợ điều phối"}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/10 text-slate-300 hover:text-white transition-colors"
            aria-label="Đóng"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                {locked ? (
                  <LockKeyIcon className="w-4 h-4 text-rose-400" weight="fill" />
                ) : (
                  <LockKeyOpenIcon className="w-4 h-4 text-emerald-400" />
                )}
                <span className="text-sm font-semibold text-white">Trạng thái truy cập</span>
              </div>
              <p className="text-[11px] text-slate-400">
                {locked
                  ? "Thành viên mới không thể vào phòng lúc này."
                  : "Bất kỳ ai có liên kết đều có thể tham gia."}
              </p>
            </div>
            <span
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold border ${
                locked
                  ? "bg-rose-500/15 text-rose-300 border-rose-500/25"
                  : "bg-emerald-500/15 text-emerald-300 border-emerald-500/25"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  locked ? "bg-rose-400" : "bg-emerald-400"
                }`}
              />
              {locked ? "Đang khóa" : "Đang mở"}
            </span>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleToggleLock}
              disabled={loadingLock}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer border disabled:opacity-40 disabled:cursor-not-allowed ${
                locked
                  ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border-emerald-500/30"
                  : "bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border-rose-500/30"
              }`}
            >
              {loadingLock ? (
                <CircleNotchIcon className="w-3.5 h-3.5 animate-spin" />
              ) : locked ? (
                <>
                  <LockKeyOpenIcon className="w-3.5 h-3.5" />
                  <span>Mở phòng</span>
                </>
              ) : (
                <>
                  <LockKeyIcon className="w-3.5 h-3.5" weight="fill" />
                  <span>Khóa phòng</span>
                </>
              )}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <KeyIcon className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-sm font-semibold text-white truncate">Mật khẩu phòng bảo mật</span>
            </div>
            {hasPassword ? (
              <span className="shrink-0 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25 px-2 py-0.5 text-[10px] font-semibold">
                Đang bật
              </span>
            ) : (
              <span className="shrink-0 text-[10px] text-slate-500">Chưa đặt</span>
            )}
          </div>

          {isHost ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={hasPassword ? "Nhập mật khẩu mới để đổi..." : "Nhập mật khẩu cho phòng..."}
                    className="w-full px-3.5 py-2 pr-10 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-white transition-colors cursor-pointer"
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
                  className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-amber-200 border border-amber-500/30 text-xs font-semibold transition-all cursor-pointer"
                >
                  {loadingPassword ? (
                    <CircleNotchIcon className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <CheckIcon className="w-3.5 h-3.5" />
                      <span>{hasPassword ? "Đổi" : "Đặt"}</span>
                    </>
                  )}
                </button>
              </div>

              {hasPassword && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleRemovePassword}
                    disabled={loadingPassword}
                    className="inline-flex items-center gap-1.5 text-[11px] text-rose-400 hover:text-rose-300 hover:underline cursor-pointer disabled:opacity-40"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                    <span>Xóa bỏ mật khẩu phòng</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">
              Chỉ Trưởng phòng mới có quyền thiết lập hoặc thay đổi mật khẩu phòng.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2.5">
          <div className="text-sm font-semibold text-white">Phân quyền</div>
          <div className="space-y-2">
            <div className="flex items-start gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                <CrownIcon className="w-3.5 h-3.5" weight="fill" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-200">Trưởng phòng</div>
                <p className="text-[11px] text-slate-400">Toàn quyền quản trị, mật khẩu và phó phòng.</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300 border border-sky-500/20">
                <StarIcon className="w-3.5 h-3.5" weight="fill" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-200">Phó phòng</div>
                <p className="text-[11px] text-slate-400">Hỗ trợ khóa/mở phòng, tắt mic và mời thành viên rời phòng.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </ModalShell>
  );
}
