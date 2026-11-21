"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "@phosphor-icons/react";
import { loadChatImage } from "../lib/image-store";

interface ImagePreviewProps {
  src: string;
  name: string;
  imageId?: string;
  onClose: () => void;
}

export function ImagePreview({ src, name, imageId, onClose }: ImagePreviewProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [source, setSource] = useState(src);
  const [fullSize, setFullSize] = useState(false);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    setSource(src);
    setFullSize(false);
    setNarrow(false);
    if (!imageId) return;
    let alive = true;
    loadChatImage(imageId).then((full) => {
      if (!alive || !full) return;
      setFullSize(true);
      setSource(full);
    });
    return () => {
      alive = false;
    };
  }, [imageId, src]);

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

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Xem ảnh ${name}`}
      data-escape-guard=""
      onClick={onClose}
      className="chat-v2-anim-fade fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-full w-[min(92vw,1100px)] flex-col gap-2"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] text-white/80" title={name}>
              {name}
            </p>
            {narrow && !fullSize ? (
              <p className="text-[10px] text-white/50">Ảnh cũ chỉ còn bản xem trước nhỏ.</p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Đóng xem ảnh"
            title="Đóng"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <XIcon size={14} weight="bold" aria-hidden="true" />
          </button>
        </div>
        <img
          src={source}
          alt={name}
          onLoad={(event) => setNarrow(event.currentTarget.naturalWidth < 600)}
          className="max-h-[78vh] w-full rounded-2xl object-contain shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
        />
      </div>
    </div>,
    document.body
  );
}
