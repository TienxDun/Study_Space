"use client";

import { useEffect, useRef, type RefObject } from "react";

const BAR_COUNT = 28;

interface UseSiriWaveformOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  isActive: boolean;
  getProgress: () => number;
  getHoverRatio: () => number | null;
}

/**
 * Sóng nhạc synth vẽ trên canvas (pattern Siri Wave 21st.dev):
 * đường cong đa họa âm, vẽ trực tiếp 0 setState nên không re-render React.
 */
export function useSiriWaveform({
  canvasRef,
  isActive,
  getProgress,
  getHoverRatio,
}: UseSiriWaveformOptions) {
  const liveRef = useRef({ isActive, getProgress, getHoverRatio });
  useEffect(() => {
    liveRef.current = { isActive, getProgress, getHoverRatio };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = canvas.getContext("2d");
    if (!g) return;

    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    fit();
    window.addEventListener("resize", fit);

    let alive = true;
    let rafId = 0;
    let lastStaticDraw = 0;

    const draw = (t: number) => {
      if (!alive) return;
      // Tab ẩn thì trình duyệt đã bóp rAF, nhưng vẫn bỏ qua phần vẽ cho chắc
      if (typeof document !== "undefined" && document.hidden) {
        rafId = requestAnimationFrame(draw);
        return;
      }
      const { isActive: active, getProgress: gp, getHoverRatio: gh } =
        liveRef.current;
      const hoverRatio = gh();
      // Đứng yên (không phát, không di chuột) thì vẽ thưa 5 khung/giây là đủ
      if (!active && hoverRatio === null && t - lastStaticDraw < 200) {
        rafId = requestAnimationFrame(draw);
        return;
      }
      lastStaticDraw = t;
      const W = canvas.width;
      const H = canvas.height;
      if (W === 0 || H === 0) {
        rafId = requestAnimationFrame(draw);
        return;
      }
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      g.clearRect(0, 0, W, H);

      const progress = Math.max(0, Math.min(1, gp()));

      const gap = 2 * dpr;
      const bw = (W - gap * (BAR_COUNT - 1)) / BAR_COUNT;
      const time = t / 1000;

      // Dựng gradient 1 lần/khung rồi dùng chung, khỏi tạo 28 cái mỗi khung
      const playedGrad = g.createLinearGradient(0, H, 0, 0);
      playedGrad.addColorStop(0, "#10b981");
      playedGrad.addColorStop(1, "#6ee7b7");

      for (let i = 0; i < BAR_COUNT; i++) {
        const barRatio = i / (BAR_COUNT - 1);
        const motion = active ? time : 0;
        let v =
          0.45 +
          Math.sin(i * 0.9 + motion * 8.5) * 0.32 +
          Math.sin(i * 1.6 + motion * 11.2) * 0.2 +
          Math.sin(i * 0.35) * 0.2;
        v = Math.max(0.08, Math.min(1, v));

        const bh = Math.max(2 * dpr, v * H);
        const x = i * (bw + gap);
        const y = (H - bh) / 2;
        const played = barRatio <= progress;
        const hovered =
          hoverRatio !== null && barRatio <= hoverRatio && !played;

        if (played && active) {
          g.fillStyle = playedGrad;
        } else if (hovered) {
          g.fillStyle = "rgba(52,211,153,0.6)";
        } else {
          g.fillStyle = "rgba(255,255,255,0.22)";
        }

        const w = Math.max(1.5 * dpr, bw);
        g.beginPath();
        if (typeof g.roundRect === "function") {
          g.roundRect(x, y, w, bh, bh / 2);
        } else {
          g.rect(x, y, w, bh);
        }
        g.fill();
      }

      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);

    return () => {
      alive = false;
      window.removeEventListener("resize", fit);
      cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
