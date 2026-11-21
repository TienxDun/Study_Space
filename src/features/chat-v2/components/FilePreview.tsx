"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, CopyIcon, FileTextIcon, XIcon } from "@phosphor-icons/react";

interface FilePreviewProps {
  name: string;
  text: string;
  onClose: () => void;
}

export function FilePreview({ name, text, onClose }: FilePreviewProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Đánh dấu đã xử lý để phím tắt toàn cục không đóng luôn cả khung chat.
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* bỏ qua */
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Xem tệp ${name}`}
      data-escape-guard=""
      onClick={onClose}
      className="chat-v2-anim-fade fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="chat-v2-anim-pop flex max-h-[84dvh] w-[min(92vw,760px)] flex-col overflow-hidden rounded-2xl border border-chat-border bg-chat-elevated shadow-[var(--chat-shadow-popover)]"
      >
        <header className="flex items-center gap-2.5 border-b border-chat-border px-4 py-3">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-chat-accent-soft text-chat-accent"
          >
            <FileTextIcon size={15} weight="duotone" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-chat-ink" title={name}>
              {name}
            </p>
            <p className="text-[10px] text-chat-muted">
              Tệp văn bản · {text.length.toLocaleString("vi-VN")} ký tự
            </p>
          </div>
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? "Đã sao chép nội dung tệp" : "Sao chép nội dung tệp"}
            title={copied ? "Đã sao chép" : "Sao chép"}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-chat-border bg-chat-surface text-chat-sub transition hover:border-chat-border-strong hover:bg-chat-hover hover:text-chat-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/50"
          >
            {copied ? (
              <CheckIcon size={14} weight="bold" className="text-chat-accent" />
            ) : (
              <CopyIcon size={14} />
            )}
          </button>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Đóng xem tệp"
            title="Đóng (Esc)"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-chat-border bg-chat-surface text-chat-sub transition hover:border-chat-border-strong hover:bg-chat-hover hover:text-chat-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/50"
          >
            <XIcon size={14} weight="bold" aria-hidden="true" />
          </button>
        </header>
        <pre className="custom-study-scroll min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-[12px] leading-6 text-chat-sub">
          {text}
        </pre>
      </div>
    </div>,
    document.body
  );
}
