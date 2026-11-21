"use client";

import { useEffect, useRef, useState } from "react";
import { CaretDownIcon, CheckIcon, KeyIcon } from "@phosphor-icons/react";
import type { ChatV2KeyTier } from "../types";

const OPTIONS: Array<{ value: ChatV2KeyTier; label: string; short: string; hint: string }> = [
  {
    value: "auto",
    label: "Tự động",
    short: "Auto",
    hint: "Model free đi key free, model khác đi key trả phí.",
  },
  {
    value: "free",
    label: "Key free",
    short: "Free",
    hint: "Chỉ hiện model dùng được bằng key free.",
  },
  {
    value: "paid",
    label: "Key trả phí",
    short: "Trả phí",
    hint: "Mở toàn bộ model trong danh sách.",
  },
];

interface KeyTierPickerProps {
  value: ChatV2KeyTier;
  onChange: (value: ChatV2KeyTier) => void;
  disabled?: boolean;
}

export function KeyTierPicker({ value, onChange, disabled = false }: KeyTierPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = OPTIONS.find((option) => option.value === value) || OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
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

  const choose = (next: ChatV2KeyTier) => {
    setOpen(false);
    onChange(next);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((state) => !state)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Chọn API key, đang dùng ${current.label}`}
        title={`API key: ${current.label} — ${current.hint}`}
        className="flex h-9 min-w-9 items-center justify-center gap-1 rounded-full px-2 text-chat-muted transition hover:bg-chat-hover hover:text-chat-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/50 disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:justify-start sm:pl-1.5 sm:pr-1.5"
      >
        <KeyIcon size={13} weight="duotone" aria-hidden="true" />
        <span className="hidden text-[11px] font-medium sm:inline">{current.short}</span>
        <CaretDownIcon
          size={10}
          weight="bold"
          aria-hidden="true"
          className={`hidden shrink-0 transition-transform motion-reduce:transition-none sm:block ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <>
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="chat-v2-anim-fade fixed inset-0 z-[59] bg-black/50 sm:hidden"
          />
          <div
            role="listbox"
            aria-label="Chọn API key"
            data-escape-guard=""
            className="chat-v2-anim-sheet fixed inset-x-3 bottom-[calc(var(--app-safe-bottom)+0.75rem)] z-[60] overflow-hidden rounded-[24px] border border-chat-border-strong bg-chat-elevated p-1.5 shadow-[var(--chat-shadow-popover)] sm:absolute sm:inset-x-auto sm:bottom-full sm:right-0 sm:z-50 sm:mb-2 sm:w-[300px] sm:rounded-2xl sm:bg-chat-elevated/97 sm:backdrop-blur-2xl"
          >
            <div className="mx-auto my-1 h-1.5 w-12 rounded-full bg-chat-border-strong sm:hidden" />
            {OPTIONS.map((option) => {
              const selected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => choose(option.value)}
                  className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-chat-hover sm:py-2"
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${
                      selected
                        ? "border-chat-accent-border bg-chat-accent-soft text-chat-accent"
                        : "border-chat-border bg-chat-surface text-chat-muted"
                    }`}
                  >
                    <KeyIcon size={13} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-semibold text-chat-ink">{option.label}</span>
                    <span className="block text-[10px] leading-4 text-chat-muted">{option.hint}</span>
                  </span>
                  {selected ? (
                    <CheckIcon size={14} weight="bold" className="mt-1 shrink-0 text-chat-accent" aria-hidden="true" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
