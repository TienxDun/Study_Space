"use client";

import { useCallback, useEffect, useState } from "react";
import { ProhibitIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAuth } from "@/components/study/auth";
import { fetchBlockedUsers, unblockUser, type BlockedUser } from "@/lib/user-blocks";

function shortUid(uid: string): string {
  if (uid.length <= 12) return uid;
  return `${uid.slice(0, 6)}…${uid.slice(-4)}`;
}

// Danh sách người đã chặn: xem và bỏ chặn ngay trong Cài đặt (P0.5 Phase 4).
export function BlockedUsersSection() {
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
    <div className="pt-2 border-t border-white/10">
      <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
          <ProhibitIcon className="w-3.5 h-3.5 text-rose-300" weight="bold" />
          <span>Người đã chặn{blocks && blocks.length > 0 ? ` (${blocks.length})` : ""}</span>
        </div>
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
