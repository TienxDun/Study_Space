"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DotsThreeVerticalIcon, FlagIcon, ProhibitIcon, XIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { blockUser } from "@/lib/user-blocks";
import { useAuth } from "@/components/study/auth";
import { RoomReportDialog } from "./RoomReportDialog";

interface MemberSafetyMenuProps {
  getToken?: () => Promise<string | null>;
  roomName: string;
  targetUid: string;
  targetName: string;
  /** Gọi sau khi chặn xong: người dùng tự rời phòng hiện tại. */
  onBlocked: () => void;
  variant?: "desktop" | "mobile";
}

// Menu an toàn trên tile thành viên khác: báo cáo và chặn (P0.5 Phase 4).
export function MemberSafetyMenu({
  getToken,
  roomName,
  targetUid,
  targetName,
  onBlocked,
  variant = "desktop",
}: MemberSafetyMenuProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmBlock(false);
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, submitting]);

  if (!targetUid) return null;

  const handleBlock = async () => {
    if (submitting) return;
    if (!getToken) {
      toast.error("Đăng nhập Google để chặn thành viên nhé.");
      return;
    }
    setSubmitting(true);
    try {
      await blockUser(getToken, targetUid, targetName);
      toast.success(`Đã chặn ${targetName}. Bạn sẽ không vào chung phòng với người này nữa.`, {
        id: "block-notice",
        duration: 6000,
      });
      setOpen(false);
      onBlocked();
    } catch (err) {
      setSubmitting(false);
      toast.error(err instanceof Error ? err.message : "Không chặn được, bạn thử lại nhé.", {
        id: "block-notice",
        duration: 6000,
      });
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Tùy chọn an toàn cho ${targetName}`}
        title="Báo cáo hoặc chặn thành viên"
        className={`absolute bottom-2 right-2 z-20 grid place-items-center rounded-xl bg-black/75 hover:bg-black/90 active:scale-95 text-white/85 hover:text-white border border-white/20 shadow-sm transition-all cursor-pointer ${
          variant === "mobile" ? "h-7.5 w-7.5" : "h-7 w-7"
        }`}
      >
        <DotsThreeVerticalIcon
          size={variant === "mobile" ? 15 : 15}
          weight="bold"
          aria-hidden="true"
        />
      </button>

      {open &&
        createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Tùy chọn an toàn cho ${targetName}`}
          onClick={() => !submitting && setOpen(false)}
          className="fixed inset-0 z-[190] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[320px] rounded-2xl border border-white/15 bg-neutral-950/88 p-5 text-white shadow-[0_20px_50px_rgba(0,0,0,0.75),inset_0_1px_1.5px_rgba(255,255,255,0.18)] overflow-hidden"
          >
            {/* Mép kính bắt sáng trên đỉnh */}
            <div
              aria-hidden="true"
              className="absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none"
            />

            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold leading-tight break-words text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                  {confirmBlock ? "Chặn thành viên?" : targetName}
                </h2>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                  {confirmBlock
                    ? `Hai bạn sẽ không vào chung phòng học nhóm được nữa. Bạn sẽ rời phòng hiện tại và có thể bỏ chặn trong Cài đặt.`
                    : "Chọn thao tác bạn muốn thực hiện với thành viên này."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={submitting}
                aria-label="Đóng"
                className="h-7 w-7 shrink-0 grid place-items-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40"
              >
                <XIcon size={14} weight="bold" aria-hidden="true" />
              </button>
            </div>

            {confirmBlock ? (
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmBlock(false)}
                  disabled={submitting}
                  className="h-8.5 px-3 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => void handleBlock()}
                  disabled={submitting}
                  className="h-8.5 px-4 rounded-xl bg-rose-500 text-white text-xs font-semibold hover:bg-rose-400 active:scale-[0.98] transition-all cursor-pointer shadow-sm shadow-rose-500/25 disabled:opacity-40"
                >
                  {submitting ? "Đang chặn…" : "Chặn"}
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setReportOpen(true);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] px-3.5 py-2.5 text-xs font-medium text-zinc-200 hover:text-white transition-all cursor-pointer active:scale-[0.99]"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-lg bg-amber-400/10 text-amber-300">
                    <FlagIcon size={14} weight="bold" aria-hidden="true" />
                  </span>
                  <span>Báo cáo thành viên</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmBlock(true)}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-rose-500/15 hover:border-rose-400/30 px-3.5 py-2.5 text-xs font-medium text-zinc-200 hover:text-rose-200 transition-all cursor-pointer active:scale-[0.99]"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-lg bg-rose-500/15 text-rose-300">
                    <ProhibitIcon size={14} weight="bold" aria-hidden="true" />
                  </span>
                  <span>Chặn thành viên</span>
                </button>
              </div>
            )}
          </div>
        </div>,
          document.body
        )}

      <RoomReportDialog
        open={reportOpen}
        room={roomName}
        targetUid={targetUid}
        targetName={targetName}
        getToken={getToken ?? (async () => null)}
        reporterName={user?.displayName || ""}
        onClose={() => setReportOpen(false)}
      />
    </>
  );
}
