"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CheckCircleIcon,
  CheckIcon,
  CircleNotchIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { ModalShell } from "@/components/ui/ModalShell";
import { cn } from "@/lib/utils";
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
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 4 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[365px] glass-panel hover:bg-black/45 p-4.5 sm:p-5 text-white select-none pointer-events-auto transform-gpu will-change-transform space-y-3.5 overflow-hidden rounded-[26px] shadow-2xl"
      >
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none z-10" />

        {phase === "done" ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4 py-2"
          >
            <div className="flex flex-col items-center text-center gap-2.5">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                <CheckCircleIcon className="h-6 w-6" weight="fill" />
              </span>
              <div className="space-y-1">
                <h3 className="text-base font-bold tracking-tight text-white">
                  Đã xoá tài khoản
                </h3>
                <p className="text-xs leading-relaxed text-slate-300">
                  Dữ liệu cá nhân trên ZenStudy đã được dọn sạch hoàn toàn.
                  Tài khoản Google của bạn vẫn an toàn.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.location.assign("/")}
              className="w-full rounded-xl bg-white/[0.08] hover:bg-white/15 active:scale-[0.98] border border-white/10 py-2.5 text-xs font-semibold text-white transition-all cursor-pointer"
            >
              Về trang chủ
            </button>
          </motion.div>
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-3.5"
          >
            {/* Header: Tiêu đề gọn gàng */}
            <motion.header variants={item}>
              <h3 className="text-[16px] font-bold leading-tight tracking-tight text-white">
                Xoá tài khoản ZenStudy?
              </h3>
            </motion.header>

            {/* Nội dung xác nhận: dạng typography phẳng, xoá bỏ hoàn toàn nested box */}
            <motion.div variants={item} className="space-y-2 text-xs leading-relaxed text-slate-300">
              <p>
                Toàn bộ dữ liệu của{" "}
                <span className="font-semibold text-white">
                  {accountEmail || "tài khoản này"}
                </span>{" "}
                sẽ bị xoá vĩnh viễn và không thể khôi phục:
              </p>
              <ul className="space-y-1.5 pl-1 text-slate-300/90">
                <li className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-rose-400 shrink-0" />
                  <span>Nhiệm vụ, ghi chú, thống kê và cài đặt</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-rose-400 shrink-0" />
                  <span>Toàn bộ lịch sử trò chuyện cùng Trợ lý AI</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-rose-400 shrink-0" />
                  <span>Quyền chủ phòng và phòng học nhóm</span>
                </li>
              </ul>
            </motion.div>

            {/* Báo lỗi nếu có */}
            {error && (
              <motion.p
                variants={item}
                role="alert"
                className="rounded-xl border border-rose-400/25 bg-rose-500/[0.1] px-3 py-2 text-xs leading-relaxed text-rose-200"
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
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 space-y-2.5"
                >
                  <div
                    className="flex items-center gap-2 text-xs font-medium text-slate-200"
                    aria-live="polite"
                  >
                    <CircleNotchIcon
                      className="h-4 w-4 shrink-0 animate-spin text-rose-400"
                      weight="bold"
                    />
                    <span>{step ? STEP_LABELS[step] : "Đang chuẩn bị…"}</span>
                  </div>
                  <div className="flex gap-1" aria-hidden="true">
                    {STEPS.map((s, index) => (
                      <span
                        key={s}
                        className={cn(
                          "h-1 flex-1 rounded-full transition-colors duration-300",
                          index <= activeStep ? "bg-rose-400" : "bg-white/10"
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    Vui lòng không đóng tab cho đến khi hoàn tất.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="controls"
                  initial={false}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.14 }}
                  className="space-y-3"
                >
                  {/* Checkbox xác nhận phẳng, tối giản không lồng viền hộp */}
                  <label
                    htmlFor="delete-account-ack"
                    className="flex cursor-pointer items-center gap-2.5 py-1 text-xs text-slate-300 hover:text-white transition-colors select-none"
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
                      className={cn(
                        "grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border transition-colors",
                        acknowledged
                          ? "border-rose-500 bg-rose-600 text-white"
                          : "border-white/30 bg-white/[0.04] text-transparent hover:border-white/50"
                      )}
                    >
                      <CheckIcon className="h-2.5 w-2.5" weight="bold" />
                    </span>
                    <span className="leading-snug">
                      Tôi hiểu và đồng ý xoá vĩnh viễn dữ liệu.
                    </span>
                  </label>

                  {/* Footer: Cụm nút bấm thao tác */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-xl border border-white/10 bg-white/[0.05] hover:bg-white/[0.1] active:scale-95 px-3.5 py-2 text-xs font-semibold text-slate-300 transition-all cursor-pointer"
                    >
                      Ở lại
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleConfirm()}
                      disabled={!acknowledged}
                      className="flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 px-3.5 py-2 text-xs font-bold text-white shadow-sm shadow-rose-950/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer"
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
