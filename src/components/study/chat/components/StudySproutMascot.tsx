"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface StudySproutMascotProps {
  size?: number;
  className?: string;
  isThinking?: boolean;
}

const PUPIL_RANGE = 3.2;

/**
 * Mầm cây tri thức (Sprout Buddy) - Linh vật đồng hành học tập cho Chatbot.
 * Biểu tượng của sự kiên trì, nảy mầm và phát triển tri thức từng ngày.
 * Mắt dõi theo con trỏ chuột và chớp mắt tự nhiên.
 */
export const StudySproutMascot = ({
  size = 40,
  className = "",
  isThinking = false,
}: StudySproutMascotProps) => {
  const reduceMotion = useReducedMotion();
  const [blinking, setBlinking] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const leftPupilRef = useRef<SVGGElement>(null);
  const rightPupilRef = useRef<SVGGElement>(null);

  // Mắt dõi theo trỏ chuột của người dùng
  useEffect(() => {
    if (reduceMotion || typeof window === "undefined") return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const box = boxRef.current?.getBoundingClientRect();
        if (!box) return;
        const cx = box.left + box.width / 2;
        const cy = box.top + box.height / 2 - 2;
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

  // Tự động chớp mắt ngẫu nhiên
  useEffect(() => {
    if (reduceMotion) return;
    let alive = true;
    let timer = 0;
    const loop = () => {
      timer = window.setTimeout(() => {
        if (!alive) return;
        setBlinking(true);
        window.setTimeout(() => alive && setBlinking(false), 170);
        loop();
      }, 2400 + Math.random() * 2600);
    };
    loop();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [reduceMotion]);

  return (
    <div
      ref={boxRef}
      className={`relative select-none shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        aria-hidden="true"
        className="overflow-visible"
      >
        <defs>
          {/* Gradient màu xanh tươi mát của mầm cây tri thức */}
          <linearGradient id="sprout-body-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#86efac" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
          <linearGradient id="sprout-leaf-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>

        {/* Bóng đổ êm dịu */}
        <ellipse cx="32" cy="57" rx="14" ry="3.5" fill="rgba(0,0,0,0.3)" />

        {/* Cuống mầm vươn lên */}
        <path
          d="M32 20 Q32 11 34 6"
          stroke="#15803d"
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
        />

        {/* Lá mầm chính (phải) */}
        <path
          d="M34 6 C43 3 46 11 39 14 C35 15 34 10 34 6 Z"
          fill="url(#sprout-leaf-grad)"
          stroke="#15803d"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Gân lá chính */}
        <path
          d="M34 6 Q37 10 40 11"
          stroke="#166534"
          strokeWidth="1"
          fill="none"
          opacity="0.6"
        />

        {/* Lá mầm nhỏ (trái) */}
        <path
          d="M32 10 C25 8 23 15 29 17 C32 18 33 13 32 10 Z"
          fill="#86efac"
          stroke="#15803d"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />

        {/* Thân mầm hạt giống tròn trĩnh bầu bĩnh */}
        <path
          d="M32 18 C45 18 52 27 52 39 C52 50 43 56 32 56 C21 56 12 50 12 39 C12 27 19 18 32 18 Z"
          fill="url(#sprout-body-grad)"
          stroke="#166534"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Bụng sáng nhẹ dịu dàng */}
        <ellipse cx="32" cy="41" rx="12" ry="11" fill="#f0fdf4" opacity="0.75" />

        {/* Gò má ửng hồng phấn */}
        <ellipse cx="17" cy="42" rx="3.5" ry="2.2" fill="#fb7185" opacity="0.65" />
        <ellipse cx="47" cy="42" rx="3.5" ry="2.2" fill="#fb7185" opacity="0.65" />

        {/* Đôi mắt thông minh */}
        {blinking ? (
          <>
            {/* Mắt nhắm cười híp mắt ^ ^ khi chớp */}
            <path
              d="M19 36 Q24 32 29 36"
              fill="none"
              stroke="#14532d"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M35 36 Q40 32 45 36"
              fill="none"
              stroke="#14532d"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            {/* Tròng trắng */}
            <ellipse
              cx="24"
              cy="35"
              rx="5.2"
              ry="5.8"
              fill="#ffffff"
              stroke="#14532d"
              strokeWidth="1.5"
            />
            <ellipse
              cx="40"
              cy="35"
              rx="5.2"
              ry="5.8"
              fill="#ffffff"
              stroke="#14532d"
              strokeWidth="1.5"
            />

            {/* Đồng tử dõi theo trỏ chuột */}
            <g ref={leftPupilRef}>
              <circle cx="24" cy="35.5" r="2.8" fill="#0f291e" />
              <circle cx="24.9" cy="34.6" r="1.1" fill="#ffffff" />
              <circle cx="23.2" cy="36.5" r="0.6" fill="#ffffff" />
            </g>
            <g ref={rightPupilRef}>
              <circle cx="40" cy="35.5" r="2.8" fill="#0f291e" />
              <circle cx="40.9" cy="34.6" r="1.1" fill="#ffffff" />
              <circle cx="39.2" cy="36.5" r="0.6" fill="#ffffff" />
            </g>
          </>
        )}

        {/* Nụ cười mỉm thân thiện */}
        <path
          d="M29 44 Q32 47 35 44"
          fill="none"
          stroke="#14532d"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>

      {/* Hiệu ứng tia sáng tri thức lóe lên khi đang suy nghĩ hoặc học tập */}
      {!reduceMotion && isThinking && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute -right-1 top-0 text-xs font-bold text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.8)]"
          animate={{ scale: [0.8, 1.25, 0.8], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        >
          ✦
        </motion.span>
      )}
    </div>
  );
};
