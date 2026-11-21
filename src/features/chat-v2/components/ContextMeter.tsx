"use client";

import { useEffect, useRef, useState } from "react";
import { LightningIcon, SparkleIcon } from "@phosphor-icons/react";
import type { ChatV2ContextMeta, ChatV2Model } from "../types";
import { formatContextSize, maxInputTokensFor } from "../lib/tokens";

interface ContextMeterProps {
  context?: ChatV2ContextMeta;
  modelInfo?: ChatV2Model;
  summaryCount?: number;
  summarizing?: boolean;
  onCompact?: () => void;
  canCompact?: boolean;
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(".0", "")}k`;
  return String(value);
}

export function ContextMeter({
  context,
  modelInfo,
  summaryCount = 0,
  summarizing = false,
  onCompact,
  canCompact = false,
}: ContextMeterProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Đóng khi click ra ngoài hoặc nhấn phím Escape
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!containerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Đánh dấu đã xử lý để phím tắt toàn cục không đóng luôn cả khung chat.
      event.preventDefault();
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleMouseEnter = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setOpen(true);
  };

  const handleMouseLeave = () => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = setTimeout(() => {
      setOpen(false);
    }, 180);
  };

  const estimatedInput = context?.estimatedInputTokens ?? 0;
  const maxInput = modelInfo ? maxInputTokensFor(modelInfo) : context?.maxInputTokens || 1;
  const rawPercent = maxInput > 0 ? (estimatedInput / maxInput) * 100 : 0;
  const percent = Math.min(100, Math.max(0, Math.round(rawPercent)));
  const percentDisplay = rawPercent > 0 && rawPercent < 1 ? "<1%" : `${percent}%`;

  const tone =
    percent >= 90
      ? "var(--chat-rose)"
      : percent >= 70
        ? "var(--chat-amber)"
        : "var(--chat-accent)";

  const contextSize = modelInfo ? formatContextSize(modelInfo.contextTokens) : "-";
  const contextSizeLabel = contextSize === "-" ? "chưa rõ" : contextSize;
  const label = context
    ? `${formatTokens(estimatedInput)} / ${formatTokens(maxInput)}`
    : modelInfo
      ? `${contextSizeLabel} context`
      : "context";

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={() => setOpen((curr) => !curr)}
        aria-expanded={open}
        aria-label={`Dung lượng ngữ cảnh: ${percentDisplay}. Nhấn hoặc hover để xem chi tiết và nén ngữ cảnh.`}
        title={open ? undefined : `Ngữ cảnh: ${label}`}
        className="group flex h-9 shrink-0 items-center gap-1.5 rounded-full px-1.5 text-chat-muted transition hover:bg-chat-hover hover:text-chat-ink active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/50 sm:h-8 sm:px-2"
      >
        <span
          aria-hidden="true"
          className="relative block h-1.5 w-6 shrink-0 overflow-hidden rounded-full bg-chat-border-strong"
        >
          <span
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
            style={{
              width: `${context ? Math.max(percent, 5) : percent}%`,
              backgroundColor: tone,
            }}
          />
        </span>
        <span className="text-[10px] font-semibold tabular-nums">
          {context ? percentDisplay : modelInfo ? contextSize : "—"}
        </span>
        {summarizing ? (
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-chat-amber motion-reduce:animate-none"
          />
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Thông tin ngữ cảnh và nén hội thoại"
          data-escape-guard=""
          className="chat-v2-anim-pop absolute bottom-full right-0 z-50 mb-2 w-72 sm:w-80 rounded-2xl border border-chat-border-strong bg-chat-elevated p-3.5 shadow-[var(--chat-shadow-popover)]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-chat-border/60 pb-2.5">
            <div className="flex items-center gap-1.5 text-chat-accent">
              <SparkleIcon size={14} weight="duotone" aria-hidden="true" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-chat-ink">
                Ngữ cảnh phiên
              </span>
            </div>
            <span className="truncate rounded-md bg-chat-surface px-1.5 py-0.5 text-[9px] font-medium text-chat-faint">
              {modelInfo?.id || "AI Model"}
            </span>
          </div>

          <div className="mt-3">
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="font-medium text-chat-sub">Dung lượng đã dùng:</span>
              <span className="font-semibold text-chat-ink">
                {percentDisplay}{" "}
                <span className="text-[10px] font-normal text-chat-muted">
                  ({context ? `${formatTokens(estimatedInput)} / ${formatTokens(maxInput)}` : `${contextSizeLabel} tối đa`})
                </span>
              </span>
            </div>

            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full border border-chat-border/80 bg-chat-surface">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.max(rawPercent > 0 ? 3 : 0, percent)}%`, backgroundColor: tone }}
              />
            </div>

            {context?.trimmedMessages && context.trimmedMessages > 0 ? (
              <p className="mt-1 text-[10px] text-chat-amber">
                Đã lược bớt {context.trimmedMessages} tin cũ để vừa giới hạn an toàn.
              </p>
            ) : null}
          </div>

          <div className="mt-3 rounded-xl border border-chat-border/60 bg-chat-surface p-2.5 text-[11px] text-chat-sub">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-chat-ink">Bộ nhớ tóm tắt:</span>
              <span className="text-[10px] text-chat-muted">
                {summaryCount > 0 ? `${summaryCount} tin cũ đã nén` : "Chưa có bản nén"}
              </span>
            </div>
            {summarizing ? (
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-chat-amber">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-chat-amber" />
                <span>Đang tiến hành nén ngữ cảnh…</span>
              </div>
            ) : null}
          </div>

          {onCompact ? (
            <div className="mt-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  onCompact();
                }}
                disabled={!canCompact || summarizing}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-chat-accent-button px-3 py-2 text-[12px] font-semibold text-chat-accent-button-text shadow-[0_4px_16px_var(--chat-accent-shadow)] transition-all hover:bg-chat-accent-button-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-chat-surface disabled:text-chat-faint disabled:shadow-none"
              >
                <LightningIcon size={14} weight="bold" className={summarizing ? "animate-pulse" : ""} aria-hidden="true" />
                {summarizing ? "Đang nén ngữ cảnh…" : "Nén ngữ cảnh ngay"}
              </button>
              <p className="mt-1.5 text-center text-[9px] leading-relaxed text-chat-faint">
                {canCompact
                  ? "Chủ động tóm tắt các tin cũ ngoài 6 tin gần nhất vào bộ nhớ phiên để tiết kiệm token."
                  : "Cần ít nhất 7 tin nhắn trong phiên để kích hoạt nén (luôn giữ nguyên 6 tin gần nhất)."}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
