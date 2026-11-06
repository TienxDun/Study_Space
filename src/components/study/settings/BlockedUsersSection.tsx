"use client";

import { useCallback, useEffect, useState } from "react";
import { ProhibitIcon, XIcon } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ModalShell } from "@/components/ui/ModalShell";
import { useAuth } from "@/components/study/auth";
import { fetchBlockedUsers, unblockUser, type BlockedUser } from "@/lib/user-blocks";

function shortUid(uid: string): string {
  if (uid.length <= 12) return uid;
  return `${uid.slice(0, 6)}…${uid.slice(-4)}`;
}

// Danh sách người đã chặn: xem và bỏ chặn trong bảng Thêm (mobile) hoặc Menu Tài khoản (desktop).
export function BlockedUsersSection({
  className = "pt-2 border-t border-white/10",
  hideHeader = false,
}: {
  className?: string;
  hideHeader?: boolean;
} = {}) {
  const { user, getToken } = useAuth();
  const [blocks, setBlocks] = useState<BlockedUser[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);

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
        duration: 6000,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không bỏ chặn được, bạn thử lại nhé.", {
        id: "block-notice",
        duration: 6000,
      });
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className={className}>
      <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-2">
        {!hideHeader && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
            <ProhibitIcon className="w-3.5 h-3.5 text-rose-300" weight="bold" />
            <span>Người đã chặn{blocks && blocks.length > 0 ? ` (${blocks.length})` : ""}</span>
          </div>
        )}
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Bạn và người bị chặn sẽ không vào chung phòng học nhóm được nữa.
        </p>

        {!user ? (
          <p className="text-[11px] text-slate-500">Đăng nhập Google để dùng tính năng chặn.</p>
        ) : loading && blocks === null ? (
          <p className="text-[11px] text-slate-500">Đang tải…</p>
        ) : blocks === null ? (
          <p className="text-[11px] text-slate-500">Không tải được danh sách chặn.</p>
        ) : blocks.length === 0 ? (
          <p className="text-[11px] text-slate-500">Chưa chặn ai.</p>
        ) : (
          <ul className="space-y-1.5">
            {blocks.map((item) => (
              <li
                key={item.uid}
                className="flex items-center justify-between gap-2 rounded-xl bg-black/25 border border-white/[0.06] px-2.5 py-2"
              >
                <span className="text-xs text-slate-200 truncate" title={item.uid}>
                  {item.name || shortUid(item.uid)}
                </span>
                <button
                  type="button"
                  onClick={() => void handleUnblock(item.uid)}
                  disabled={busyUid !== null}
                  className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border border-white/10 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {busyUid === item.uid ? "Đang bỏ…" : "Bỏ chặn"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Hộp thoại quản lý người đã chặn cho Mobile (bảng Thêm) */
export function BlockedUsersDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      panelKey="blocked-users-dialog"
      role="dialog"
      ariaLabel="Danh sách người đã chặn"
      backdropClassName="z-[110] bg-black/60 backdrop-blur-xs"
      panelClassName="fixed inset-0 z-[120] flex items-center justify-center p-4 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 4 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[380px] max-h-[min(520px,calc(100vh-2rem))] overflow-y-auto custom-study-scroll glass-panel hover:bg-black/45 p-4 text-white select-none pointer-events-auto rounded-3xl border border-white/10 shadow-2xl space-y-3"
      >
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-400/20 flex items-center justify-center text-rose-300">
              <ProhibitIcon className="w-4 h-4" weight="bold" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">Người đã chặn</h3>
              <p className="text-[11px] text-white/50">Phòng học nhóm</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <BlockedUsersSection className="pt-0" hideHeader />

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-white/90 hover:text-white transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </motion.div>
    </ModalShell>
  );
}
