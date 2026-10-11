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

export const StudyEmbedPlayerWidget = ({
  isOpen,
  onClose,
  onOpen,
  onPipModeChange,
  activeItem = null,
  onStreamActiveChange,
  onActiveItemChange,
}: StudyEmbedPlayerWidgetProps) => {
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
            : isBackdropOpen
            ? "fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 pointer-events-none"
            : "fixed -top-[9999px] -left-[9999px] w-1 h-1 opacity-0 pointer-events-none"
        }
      >
        <motion.div
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
              : "pointer-events-auto relative w-full max-w-5xl h-[88vh] max-h-[820px] flex flex-col rounded-3xl bg-black/40 hover:bg-black/45 backdrop-blur-2xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-slate-100 overflow-hidden transform-gpu will-change-transform"
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
    </>
  );
};
