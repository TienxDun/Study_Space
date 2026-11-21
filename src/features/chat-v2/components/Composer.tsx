"use client";

import {
  useEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type RefObject,
} from "react";
import {
  ArrowUpIcon,
  FileTextIcon,
  PaperclipIcon,
  StopIcon,
  UploadSimpleIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { ChatV2Attachment } from "../lib/attachments";
import { MAX_ATTACHMENTS } from "../lib/attachments";
import type { ChatV2ContextMeta, ChatV2KeyTier, ChatV2Model } from "../types";
import { ContextMeter } from "./ContextMeter";
import { ImagePreview } from "./ImagePreview";
import { KeyTierPicker } from "./KeyTierPicker";
import { ModelPicker } from "./ModelPicker";

interface ComposerProps {
  input: string;
  onInput: (value: string) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  sending: boolean;
  canSend: boolean;
  visionBlocked: boolean;
  attachments: ChatV2Attachment[];
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveAttachment: (id: string) => void;
  onSend: () => void;
  onStop: () => void;
  // Công cụ chọn model/ngữ cảnh nằm cạnh nút gửi; bỏ trống khi nhúng nơi khác.
  models?: ChatV2Model[];
  model?: string;
  modelInfo?: ChatV2Model;
  onModelChange?: (id: string) => void;
  keyTier?: ChatV2KeyTier;
  onKeyTierChange?: (value: ChatV2KeyTier) => void;
  context?: ChatV2ContextMeta;
  summaryCount?: number;
  summarizing?: boolean;
  onCompact?: () => void;
  canCompact?: boolean;
}

export function Composer({
  input,
  onInput,
  inputRef,
  sending,
  canSend,
  visionBlocked,
  attachments,
  onAddFiles,
  onRemoveAttachment,
  onSend,
  onStop,
  models = [],
  model = "",
  modelInfo,
  onModelChange,
  keyTier,
  onKeyTierChange,
  context,
  summaryCount,
  summarizing,
  onCompact,
  canCompact,
}: ComposerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ src: string; name: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const pickers =
    models.length > 0 && onModelChange && keyTier && onKeyTierChange ? (
      <>
        <ModelPicker
          models={models}
          value={model}
          valueInfo={modelInfo}
          onChange={onModelChange}
          disabled={sending}
          compact
        />
        <KeyTierPicker value={keyTier} onChange={onKeyTierChange} disabled={sending} />
      </>
    ) : null;

  const hasFiles = (event: ReactDragEvent) =>
    Array.from(event.dataTransfer?.types || []).includes("Files");

  const endDrag = () => {
    dragDepth.current = 0;
    setDragging(false);
  };

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (!input) {
      el.style.height = "44px";
      el.style.overflowY = "hidden";
      return;
    }
    el.style.height = "auto";
    const next = Math.min(Math.max(el.scrollHeight, 44), 160);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > 160 ? "auto" : "hidden";
  }, [input, inputRef]);

  return (
    <div
      className="relative shrink-0 bg-chat-bg/85 px-3 pb-[calc(var(--app-safe-bottom)+0.75rem)] pt-3 backdrop-blur-md sm:bg-chat-bg/80 sm:px-6 sm:pb-4 sm:backdrop-blur-2xl"
      onDragEnter={(event) => {
        if (sending || !hasFiles(event)) return;
        event.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        // Một số trình duyệt bỏ trống types khi rời vùng kéo — luôn đếm để nhãn không kẹt.
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        endDrag();
        if (sending) return;
        const files = Array.from(event.dataTransfer.files || []);
        if (files.length > 0) onAddFiles(files);
      }}
    >
      {dragging ? (
        <div className="chat-v2-anim-fade pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-3 bg-chat-bg/75 backdrop-blur-sm sm:px-6">
          <div className="chat-v2-anim-pop relative flex w-full max-w-[500px] items-center gap-3.5 rounded-2xl border border-chat-accent-border bg-chat-elevated/95 p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.4),0_0_35px_var(--chat-accent-shadow)] ring-1 ring-chat-accent/30 backdrop-blur-xl sm:gap-4 sm:rounded-3xl sm:p-4">
            {/* Hiệu ứng hào quang xung quanh thẻ (Ambient glow) */}
            <div
              aria-hidden="true"
              className="absolute -inset-0.5 -z-10 rounded-2xl bg-gradient-to-r from-chat-accent/20 via-emerald-400/10 to-chat-accent/20 opacity-80 blur-md sm:rounded-3xl"
            />

            {/* Khung icon nổi bật với chuyển động nhún nhẹ */}
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-chat-accent/15 text-chat-accent shadow-inner ring-1 ring-chat-accent/25 sm:h-12 sm:w-12 sm:rounded-2xl">
              <UploadSimpleIcon
                size={22}
                weight="bold"
                className="motion-safe:animate-bounce"
                aria-hidden="true"
              />
            </div>

            {/* Thông điệp rõ ràng, tinh giản */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-chat-ink sm:text-sm">
                Thả tệp để đính kèm
              </p>
              <p className="truncate text-[10.5px] text-chat-sub sm:text-[11.5px]">
                Ảnh JPG, PNG, WebP · Mã nguồn & văn bản
              </p>
            </div>

            {/* Giới hạn số lượng tệp */}
            <div className="hidden shrink-0 items-center rounded-full border border-chat-border bg-chat-surface-2 px-2.5 py-1 text-[10px] font-medium text-chat-muted sm:flex">
              {attachments.length > 0
                ? `${attachments.length}/${MAX_ATTACHMENTS} tệp`
                : `Tối đa ${MAX_ATTACHMENTS} tệp`}
            </div>
          </div>
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-[820px]">
        {visionBlocked ? (
          <div className="mb-2.5 flex items-start gap-2 rounded-2xl border border-chat-amber-border bg-chat-amber-soft px-3 py-2 text-[11px] leading-5 text-chat-amber">
            <WarningIcon size={14} weight="duotone" className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>Model này chỉ đọc chữ. Chọn qwen3.8-max, gemini-3.8-flash, gpt-5.6 hoặc glm-5.3-flash, hoặc bỏ ảnh.</span>
          </div>
        ) : null}

        {attachments.length > 0 ? (
          <div className="mb-2.5 flex flex-wrap gap-2">
            {attachments.map((attachment) => {
              const thumb = attachment.kind === "image" ? attachment.thumb : undefined;
              return (
                <span
                  key={attachment.id}
                  className="group inline-flex max-w-[220px] items-center gap-2 rounded-xl border border-chat-border bg-chat-surface p-1.5 pr-2 text-[10px] text-chat-sub"
                  title={attachment.name}
                >
                  {thumb ? (
                    <button
                      type="button"
                      onClick={() =>
                        setPreview({ src: attachment.dataUrl || thumb, name: attachment.name })
                      }
                      aria-label={`Xem ảnh ${attachment.name}`}
                      title={`Xem ảnh ${attachment.name}`}
                      className="shrink-0 cursor-zoom-in rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/50"
                    >
                      <span
                        aria-hidden="true"
                        className="block h-8 w-8 rounded-lg bg-cover bg-center"
                        style={{ backgroundImage: `url(${thumb})` }}
                      />
                    </button>
                  ) : (
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-chat-accent-soft text-chat-accent">
                      <FileTextIcon size={15} aria-hidden="true" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(attachment.id)}
                    disabled={sending}
                    aria-label={`Xóa ${attachment.name}`}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-chat-muted transition hover:bg-chat-hover hover:text-chat-ink disabled:opacity-40"
                  >
                    <XIcon size={11} weight="bold" aria-hidden="true" />
                  </button>
                </span>
              );
            })}
          </div>
        ) : null}

        <div className="rounded-[22px] border border-chat-border-strong bg-chat-input p-2 shadow-[var(--chat-shadow),inset_0_1px_0_var(--chat-hover)] transition focus-within:border-chat-accent-border focus-within:shadow-[var(--chat-shadow),inset_0_1px_0_var(--chat-hover)]">
          <label htmlFor="chat-v2-input" className="sr-only">
            Nhập câu hỏi cho trợ lý học tập
          </label>
          <textarea
            ref={inputRef}
            id="chat-v2-input"
            value={input}
            onChange={(event) => onInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSend();
              }
            }}
            onPaste={(event) => {
              const clipboard = event.clipboardData;
              if (!clipboard) return;
              const images: File[] = [];
              for (const item of Array.from(clipboard.items || [])) {
                if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
                const file = item.getAsFile();
                if (file) images.push(file);
              }
              if (images.length === 0 && clipboard.files) {
                for (const file of Array.from(clipboard.files)) {
                  if (file.type.startsWith("image/")) images.push(file);
                }
              }
              if (images.length === 0) return;
              event.preventDefault();
              const stamp = Date.now();
              onAddFiles(
                images.map((file, index) => {
                  if (file.name) return file;
                  const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : "png";
                  return new File([file], `clipboard-${stamp}-${index + 1}.${ext}`, { type: file.type });
                })
              );
            }}
            rows={1}
            maxLength={20000}
            placeholder="Hỏi bài, dán ảnh hoặc kéo tệp vào đây…"
            disabled={sending}
            style={{ height: "44px" }}
            className="w-full resize-none bg-transparent px-2 pt-1.5 text-[13px] leading-6 text-chat-ink outline-none placeholder:text-chat-muted disabled:opacity-60 sm:text-sm"
          />
          <div className="flex items-center justify-between gap-1 px-0.5 pb-0.5 pt-0.5">
            <div className="flex min-w-0 items-center gap-0.5">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,.txt,.md,.markdown,.csv,.json,.py,.js,.jsx,.ts,.tsx,.java,.html,.css,.sql,.xml,.yml,.yaml,.log"
                multiple
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
                onChange={(event) => {
                  if (event.target.files) onAddFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={sending || attachments.length >= MAX_ATTACHMENTS}
                aria-label="Đính kèm ảnh hoặc tệp chữ"
                title={
                  attachments.length > 0
                    ? `Đính kèm (${attachments.length}/${MAX_ATTACHMENTS} tệp)`
                    : `Đính kèm (tối đa ${MAX_ATTACHMENTS} tệp)`
                }
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-chat-muted transition hover:bg-chat-hover hover:text-chat-ink disabled:opacity-35 sm:h-8 sm:w-8"
              >
                <PaperclipIcon size={16} weight="bold" aria-hidden="true" />
              </button>
              {pickers}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {pickers ? (
                <ContextMeter
                  context={context}
                  modelInfo={modelInfo}
                  summaryCount={summaryCount}
                  summarizing={summarizing}
                  onCompact={onCompact}
                  canCompact={canCompact}
                />
              ) : null}
              {sending ? (
                <button
                  type="button"
                  onClick={onStop}
                  aria-label="Dừng trả lời"
                  title="Dừng"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-chat-rose-button text-chat-rose-button-text transition hover:bg-chat-rose-button-hover active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-rose/60"
                >
                  <StopIcon size={15} weight="fill" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSend}
                  disabled={!canSend}
                  aria-label="Gửi câu hỏi"
                  title="Gửi"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-chat-accent-button text-chat-accent-button-text shadow-[0_6px_18px_var(--chat-accent-shadow)] transition hover:bg-chat-accent-button-hover active:scale-95 disabled:cursor-not-allowed disabled:border disabled:border-chat-border disabled:bg-transparent disabled:text-chat-faint disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/60"
                >
                  <ArrowUpIcon size={16} weight="bold" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>

        <p className="mt-2 text-center text-[9px] leading-4 text-chat-muted sm:text-[10px]">
          <span className="hidden sm:inline">Enter để gửi · Shift + Enter xuống dòng · </span>
          AI có thể sai. Kiểm tra lại thông tin quan trọng. Không gửi ảnh mặt hay giấy tờ cá nhân.
        </p>
      </div>

      {preview ? (
        <ImagePreview src={preview.src} name={preview.name} onClose={() => setPreview(null)} />
      ) : null}
    </div>
  );
}
