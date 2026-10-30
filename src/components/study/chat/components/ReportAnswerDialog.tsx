"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { FlagIcon, XIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  AI_REPORT_REASONS,
  submitAiReport,
  type AiReportReason,
} from "@/lib/content-reports";

export interface ReportAnswerTarget {
  id: string;
  text: string;
  question?: string;
}

interface ReportAnswerDialogProps {
  target: ReportAnswerTarget | null;
  sessionId: string | null;
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onSubmitted: (id: string) => void;
}

// Dialog báo cáo một câu trả lời của trợ lý (Play yêu cầu báo cáo nội dung AI ngay trong app).
export function ReportAnswerDialog({
  target,
  sessionId,
  getToken,
  onClose,
  onSubmitted,
}: ReportAnswerDialogProps) {
  const [reason, setReason] = useState<AiReportReason | "">("");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const groupName = useId();

  // Mỗi câu trả lời mới mở lại form trắng, tránh gửi nhầm lý do của lần trước.
  useEffect(() => {
    if (!target) return;
    setReason("");
    setDetail("");
    setSubmitting(false);
  }, [target]);

  const close = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [submitting, onClose]);

  useEffect(() => {
    if (!target) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [target, close]);

  if (!target) return null;

  const handleSubmit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    const result = await submitAiReport({
      getToken,
      answer: target.text,
      question: target.question,
      reason,
      detail,
      sessionId,
      messageId: target.id,
    });
    if (!result.ok) {
      setSubmitting(false);
      toast.error(result.notice, { id: "report-notice", duration: 6000 });
      return;
    }
    toast.success("Đã gửi báo cáo, cảm ơn bạn đã giúp ZenStudy an toàn hơn!", {
      id: "report-notice",
      duration: 6000,
    });
    onSubmitted(target.id);
    onClose();
  };

  const preview =
    target.text.length > 150 ? `${target.text.slice(0, 150).trimEnd()}…` : target.text;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Báo cáo câu trả lời của trợ lý"
      onClick={close}
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150"
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
              <h2 className="text-sm font-semibold leading-tight">Báo cáo câu trả lời</h2>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Chỉ quản trị viên ZenStudy xem được báo cáo này.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={submitting}
            aria-label="Đóng"
            title="Đóng (Esc)"
            className="h-8 w-8 shrink-0 grid place-items-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <XIcon size={15} weight="bold" aria-hidden="true" />
          </button>
        </div>

        {target.question ? (
          <p className="mt-3.5 text-[11px] leading-relaxed text-zinc-400 break-words">
            <span className="font-semibold text-zinc-300">Bạn đã hỏi: </span>
            <span className="line-clamp-2">{target.question}</span>
          </p>
        ) : null}

        <blockquote className="mt-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs leading-relaxed text-zinc-300 break-words">
          <span className="line-clamp-3">{preview}</span>
        </blockquote>

        <fieldset className="mt-4">
          <legend className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Lý do báo cáo
          </legend>
          <div className="mt-2 space-y-1.5">
            {AI_REPORT_REASONS.map((item) => {
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
                      checked ? "border-emerald-400 bg-emerald-400/80" : "border-white/30 bg-transparent"
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
            placeholder="Ví dụ: câu trả lời hướng dẫn điều nguy hiểm…"
            className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/40"
          />
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={close}
            disabled={submitting}
            className="h-9 px-3.5 rounded-xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!reason || submitting}
            className="h-9 px-4 rounded-xl bg-emerald-500 text-slate-950 text-sm font-semibold hover:bg-emerald-400 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            {submitting ? "Đang gửi…" : "Gửi báo cáo"}
          </button>
        </div>
      </div>
    </div>
  );
}
