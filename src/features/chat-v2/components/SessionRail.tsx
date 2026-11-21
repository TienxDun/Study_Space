"use client";

import { useState } from "react";
import {
  BookmarkSimpleIcon,
  CaretDownIcon,
  CaretUpIcon,
  FileTextIcon,
  FilesIcon,
  ImageIcon,
  MagnifyingGlassPlusIcon,
  XIcon,
} from "@phosphor-icons/react";
import { relativeTime } from "../lib/sessions";
import type { ChatV2SessionFileMeta, ChatV2SessionSummary } from "../types";
import { FilePreview } from "./FilePreview";
import { ImagePreview } from "./ImagePreview";

interface SessionRailProps {
  summary: ChatV2SessionSummary | null;
  summarizing: boolean;
  files: ChatV2SessionFileMeta[];
  onClose: () => void;
}

export function SessionRail({ summary, summarizing, files, onClose }: SessionRailProps) {
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState<{ src: string; name: string; id: string } | null>(null);
  const [filePreview, setFilePreview] = useState<{ name: string; text: string } | null>(null);
  const canExpand = (summary?.text.length || 0) > 320;

  return (
    <aside
      aria-label="Chi tiết phiên học"
      className="chat-v2-rail chat-v2-anim-fade hidden w-[260px] shrink-0 flex-col sm:flex xl:w-[280px]"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-chat-faint">
            Phiên học
          </p>
          <p className="mt-0.5 truncate text-[13px] font-semibold text-chat-ink">Bộ nhớ &amp; tệp</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Ẩn chi tiết phiên"
          title="Ẩn chi tiết phiên"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-chat-border bg-chat-surface text-chat-sub transition hover:border-chat-border-strong hover:bg-chat-hover hover:text-chat-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/50"
        >
          <XIcon size={13} weight="bold" aria-hidden="true" />
        </button>
      </div>

      <div className="custom-study-scroll flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 py-3">
        {summary ? (
          <section className="rounded-2xl border border-chat-border bg-chat-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5 text-chat-accent">
                <BookmarkSimpleIcon size={13} weight="duotone" aria-hidden="true" />
                <h2 className="truncate text-[10px] font-semibold uppercase tracking-[0.14em]">
                  Bộ nhớ phiên
                </h2>
              </div>
              {summarizing ? (
                <span className="flex shrink-0 items-center gap-1 text-[9px] text-chat-amber">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-chat-amber motion-reduce:animate-none" />
                  Đang cập nhật
                </span>
              ) : null}
            </div>

            <p
              className={`mt-2 whitespace-pre-wrap break-words text-[11px] leading-5 text-chat-sub ${
                expanded ? "" : "line-clamp-8"
              }`}
            >
              {summary.text}
            </p>

            {canExpand ? (
              <button
                type="button"
                onClick={() => setExpanded((current) => !current)}
                aria-expanded={expanded}
                className="mt-1.5 inline-flex items-center gap-1 rounded-lg text-[10px] font-medium text-chat-accent transition hover:text-chat-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/50"
              >
                {expanded ? (
                  <CaretUpIcon size={11} weight="bold" aria-hidden="true" />
                ) : (
                  <CaretDownIcon size={11} weight="bold" aria-hidden="true" />
                )}
                {expanded ? "Thu gọn" : "Xem thêm"}
              </button>
            ) : null}

            <p className="mt-2 text-[9px] leading-4 text-chat-faint">
              Đã tóm tắt {summary.messageCount} tin cũ · {relativeTime(summary.updatedAt)}
            </p>
          </section>
        ) : null}

        {files.length > 0 ? (
          <section className="rounded-2xl border border-chat-border bg-chat-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5 text-chat-accent">
                <FilesIcon size={13} weight="duotone" aria-hidden="true" />
                <h2 className="truncate text-[10px] font-semibold uppercase tracking-[0.14em]">
                  Tệp trong phiên
                </h2>
              </div>
              <span className="shrink-0 text-[9px] text-chat-faint">{files.length}</span>
            </div>

            <ul className="mt-2 space-y-1.5">
              {files.map((file) => {
                const thumb = file.kind === "image" ? file.thumb : undefined;
                const info = (
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-[11px] font-medium text-chat-ink"
                      title={file.name}
                    >
                      {file.name}
                    </span>
                    <span className="block text-[9px] text-chat-faint">
                      {file.kind === "image" ? "Ảnh" : "Tệp chữ"}
                    </span>
                  </span>
                );
                if (thumb) {
                  return (
                    <li key={file.id} className="rounded-xl border border-chat-border bg-chat-bg/50 p-1.5">
                      <button
                        type="button"
                        onClick={() => setPreview({ src: thumb, name: file.name, id: file.id })}
                        aria-label={`Xem ảnh ${file.name}`}
                        title={`Xem ảnh ${file.name}`}
                        className="flex w-full cursor-zoom-in items-center gap-2 rounded-lg text-left transition hover:bg-chat-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/50"
                      >
                        <span
                          aria-hidden="true"
                          className="h-7 w-7 shrink-0 rounded-lg bg-cover bg-center"
                          style={{ backgroundImage: `url(${thumb})` }}
                        />
                        {info}
                        <MagnifyingGlassPlusIcon
                          size={11}
                          weight="bold"
                          className="shrink-0 text-chat-muted"
                          aria-hidden="true"
                        />
                      </button>
                    </li>
                  );
                }
                if (file.kind === "text" && file.text) {
                  const text = file.text;
                  return (
                    <li key={file.id} className="rounded-xl border border-chat-border bg-chat-bg/50 p-1.5">
                      <button
                        type="button"
                        onClick={() => setFilePreview({ name: file.name, text })}
                        aria-label={`Xem tệp ${file.name}`}
                        title={`Xem tệp ${file.name}`}
                        className="flex w-full items-center gap-2 rounded-lg text-left transition hover:bg-chat-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/50"
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-chat-accent-soft text-chat-accent">
                          <FileTextIcon size={13} weight="duotone" aria-hidden="true" />
                        </span>
                        {info}
                        <MagnifyingGlassPlusIcon
                          size={11}
                          weight="bold"
                          className="shrink-0 text-chat-muted"
                          aria-hidden="true"
                        />
                      </button>
                    </li>
                  );
                }
                return (
                  <li
                    key={file.id}
                    className="flex items-center gap-2 rounded-xl border border-chat-border bg-chat-bg/50 p-1.5"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-chat-accent-soft text-chat-accent">
                      {file.kind === "image" ? (
                        <ImageIcon size={13} weight="duotone" aria-hidden="true" />
                      ) : (
                        <FileTextIcon size={13} weight="duotone" aria-hidden="true" />
                      )}
                    </span>
                    {info}
                  </li>
                );
              })}
            </ul>

            <p className="mt-2 text-[9px] leading-4 text-chat-faint">
              Ảnh gửi đi được lưu trên máy này.
            </p>
          </section>
        ) : null}
      </div>

      <p className="px-4 py-2.5 text-[9px] leading-4 text-chat-faint">
        Chi tiết phiên chỉ lưu trên máy này.
      </p>

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
    </aside>
  );
}
