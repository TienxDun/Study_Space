"use client";

import { motion } from "framer-motion";
import { CircleNotchIcon } from "@phosphor-icons/react";
import { ModalShell } from "@/components/ui/ModalShell";

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** Khi truyền vào, modal chờ thao tác xong mới đóng: khoá nút và hiện spinner. */
  pending?: boolean;
  title?: string;
  description?: string;
  itemName?: string;
  confirmText?: string;
  cancelText?: string;
  confirmClassName?: string;
}

export const ConfirmDeleteModal = ({
  isOpen,
  onClose,
  onConfirm,
  pending,
  title = "Xác nhận xóa",
  description = "Thao tác này không thể hoàn tác.",
  itemName,
  confirmText = "Xóa",
  cancelText = "Hủy",
  confirmClassName,
}: ConfirmDeleteModalProps) => {
  // Bẫy Tab + Esc + trả focus do ModalShell lo chung
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={() => {
        if (!pending) onClose();
      }}
      panelKey="confirm-delete-modal"
      role="alertdialog"
      ariaLabel={title}
      backdropClassName="z-[90] bg-black/60 backdrop-blur-md"
      panelClassName="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Minimalist Modern Dialog Box */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 4 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        className="dialog-glass relative z-10 w-full max-w-[320px] p-5 text-white select-none pointer-events-auto transform-gpu will-change-transform space-y-4 overflow-hidden"
      >
        {/* Content */}
        <div className="space-y-1.5">
          <h3 className="text-sm font-bold text-white tracking-tight leading-snug">
            {title}
          </h3>
          <p className="text-xs text-slate-400 font-normal leading-relaxed">
            {itemName ? (
              <>
                Bạn có chắc muốn xóa{" "}
                <span className="text-slate-200 font-semibold">
                  &ldquo;{itemName}&rdquo;
                </span>
                ?
              </>
            ) : (
              description
            )}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              if (pending) return;
              onConfirm();
              if (pending === undefined) onClose();
            }}
            disabled={pending}
            aria-busy={pending || undefined}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait flex items-center gap-1.5 ${
              confirmClassName || "bg-rose-600 hover:bg-rose-500 shadow-rose-600/30"
            }`}
          >
            {pending && (
              <CircleNotchIcon className="w-3.5 h-3.5 animate-spin" weight="bold" />
            )}
            {pending ? "Đang xử lý…" : confirmText}
          </button>
        </div>
      </motion.div>
    </ModalShell>
  );
};
