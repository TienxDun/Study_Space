"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { resolveAssetUrl } from "@/lib/asset-resolver";

/**
 * Phòng thử chất liệu surface mobile: 4 phương án nền panel trên cùng một bối cảnh,
 * kèm kế FPS thời gian thực để vừa chọn đẹp vừa thấy chi phí thật.
 * Trang này KHÔNG phụ thuộc pointer:coarse - mỗi ô tự vẽ đúng chất liệu của nó
 * bằng inline style, nên xem trên máy tính hay điện thoại đều ra kết quả như nhau.
 */

interface Backdrop {
  key: string;
  label: string;
  image: string;
  /** Màu nhấn lấy theo sắc chủ đạo của cảnh, dùng cho phương án nhuộm màu (C). */
  accent: string;
}

const BACKDROPS: Backdrop[] = [
  {
    key: "dark",
    label: "Nền tối (Night Sky)",
    image: resolveAssetUrl("scenes/anime-night-sky-illustration.avif"),
    accent: "#8b93f8",
  },
  {
    key: "bright",
    label: "Nền sáng (Fantasy World)",
    image: resolveAssetUrl("thumbnails/journey-through-fantasy-world.webp"),
    accent: "#7dd3fc",
  },
];

type VariantKey = "black" | "graphite" | "frost" | "elevated";

interface Variant {
  key: VariantKey;
  name: string;
  note: string;
  cost: string;
  /** true khi panel cần lớp ảnh đã mờ tĩnh bên dưới (phương án A). */
  frost: boolean;
  panel: (accent: string) => CSSProperties;
}

const VARIANTS: Variant[] = [
  {
    key: "black",
    name: "1 · Đen đặc (cũ)",
    note: "rgba(0,0,0,.82) - mảng đen dán lên màn hình, không chiều sâu.",
    cost: "Rẻ nhất",
    frost: false,
    panel: () => ({
      background: "rgba(0, 0, 0, 0.82)",
      border: "1px solid rgba(255, 255, 255, 0.14)",
      boxShadow: "0 24px 60px rgba(0, 0, 0, 0.6)",
    }),
  },
  {
    key: "graphite",
    name: "2 · Graphite (đang dùng)",
    note: "Than-xanh gradient. Đẹp trên nền sáng, tan biến trên nền tối.",
    cost: "Rẻ",
    frost: false,
    panel: () => ({
      background:
        "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.015) 42%, rgba(255,255,255,0)), linear-gradient(180deg, rgba(27,33,48,.94), rgba(20,24,33,.96))",
      border: "1px solid rgba(255, 255, 255, 0.16)",
      boxShadow: "0 24px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255,255,255,.15)",
    }),
  },
  {
    key: "frost",
    name: "3 · A+C: kính tĩnh + nhuộm cảnh",
    note: "Ảnh cảnh làm mờ TĨNH phía sau + viền ánh màu của chính bối cảnh.",
    cost: "Rẻ (mờ 1 lần, không mỗi frame)",
    frost: true,
    panel: (accent) => ({
      background:
        "linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04) 45%, rgba(255,255,255,.015)), rgba(16,20,30,.42)",
      border: `1px solid ${hexToRgba(accent, 0.34)}`,
      boxShadow: `0 24px 60px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.28), 0 0 0 1px ${hexToRgba(accent, 0.08)}`,
    }),
  },
  {
    key: "elevated",
    name: "4 · B: graphite nâng viền sáng",
    note: "Sáng hơn hẳn nền, viền trắng mạnh + bóng đổ -> tách khối dù nền tối cỡ nào.",
    cost: "Rẻ",
    frost: false,
    panel: () => ({
      background:
        "linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.03) 40%, rgba(255,255,255,.01)), linear-gradient(180deg, #262e42, #1c2231)",
      border: "1px solid rgba(255, 255, 255, 0.22)",
      boxShadow: "0 28px 70px rgba(0, 0, 0, 0.72), inset 0 1px 0 rgba(255,255,255,.22)",
    }),
  },
];

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Đồng hồ FPS bằng requestAnimationFrame, làm mới 2 lần/giây. */
function useFps(): number {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const tick = () => {
      frames += 1;
      const now = performance.now();
      if (now - last >= 500) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return fps;
}

interface SampleProps {
  variant: Variant;
  backdrop: Backdrop;
  expanded: boolean;
  onToggle: () => void;
}

function Sample({ variant, backdrop, expanded, onToggle }: SampleProps) {
  const style = variant.panel(backdrop.accent);
  return (
    <button
      type="button"
      onClick={onToggle}
      style={style}
      className={`relative overflow-hidden rounded-3xl p-4 text-left text-white transition-transform active:scale-[0.99] ${
        expanded ? "fixed inset-3 z-50 flex flex-col justify-between rounded-[32px] p-6" : ""
      }`}
    >
      {/* Lớp ảnh cảnh đã làm mờ TĨNH: đây là thứ thay backdrop-filter động.
          GPU chỉ vẽ một lần rồi cache, không phải làm lại theo video. */}
      {variant.frost && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-16"
          style={{
            backgroundImage: `url('${backdrop.image}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(30px) saturate(1.35) brightness(0.85)",
            transform: "scale(1.1)",
          }}
        />
      )}

      <span className="relative z-10 flex flex-col gap-3">
        <span
          className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{
            background: hexToRgba(backdrop.accent, 0.16),
            border: `1px solid ${hexToRgba(backdrop.accent, 0.4)}`,
            color: "#fff",
          }}
        >
          {variant.name}
        </span>

        <span className="block text-[17px] font-bold tracking-tight">Không gian của bạn</span>

        <span className="block space-y-1.5">
          {["Toán chương III — 25 phút", "Đọc hiểu — 15 phút"].map((row) => (
            <span
              key={row}
              className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-[13px]"
              style={{
                background: "rgba(255, 255, 255, 0.07)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: backdrop.accent }}
              />
              {row}
            </span>
          ))}
        </span>

        {/* Dòng chữ mờ nhỏ nhất: bài kiểm tra đọc được hay không thật sự */}
        <span className="block text-[11px] leading-relaxed" style={{ color: "rgba(226,232,240,.62)" }}>
          {variant.note}
        </span>
      </span>

      <span className="relative z-10 mt-4 flex items-center justify-between gap-3">
        <span
          className="rounded-xl px-3 py-2 text-[12px] font-bold"
          style={{
            background: hexToRgba(backdrop.accent, 0.22),
            border: `1px solid ${hexToRgba(backdrop.accent, 0.5)}`,
          }}
        >
          Bắt đầu
        </span>
        <span
          className="rounded-full px-2 py-1 text-[10px] font-semibold"
          style={{ background: "rgba(0,0,0,.35)", border: "1px solid rgba(255,255,255,.14)" }}
        >
          {variant.cost}
        </span>
      </span>

      {expanded && (
        <span className="absolute right-4 top-4 z-10 rounded-full bg-black/45 px-3 py-1 text-[11px] font-semibold">
          Bấm để thu lại
        </span>
      )}
    </button>
  );
}

export default function SurfaceLabPage() {
  const [backdropKey, setBackdropKey] = useState(BACKDROPS[0].key);
  const [expandedKey, setExpandedKey] = useState<VariantKey | null>(null);
  const fps = useFps();
  const backdrop = useMemo(
    () => BACKDROPS.find((b) => b.key === backdropKey) ?? BACKDROPS[0],
    [backdropKey]
  );

  return (
    <main className="relative min-h-dvh w-full overflow-hidden bg-slate-950 text-white">
      {/* Bối cảnh thật của app để so sánh chất liệu panel đặt lên trên */}
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${backdrop.image}')` }}
      />
      <div aria-hidden="true" className="fixed inset-0 bg-slate-950/25" />

      <div className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-24 pt-6">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[19px] font-bold tracking-tight">Phòng thử chất liệu surface</h1>
            <p className="mt-1 text-[12px] text-slate-300">
              Bấm một ô để xem toàn màn hình như sheet thật.
            </p>
          </div>
          <span
            className="rounded-full px-3 py-1.5 text-[12px] font-bold tabular-nums"
            style={{
              background: fps >= 55 ? "rgba(16,185,129,.2)" : "rgba(251,146,60,.24)",
              border: "1px solid rgba(255,255,255,.16)",
            }}
          >
            {fps} FPS
          </span>
        </header>

        <div className="mb-5 flex gap-2">
          {BACKDROPS.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => {
                setBackdropKey(b.key);
                setExpandedKey(null);
              }}
              className={`flex-1 rounded-2xl px-3 py-2.5 text-[12px] font-bold transition-colors ${
                b.key === backdrop.key
                  ? "bg-white/18 text-white"
                  : "bg-black/40 text-slate-300 hover:bg-black/55"
              }`}
              style={{ border: "1px solid rgba(255,255,255,.16)" }}
            >
              {b.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {VARIANTS.map((variant) => (
            <Sample
              key={variant.key}
              variant={variant}
              backdrop={backdrop}
              expanded={expandedKey === variant.key}
              onToggle={() =>
                setExpandedKey((current) => (current === variant.key ? null : variant.key))
              }
            />
          ))}
        </div>

        <p className="mt-6 text-[11px] leading-relaxed text-slate-300">
          Ô 3 là phương án lấy lại chất kính mà không dùng backdrop-filter động: làm mờ ảnh
          thumbnail tĩnh (GPU vẽ một lần) thay vì làm mờ video đang phát (60 lần/giây). Ô 4 là
          phương án không cần thêm lớp nào, chỉ nâng độ sáng và viền.
        </p>
      </div>
    </main>
  );
}
