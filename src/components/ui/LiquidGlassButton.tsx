/* Lucian UX/UI Prompt #001 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#001 */
"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react";

export interface LiquidGlassButtonProps {
  label?: string;
  successLabel?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export const LiquidGlassButton: React.FC<LiquidGlassButtonProps> = ({
  label = "Bắt đầu ngay",
  successLabel = "Sẵn sàng",
  onClick,
  disabled = false,
  className = "",
}) => {
  const [state, setState] = useState<"idle" | "load" | "ok">("idle");
  const [liveText, setLiveText] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const magRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!btnRef.current || !magRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const rm = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pull = rm ? 0 : Math.max(0, 1 - Math.hypot(dx, dy) / 190);
    magRef.current.style.translate = `${(dx * 0.18 * pull).toFixed(1)}px ${(dy * 0.18 * pull).toFixed(1)}px`;
    btnRef.current.style.setProperty("--mx", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
    btnRef.current.style.setProperty("--my", `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (magRef.current) {
      magRef.current.style.translate = "0px 0px";
    }
  }, []);

  const handleClick = useCallback(() => {
    if (state !== "idle" || disabled) return;
    clearTimers();

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }

    setState("load");
    setLiveText("Đang tải...");

    const rm = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const loadDuration = rm ? 200 : 900;
    const okDuration = rm ? 250 : 650;

    const t1 = setTimeout(() => {
      setState("ok");
      setLiveText(successLabel);

      const t2 = setTimeout(() => {
        onClick?.();
        const t3 = setTimeout(() => {
          setState("idle");
          setLiveText("");
        }, 800);
        timersRef.current.push(t3);
      }, okDuration);
      timersRef.current.push(t2);
    }, loadDuration);
    timersRef.current.push(t1);
  }, [state, disabled, clearTimers, successLabel, onClick]);

  return (
    <div
      ref={rootRef}
      className={`u001-container relative flex items-center justify-center select-none ${className}`}
      data-state={state}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <style>{`
        .u001-container {
          --ux-ink: #F4F0E8;
          --ux-accent: #B7A4FF;
          --ux-mint: #7EE8C0;
          --ux-ease: cubic-bezier(.2, .8, .2, 1);
          --ux-spring: cubic-bezier(.34, 1.45, .64, 1);
          --hi: rgba(255, 255, 255, .65);
          --rim: rgba(255, 255, 255, .25);
          --drop: rgba(0, 0, 0, .5);
          position: relative;
          width: 100%;
          max-width: 280px;
          height: 80px;
          display: grid;
          place-items: center;
          isolation: isolate;
        }

        .u001-mag {
          transition: translate .8s var(--ux-spring);
        }
        .u001-float {
          animation: u001-float 6s ease-in-out infinite;
        }
        @keyframes u001-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }

        .u001-btn {
          position: relative;
          display: block;
          width: 256px;
          height: 64px;
          padding: 0;
          border: 0;
          border-radius: 999px;
          overflow: hidden;
          isolation: isolate;
          color: var(--ux-ink);
          background: transparent;
          -webkit-backdrop-filter: blur(18px) saturate(180%);
          backdrop-filter: blur(18px) saturate(180%);
          box-shadow: inset 0 1.5px 0 var(--hi), inset 0 -12px 20px -14px var(--hi), inset 0 0 0 1px var(--rim), 0 20px 36px -18px var(--drop), 0 3px 8px -4px var(--drop);
          transition: width .7s var(--ux-ease), transform .55s var(--ux-spring), box-shadow .6s var(--ux-ease);
          cursor: pointer;
        }
        .u001-btn::before {
          content: "";
          position: absolute;
          left: 9%;
          right: 9%;
          top: 7%;
          height: 42%;
          border-radius: 999px;
          pointer-events: none;
          background: linear-gradient(180deg, rgba(255, 255, 255, .42), rgba(255, 255, 255, 0));
        }
        .u001-btn::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          opacity: 0;
          transition: opacity .4s var(--ux-ease);
          background: radial-gradient(130px 70px at var(--mx, 50%) var(--my, 0%), rgba(255, 255, 255, .4), transparent 70%);
        }
        .u001-btn:hover::after {
          opacity: 1;
        }
        .u001-btn:active {
          transform: scale(1.03, .92);
        }
        .u001-btn:focus-visible {
          outline: 2px solid var(--ux-accent);
          outline-offset: 4px;
        }

        .u001-sheen {
          position: absolute;
          top: -40%;
          bottom: -40%;
          left: 0;
          width: 38%;
          pointer-events: none;
          background: linear-gradient(100deg, transparent, rgba(255, 255, 255, .45) 50%, transparent);
          transform: translateX(-150%) skewX(-12deg);
          transition: transform 1.1s var(--ux-ease);
        }
        .u001-btn:hover .u001-sheen {
          transform: translateX(300%) skewX(-12deg);
        }

        .u001-txt, .u001-done {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 16px;
          font-weight: 600;
          letter-spacing: -0.015em;
          white-space: nowrap;
          transition: opacity .35s var(--ux-ease), transform .55s var(--ux-ease), filter .4s var(--ux-ease);
        }
        .u001-done {
          opacity: 0;
          transform: translateY(14px);
          filter: blur(4px);
        }
        .u001-done b {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: var(--ux-mint);
          color: #07080D;
          box-shadow: 0 0 0 5px color-mix(in srgb, var(--ux-mint) 25%, transparent);
        }
        .u001-done svg {
          width: 15px;
          height: 15px;
          fill: none;
          stroke: currentColor;
          stroke-width: 2.8;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .u001-done path {
          stroke-dasharray: 18;
          stroke-dashoffset: 18;
          transition: stroke-dashoffset .5s var(--ux-ease) .25s;
        }

        .u001-spin {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 28px;
          height: 28px;
          margin: -14px 0 0 -14px;
          opacity: 0;
          transform: scale(.5);
          transition: opacity .35s var(--ux-ease), transform .6s var(--ux-spring);
        }
        .u001-spin svg {
          width: 100%;
          height: 100%;
          fill: none;
          stroke: #ffffff;
          stroke-width: 2.4;
          stroke-linecap: round;
          animation: u001-rot 1s linear infinite;
        }
        .u001-spin circle {
          stroke-dasharray: 1 56;
          animation: u001-arc 1.4s ease-in-out infinite;
        }
        @keyframes u001-rot {
          to { transform: rotate(360deg); }
        }
        @keyframes u001-arc {
          0%, 100% { stroke-dasharray: 1 56; }
          50% { stroke-dasharray: 38 19; }
        }

        /* Loading state: shrinks like a water drop */
        .u001-container[data-state="load"] .u001-btn {
          width: 64px;
          cursor: progress;
        }
        .u001-container[data-state="load"] .u001-txt {
          opacity: 0;
          transform: translateY(-14px);
          filter: blur(5px);
        }
        .u001-container[data-state="load"] .u001-spin {
          opacity: 1;
          transform: none;
        }

        /* Success state: expands with check mark */
        .u001-container[data-state="ok"] .u001-btn {
          width: 256px;
          transition-timing-function: var(--ux-spring);
          box-shadow: inset 0 1.5px 0 var(--hi), inset 0 0 0 1px var(--rim), 0 20px 36px -18px var(--drop), 0 0 45px -8px color-mix(in srgb, var(--ux-mint) 70%, transparent);
        }
        .u001-container[data-state="ok"] .u001-txt {
          opacity: 0;
          transform: translateY(-14px);
          filter: blur(5px);
        }
        .u001-container[data-state="ok"] .u001-done {
          opacity: 1;
          transform: none;
          filter: none;
        }
        .u001-container[data-state="ok"] .u001-done path {
          stroke-dashoffset: 0;
        }

        .u001-live {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip-path: inset(50%);
          white-space: nowrap;
        }

        @media (prefers-reduced-motion: reduce) {
          .u001-container, .u001-container *, .u001-container *::before, .u001-container *::after {
            animation-duration: .001ms;
            animation-iteration-count: 1;
            transition-duration: .001ms;
          }
        }
      `}</style>

      <div ref={magRef} className="u001-mag">
        <div className="u001-float">
          <button
            ref={btnRef}
            type="button"
            className="u001-btn"
            onClick={handleClick}
            disabled={disabled || state === "load"}
            aria-busy={state === "load"}
          >
            <span className="u001-sheen" aria-hidden="true" />
            <span className="u001-txt">
              <span>{label}</span>
              <ArrowRightIcon className="w-4 h-4 ml-1 text-white/90" weight="bold" />
            </span>
            <span className="u001-spin" aria-hidden="true">
              <svg viewBox="0 0 30 30">
                <circle cx="15" cy="15" r="10" />
              </svg>
            </span>
            <span className="u001-done" aria-hidden="true">
              <b>
                <svg viewBox="0 0 16 16">
                  <path d="M3.5 8.4l3 3 6-6.4" />
                </svg>
              </b>
              <span>{successLabel}</span>
            </span>
          </button>
        </div>
      </div>
      <span className="u001-live" aria-live="polite">
        {liveText}
      </span>
    </div>
  );
};
