"use client";

import { useEffect, useState } from "react";
import {
  ArrowsClockwiseIcon,
  CheckIcon,
  CopyIcon,
  FileTextIcon,
  MagnifyingGlassPlusIcon,
  PencilSimpleIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import type { ChatV2Message } from "../types";
import { ChatV2Markdown } from "./ChatV2Markdown";
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
      <article className="group flex flex-col items-end">
        <div className="max-w-[86%] rounded-2xl rounded-br-md border border-chat-user-border bg-chat-user px-4 py-3 shadow-[inset_0_1px_0_var(--chat-hover)]">
          {message.text ? (
            <p className="whitespace-pre-wrap break-words text-[13px] leading-6 text-chat-user-text sm:text-sm">
              {message.text}
            </p>
          ) : null}
          {message.attachments && message.attachments.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
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
                      className="inline-flex max-w-[190px] cursor-zoom-in items-center gap-1.5 rounded-lg border border-chat-user-border bg-chat-surface px-2 py-1 text-[10px] text-chat-user-text transition hover:border-chat-accent-border hover:bg-chat-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/50"
                    >
                      <span
                        aria-hidden="true"
                        className="h-6 w-6 shrink-0 rounded bg-cover bg-center"
                        style={{ backgroundImage: `url(${thumb})` }}
                      />
                      <span className="truncate">{attachment.name}</span>
                      <MagnifyingGlassPlusIcon
                        size={10}
                        weight="bold"
                        className="shrink-0 text-chat-muted"
                        aria-hidden="true"
                      />
                    </button>
                  );
                }
                return (
                  <span
                    key={attachment.id}
                    title={attachment.name}
                    className="inline-flex max-w-[190px] items-center gap-1.5 rounded-lg border border-chat-user-border bg-chat-surface px-2 py-1 text-[10px] text-chat-user-text"
                  >
                    <FileTextIcon size={12} aria-hidden="true" />
                    <span className="truncate">{attachment.name}</span>
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>
        {message.text ? (
          <div className="mt-0.5 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100 max-sm:opacity-100">
            <button
              type="button"
              onClick={copy}
              aria-label={copied ? "Đã sao chép" : "Sao chép câu hỏi"}
              title={copied ? "Đã sao chép" : "Sao chép"}
              className="grid h-6 w-6 place-items-center rounded-md text-chat-muted transition hover:bg-chat-hover hover:text-chat-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/40"
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
                className="grid h-6 w-6 place-items-center rounded-md text-chat-muted transition hover:bg-chat-hover hover:text-chat-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/40"
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
          <div className="mt-1 flex items-center gap-1">
            <button
              type="button"
              onClick={copy}
              aria-label={copied ? "Đã sao chép" : "Sao chép câu trả lời"}
              title={copied ? "Đã sao chép" : "Sao chép"}
              className="grid h-7 w-7 place-items-center rounded-lg text-chat-muted transition hover:bg-chat-hover hover:text-chat-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/40"
            >
              {copied ? <CheckIcon size={13} weight="bold" className="text-chat-accent" /> : <CopyIcon size={13} />}
            </button>
            {canRegenerate ? (
              <button
                type="button"
                onClick={onRegenerate}
                aria-label="Làm lại câu trả lời"
                title="Làm lại"
                className="grid h-7 w-7 place-items-center rounded-lg text-chat-muted transition hover:bg-chat-hover hover:text-chat-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/40"
              >
                <ArrowsClockwiseIcon size={13} />
              </button>
            ) : null}
            {typeof message.durationMs === "number" && message.durationMs > 0 ? (
              <span
                title={`Thời gian phản hồi: ${fullDuration(message.durationMs)}`}
                className="ml-auto inline-flex select-none items-center font-mono text-[10px] tabular-nums text-chat-faint"
              >
                {compactDuration(message.durationMs)}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
