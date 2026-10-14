"use client";

import { useEffect, useRef, type RefObject } from "react";
import { PaperclipIcon, ArrowUpIcon, XIcon, FileTextIcon } from "@phosphor-icons/react";
import type { ImageAttachment } from "../hooks/useImageAttachments";

interface ChatInputProps {
  input: string;
  onInput: (v: string) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  sending: boolean;
  regenerating: boolean;
  onSend: () => void;
  attachments: ImageAttachment[];
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveAttachment: (id: string) => void;
}

// Khung nhập câu hỏi nguyên khối (Unified Capsule) chuẩn phong cách AI hiện đại
export function ChatInput({
  input,
  onInput,
  inputRef,
  sending,
  regenerating,
  onSend,
  attachments,
  onAddFiles,
  onRemoveAttachment,
}: ChatInputProps) {
  const busy = sending || regenerating;
  const canSend = !busy && (!!input.trim() || attachments.length > 0);
  const fileRef = useRef<HTMLInputElement>(null);

  // Tự động điều chỉnh chiều cao theo nội dung (tối thiểu 24px, tối đa 120px):
  // - Khi không có chữ (chỉ hiện placeholder): khóa cứng ở chiều cao 1 dòng chuẩn (24px) để căn giữa hoàn hảo cùng 2 nút icon
  // - Khi có chữ: co giãn linh hoạt theo scrollHeight từ 24px đến tối đa 120px
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (!input) {
      el.style.height = "24px";
      el.style.overflowY = "hidden";
      return;
    }
    el.style.height = "auto";
    const nextHeight = Math.min(Math.max(el.scrollHeight, 24), 120);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > 120 ? "auto" : "hidden";
  }, [input, inputRef]);

  return (
    <div className="p-2.5 sm:p-3 border-t border-white/10 bg-zinc-950/70 backdrop-blur-xl">
      <label htmlFor="study-chat-input" className="sr-only">
        Nhập câu hỏi cho trợ lý học tập
      </label>

      {/* File xem trước trước khi gửi */}
      {attachments.length > 0 && (
        <div className="flex gap-2.5 px-1 pb-2.5 pt-0.5 overflow-x-auto custom-study-scroll">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="group/attach relative shrink-0 rounded-xl overflow-hidden border border-white/15 bg-white/[0.05] shadow-md transition-all hover:border-white/30"
            >
              {a.kind === "image" && a.dataUrl ? (
                <div className="relative h-20 w-24 bg-black/40">
                  <img
                    src={a.dataUrl}
                    alt={a.name}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1 pointer-events-none">
                    <p className="text-[10px] font-mono text-zinc-300 truncate">
                      {a.name}
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  title={a.name}
                  className="h-20 w-36 px-2.5 py-2 flex flex-col justify-between"
                >
                  <div className="flex items-center gap-1.5 text-sky-400">
                    <FileTextIcon size={16} weight="bold" />
                    <span className="text-[11px] font-medium text-zinc-200 truncate">
                      {a.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {a.size < 1024 ? `${a.size} B` : `${Math.round(a.size / 1024)} KB`}
                  </span>
                </div>
              )}

              {/* Nút xóa file */}
              <button
                type="button"
                onClick={() => onRemoveAttachment(a.id)}
                title={`Xóa file ${a.name}`}
                aria-label={`Xóa file ${a.name}`}
                className="absolute top-1 right-1 h-5 w-5 grid place-items-center rounded-full bg-black/70 hover:bg-rose-500 text-zinc-300 hover:text-white border border-white/20 transition-all cursor-pointer shadow-sm active:scale-90"
              >
                <XIcon size={10} weight="bold" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Unified Input Capsule: Khối bo tròn cân xứng đối xứng pixel-perfect, nút gửi lồng bên trong */}
      <div className="group relative flex items-end gap-1.5 p-1.5 rounded-2xl bg-black/60 border border-white/15 hover:border-white/25 focus-within:border-white/40 focus-within:ring-2 focus-within:ring-white/15 shadow-inner transition-all duration-200">
        {/* Nút kẹp file */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          title="Gửi ảnh hoặc file chữ (png, jpg, webp, txt, md, csv, json, mã nguồn)"
          aria-label="Gửi file"
          className="h-8.5 w-8.5 shrink-0 grid place-items-center rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-40 transition-all cursor-pointer"
        >
          <PaperclipIcon size={17} weight="bold" aria-hidden="true" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,.txt,.md,.markdown,.csv,.json,.py,.js,.jsx,.ts,.tsx,.java,.html,.css,.c,.h,.cpp,.go,.rs,.sql,.xml,.yml,.yaml,.log"
          multiple
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            if (e.target.files) onAddFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="flex-1 min-w-0 flex items-center min-h-[34px] py-1 px-1">
          <textarea
            ref={inputRef}
            id="study-chat-input"
            name="chat-question"
            rows={1}
            value={input}
            onChange={(e) => onInput(e.target.value)}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData?.files || []).filter((f) =>
                f.type.startsWith("image/")
              );
              if (files.length > 0) {
                e.preventDefault();
                onAddFiles(files);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend) {
                  onSend();
                }
              }
            }}
            placeholder="Hỏi gì đó… (Shift+Enter để xuống dòng)"
            maxLength={8000}
            disabled={busy}
            style={{
              height: "24px",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
            className="w-full bg-transparent border-0 outline-none text-base sm:text-sm text-white placeholder:text-zinc-500 placeholder:truncate resize-none leading-6 p-0 m-0 overflow-y-auto [&::-webkit-scrollbar]:hidden"
          />
        </div>

        {/* Nút gửi: Nằm gọn gàng ở góc phải capsule, Pure White khi có chữ chuẩn ChatGPT / Linear */}
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          title={busy ? "Đang suy nghĩ câu trả lời…" : "Gửi câu hỏi (Enter)"}
          aria-label="Gửi câu hỏi"
          className={`h-8.5 w-8.5 shrink-0 grid place-items-center rounded-xl transition-all duration-150 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
            canSend
              ? "bg-white hover:bg-zinc-200 text-zinc-950 font-bold shadow-[0_2px_12px_rgba(255,255,255,0.25)] hover:scale-105 active:scale-95 cursor-pointer"
              : "bg-white/5 text-zinc-600 cursor-not-allowed opacity-40"
          }`}
        >
          <ArrowUpIcon size={16} weight="bold" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
