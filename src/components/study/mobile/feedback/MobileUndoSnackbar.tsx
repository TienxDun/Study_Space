"use client";

import { useEffect, useRef } from "react";

// Thanh hoàn tác cho mobile, ý tưởng từ mẫu 071 Lucianlabs (MIT) và
// vòng cháy của React Bits: đếm ngược 5 giây, chạm giữ để dừng đếm.
interface MobileUndoSnackbarProps {
  message: string;
  durationMs?: number;
  onUndo: () => void;
  onTimeout: () => void;
}

export function MobileUndoSnackbar({
  message,
  durationMs = 5000,
  onUndo,
  onTimeout,
}: MobileUndoSnackbarProps) {
  const ringRef = useRef<SVGCircleElement>(null);
  const rafRef = useRef(0);
  const pausedRef = useRef(false);
  const leftRef = useRef(durationMs);
  const lastRef = useRef(0);
  const doneRef = useRef(false);
  const timeoutRef = useRef(onTimeout);

  useEffect(() => {
    timeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    lastRef.current = performance.now();

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      cancelAnimationFrame(rafRef.current);
      timeoutRef.current();
    };

    const tick = (now: number) => {
      if (!pausedRef.current) {
        leftRef.current -= now - lastRef.current;
        const left = Math.max(0, leftRef.current / durationMs);
        ringRef.current?.style.setProperty("--left", left.toFixed(3));
        if (leftRef.current <= 0) {
          finish();
          return;
        }
      }
      lastRef.current = now;
      rafRef.current = requestAnimationFrame(tick);
    };

    const startAfter = reduceMotion ? 300 : 0;
    const starter = window.setTimeout(() => {
      rafRef.current = requestAnimationFrame(tick);
    }, startAfter);

    return () => {
      window.clearTimeout(starter);
      cancelAnimationFrame(rafRef.current);
    };
  }, [durationMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      onPointerDown={() => {
        pausedRef.current = true;
      }}
      onPointerUp={() => {
        pausedRef.current = false;
        lastRef.current = performance.now();
      }}
      onPointerCancel={() => {
        pausedRef.current = false;
        lastRef.current = performance.now();
      }}
      className="mobile-undo-enter fixed inset-x-3 bottom-[calc(var(--mobile-nav-height)+var(--app-safe-bottom)+var(--mobile-nav-safe-gap)+5.5rem)] z-[80] flex items-center gap-2.5 h-[58px] pl-4 pr-2 rounded-2xl bg-black/75 backdrop-blur-2xl border border-white/15 text-white shadow-[0_16px_40px_rgba(0,0,0,0.6)] sm:hidden"
    >
      <p className="flex-1 min-w-0 text-[13px] font-semibold truncate">{message}</p>
      <button
        type="button"
        onClick={onUndo}
        className="h-11 shrink-0 inline-flex items-center gap-2 pl-2 pr-3 rounded-xl text-sm font-bold text-emerald-300 active:scale-95"
        aria-label="Hoàn tác xóa"
      >
        <svg viewBox="0 0 22 22" aria-hidden="true" className="w-[22px] h-[22px] -rotate-90">
          <circle cx="11" cy="11" r="8.5" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.6" />
          <circle
            ref={ringRef}
            cx="11"
            cy="11"
            r="8.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset="calc(100 - var(--left, 1) * 100)"
          />
        </svg>
        Hoàn tác
      </button>
    </div>
  );
}
