"use client";

interface PomoProgressRingProps {
  progress: number; // 0..1 elapsed
  size?: number;
}

/** Vòng tròn focus: khung chứa duy nhất số thời gian ở giữa. */
export function PomoProgressRing({ progress, size = 340 }: PomoProgressRingProps) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const clamped = Math.max(0, Math.min(1, progress));

  // Ring khuyết 1 khoảng ở đáy (GAP% chu vi) để nhét dots chu kỳ vào.
  // pathLength=100 cho số đẹp: ARC% cung hiển thị + GAP% khoảng trống.
  // Xoay 126° để khoảng trống nằm chính giữa đáy (6 giờ).
  const ARC = 80;
  const GAP = 20;

  return (
    <div
      aria-hidden="true"
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none h-full w-full"
      style={{ maxWidth: size, maxHeight: size }}
    >
      <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="pomo-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#6ee7b7" />
          </linearGradient>
        </defs>
        <g transform={`rotate(126 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={stroke}
            pathLength={100}
            strokeDasharray={`${ARC} ${GAP}`}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="url(#pomo-ring-gradient)"
            strokeWidth={stroke}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${clamped * ARC} 100`}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
            style={{ filter: "drop-shadow(0 0 8px rgba(52,211,153,0.8))" }}
          />
        </g>
      </svg>
    </div>
  );
}
