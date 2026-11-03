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
      if (event.key === "Escape") setOpen(false);
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
        className="flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full border border-chat-border bg-chat-surface px-2 text-chat-sub transition hover:border-chat-border-strong hover:bg-chat-hover hover:text-chat-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/50 disabled:cursor-not-allowed disabled:opacity-50 sm:justify-start sm:px-3"
      >
        <KeyIcon size={15} weight="duotone" aria-hidden="true" />
        <span className="hidden text-[11px] font-semibold sm:inline">{current.short}</span>
        <CaretDownIcon
          size={11}
          weight="bold"
          aria-hidden="true"
          className={`hidden shrink-0 transition-transform motion-reduce:transition-none sm:block ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Chọn API key"
          className="chat-v2-anim-pop fixed inset-x-3 top-[7.25rem] z-50 overflow-hidden rounded-2xl border border-chat-border-strong bg-chat-elevated/97 p-1.5 shadow-[var(--chat-shadow-popover)] backdrop-blur-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[300px]"
        >
          {OPTIONS.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => choose(option.value)}
                className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-chat-hover"
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
      ) : null}
    </div>
  );
}
