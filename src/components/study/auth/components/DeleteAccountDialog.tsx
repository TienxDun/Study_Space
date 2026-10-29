"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CheckCircleIcon,
  CheckIcon,
  CircleNotchIcon,
  ShieldCheckIcon,
  TrashIcon,
  WarningOctagonIcon,
} from "@phosphor-icons/react";
import { ModalShell } from "@/components/ui/ModalShell";
import {
  DeleteAccountError,
  deleteAccount,
  type DeleteAccountStep,
} from "@/lib/delete-account";

const STEPS: DeleteAccountStep[] = ["chat", "server", "local"];

const STEP_LABELS: Record<DeleteAccountStep, string> = {
  chat: "Đang xoá lịch sử trò chuyện…",
  server: "Đang xoá dữ liệu và tài khoản…",
  local: "Đang dọn dữ liệu trên thiết bị…",
};

const DELETED_ITEMS = [
  "Ghi chú, việc cần làm, cài đặt và thống kê tập trung.",
  "Lịch sử trò chuyện với trợ lý AI.",
  "Tư cách chủ phòng và đồng host ở phòng học nhóm.",
];

interface DeleteAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
  accountEmail?: string | null;
}

export function DeleteAccountDialog({
  isOpen,
  onClose,
  accountEmail,
}: DeleteAccountDialogProps) {
  const reduceMotion = useReducedMotion();
  const [acknowledged, setAcknowledged] = useState(false);
  const [phase, setPhase] = useState<"confirm" | "deleting" | "done">("confirm");
  const [step, setStep] = useState<DeleteAccountStep | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setAcknowledged(false);
    setPhase("confirm");
    setStep(null);
    setError("");
  }, [isOpen]);

  const isDeleting = phase === "deleting";
  const activeStep = step ? STEPS.indexOf(step) : -1;

  const handleConfirm = async () => {
    if (!acknowledged || isDeleting) return;
    setError("");
    setPhase("deleting");
    try {
      await deleteAccount({ onProgress: setStep });
      setPhase("done");
    } catch (err) {
      setError(
        err instanceof DeleteAccountError
          ? err.message
          : "Không xoá được tài khoản lúc này. Bạn thử lại nhé."
      );
      setPhase("confirm");
    }
  };

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: reduceMotion ? 0 : 0.045 } },
  };
  const item = reduceMotion
    ? { hidden: {}, show: {} }
    : {
        hidden: { opacity: 0, y: 8 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] as const },
        },
      };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={() => {
        if (!isDeleting) onClose();
      }}
      panelKey="delete-account-dialog"
      role="alertdialog"
      ariaLabel="Xoá tài khoản ZenStudy"
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
        className="relative z-10 w-full max-w-[400px] max-h-[min(600px,calc(100vh-2rem))] overflow-y-auto custom-study-scroll glass-panel hover:bg-black/45 p-5 text-white select-none pointer-events-auto"
      >
        {phase === "done" ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4 py-1"
          >
            <div className="flex flex-col items-center text-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/[0.14] text-emerald-300">
                <CheckCircleIcon className="h-6 w-6" weight="fill" />
              </span>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold tracking-tight text-white">
                  Đã xoá tài khoản
                </h3>
                <p className="text-[12.5px] leading-relaxed text-slate-400">
                  Dữ liệu học tập, lịch sử trò chuyện và tài khoản ZenStudy đã bị xoá.
                  Tài khoản Google của bạn vẫn còn nguyên.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.location.assign("/")}
              className="w-full rounded-xl border border-white/10 bg-white/[0.06] py-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50 cursor-pointer"
            >
              Về trang chủ
            </button>
          </motion.div>
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-4"
          >
            <motion.header variants={item} className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-rose-400/25 bg-rose-500/[0.12] text-rose-300">
                <WarningOctagonIcon className="h-[18px] w-[18px]" weight="fill" />
              </span>
              <div className="min-w-0 space-y-1 pt-0.5">
                <h3 className="text-[17px] font-bold leading-snug tracking-tight text-white">
                  Xoá tài khoản ZenStudy?
                </h3>
                <p className="text-[13px] leading-relaxed text-slate-400">
                  Thao tác này không thể hoàn tác. Dữ liệu sau sẽ bị xoá vĩnh viễn:
                </p>
              </div>
            </motion.header>

            <motion.ul variants={item} className="space-y-2">
              {DELETED_ITEMS.map((text) => (
                <li key={text} className="flex items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-rose-300/80"
                  />
                  <span className="text-[13px] leading-relaxed text-slate-300">{text}</span>
                </li>
              ))}
            </motion.ul>

            {accountEmail && (
              <motion.div
                variants={item}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
              >
                <span className="shrink-0 text-[11.5px] text-slate-500">Tài khoản</span>
                <span
                  className="min-w-0 truncate text-[12px] font-medium text-slate-200"
                  title={accountEmail}
                >
                  {accountEmail}
                </span>
              </motion.div>
            )}

            <motion.div
              variants={item}
              className="flex items-start gap-2.5 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.07] px-3 py-2.5"
            >
              <ShieldCheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              <div className="space-y-0.5">
                <p className="text-[13px] leading-relaxed text-emerald-50/90">
                  Tài khoản Google của bạn vẫn được giữ nguyên.
                </p>
                <p className="text-[11.5px] leading-relaxed text-emerald-100/70">
                  Không cần chọn lại tài khoản Google.
                </p>
              </div>
            </motion.div>

            {error && (
              <motion.p
                variants={item}
                role="alert"
                className="rounded-xl border border-rose-400/25 bg-rose-500/[0.08] px-3 py-2.5 text-[12px] leading-relaxed text-rose-200"
              >
                {error}
              </motion.p>
            )}

            <AnimatePresence mode="wait" initial={false}>
              {isDeleting ? (
                <motion.div
                  key="progress"
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3"
                >
                  <div
                    className="flex items-center gap-2 text-[12.5px] font-medium text-slate-200"
                    aria-live="polite"
                  >
                    <CircleNotchIcon
                      className="h-4 w-4 shrink-0 animate-spin text-rose-300"
                      weight="bold"
                    />
                    <span>{step ? STEP_LABELS[step] : "Đang chuẩn bị…"}</span>
                  </div>
                  <div className="mt-2.5 flex gap-1" aria-hidden="true">
                    {STEPS.map((s, index) => (
                      <span
                        key={s}
                        className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                          index <= activeStep ? "bg-rose-400/80" : "bg-white/10"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-[11.5px] leading-relaxed text-slate-500">
                    Bạn đừng đóng tab này cho tới khi xong nhé.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="controls"
                  initial={false}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.14 }}
                  className="space-y-3.5"
                >
                  <label
                    htmlFor="delete-account-ack"
                    className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${
                      acknowledged
                        ? "border-rose-400/30 bg-rose-500/[0.08]"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                    }`}
                  >
                    <input
                      id="delete-account-ack"
                      type="checkbox"
                      checked={acknowledged}
                      onChange={(e) => setAcknowledged(e.target.checked)}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={`mt-px grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-rose-300/60 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-black/40 ${
                        acknowledged
                          ? "border-rose-400 bg-rose-500 text-white"
                          : "border-white/25 bg-transparent text-transparent"
                      }`}
                    >
                      <CheckIcon className="h-2.5 w-2.5" weight="bold" />
                    </span>
                    <span className="text-[13px] leading-relaxed text-slate-300">
                      Tôi hiểu dữ liệu sẽ bị xoá vĩnh viễn và không thể khôi phục.
                    </span>
                  </label>

                  <p className="text-[12px] leading-relaxed text-slate-500">
                    Không xoá được tại đây?{" "}
                    <Link
                      href="/account-deletion/"
                      className="font-medium text-slate-300 underline underline-offset-2 transition-colors hover:text-white"
                      onClick={onClose}
                    >
                      Xoá tài khoản trên web
                    </Link>
                  </p>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[12.5px] font-semibold text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 cursor-pointer"
                    >
                      Ở lại
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleConfirm()}
                      disabled={!acknowledged}
                      className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-[12.5px] font-bold text-white shadow-sm shadow-rose-950/40 transition-all hover:bg-rose-500 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/70 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-rose-600 disabled:active:scale-100 cursor-pointer"
                    >
                      <TrashIcon className="h-3.5 w-3.5" weight="bold" />
                      Xoá vĩnh viễn
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </motion.div>
    </ModalShell>
  );
}
