"use client";

import { useEffect } from "react";
import { ChatV2 } from "./ChatV2";

interface ChatV2OverlayProps {
  onClose: () => void;
}

/** Bản toàn màn hình: phủ lên không gian học, Esc đóng và khoá cuộn nền. */
export function ChatV2Overlay({ onClose }: ChatV2OverlayProps) {
  useEffect(() => {
    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Lớp con (xem ảnh/tệp, danh sách phiên) tự đóng trước.
      if (document.querySelector("[data-escape-guard]")) return;
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Trợ lý học tập"
      className="chat-v2-anim-fade fixed inset-0 z-[90] overflow-hidden"
    >
      <ChatV2 onClose={onClose} />
    </div>
  );
}
