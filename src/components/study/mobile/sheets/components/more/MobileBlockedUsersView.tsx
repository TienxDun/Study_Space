"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowsClockwiseIcon,
  CircleNotchIcon,
  ProhibitIcon,
  UsersIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { GoogleIcon, useAuth } from "@/components/study/auth";
import { fetchBlockedUsers, unblockUser, type BlockedUser } from "@/lib/user-blocks";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { cn } from "@/lib/utils";

function shortUid(uid: string): string {
  if (uid.length <= 12) return uid;
  return `${uid.slice(0, 6)}…${uid.slice(-4)}`;
}

const ACCENT = {
  rose: { glow: "bg-rose-500/12", tile: "border-rose-300/15 text-rose-300/80" },
  amber: { glow: "bg-amber-500/12", tile: "border-amber-300/15 text-amber-300/80" },
} as const;

// Khối trạng thái rỗng dùng chung cho sheet Người đã chặn: icon phát sáng + tiêu đề + mô tả + hành động
function StateScreen({
  accent,
  icon,
  title,
  description,
  children,
}: {
  accent: keyof typeof ACCENT;
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-4 py-10">
      <div className="relative mb-4">
        <span aria-hidden="true" className={cn("absolute -inset-2.5 rounded-full blur-xl", ACCENT[accent].glow)} />
        <span
          className={cn(
            "relative grid place-items-center w-14 h-14 rounded-2xl bg-white/[0.045] border shadow-[inset_0_1px_1px_rgba(255,255,255,0.10)]",
            ACCENT[accent].tile
          )}
        >
          {icon}
        </span>
      </div>
      <p className="text-sm font-semibold text-white/90">{title}</p>
      <p className="mt-1.5 text-xs text-white/45 leading-relaxed max-w-[260px]">{description}</p>
      {children}
    </div>
  );
}

/**
 * Trang con hiển thị danh sách Người đã chặn trong bảng Thêm (Mobile Sub-screen).
 * Thiết kế phẳng, tối giản, loại bỏ hoàn toàn nested boxes và icon dư thừa.
 */
export function MobileBlockedUsersView() {
  const { user, getToken, signIn, isSigningIn } = useAuth();
  const [blocks, setBlocks] = useState<BlockedUser[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [unblockTarget, setUnblockTarget] = useState<BlockedUser | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setBlocks([]);
      return;
    }
    setLoading(true);
    try {
      setBlocks(await fetchBlockedUsers(getToken));
    } catch {
      setBlocks(null);
    } finally {
      setLoading(false);
    }
  }, [user, getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUnblock = async (uid: string) => {
    if (busyUid) return;
    setBusyUid(uid);
    try {
      await unblockUser(getToken, uid);
      setBlocks((prev) => (prev ? prev.filter((item) => item.uid !== uid) : prev));
      toast.success("Đã bỏ chặn. Hai bạn có thể vào chung phòng học nhóm lại.", {
        id: "block-notice",
        duration: 5000,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không bỏ chặn được, bạn thử lại nhé.", {
        id: "block-notice",
        duration: 5000,
      });
    } finally {
      setUnblockTarget(null);
      setBusyUid(null);
    }
  };

  const hasList = Boolean(user) && blocks !== null && blocks.length > 0;

  return (
    <div className="flex-1 flex flex-col px-3 pt-2 pb-4 select-none">
      {/* Ghi chú ngắn gọn, chỉ hiện khi đã có danh sách để tránh trùng lặp với trạng thái rỗng */}
      {hasList && (
        <p className="px-1 pb-3 text-xs text-white/50 leading-relaxed">
          Bạn và người bị chặn sẽ không thể vào chung phòng học nhóm.
        </p>
      )}

      {/* Nội dung danh sách */}
      {!user ? (
        <StateScreen
          accent="rose"
          icon={<ProhibitIcon className="w-6 h-6" weight="duotone" />}
          title="Đăng nhập để quản lý danh sách chặn"
          description="Danh sách người đã chặn được lưu theo tài khoản Google và đồng bộ trên mọi thiết bị."
        >
          <button
            type="button"
            onClick={() => void signIn()}
            disabled={isSigningIn}
            className="mt-5 inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-white text-slate-950 text-xs font-bold shadow-sm active:scale-[0.97] disabled:opacity-60 cursor-pointer touch-manipulation transition-transform"
          >
            {isSigningIn ? (
              <CircleNotchIcon className="w-4 h-4 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Đăng nhập bằng Google
          </button>
        </StateScreen>
      ) : loading && blocks === null ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2.5 text-white/40">
          <CircleNotchIcon className="w-5 h-5 animate-spin text-white/60" />
          <span className="text-xs">Đang tải danh sách chặn…</span>
        </div>
      ) : blocks === null ? (
        <StateScreen
          accent="amber"
          icon={<WarningCircleIcon className="w-6 h-6" weight="duotone" />}
          title="Không tải được danh sách chặn"
          description="Kết nối mạng có thể đang chập chờn. Kiểm tra rồi thử lại nhé."
        >
          <button
            type="button"
            onClick={() => void load()}
            className="mt-5 inline-flex items-center justify-center gap-2 h-9 px-4 rounded-xl bg-white/[0.10] hover:bg-white/[0.16] border border-white/15 text-xs font-semibold text-white active:scale-95 transition-[background-color,transform] cursor-pointer touch-manipulation"
          >
            <ArrowsClockwiseIcon className="w-3.5 h-3.5" weight="bold" />
            Thử lại
          </button>
        </StateScreen>
      ) : blocks.length === 0 ? (
        <StateScreen
          accent="rose"
          icon={<ProhibitIcon className="w-6 h-6" weight="duotone" />}
          title="Chưa chặn ai"
          description="Khi bạn chặn một người, hai bạn sẽ không vào chung phòng học nhóm được nữa."
        >
          <span className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[11px] text-white/45 whitespace-nowrap">
            <UsersIcon className="w-3.5 h-3.5 text-white/35" weight="bold" />
            Chặn từ danh sách thành viên phòng
          </span>
        </StateScreen>
      ) : (
        <div className="space-y-2">
          <div className="px-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-white/40">
            <span>Danh sách chặn ({blocks.length})</span>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="text-[11px] normal-case text-white/50 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
            >
              Làm mới
            </button>
          </div>

          <div className="rounded-2xl bg-white/[0.035] border border-white/[0.08] overflow-hidden divide-y divide-white/[0.06] shadow-sm">
            {blocks.map((item) => (
              <div
                key={item.uid}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-full bg-white/[0.08] border border-white/[0.12] flex items-center justify-center text-white/80 shrink-0 font-bold text-xs uppercase">
                    {item.name ? item.name.charAt(0) : "U"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white/95 truncate">
                      {item.name || "Người dùng ẩn danh"}
                    </p>
                    <p className="text-[10px] font-mono text-white/40 truncate">
                      UID: {shortUid(item.uid)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUnblockTarget(item)}
                  disabled={busyUid !== null}
                  className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.08] hover:bg-rose-500/20 active:scale-95 text-white/85 hover:text-rose-300 border border-white/15 hover:border-rose-400/30 transition-all cursor-pointer disabled:opacity-50 touch-manipulation shadow-xs"
                >
                  {busyUid === item.uid ? (
                    <span className="flex items-center gap-1">
                      <CircleNotchIcon className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang gỡ...</span>
                    </span>
                  ) : (
                    "Bỏ chặn"
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hộp thoại xác nhận bỏ chặn người dùng */}
      <ConfirmDeleteModal
        isOpen={Boolean(unblockTarget)}
        pending={busyUid === unblockTarget?.uid}
        onClose={() => {
          if (!busyUid) setUnblockTarget(null);
        }}
        onConfirm={() => {
          if (unblockTarget) void handleUnblock(unblockTarget.uid);
        }}
        title="Bỏ chặn người dùng"
        description={`Bạn có chắc muốn bỏ chặn "${unblockTarget?.name || shortUid(unblockTarget?.uid || "")}" không? Sau khi bỏ chặn, hai bạn sẽ có thể vào chung các phòng học nhóm.`}
        confirmText="Bỏ chặn"
        cancelText="Hủy"
        confirmClassName="bg-rose-600 hover:bg-rose-500 shadow-rose-600/30"
      />
    </div>
  );
}
