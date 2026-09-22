"use client";

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
}

const DEFAULT_TRANSITION: Transition = {
  duration: 0.18,
  ease: [0.16, 1, 0.3, 1],
};

/** Khung modal/popout dung chung: backdrop + panel + AnimatePresence.
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
}: ModalShellProps) => (
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
        />
        <motion.div
          key={panelKey}
          ref={panelRef}
          initial={initial}
          animate={animate}
          exit={exit}
          transition={transition}
          className={cn(panelClassName, "transform-gpu will-change-transform")}
        >
          {children}
        </motion.div>
      </>
    )}
  </AnimatePresence>
);
