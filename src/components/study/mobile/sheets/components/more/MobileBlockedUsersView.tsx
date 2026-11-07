"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CircleNotchIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAuth } from "@/components/study/auth";
import { fetchBlockedUsers, unblockUser, type BlockedUser } from "@/lib/user-blocks";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";

function shortUid(uid: string): string {
  if (uid.length <= 12) return uid;
  return `${uid.slice(0, 6)}…${uid.slice(-4)}`;
}

/**
 * Trang con hiển thị danh sách Người đã chặn trong bảng Thêm (Mobile Sub-screen).
 * Thiết kế phẳng, tối giản, loại bỏ hoàn toàn nested boxes và icon dư thừa.
 */
export function MobileBlockedUsersView() {
  const { user, getToken } = useAuth();
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

  return (
    <div className="px-3 pt-2 pb-4 space-y-4 select-none">
      {/* Ghi chú ngắn gọn, thanh thoát, không viền hộp */}
      <p className="px-1 text-xs text-white/50 leading-relaxed">
        Bạn và người bị chặn sẽ không thể vào chung phòng học nhóm.
      </p>

      {/* Nội dung danh sách */}
      {!user ? (
        <div className="py-12 text-center">
          <p className="text-xs text-white/50">
            Đăng nhập Google để quản lý danh sách người đã chặn.
          </p>
        </div>
      ) : loading && blocks === null ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-white/40">
          <CircleNotchIcon className="w-5 h-5 animate-spin text-white/60" />
          <span className="text-xs">Đang tải danh sách chặn...</span>
        </div>
      ) : blocks === null ? (
        <div className="py-10 text-center space-y-2">
          <p className="text-xs text-rose-300">Không tải được danh sách chặn.</p>
          <button
            type="button"
            onClick={() => void load()}
            className="px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs font-medium text-white transition-colors cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      ) : blocks.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm font-medium text-white/75">Chưa chặn ai</p>
          <p className="text-xs text-white/40 max-w-[250px] mx-auto mt-1 leading-relaxed">
            Bạn có thể chặn người tham gia trực tiếp trong bảng thành viên phòng học.
          </p>
        </div>
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
