"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { FlagIcon, XIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  ROOM_REPORT_REASONS,
  submitRoomReport,
  type RoomReportReason,
} from "@/lib/user-blocks";

interface RoomReportDialogProps {
  open: boolean;
  room: string;
  targetUid: string;
  targetName: string;
  getToken: () => Promise<string | null>;
  /** Tên hiển thị của người gửi (admin đọc thay vì UID). */
  reporterName?: string;
  onClose: () => void;
}

// Báo cáo hành vi của một thành viên trong phòng học (Play yêu cầu công cụ báo cáo UGC).
export function RoomReportDialog({
  open,
  room,
  targetUid,
  targetName,
  getToken,
  reporterName,
  onClose,
}: RoomReportDialogProps) {
  const [reason, setReason] = useState<RoomReportReason | "">("");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const groupName = useId();

  useEffect(() => {
    if (!open) return;
    setReason("");
    setDetail("");
    setSubmitting(false);
  }, [open, targetUid]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async () => {    if (!reason || submitting) return;
    setSubmitting(true);
    try {
      await submitRoomReport({
        getToken,
        room,
        targetUid,
        targetName,
        reporterName,
        reason,
        detail,
      });
      toast.success("Đã gửi báo cáo, cảm ơn bạn đã giúp phòng học an toàn hơn!", {
        id: "report-notice",
        duration: 6000,
      });
      onClose();
    } catch (err) {
      setSubmitting(false);
      toast.error(err instanceof Error ? err.message : "Không gửi được báo cáo.", {
        id: "report-notice",
        duration: 6000,
      });
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Báo cáo ${targetName}`}
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[88dvh] overflow-y-auto custom-study-scroll rounded-t-2xl sm:rounded-2xl border border-white/12 bg-[#0b0f16]/98 p-4 sm:p-5 text-white shadow-[0_24px_70px_rgba(0,0,0,0.8)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-400/10 border border-amber-400/25 text-amber-300">
              <FlagIcon size={17} weight="fill" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold leading-tight">Báo cáo thành viên</h2>
              <p className="text-[11px] text-zinc-400 leading-relaxed break-words">
                {targetName} · chỉ quản trị viên ZenStudy xem được.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Đóng"
            className="h-8 w-8 shrink-0 grid place-items-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40"
          >
            <XIcon size={15} weight="bold" aria-hidden="true" />
          </button>
        </div>

        <fieldset className="mt-4">
          <legend className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Lý do báo cáo
          </legend>
          <div className="mt-2 space-y-1.5">
            {ROOM_REPORT_REASONS.map((item) => {
              const checked = reason === item.value;
              return (
                <label
                  key={item.value}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-white/40 ${
                    checked
                      ? "border-emerald-400/50 bg-emerald-500/10 text-white"
                      : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  <input
                    type="radio"
                    name={groupName}
                    value={item.value}
                    checked={checked}
                    onChange={() => setReason(item.value)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`h-3.5 w-3.5 shrink-0 rounded-full border transition-colors ${
                      checked ? "border-emerald-400 bg-emerald-400/80" : "border-white/30"
                    }`}
                  />
                  <span className="flex-1">{item.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-4">
          <label
            htmlFor={`${groupName}-detail`}
            className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400"
          >
            Ghi chú thêm (không bắt buộc)
          </label>
          <textarea
            id={`${groupName}-detail`}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Điều gì đã xảy ra trong phòng?"
            className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/40"
          />
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-9 px-3.5 rounded-xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!reason || submitting}
            className="h-9 px-4 rounded-xl bg-emerald-500 text-slate-950 text-sm font-semibold hover:bg-emerald-400 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Đang gửi…" : "Gửi báo cáo"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
