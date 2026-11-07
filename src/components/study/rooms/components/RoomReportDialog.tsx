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
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[340px] max-h-[90dvh] overflow-y-auto custom-study-scroll rounded-2xl border border-white/15 bg-neutral-950/88 p-4.5 text-white shadow-[0_20px_50px_rgba(0,0,0,0.75),inset_0_1px_1.5px_rgba(255,255,255,0.18)]"
      >
        {/* Mép kính bắt sáng trên đỉnh */}
        <div
          aria-hidden="true"
          className="absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none"
        />

        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-400/10 text-amber-300">
              <FlagIcon size={16} weight="fill" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                Báo cáo thành viên
              </h2>
              <p className="text-[11px] text-zinc-400 leading-snug">
                {targetName} · ZenStudy sẽ kiểm duyệt
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Đóng"
            className="h-7 w-7 shrink-0 grid place-items-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40"
          >
            <XIcon size={14} weight="bold" aria-hidden="true" />
          </button>
        </div>

        <fieldset className="mt-3">
          <legend className="text-xs font-medium text-zinc-400 mb-1">
            Chọn lý do:
          </legend>
          <div className="space-y-0.5">
            {ROOM_REPORT_REASONS.map((item) => {
              const checked = reason === item.value;
              return (
                <label
                  key={item.value}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors cursor-pointer select-none ${
                    checked
                      ? "bg-emerald-500/10 text-emerald-300 font-medium"
                      : "text-zinc-300 hover:bg-white/[0.04] hover:text-white"
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
                    className={`h-4 w-4 shrink-0 rounded-full border flex items-center justify-center transition-colors ${
                      checked
                        ? "border-emerald-400 bg-emerald-500"
                        : "border-zinc-500 bg-transparent"
                    }`}
                  >
                    {checked && <span className="h-1.5 w-1.5 rounded-full bg-slate-950" />}
                  </span>
                  <span className="flex-1 text-[13px]">{item.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-3">
          <textarea
            id={`${groupName}-detail`}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Ghi chú thêm (không bắt buộc)..."
            className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/25 focus:ring-1 focus:ring-white/20 transition-all"
          />
        </div>

        <div className="mt-3.5 flex items-center justify-end gap-2 pt-2.5 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-8.5 px-3.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!reason || submitting}
            className="h-8.5 px-4 rounded-xl bg-emerald-500 text-slate-950 text-xs font-semibold hover:bg-emerald-400 active:scale-[0.98] transition-all cursor-pointer shadow-sm shadow-emerald-500/25 disabled:opacity-35 disabled:cursor-not-allowed"
          >
            {submitting ? "Đang gửi…" : "Gửi báo cáo"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
