"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface MascotFaceProps {
  size?: number;
  // null = chưa biết, true = nhạc chạy (tươi), false = nhạc dừng (lim dim)
  musicPlaying: boolean | null;
  poking?: boolean;
}

const PUPIL_RANGE = 3.5;

// Mặt mèo chill đeo tai nghe: mắt nhìn theo chuột, thỉnh thoảng chớp mắt.
export const MascotFace = ({ size = 40, musicPlaying, poking = false }: MascotFaceProps) => {
  const reduceMotion = useReducedMotion();
  const [blinking, setBlinking] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const leftPupilRef = useRef<SVGGElement>(null);
  const rightPupilRef = useRef<SVGGElement>(null);

  // Mắt nhìn theo chuột: chỉnh trực tiếp để khỏi vẽ lại liên tục
  useEffect(() => {
    if (reduceMotion || typeof window === "undefined") return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const box = boxRef.current?.getBoundingClientRect();
        if (!box) return;
        const cx = box.left + box.width / 2;
        const cy = box.top + box.height / 2 - 4;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const len = Math.hypot(dx, dy) || 1;
        const px = (dx / len) * Math.min(PUPIL_RANGE, len / 60);
        const py = (dy / len) * Math.min(PUPIL_RANGE, len / 60);
        const t = `translate(${px.toFixed(2)}px, ${py.toFixed(2)}px)`;
        if (leftPupilRef.current) leftPupilRef.current.style.transform = t;
        if (rightPupilRef.current) rightPupilRef.current.style.transform = t;
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [reduceMotion]);

  // Thỉnh thoảng chớp mắt cho có hồn
  useEffect(() => {
    if (reduceMotion) return;
    let alive = true;
    let timer = 0;
    let blinkTimer = 0;
    const scheduleBlink = () => {
      timer = window.setTimeout(() => {
        if (!alive) return;
        setBlinking(true);
        blinkTimer = window.setTimeout(() => {
          if (alive) setBlinking(false);
        }, 160);
        scheduleBlink();
      }, 2600 + Math.random() * 2600);
    };
    const onVisibility = () => {
      window.clearTimeout(timer);
      window.clearTimeout(blinkTimer);
      if (document.hidden) {
        if (alive) setBlinking(false);
      } else {
        scheduleBlink();
      }
    };
    if (!document.hidden) scheduleBlink();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      window.clearTimeout(blinkTimer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduceMotion]);

  const sleepy = musicPlaying === false;
  const eyesShut = blinking || sleepy;

  return (
    <div ref={boxRef} className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
        {/* Bóng dưới chân */}
        <ellipse cx="32" cy="58" rx="14" ry="3.5" fill="rgba(0,0,0,0.35)" />
        {/* Tai */}
        <path d="M14 26 L10 8 L24 16 Z" fill="#ffcf9e" stroke="#5b3a1e" strokeWidth="2" strokeLinejoin="round" />
        <path d="M50 26 L54 8 L40 16 Z" fill="#ffcf9e" stroke="#5b3a1e" strokeWidth="2" strokeLinejoin="round" />
        <path d="M15 21 L13 12 L21 17 Z" fill="#f4a7b9" />
        <path d="M49 21 L51 12 L43 17 Z" fill="#f4a7b9" />
        {/* Đầu */}
        <circle cx="32" cy="34" r="20" fill="#ffe3b3" stroke="#5b3a1e" strokeWidth="2" />
        {/* Tai nghe chill */}
        <path d="M13 32 Q13 10 32 10 Q51 10 51 32" fill="none" stroke="#34d399" strokeWidth="3.5" strokeLinecap="round" />
        <rect x="9" y="27" width="7" height="12" rx="3.5" fill="#10b981" stroke="#064e3b" strokeWidth="1.5" />
        <rect x="48" y="27" width="7" height="12" rx="3.5" fill="#10b981" stroke="#064e3b" strokeWidth="1.5" />
        {/* Má hồng */}
        <ellipse cx="19" cy="40" rx="4" ry="2.6" fill="#f9a8d4" opacity="0.8" />
        <ellipse cx="45" cy="40" rx="4" ry="2.6" fill="#f9a8d4" opacity="0.8" />
        {/* Mắt: dừng nhạc thì lim dim, chọc thì chớp */}
        {eyesShut ? (
          <>
            <path d="M20 35 Q24 37 28 35" fill="none" stroke="#3f2d20" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M36 35 Q40 37 44 35" fill="none" stroke="#3f2d20" strokeWidth="2.2" strokeLinecap="round" />
          </>
        ) : (
          <>
            <ellipse cx="24" cy="34" rx="5" ry="5.6" fill="#fff" stroke="#3f2d20" strokeWidth="1.6" />
            <ellipse cx="40" cy="34" rx="5" ry="5.6" fill="#fff" stroke="#3f2d20" strokeWidth="1.6" />
            <g ref={leftPupilRef}>
              <circle cx="24" cy="34.5" r="2.6" fill="#1f2937" />
              <circle cx="24.8" cy="33.6" r="0.9" fill="#fff" />
            </g>
            <g ref={rightPupilRef}>
              <circle cx="40" cy="34.5" r="2.6" fill="#1f2937" />
              <circle cx="40.8" cy="33.6" r="0.9" fill="#fff" />
            </g>
          </>
        )}
        {/* Miệng */}
        <path
          d={poking ? "M28 43 Q32 47 36 43 Q32 45 28 43 Z" : "M28 43 Q30 45 32 43 Q34 45 36 43"}
          fill={poking ? "#3f2d20" : "none"}
          stroke="#3f2d20"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      {/* Nhạc chạy thì nốt nhạc bay, nhạc dừng thì mèo ngủ gật */}
      {!reduceMotion && musicPlaying && (
        <>
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute -right-1 top-0 text-xs font-bold text-emerald-300"
            animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            ♪
          </motion.span>
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute -left-1 top-2 text-[10px] font-bold text-emerald-200"
            animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          >
            ♫
          </motion.span>
        </>
      )}
      {!reduceMotion && sleepy && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute -right-1 top-0 text-xs font-bold text-sky-300"
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          z
        </motion.span>
      )}
    </div>
  );
};
