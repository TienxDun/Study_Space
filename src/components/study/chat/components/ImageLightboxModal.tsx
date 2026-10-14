"use client";

import { useEffect, useCallback } from "react";
import { XIcon, DownloadSimpleIcon } from "@phosphor-icons/react";

interface ImageLightboxModalProps {
  src: string | null;
  alt?: string;
  onClose: () => void;
}

export function ImageLightboxModal({ src, alt, onClose }: ImageLightboxModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!src) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [src, handleKeyDown]);

  if (!src) return null;

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const a = document.createElement("a");
      a.href = src;
      a.download = alt || `study-image-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      window.open(src, "_blank");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Xem ảnh phóng to"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200 select-none"
    >
      {/* Top Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl mx-auto flex items-center justify-between pb-3 text-zinc-300"
      >
        <span className="text-xs sm:text-sm font-medium text-zinc-300 truncate max-w-[200px] sm:max-w-md">
          {alt || "Xem ảnh phóng to"}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            title="Tải ảnh về máy"
            aria-label="Tải ảnh về máy"
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-white/10 hover:bg-white/20 hover:text-white transition-colors cursor-pointer border border-white/10"
          >
            <DownloadSimpleIcon size={14} weight="bold" aria-hidden="true" />
            <span className="hidden sm:inline">Tải về</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            title="Đóng (Esc)"
            aria-label="Đóng"
            className="h-8 w-8 grid place-items-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/15 transition-colors cursor-pointer border border-white/10"
          >
            <XIcon size={16} weight="bold" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden">
        <img
          src={src}
          alt={alt || "Ảnh phóng to"}
          onClick={(e) => e.stopPropagation()}
          className="max-h-[82vh] max-w-[94vw] sm:max-w-[85vw] object-contain rounded-xl shadow-2xl border border-white/15 cursor-default transition-all"
        />
      </div>
    </div>
  );
}
