"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { StudyEmbedPlayerWidgetProps } from "./types";
import { usePipMode } from "./hooks/usePipMode";
import { useEmbedSplitPane } from "./hooks/useEmbedSplitPane";
import { useEmbedManager } from "./hooks/useEmbedManager";
import { useYouTubeRemote, ensureYouTubeJsApi } from "@/lib/youtube-remote";
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
    enterPip,
    exitPip,
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
    isYouTubeActive
  );

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
          style={{ x: pipX, y: pipY }}
          drag={isPipMode}
          dragConstraints={isPipMode ? dragBounds : undefined}
          dragControls={pipDragControls}
          dragListener={false}
          dragMomentum={false}
          dragElastic={0.08}
          animate={isPipMode ? undefined : { x: 0, y: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className={
            isPipMode
              ? "pointer-events-auto fixed bottom-24 right-6 w-[340px] sm:w-[420px] rounded-2xl bg-black/60 backdrop-blur-xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden group/pip touch-none select-none"
              : "pointer-events-auto relative w-full max-w-5xl h-[88vh] max-h-[820px] flex flex-col rounded-3xl bg-black/40 hover:bg-black/45 backdrop-blur-xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-slate-100 overflow-hidden transform-gpu will-change-transform"
          }
        >
          {/* Top Edge Brushed Metallic Reflection */}
          {!isPipMode && (
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none z-10" />
          )}

          {/* 1. Header Logic */}
          {isPipMode ? (
            <PipHeader
              activeItem={activeItem}
              pipDragControls={pipDragControls}
              isExternalPaused={isExternalPaused}
              toggleExternalPlay={toggleExternalPlay}
              onMaximize={() => exitPip(true)}
              onClose={() => exitPip(false)}
            />
          ) : (
            <StudioHeader onClose={onClose} />
          )}

          {/* 2. Body Area */}
          {isPipMode ? (
            /* Dedicated PiP Player Frame */
            <div className="relative w-full h-[190px] sm:h-[236px] bg-black">
              {activeItem && (
                <iframe
                  key={activeItem.id}
                  src={ensureYouTubeJsApi(activeItem.embedUrl)}
                  title={activeItem.title}
                  className="w-full h-full border-0"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                />
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
                onEnterPip={enterPip}
                onStopStream={(e) => {
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
        </motion.div>
      </div>
    </>
  );
};
