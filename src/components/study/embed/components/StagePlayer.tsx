"use client";

import { useEffect, useState } from "react";
import {
  TelevisionIcon,
  MusicNotesIcon,
  ArrowSquareOutIcon,
  SquareIcon,
  PictureInPictureIcon,
  RadioIcon,
  BookmarkIcon,
  BookmarkSimpleIcon,
  LinkIcon,
  SpeakerHighIcon,
  PlayIcon,
  LightbulbIcon,
  XIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { StudyEmbedItem } from "../types";
import { ensureYouTubeJsApi } from "@/lib/youtube-remote";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { useIsMobile } from "@/components/study/mobile/hooks/useIsMobile";

interface StagePlayerProps {
  activeItem: StudyEmbedItem | null;
  splitRatio: number;
  isIframeLoading: boolean;
  setIsIframeLoading: (loading: boolean) => void;
  onEnterPip: () => void;
  onStopStream: (e?: React.MouseEvent) => void;
  isSaved?: boolean;
  onToggleSave?: () => void;
  /** Báo iframe vừa load xong để khôi phục vị trí phát (Studio↔PiP). */
  onIframeLoad?: (iframe: HTMLIFrameElement) => void;
}

export function StagePlayer({
  activeItem,
  splitRatio,
  isIframeLoading,
  setIsIframeLoading,
  onEnterPip,
  onStopStream,
  isSaved = false,
  onToggleSave,
  onIframeLoad,
}: StagePlayerProps) {
  const isMobile = useIsMobile();
  const handleCopyLink = async () => {
    if (!activeItem) return;
    try {
      await navigator.clipboard.writeText(activeItem.url);
      toast.success("Đã copy link đài này");
    } catch {
      toast.error("Không copy được link", {
        description: "Hãy thử bôi đen link và copy thủ công.",
      });
    }
  };

  const [showTips, setShowTips] = useState(true);

  // Chỉ hiện Lưu/Copy với đài do người dùng tự dán link (id "custom-*",
  // quy ước tạo trong useEmbedManager.handlePlayFromInput). Đài nạp sẵn
  // (preset "preset-*") đã có trong danh sách nên 2 nút này thừa.
  const isCustomItem = activeItem?.id.startsWith("custom-") ?? false;
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEYS.embedStageTipsDismissed) === "1") {
        setShowTips(false);
      }
    } catch {}
  }, []);

  const handleDismissTips = () => {
    setShowTips(false);
    try {
      localStorage.setItem(STORAGE_KEYS.embedStageTipsDismissed, "1");
    } catch {}
  };

  const handleToggleTips = () => {
    setShowTips((prev) => {
      const next = !prev;
      try {
        if (next) {
          localStorage.removeItem(STORAGE_KEYS.embedStageTipsDismissed);
        } else {
          localStorage.setItem(STORAGE_KEYS.embedStageTipsDismissed, "1");
        }
      } catch {}
      return next;
    });
  };
  return (
    <div
      style={isMobile ? undefined : { flexBasis: `${splitRatio}%` }}
      className={`w-full md:w-auto md:shrink-0 flex flex-col border-b border-white/10 md:border-b-0 bg-transparent p-3 sm:p-5 md:overflow-y-auto md:custom-study-scroll ${
        isMobile && !activeItem ? "hidden md:flex" : ""
      }`}
    >
      {activeItem ? (
        <div className="flex flex-col gap-4">
          {/* 16:9 Video Frame */}
          <div
            className={`relative w-full rounded-2xl overflow-hidden bg-black shadow-xl border border-line/15 ${
              activeItem.platform === "spotify" ? "h-[152px]" : "aspect-video"
            }`}
          >
            {/* Loading Skeleton */}
            <div
              className={`absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950 gap-2.5 pointer-events-none transition-opacity duration-300 ${
                isIframeLoading ? "opacity-100" : "opacity-0"
              }`}
            >
              <div className="flex items-end gap-1 h-5">
                <span className="w-1 h-3 bg-slate-400 rounded-full animate-pulse" />
                <span
                  className="w-1 h-5 bg-accent-music-glow rounded-full animate-pulse"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-1 h-4 bg-accent-stream-glow rounded-full animate-pulse"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
              <span className="text-xs font-medium text-slate-300">
                Đang tải luồng phát...
              </span>
            </div>

            {/* Isolated iframe container */}
            <div className="w-full h-full">
              <iframe
                key={activeItem.id}
                src={ensureYouTubeJsApi(activeItem.embedUrl)}
                title={activeItem.title}
                className="w-full h-full border-0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                onLoad={(e) => {
                  setIsIframeLoading(false);
                  onIframeLoad?.(e.currentTarget as HTMLIFrameElement);
                }}
              />
            </div>
          </div>

          {/* Spotify autoplay notice: luôn hiện nổi bật, không nằm trong tips tắt được */}
          {activeItem.platform === "spotify" && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-[#1DB954]/40 bg-[#1DB954]/10 p-3 shadow-[0_0_16px_rgba(29,185,84,0.15)]">
              <span className="w-7 h-7 rounded-lg bg-[#1DB954]/15 border border-[#1DB954]/30 flex items-center justify-center shrink-0">
                <PlayIcon weight="fill" className="w-3.5 h-3.5 text-[#1DB954]" />
              </span>
              <p className="text-xs leading-relaxed text-slate-300">
                <span className="text-white font-semibold">Spotify cần bấm ▶ tay</span>
                {" — "}trình duyệt chặn autoplay trong khung nhúng.
              </p>
            </div>
          )}

          {/* Seamless Single-line Media Bar: giữ nguyên 3 nút thao tác */}
          <div className="flex items-center justify-between gap-3 px-1 py-0.5">
            {/* Left: Badge + Truncated Title */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {activeItem.platform === "spotify" ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-accent-music/15 text-accent-music-bright text-[10px] font-bold shrink-0">
                  <MusicNotesIcon className="w-3 h-3" />
                  <span>SPOTIFY</span>
                </span>
              ) : activeItem.isLive ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-accent-stream/15 text-accent-stream-bright text-[10px] font-bold shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-stream animate-pulse" />
                  <span>LIVE</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/10 text-slate-300 text-[10px] font-bold shrink-0">
                  <TelevisionIcon className="w-3 h-3" />
                  <span>VIDEO</span>
                </span>
              )}

              <span
                className="text-xs sm:text-sm font-semibold text-slate-200 truncate"
                title={activeItem.title}
              >
                {activeItem.title}
              </span>
            </div>

            {/* Right: Icon Buttons Strip (giữ nguyên) + nút bật/tắt tips */}
            <div className="flex items-center gap-1 shrink-0">
              {activeItem.platform === "youtube" && (
                <button
                  onClick={onEnterPip}
                  className="hidden sm:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer active:scale-95 items-center justify-center"
                  title="Tách thành cửa sổ nổi (PiP)"
                >
                  <PictureInPictureIcon className="w-4 h-4 text-accent-music-glow" />
                </button>
              )}

              <a
                href={activeItem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer active:scale-95 flex items-center justify-center"
                title="Mở trên trang web gốc"
              >
                <ArrowSquareOutIcon className="w-4 h-4" />
              </a>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStopStream(e);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer active:scale-95 flex items-center justify-center"
                title="Dừng phát đài này"
              >
                <SquareIcon className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleToggleTips}
                className={`hidden sm:flex p-1.5 rounded-lg transition-colors cursor-pointer active:scale-95 items-center justify-center ${
                  showTips
                    ? "text-amber-300 bg-amber-400/10"
                    : "text-slate-400 hover:text-white hover:bg-white/10"
                }`}
                title={showTips ? "Ẩn mẹo dùng đài" : "Hiện mẹo dùng đài"}
              >
                <LightbulbIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Save + Copy: chỉ với đài người dùng tự nhập, preset nạp sẵn thì ẩn */}
          {isCustomItem && (
            <div className="flex items-center gap-2 px-1">
            <button
              type="button"
              onClick={onToggleSave}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 border ${
                isSaved
                  ? "bg-accent-music/15 text-accent-music-bright border-accent-music/30"
                  : "bg-white/[0.04] text-slate-200 border-line/15 hover:bg-white/[0.08] hover:text-white"
              }`}
              title={isSaved ? "Bỏ lưu đài này" : "Lưu đài này vào danh sách"}
            >
              {isSaved ? (
                <BookmarkSimpleIcon className="w-3.5 h-3.5" />
              ) : (
                <BookmarkIcon className="w-3.5 h-3.5" />
              )}
              <span>{isSaved ? "Đã lưu" : "Lưu đài này"}</span>
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white/[0.04] text-slate-200 border border-line/15 hover:bg-white/[0.08] hover:text-white transition-all cursor-pointer active:scale-95"
              title="Copy link đài này để chia sẻ"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Copy link</span>
            </button>
            </div>
          )}

          {/* Đài tips: chỉ hiện trên desktop, mobile ẩn hẳn cho gọn */}
          {!isMobile && showTips && (
            <div className="rounded-2xl bg-white/[0.03] border border-line/10 p-3.5 space-y-3">
              <div className="flex items-center justify-between pb-0.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-200">
                  <LightbulbIcon className="w-3.5 h-3.5 text-amber-300" />
                  Mẹo dùng đài
                </span>
                <button
                  type="button"
                  onClick={handleDismissTips}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer active:scale-95"
                  title="Ẩn mẹo này, không hiện lại"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1.5">
                {activeItem.platform === "youtube" && (
                  <button
                    type="button"
                    onClick={onEnterPip}
                    title="Bấm để tách video nổi ngay (PiP)"
                    aria-label="Tách video nổi ngay"
                    className="w-full flex items-center gap-3 rounded-xl p-2 text-left hover:bg-white/[0.06] active:scale-[0.99] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    <span className="w-7 h-7 rounded-lg bg-white/5 border border-line/10 flex items-center justify-center shrink-0">
                      <PictureInPictureIcon className="w-3.5 h-3.5 text-accent-music-glow" />
                    </span>
                    <p className="text-xs leading-relaxed text-slate-400 whitespace-nowrap">
                      <span className="text-slate-200 font-semibold">Nút PiP vừa học vừa xem</span>
                      {" — "}tách video nổi để đọc tài liệu mà vẫn thấy hình.
                    </p>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (activeItem) window.open(activeItem.url, "_blank", "noopener,noreferrer");
                  }}
                  title="Bấm để mở trang gốc ngay"
                  aria-label="Mở trang gốc ngay"
                  className="w-full flex items-center gap-3 rounded-xl p-2 text-left hover:bg-white/[0.06] active:scale-[0.99] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <span className="w-7 h-7 rounded-lg bg-white/5 border border-line/10 flex items-center justify-center shrink-0">
                    <ArrowSquareOutIcon className="w-3.5 h-3.5 text-slate-300" />
                  </span>
                  <p className="text-xs leading-relaxed text-slate-400 whitespace-nowrap">
                    <span className="text-slate-200 font-semibold">Nút mở trang gốc</span>
                    {" — "}xem bình luận, mô tả và kênh phát hành.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={(e) => onStopStream(e)}
                  title="Bấm để dừng hẳn đài ngay"
                  aria-label="Dừng hẳn đài ngay"
                  className="w-full flex items-center gap-3 rounded-xl p-2 text-left hover:bg-white/[0.06] active:scale-[0.99] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <span className="w-7 h-7 rounded-lg bg-white/5 border border-line/10 flex items-center justify-center shrink-0">
                    <SquareIcon className="w-3.5 h-3.5 text-slate-400" />
                  </span>
                  <p className="text-xs leading-relaxed text-slate-400 whitespace-nowrap">
                    <span className="text-slate-200 font-semibold">Nút ■ dừng hẳn đài</span>
                    {" — "}tắt modal vẫn phát nền, chỉ nút này mới dừng.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Bấm y như gõ phím M: tắt tiếng chung cả nhạc nền lẫn đài phát
                    window.dispatchEvent(new KeyboardEvent("keydown", { key: "m" }));
                  }}
                  title="Bấm để tắt / bật tiếng ngay (như phím M)"
                  aria-label="Tắt hoặc bật tiếng ngay"
                  className="w-full flex items-center gap-3 rounded-xl p-2 text-left hover:bg-white/[0.06] active:scale-[0.99] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <span className="w-7 h-7 rounded-lg bg-white/5 border border-line/10 flex items-center justify-center shrink-0">
                    <SpeakerHighIcon className="w-3.5 h-3.5 text-accent-music-bright" />
                  </span>
                  <p className="text-xs leading-relaxed text-slate-400 whitespace-nowrap">
                    <span className="text-slate-200 font-semibold">Phím M tắt tiếng cả đài</span>
                    {" — "}áp dụng chung cho nhạc nền và đài phát.
                  </p>
                </button>
              </div>

              <button
                type="button"
                onClick={handleDismissTips}
                className="w-full py-2 rounded-xl text-xs font-bold text-slate-300 bg-white/[0.04] border border-line/10 hover:bg-white/[0.08] hover:text-white transition-all cursor-pointer active:scale-95"
              >
                Đã hiểu, không hiện lại
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Empty Stage State */
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-white/[0.04] border border-line/10 flex items-center justify-center text-slate-500 shadow-inner">
            <RadioIcon className="w-8 h-8 text-slate-400" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-200">Chưa chọn đài phát</h4>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              Hãy chọn một kênh từ danh sách bên phải hoặc dán liên kết YouTube / Spotify để
              bắt đầu nghe nhạc.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
