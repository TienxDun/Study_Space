"use client";

import { useEffect, useState } from "react";
import {
  ArrowsClockwiseIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  FileTextIcon,
  MagnifyingGlassPlusIcon,
  PencilSimpleIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import type { ChatV2Message } from "../types";
import { ChatV2Markdown } from "./ChatV2Markdown";
import { FilePreview } from "./FilePreview";
import { ImagePreview } from "./ImagePreview";

interface MessageBubbleProps {
  message: ChatV2Message;
  streaming: boolean;
  canRegenerate: boolean;
  onRegenerate: () => void;
  onEdit?: (text: string) => void;
}

/** "2,4s" khi dưới một phút; dài hơn thì "1 phút 12 giây". */
function compactDuration(ms: number): string {
  const seconds = Math.max(0, ms) / 1000;
  if (seconds < 60) return `${seconds.toFixed(1).replace(".", ",")}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest > 0 ? `${minutes} phút ${rest} giây` : `${minutes} phút`;
}

function fullDuration(ms: number): string {
  const seconds = Math.max(0, ms) / 1000;
  if (seconds < 60) return `${seconds.toFixed(1).replace(".", ",")} giây`;
  return compactDuration(ms);
}

/** Đồng hồ chờ tách riêng để mỗi nhịp chỉ render lại con số, không đụng markdown. */
function ElapsedTimer() {
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 200);
    return () => window.clearInterval(timer);
  }, []);
  return <>{compactDuration(elapsedMs)}</>;
}

export function MessageBubble({
  message,
  streaming,
  canRegenerate,
  onRegenerate,
  onEdit,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState<{ src: string; name: string; id: string } | null>(null);
  const [filePreview, setFilePreview] = useState<{ name: string; text: string } | null>(null);
  const isUser = message.role === "user";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* bỏ qua */
    }
  };

  if (isUser) {
    return (
      <article className="group flex flex-col items-end gap-1.5">
        {message.attachments && message.attachments.length > 0 ? (
          <div className="flex max-w-[86%] flex-wrap items-end justify-end gap-2">
            {message.attachments.map((attachment) => {
              const thumb = attachment.kind === "image" ? attachment.thumb : undefined;
              if (thumb) {
                return (
                  <button
                    key={attachment.id}
                    type="button"
                    onClick={() =>
                      setPreview({ src: thumb, name: attachment.name, id: attachment.id })
                    }
                    aria-label={`Xem ảnh ${attachment.name}`}
                    title={`Xem ảnh ${attachment.name}`}
                    className="group/att relative block max-w-[220px] shrink-0 cursor-zoom-in overflow-hidden rounded-2xl border border-chat-user-border bg-chat-surface shadow-[var(--chat-shadow)] transition hover:border-chat-accent-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumb}
                      alt=""
                      className="block h-auto max-h-[180px] w-auto max-w-[220px] object-cover"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 via-black/35 to-transparent px-2 pb-1 pt-5 text-left text-[10px] text-white opacity-0 transition-opacity duration-200 group-hover/att:opacity-100 group-focus-visible/att:opacity-100 motion-reduce:transition-none"
                    >
                      {attachment.name}
                    </span>
                    <span
                      aria-hidden="true"
                      className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/45 text-white opacity-0 transition-opacity duration-200 group-hover/att:opacity-100 group-focus-visible/att:opacity-100 motion-reduce:transition-none"
                    >
                      <MagnifyingGlassPlusIcon size={11} weight="bold" />
                    </span>
                  </button>
                );
              }
              const fileIndex =
                attachment.kind === "text"
                  ? (message.attachments || [])
                      .filter((item) => item.kind === "text")
                      .findIndex((item) => item.id === attachment.id)
                  : -1;
              const fileText =
                fileIndex >= 0 ? message.payload?.files?.[fileIndex]?.text : undefined;
              const cardInner = (
                <>
                  <span
                    aria-hidden="true"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-chat-accent-soft text-chat-accent"
                  >
                    <FileTextIcon size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-medium text-chat-ink">
                      {attachment.name}
                    </span>
                    <span className="block text-[10px] text-chat-muted">Tệp văn bản</span>
                  </span>
                  {fileText ? (
                    <MagnifyingGlassPlusIcon
                      size={12}
                      weight="bold"
                      aria-hidden="true"
                      className="ml-auto shrink-0 text-chat-muted"
                    />
                  ) : null}
                </>
              );
              const cardClass =
                "inline-flex max-w-[260px] items-center gap-2.5 rounded-2xl border border-chat-border bg-chat-elevated px-3 py-2 text-left shadow-[var(--chat-shadow)]";
              if (fileText) {
                return (
                  <button
                    key={attachment.id}
                    type="button"
                    onClick={() => setFilePreview({ name: attachment.name, text: fileText })}
                    aria-label={`Xem tệp ${attachment.name}`}
                    title={`Xem tệp ${attachment.name}`}
                    className={`${cardClass} cursor-pointer transition hover:border-chat-accent-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/50`}
                  >
                    {cardInner}
                  </button>
                );
              }
              return (
                <span key={attachment.id} title={attachment.name} className={cardClass}>
                  {cardInner}
                </span>
              );
            })}
          </div>
        ) : null}
        {message.text ? (
          <div className="max-w-[86%] rounded-2xl rounded-br-md border border-chat-user-border bg-chat-user px-4 py-3 shadow-[inset_0_1px_0_var(--chat-hover)]">
            <p className="whitespace-pre-wrap break-words text-[13px] leading-6 text-chat-user-text sm:text-sm">
              {message.text}
            </p>
          </div>
        ) : null}
        {message.text ? (
          <div className="mt-0.5 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100 max-sm:opacity-100">
            <button
              type="button"
              onClick={copy}
              aria-label={copied ? "Đã sao chép" : "Sao chép câu hỏi"}
              title={copied ? "Đã sao chép" : "Sao chép"}
              className="grid h-8 w-8 place-items-center rounded-md text-chat-muted transition hover:bg-chat-hover hover:text-chat-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/40 sm:h-6 sm:w-6"
            >
              {copied ? (
                <CheckIcon size={12} weight="bold" className="text-chat-accent" />
              ) : (
                <CopyIcon size={12} />
              )}
            </button>
            {onEdit ? (
              <button
                type="button"
                onClick={() => onEdit(message.text)}
                aria-label="Chỉnh sửa câu hỏi"
                title="Sửa lại câu hỏi này"
                className="grid h-8 w-8 place-items-center rounded-md text-chat-muted transition hover:bg-chat-hover hover:text-chat-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/40 sm:h-6 sm:w-6"
              >
                <PencilSimpleIcon size={12} />
              </button>
            ) : null}
          </div>
        ) : null}
        {preview ? (
          <ImagePreview
            src={preview.src}
            name={preview.name}
            imageId={preview.id}
            onClose={() => setPreview(null)}
          />
        ) : null}
        {filePreview ? (
          <FilePreview
            name={filePreview.name}
            text={filePreview.text}
            onClose={() => setFilePreview(null)}
          />
        ) : null}
      </article>
    );
  }

  return (
    <article className="min-w-0 chat-v2-anim-fade">
      <div className="min-w-0">
        {message.text ? (
          <div className="py-1">
            <ChatV2Markdown text={message.text} />
            {streaming ? (
              <span className="ml-0.5 inline-block h-4 w-1 animate-pulse rounded-full bg-chat-accent align-middle motion-reduce:animate-none" />
            ) : null}
          </div>
        ) : streaming ? (
          <div
            role="status"
            aria-label="ZenStudy đang suy nghĩ"
            className="chat-v2-anim-fade inline-flex items-center gap-2 py-1 text-[13px] sm:text-sm text-chat-sub"
          >
            <SparkleIcon
              size={14}
              weight="fill"
              className="animate-pulse text-chat-accent shrink-0 motion-reduce:animate-none"
              aria-hidden="true"
            />
            <span className="bg-gradient-to-r from-chat-ink via-chat-accent to-chat-sub bg-[length:200%_auto] bg-clip-text font-medium text-transparent chat-v2-shimmer">
              Đang suy nghĩ…
            </span>
            <span className="select-none font-mono text-[11px] text-chat-faint" aria-hidden="true">
              ·
            </span>
            <span
              className="select-none font-mono text-[11px] tabular-nums text-chat-faint"
              aria-label="Thời gian chờ"
            >
              <ElapsedTimer />
            </span>
          </div>
        ) : null}
        {!streaming && message.text ? (
          <div className="mt-1.5 flex items-center gap-1">
            <button
              type="button"
              onClick={copy}
              aria-label={copied ? "Đã sao chép" : "Sao chép câu trả lời"}
              title={copied ? "Đã sao chép" : "Sao chép"}
              className="grid h-8 w-8 place-items-center rounded-lg text-chat-muted transition hover:bg-chat-hover hover:text-chat-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/40 sm:h-7 sm:w-7"
            >
              {copied ? <CheckIcon size={13} weight="bold" className="text-chat-accent" /> : <CopyIcon size={13} />}
            </button>
            {canRegenerate ? (
              <button
                type="button"
                onClick={onRegenerate}
                aria-label="Làm lại câu trả lời"
                title="Làm lại"
                className="grid h-8 w-8 place-items-center rounded-lg text-chat-muted transition hover:bg-chat-hover hover:text-chat-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/40 sm:h-7 sm:w-7"
              >
                <ArrowsClockwiseIcon size={13} />
              </button>
            ) : null}
            {typeof message.durationMs === "number" && message.durationMs > 0 ? (
              <span
                title={`Thời gian phản hồi: ${fullDuration(message.durationMs)}`}
                className="ml-2 inline-flex select-none items-center gap-1 font-mono text-[10px] tabular-nums text-chat-muted"
              >
                <ClockIcon size={11} weight="duotone" aria-hidden="true" />
                {compactDuration(message.durationMs)}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
