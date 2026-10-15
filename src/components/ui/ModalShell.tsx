"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { TargetAndTransition, Transition } from "framer-motion";
import type { ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";

export interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Dinh vi + kich thuoc panel (bat buoc, khac nhau moi widget). */
  panelClassName: string;
  backdropClassName?: string;
  panelKey?: string;
  panelRef?: Ref<HTMLDivElement>;
  initial?: TargetAndTransition;
  animate?: TargetAndTransition;
  exit?: TargetAndTransition;
  transition?: Transition;
  /** Tên đọc cho máy đọc màn hình, mặc định "Hộp thoại". */
  ariaLabel?: string;
  /** Vai trò modal: hộp thường hoặc hộp cảnh báo xóa. */
  role?: "dialog" | "alertdialog";
}

const DEFAULT_TRANSITION: Transition = {
  duration: 0.18,
  ease: [0.16, 1, 0.3, 1],
};

function setRef(ref: Ref<HTMLDivElement> | undefined, el: HTMLDivElement | null) {
  if (!ref) return;
  if (typeof ref === "function") ref(el);
  else (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
}

/** Khung modal/popout dung chung: backdrop + panel + AnimatePresence.
 *  Portal truc tiep vao document.body de thoat khoi containing block cua cac the cha co transform.
 *  Quy uoc: backdrop click = dong. Esc do page.tsx quan ly tap trung. */
export const ModalShell = ({
  isOpen,
  onClose,
  children,
  panelClassName,
  backdropClassName,
  panelKey = "modal-panel",
  panelRef,
  initial = { opacity: 0 },
  animate = { opacity: 1 },
  exit = { opacity: 0 },
  transition = DEFAULT_TRANSITION,
  ariaLabel = "Hộp thoại",
  role = "dialog",
}: ModalShellProps) => {
  const [mounted, setMounted] = useState(false);
  const innerRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Mở lên tự vào bảng, Tab xoay vòng bên trong, tắt đi trả về chỗ cũ
  useEffect(() => {
    if (!isOpen || !mounted) return;
    prevFocusRef.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => innerRef.current?.focus(), 60);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = innerRef.current;
      if (!root) return;
      const list = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => {
        if (el.hasAttribute("disabled")) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        return el.offsetParent !== null || el === document.activeElement;
      });
      if (list.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey, true);
      prevFocusRef.current?.focus?.();
    };
  }, [isOpen, mounted, onClose]);

  const content = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key={`${panelKey}-backdrop`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "fixed inset-0 z-40 bg-black/10 cursor-default",
              backdropClassName
            )}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            key={panelKey}
            ref={(el) => {
              (innerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
              setRef(panelRef, el);
            }}
            role={role}
            aria-modal="true"
            aria-label={ariaLabel}
            tabIndex={-1}
            initial={initial}
            animate={animate}
            exit={exit}
            transition={transition}
            className={cn(panelClassName, "will-change-transform focus:outline-none")}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  if (!mounted || typeof document === "undefined" || !document.body) return null;
  return createPortal(content, document.body);
};
