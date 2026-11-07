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
  /**
   * Giữ panel trong DOM sau lần mở đầu, chỉ ẩn bằng display:none khi hoạt ảnh
   * đóng chạy xong. Mặc định false = mở/dựng, đóng/hủy như cũ.
   */
  keepMounted?: boolean;
  /**
   * Chiến lược ẩn panel khi keepMounted = true và isOpen = false:
   * - "display" (mặc định): dùng display: none, giải phóng render tree.
   * - "offscreen": giữ panel trong DOM với opacity: 0 & pointer-events: none (offscreen),
   *   phục vụ các bảng chứa iframe/media (như đài phát thanh) để duy trì luồng âm thanh ngầm.
   */
  hiddenStrategy?: "display" | "offscreen";
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

/** Đọc thời lượng hoạt ảnh đóng để biết lúc nào được phép ẩn panel khỏi màn hình. */
function getExitDurationMs(exit: TargetAndTransition): number {
  const raw = (exit.transition as { duration?: unknown } | undefined)?.duration;
  return (typeof raw === "number" ? raw : 0.22) * 1000;
}

// Các modal đang mở, xếp theo thứ tự mở. Chỉ modal cuối (trên cùng) được
// xử lý Esc/Tab, nếu không mỗi lớp sẽ tự đóng khi có modal con đè lên.
const modalLayerStack: symbol[] = [];

/** Khung modal/popout dung chung: backdrop + panel + AnimatePresence.
 *  Portal truc tiep vao document.body de thoat khoi containing block cua cac the cha co transform.
 *  Quy uoc: backdrop click = dong. Esc/Tab do lop tren cung (modalLayerStack) xu ly. */
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
  keepMounted = false,
  hiddenStrategy = "display",
}: ModalShellProps) => {
  const [mounted, setMounted] = useState(false);
  // keepMounted: panel ở lại DOM sau lần mở đầu, chỉ bị display:none khi hoạt
  // ảnh đóng đã chạy xong. Nhờ vậy mở lại không phải dựng lại cả danh sách.
  const [hasOpened, setHasOpened] = useState(isOpen);
  const [exitFinished, setExitFinished] = useState(!isOpen);
  const exitDurationMs = getExitDurationMs(exit);
  // Lớp thứ 2 trở lên tự nâng z-index để nền mờ luôn phủ lên panel của hộp dưới
  const [layerZ, setLayerZ] = useState<number | null>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const layerIdRef = useRef<symbol>(Symbol("modal-layer"));
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!keepMounted) return;
    if (isOpen) {
      setHasOpened(true);
      setExitFinished(false);
      return;
    }
    const t = window.setTimeout(() => setExitFinished(true), exitDurationMs + 80);
    return () => window.clearTimeout(t);
  }, [isOpen, keepMounted, exitDurationMs]);

  // Mở lên tự vào bảng, Tab xoay vòng bên trong, tắt đi trả về chỗ cũ
  useEffect(() => {
    if (!isOpen || !mounted) return;
    const layerId = layerIdRef.current;
    modalLayerStack.push(layerId);
    const depth = modalLayerStack.length;
    setLayerZ(depth > 1 ? 1000 + depth * 20 : null);
    prevFocusRef.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => innerRef.current?.focus(), 60);

    const onKey = (e: KeyboardEvent) => {
      // Modal bên dưới không phản hồi phím khi đã có modal con đè lên
      if (modalLayerStack[modalLayerStack.length - 1] !== layerId) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
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
      const layerIndex = modalLayerStack.lastIndexOf(layerId);
      if (layerIndex !== -1) modalLayerStack.splice(layerIndex, 1);
      prevFocusRef.current?.focus?.();
    };
    }, [isOpen, mounted]);

  const isHidden = keepMounted && !isOpen && exitFinished;
  const backdropStyle = {
    ...(layerZ !== null ? { zIndex: layerZ } : null),
    ...(isHidden ? { display: "none" as const } : null),
  };
  const panelStyle = {
    ...(layerZ !== null ? { zIndex: layerZ + 10 } : null),
    ...(isHidden
      ? hiddenStrategy === "offscreen"
        ? { opacity: 0, pointerEvents: "none" as const, transform: "translate3d(0, 9999px, 0)" }
        : { display: "none" as const }
      : null),
  };

  const content = (
    <AnimatePresence>
      {(isOpen || (keepMounted && hasOpened)) && (
        <>
          <motion.div
            key={`${panelKey}-backdrop`}
            initial={{ opacity: 0 }}
            animate={keepMounted && !isOpen ? { opacity: 0 } : { opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={backdropStyle}
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
            animate={keepMounted && !isOpen ? exit : animate}
            exit={exit}
            transition={transition}
            style={panelStyle}
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
