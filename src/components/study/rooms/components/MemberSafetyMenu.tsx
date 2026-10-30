"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DotsThreeVerticalIcon, FlagIcon, ProhibitIcon, XIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { blockUser } from "@/lib/user-blocks";
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
        className={`absolute bottom-1.5 right-1.5 z-20 grid place-items-center rounded-md bg-black/70 hover:bg-black/85 text-white/85 hover:text-white border border-white/20 shadow-sm transition-colors cursor-pointer ${
          variant === "mobile" ? "h-6 w-6" : "h-7 w-7"
        }`}
      >
        <DotsThreeVerticalIcon
          size={variant === "mobile" ? 13 : 15}
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
          className="fixed inset-0 z-[190] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-white/12 bg-[#0b0f16]/98 p-4 sm:p-5 text-white shadow-[0_24px_70px_rgba(0,0,0,0.8)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold leading-tight break-words">
                  {confirmBlock ? "Chặn thành viên?" : targetName}
                </h2>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                  {confirmBlock
                    ? `Hai bạn sẽ không vào chung phòng học nhóm được nữa. Bạn sẽ rời phòng hiện tại và có thể bỏ chặn trong Cài đặt.`
                    : "Chọn việc bạn muốn làm với thành viên này."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={submitting}
                aria-label="Đóng"
                className="h-8 w-8 shrink-0 grid place-items-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40"
              >
                <XIcon size={15} weight="bold" aria-hidden="true" />
              </button>
            </div>

            {confirmBlock ? (
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmBlock(false)}
                  disabled={submitting}
                  className="h-9 px-3.5 rounded-xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => void handleBlock()}
                  disabled={submitting}
                  className="h-9 px-4 rounded-xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-400 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40"
                >
                  {submitting ? "Đang chặn…" : "Chặn"}
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setReportOpen(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-zinc-200 hover:bg-white/[0.07] hover:text-white transition-colors cursor-pointer"
                >
                  <FlagIcon size={15} weight="bold" aria-hidden="true" className="text-amber-300" />
                  <span>Báo cáo thành viên</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmBlock(true)}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-zinc-200 hover:bg-rose-500/10 hover:text-white transition-colors cursor-pointer"
                >
                  <ProhibitIcon size={15} weight="bold" aria-hidden="true" className="text-rose-300" />
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
        onClose={() => setReportOpen(false)}
      />
    </>
  );
}
