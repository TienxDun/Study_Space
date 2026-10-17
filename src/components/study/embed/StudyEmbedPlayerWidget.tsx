"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { StudyEmbedPlayerWidgetProps } from "./types";
import { usePipMode } from "./hooks/usePipMode";
import { useEmbedSplitPane } from "./hooks/useEmbedSplitPane";
import { useEmbedManager } from "./hooks/useEmbedManager";
import { useYouTubeRemote, ensureYouTubeJsApi, sendYouTubeCommand } from "@/lib/youtube-remote";
import {
  ensureYouTubeIframeApi,
  getYouTubeTime,
  seekYouTubeTime,
  seekMemory,
  withTimeout,
} from "@/lib/youtube-player-api";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { PipHeader } from "./components/PipHeader";
import { StudioHeader } from "./components/StudioHeader";
import { StagePlayer } from "./components/StagePlayer";
import { ResizableDivider } from "./components/ResizableDivider";
import { DiscoveryHub } from "./components/DiscoveryHub";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { useIsMobile } from "@/components/study/mobile/hooks/useIsMobile";
import { RadioIcon, XIcon, ArrowsInSimpleIcon, ArrowsOutSimpleIcon, CaretLeftIcon } from "@phosphor-icons/react";
import { saveStorage } from "@/lib/safe-storage";

export const StudyEmbedPlayerWidget = ({
  isOpen,
  onClose,
  onOpen,
  onPipModeChange,
  activeItem = null,
  onStreamActiveChange,
  onActiveItemChange,
  onBack,
  backLabel,
}: StudyEmbedPlayerWidgetProps) => {
  const isMobile = useIsMobile();
  const {
    isPipMode,
    pipDragControls,
    pipX,
    pipY,
    dragBounds,
    pipSize,
    enterPip,
    exitPip,
    handlePipResizePointerDown,
    handlePipResizeKeyDown,
  } = usePipMode({
    isOpen,
    onPipModeChange,
    onOpen,
  });

  const {
    splitRatio,
    isResizing,
    splitContainerRef,
    handleMouseDownDivider,
    handleDoubleClickDivider,
  } = useEmbedSplitPane();

  // Trạng thái kéo thả PiP (đồng bộ hiệu ứng với Notes/Rooms khi dragging).
  const [isPipDragging, setIsPipDragging] = useState(false);

  // Iframe YouTube đang gắn (Studio XOR PiP — chỉ 1 tồn tại cùng lúc).
  const ytIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Warm YouTube IFrame API từ sớm để lần chuyển mode đầu tiên cũng nhanh.
  useEffect(() => {
    void ensureYouTubeIframeApi().catch(() => {});
  }, []);

  // Chế độ mở rộng toàn màn hình Zen vs Thu nhỏ khay đáy trên Mobile
  const [isZenMode, setIsZenMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.mobileSheetZenMap);
      if (raw) {
        const map = JSON.parse(raw);
        if (typeof map["embed"] === "boolean") return map["embed"];
      }
    } catch {}
    return false;
  });

  const handleToggleZenMode = () => {
    setIsZenMode((prev) => {
      const next = !prev;
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.mobileSheetZenMap);
        const map = raw ? JSON.parse(raw) : {};
        map["embed"] = next;
        saveStorage(STORAGE_KEYS.mobileSheetZenMap, JSON.stringify(map));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (isOpen && isMobile) {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.mobileSheetZenMap);
        if (raw) {
          const map = JSON.parse(raw);
          if (typeof map["embed"] === "boolean") {
            setIsZenMode(map["embed"]);
          }
        }
      } catch {}
    }
  }, [isOpen, isMobile]);

  const {
    activeCategory,
    setActiveCategory,
    viewMode,
    toggleViewMode,
    savedEmbeds,
    searchOrUrl,
    setSearchOrUrl,
    detectedEmbed,
    isIframeLoading,
    setIsIframeLoading,
    failedImages,
    setFailedImages,
    loadedImages,
    setLoadedImages,
    displayedItems,
    handlePlayItem,
    handleStopStream,
    handlePlayFromInput,
    handleDeleteSaved,
    embedToDelete,
    setEmbedToDelete,
    handleConfirmDeleteSaved,
    handleToggleSaveItem,
    resolveActiveItemMetadata,
  } = useEmbedManager({
    onStreamActiveChange,
    onActiveItemChange,
    onPlaySuccess: () => {
      exitPip(false);
      if (onOpen) onOpen();
    },
  });

  // Chuyển tab danh mục khi vuốt ngang (đồng bộ với Bảng Cảnh & Bảng Nhạc)
  const EMBED_CATEGORY_KEYS = ["all", "youtube", "spotify", "saved"];
  const handleNextCategory = () => {
    const idx = EMBED_CATEGORY_KEYS.indexOf(activeCategory);
    if (idx < EMBED_CATEGORY_KEYS.length - 1) setActiveCategory(EMBED_CATEGORY_KEYS[idx + 1]);
  };
  const handlePrevCategory = () => {
    const idx = EMBED_CATEGORY_KEYS.indexOf(activeCategory);
    if (idx > 0) setActiveCategory(EMBED_CATEGORY_KEYS[idx - 1]);
  };

  // Kéo vuốt xuống đóng bảng trên Mobile bám sát 1:1 theo thời gian thực (chuẩn MobileSheetShell)
  const sheetPanelRef = useRef<HTMLDivElement | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isDraggingDown = useRef(false);

  useEffect(() => {
    if (isOpen && isMobile && sheetPanelRef.current) {
      sheetPanelRef.current.style.transform = "";
      sheetPanelRef.current.style.opacity = "";
      sheetPanelRef.current.style.transition = "";
    }
  }, [isOpen, isMobile]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("input")) return;
    touchStartY.current = e.touches[0].clientY;
    isDraggingDown.current = true;
    if (sheetPanelRef.current) {
      sheetPanelRef.current.style.transition = "none";
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingDown.current || touchStartY.current === null) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0) {
      if (sheetPanelRef.current) {
        sheetPanelRef.current.style.transform = `translateY(${diff}px)`;
        sheetPanelRef.current.style.opacity = `${Math.max(0.3, 1 - diff / (window.innerHeight || 800))}`;
      }
    } else {
      if (sheetPanelRef.current) {
        const resistance = !isZenMode ? diff * 0.35 : 0;
        sheetPanelRef.current.style.transform = `translateY(${resistance}px)`;
        sheetPanelRef.current.style.opacity = "1";
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDraggingDown.current || touchStartY.current === null) return;
    const diff = e.changedTouches[0].clientY - touchStartY.current;
    isDraggingDown.current = false;
    touchStartY.current = null;

    // 1. Vuốt lên trên (diff < -35px): Phóng to bảng thành Zen Mode
    if (diff < -35) {
      if (!isZenMode) {
        if (sheetPanelRef.current) {
          sheetPanelRef.current.style.transition =
            "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)";
          sheetPanelRef.current.style.transform = "translateY(0px)";
        }
        handleToggleZenMode();
        return;
      } else {
        if (sheetPanelRef.current) {
          sheetPanelRef.current.style.transition =
            "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)";
          sheetPanelRef.current.style.transform = "translateY(0px)";
        }
        return;
      }
    }

    // 2. Vuốt xuống dưới (diff > 0):
    // Người dùng vuốt xuống: bảng trượt thẳng xuống dưới để tắt dứt khoát, không nảy ngược lên!
    if (diff >= 60) {
      if (sheetPanelRef.current) {
        sheetPanelRef.current.style.transition =
          "transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.18s ease-out";
        sheetPanelRef.current.style.transform = "translateY(calc(100% + 120px))";
        sheetPanelRef.current.style.opacity = "0";
      }
      setTimeout(() => {
        if (sheetPanelRef.current) {
          sheetPanelRef.current.style.transform = "";
          sheetPanelRef.current.style.opacity = "";
          sheetPanelRef.current.style.transition = "";
        }
        onClose();
      }, 200);
      return;
    }

    // Chưa đủ ngưỡng vuốt xuống (< 60px) -> Đàn hồi bật nảy nhẹ về vị trí ban đầu
    if (sheetPanelRef.current) {
      sheetPanelRef.current.style.transition =
        "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease-out";
      sheetPanelRef.current.style.transform = "translateY(0px)";
      sheetPanelRef.current.style.opacity = "1";
    }
  };

  const handleTouchCancel = () => {
    isDraggingDown.current = false;
    touchStartY.current = null;
    if (sheetPanelRef.current) {
      sheetPanelRef.current.style.transition =
        "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease-out";
      sheetPanelRef.current.style.transform = "translateY(0px)";
      sheetPanelRef.current.style.opacity = "1";
    }
  };

  // Background resolver for activeItem
  useEffect(() => {
    if (activeItem) {
      resolveActiveItemMetadata(activeItem);
    }
  }, [activeItem, resolveActiveItemMetadata]);

  const isYouTubeActive = Boolean(activeItem && activeItem.platform === "youtube");
  const { isPaused: isExternalPaused, toggleExternalPlay } = useYouTubeRemote(
    Boolean(activeItem),
    isYouTubeActive,
    // Tín hiệu đáng tin nhất để tắt màn che loading: player báo đang phát thật
    () => setIsIframeLoading(false)
  );

  // Đài đổi id (kể cả khôi phục từ lần trước) thì bật loading lại từ đầu
  const lastLoadingIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeItem && lastLoadingIdRef.current !== activeItem.id) {
      lastLoadingIdRef.current = activeItem.id;
      setIsIframeLoading(true);
    }
    if (!activeItem) {
      lastLoadingIdRef.current = null;
    }
  }, [activeItem, setIsIframeLoading]);

  // Chụp vị trí phát hiện tại trước khi unmount iframe (chuyển mode).
  // Chỉ YouTube VOD: live không tua được, Spotify không có API.
  const snapshotYouTubeTime = async (): Promise<void> => {
    const item = activeItem;
    const iframe = ytIframeRef.current;
    if (!item || item.platform !== "youtube" || item.isLive) return;
    if (!iframe || !iframe.isConnected) return;
    try {
      const t = await withTimeout(getYouTubeTime(iframe), 800, "remember-time");
      if (t != null) seekMemory.remember(item.embedUrl, t);
    } catch {}
  };

  // Khôi phục vị trí đã nhớ khi iframe mới load xong.
  const flushPendingSeek = (iframe: HTMLIFrameElement | null) => {
    const item = activeItem;
    if (!iframe || !item || item.platform !== "youtube" || item.isLive) return;
    ytIframeRef.current = iframe;
    const t = seekMemory.consume(item.embedUrl);
    if (t == null) return;
    void seekYouTubeTime(iframe, t);
  };

  // Vào PiP / về Studio: nhớ giờ trước, chuyển mode sau.
  const handleEnterPipKeepTime = () => {
    void snapshotYouTubeTime().finally(() => enterPip());
  };
  const handleMaximizeKeepTime = () => {
    void snapshotYouTubeTime().finally(() => exitPip(true));
  };

  const isBackdropOpen = isOpen && !isPipMode;

  // Don't render anything if completely closed and no active stream
  if (!isOpen && !activeItem && !isPipMode) return null;

  return (
    <>
      {/* Dimmed Modal Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity duration-300 ${
          isBackdropOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Persistent Morphing Player & Modal Shell */}
      <div
        className={
          isPipMode
            ? "fixed inset-0 z-50 pointer-events-none"
            : isMobile
            ? `fixed ${isZenMode ? "inset-x-2 top-2.5" : "inset-x-3"} bottom-[calc(var(--mobile-nav-height)+var(--app-safe-bottom)+var(--mobile-nav-safe-gap)+0.75rem)] z-50 pointer-events-none transition-[inset] duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isBackdropOpen ? "" : "translate-y-[200%] opacity-0"
              }`
            : `fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 pointer-events-none ${
                isBackdropOpen ? "" : "translate-y-[200%] opacity-0"
              }`
        }
      >
        <motion.div
          ref={sheetPanelRef}
          style={
            isPipMode
              ? { x: pipX, y: pipY, width: pipSize.width, height: pipSize.height }
              : { x: pipX, y: pipY }
          }
          drag={isPipMode}
          dragConstraints={isPipMode ? dragBounds : undefined}
          dragControls={pipDragControls}
          dragListener={false}
          dragMomentum={false}
          dragElastic={0.08}
          onDragStart={() => {
            if (isPipMode) setIsPipDragging(true);
          }}
          onDragEnd={() => {
            setIsPipDragging(false);
            try {
              localStorage.setItem(
                STORAGE_KEYS.embedPipPos,
                JSON.stringify({ x: pipX.get(), y: pipY.get() })
              );
            } catch {}
          }}
          animate={isPipMode ? undefined : { x: 0, y: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className={
            isPipMode
              ? `pointer-events-auto fixed bottom-24 right-6 min-w-[260px] min-h-[200px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-120px)] flex flex-col rounded-3xl bg-black/60 hover:bg-black/65 backdrop-blur-2xl border border-white/15 overflow-hidden group/pip touch-none select-none transition-colors ${
                  isPipDragging
                    ? "shadow-[0_30px_80px_rgba(0,0,0,0.65)] ring-2 ring-emerald-500/40 cursor-grabbing"
                    : "shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
                }`
              : isMobile
              ? `pointer-events-auto relative w-full flex flex-col text-white overflow-hidden transform-gpu will-change-[height,transform] transition-[height,max-height,border-radius,box-shadow,background-color] duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isZenMode
                    ? "h-full rounded-[32px] bg-neutral-950/94 backdrop-blur-xl border border-white/[0.18] shadow-[0_24px_60px_rgba(0,0,0,0.85),inset_0_1px_2px_rgba(255,255,255,0.25)]"
                    : "h-[72dvh] max-h-[72dvh] rounded-[28px] bg-neutral-950/90 backdrop-blur-lg border border-white/[0.16] shadow-[0_20px_50px_rgba(0,0,0,0.75),inset_0_1px_1.5px_rgba(255,255,255,0.2)]"
                }`
              : "pointer-events-auto relative w-full max-w-5xl h-[88vh] max-h-[820px] flex flex-col glass-panel hover:bg-black/45 text-slate-100 overflow-hidden transform-gpu will-change-transform"
          }
        >
          {/* Top Edge Brushed Metallic Reflection */}
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none z-10" />

          {/* 1. Header Logic */}
          {isPipMode ? (
            <PipHeader
              activeItem={activeItem}
              pipDragControls={pipDragControls}
              onMaximize={handleMaximizeKeepTime}
              onClose={() => {
                // Thu về thanh đáy: tắt PiP + đóng Studio (giữ luồng phát nền)
                exitPip(false);
                onClose();
              }}
              isDragging={isPipDragging}
            />
          ) : isMobile ? (
            <div
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchCancel}
              className="shrink-0 select-none cursor-grab active:cursor-grabbing border-b border-white/[0.12] bg-white/[0.02] touch-none"
            >
              {/* Thanh nắm tay kéo (Pill Handle) chuẩn Mobile Sheet */}
              <div className="pt-2.5 pb-1 flex items-center justify-center">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-12 rounded-full bg-white/30 hover:bg-white/50 active:bg-white/60 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
                />
              </div>
              {/* Tiêu đề & Nút thao tác */}
              <div className="flex items-center justify-between px-3.5 pb-2.5 pt-0.5 gap-2">
                {onBack && (
                  <button
                    type="button"
                    onClick={onBack}
                    aria-label={backLabel ? `Quay lại ${backLabel}` : "Quay lại"}
                    className="flex items-center gap-0.5 px-2 py-1 -ml-1 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 text-white/90 hover:text-white transition-all text-xs font-semibold shrink-0 select-none shadow-sm"
                  >
                    <CaretLeftIcon className="w-4 h-4" weight="bold" />
                    {backLabel && (
                      <span className="max-w-[80px] truncate tracking-tight">{backLabel}</span>
                    )}
                  </button>
                )}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-300 shrink-0">
                    <RadioIcon className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] truncate">
                    Đài phát thanh
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Nút chuyển chế độ Full-Screen Zen Overlay / Khay đáy */}
                  <button
                    type="button"
                    onClick={handleToggleZenMode}
                    title={isZenMode ? "Thu gọn về dạng khay đáy" : "Mở rộng không gian Zen (Toàn màn hình)"}
                    aria-label="Chuyển chế độ xem"
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 border border-white/15 flex items-center justify-center text-white/80 hover:text-white transition-all shadow-sm cursor-pointer"
                  >
                    {isZenMode ? (
                      <ArrowsInSimpleIcon className="w-3.5 h-3.5" weight="bold" />
                    ) : (
                      <ArrowsOutSimpleIcon className="w-3.5 h-3.5" weight="bold" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 border border-white/15 flex items-center justify-center text-white/80 hover:text-white transition-all shadow-sm cursor-pointer"
                    title="Đóng Đài phát thanh"
                    aria-label="Đóng Đài phát thanh"
                  >
                    <XIcon className="w-4 h-4" weight="bold" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <StudioHeader onClose={onClose} />
          )}

          {/* 2. Body Area */}
          {isPipMode ? (
            /* Dedicated PiP Player Frame */
            <div className="relative w-full flex-1 min-h-0 bg-black">
              {activeItem && (
                <div className="w-full h-full">
                  <iframe
                    key={activeItem.id}
                    ref={ytIframeRef}
                    src={ensureYouTubeJsApi(activeItem.embedUrl)}
                    title={activeItem.title}
                    className="w-full h-full border-0"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    onLoad={(e) => flushPendingSeek(e.currentTarget)}
                  />
                </div>
              )}
            </div>
          ) : (
            /* Split-Pane 2 Columns Studio Layout with Resizable Divider */
            <div
              ref={splitContainerRef}
              className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden relative"
            >
              {/* LEFT COLUMN: Stage & Media Controls */}
              <StagePlayer
                activeItem={activeItem}
                splitRatio={splitRatio}
                isIframeLoading={isIframeLoading}
                setIsIframeLoading={setIsIframeLoading}
                onEnterPip={handleEnterPipKeepTime}
                onIframeLoad={flushPendingSeek}
                isSaved={Boolean(
                  activeItem &&
                    savedEmbeds.some(
                      (s) => s.id === activeItem.id || s.url === activeItem.url
                    )
                )}
                onToggleSave={() => {
                  if (activeItem) handleToggleSaveItem(activeItem);
                }}
                onStopStream={(e) => {
                  sendYouTubeCommand("pauseVideo");
                  handleStopStream(e);
                  exitPip(false);
                }}
              />

              {/* CENTER: Resizable Divider */}
              <ResizableDivider
                isResizing={isResizing}
                onMouseDown={handleMouseDownDivider}
                onDoubleClick={handleDoubleClickDivider}
              />

              {/* RIGHT COLUMN: Discovery Hub & Playlist */}
              <DiscoveryHub
                searchOrUrl={searchOrUrl}
                onSearchChange={setSearchOrUrl}
                detectedEmbed={detectedEmbed}
                onPlayFromInput={handlePlayFromInput}
                viewMode={viewMode}
                onToggleViewMode={toggleViewMode}
                activeCategory={activeCategory}
                onSelectCategory={setActiveCategory}
                savedEmbedsCount={savedEmbeds.length}
                displayedItems={displayedItems}
                activeItem={activeItem}
                savedEmbeds={savedEmbeds}
                failedImages={failedImages}
                loadedImages={loadedImages}
                onImageLoad={(id) => setLoadedImages((prev) => ({ ...prev, [id]: true }))}
                onImageError={(id) => setFailedImages((prev) => ({ ...prev, [id]: true }))}
                onPlayItem={handlePlayItem}
                onDeleteSaved={handleDeleteSaved}
                onSwipeLeft={handleNextCategory}
                onSwipeRight={handlePrevCategory}
              />
            </div>
          )}

          {/* Tay kéo to/nhỏ góc dưới phải, y như thẻ Notes / Rooms */}
          {isPipMode && (
            <div
              onPointerDown={handlePipResizePointerDown}
              onKeyDown={handlePipResizeKeyDown}
              role="separator"
              aria-orientation="horizontal"
              aria-label="Kéo để đổi cỡ cửa sổ nổi. Bấm phím mũi tên để chỉnh, Enter để về cỡ mặc định."
              title="Kéo để đổi cỡ (mũi tên + Enter = về mặc định)"
              tabIndex={0}
              className="absolute bottom-1 right-1 w-6 h-6 cursor-nwse-resize touch-none z-20 flex items-end justify-end rounded-md opacity-60 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 transition-opacity before:content-[''] before:absolute before:-inset-2"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="text-slate-300">
                <path d="M11 1 L1 11 M11 5 L5 11 M11 9 L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          )}
        </motion.div>
      </div>

      {/* Hộp thoại xác nhận xóa đài phát đã lưu dạng alertdialog */}
      <ConfirmDeleteModal
        isOpen={Boolean(embedToDelete)}
        onClose={() => setEmbedToDelete(null)}
        onConfirm={handleConfirmDeleteSaved}
        title="Xác nhận xóa đài phát"
        description="Bạn có chắc chắn muốn xóa đài này khỏi danh sách đã lưu không?"
        itemName={embedToDelete?.title}
        confirmText="Xóa đài"
        cancelText="Hủy bỏ"
      />
    </>
  );
};
