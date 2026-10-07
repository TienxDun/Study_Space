"use client";

import { useState, useEffect, useRef } from "react";

const TOTAL_BARS = 28;
const DEFAULT_BAR_HEIGHT = 20;
const FRAME_THROTTLE_MS = 40; // ~25 FPS to prevent excessive React state churn

/**
 * Hook tạo sóng âm đa họa âm mô phỏng (Multi-harmonic Beat Synthesizer)
 * Giới hạn tần suất cập nhật ở ~25fps để giao diện mượt mà và tiết kiệm CPU.
 */
export function useWaveformSynthesizer(isActive: boolean): number[] {
  const [frequencyData, setFrequencyData] = useState<number[]>(() =>
    new Array(TOTAL_BARS).fill(DEFAULT_BAR_HEIGHT)
  );
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      setFrequencyData(new Array(TOTAL_BARS).fill(DEFAULT_BAR_HEIGHT));
      return;
    }

    let lastRenderTime = 0;
    const renderWave = (timestamp: number) => {
      if (timestamp - lastRenderTime >= FRAME_THROTTLE_MS) {
        lastRenderTime = timestamp;
        const t = timestamp / 1000;
        const bars = Array.from({ length: TOTAL_BARS }, (_, i) => {
          const bassFactor = Math.sin(t * 6.0) * Math.cos(i * 0.35) * 38;
          const midFactor = Math.sin(i * 0.9 + t * 8.5) * 32;
          const trebleFactor = Math.sin(i * 1.6 + t * 11.2) * 20;
          const noise = Math.sin(t * 18 + i * 5) * 10;

          const combined = 45 + bassFactor + midFactor + trebleFactor + noise;
          const scaled = combined * 0.95;
          return Math.max(20, Math.min(98, Math.round(scaled)));
        });

        setFrequencyData(bars);
      }
      animationFrameRef.current = requestAnimationFrame(renderWave);
    };

    animationFrameRef.current = requestAnimationFrame(renderWave);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive]);

  return frequencyData;
}
