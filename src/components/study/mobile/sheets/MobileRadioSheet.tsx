"use client";

import React, { useCallback } from "react";
import {
  SquareIcon,
  LinkIcon,
  BookmarkIcon,
  BookmarkSimpleIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { StudyEmbedItem } from "@/components/study/embed/types";
import { useEmbedManager } from "@/components/study/embed/hooks/useEmbedManager";
import { DiscoveryHub } from "@/components/study/embed/components/DiscoveryHub";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { ensureYouTubeJsApi, sendYouTubeCommand } from "@/lib/youtube-remote";
import { MobileSheetShell } from "./core/MobileSheetShell";

export interface MobileRadioSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  backLabel?: string;
  activeItem: StudyEmbedItem | null;
  onStreamActiveChange?: (isActive: boolean) => void;
  onActiveItemChange?: (item: StudyEmbedItem | null) => void;
}

export const MobileRadioSheet = React.memo(function MobileRadioSheet({
  isOpen,
  onClose,
  onBack,
  backLabel,
  activeItem,
  onStreamActiveChange,
  onActiveItemChange,
}: MobileRadioSheetProps) {
  // Logic dữ liệu kênh và luồng phát
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
    isResolvingInput,
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
  } = useEmbedManager({
    onStreamActiveChange,
    onActiveItemChange,
  });

  // Chuyển danh mục khi vuốt ngang
  const EMBED_CATEGORY_KEYS = ["all", "youtube", "spotify", "saved"];
  const handleNextCategory = useCallback(() => {
    const idx = EMBED_CATEGORY_KEYS.indexOf(activeCategory);
    if (idx < EMBED_CATEGORY_KEYS.length - 1) setActiveCategory(EMBED_CATEGORY_KEYS[idx + 1]);
  }, [activeCategory, setActiveCategory]);

  const handlePrevCategory = useCallback(() => {
    const idx = EMBED_CATEGORY_KEYS.indexOf(activeCategory);
    if (idx > 0) setActiveCategory(EMBED_CATEGORY_KEYS[idx - 1]);
  }, [activeCategory, setActiveCategory]);

  const handleCopyLink = async () => {
    if (!activeItem) return;
    try {
      await navigator.clipboard.writeText(activeItem.url);
      toast.success("Đã copy link đài");
    } catch {
      toast.error("Không copy được link");
    }
  };

  const isSaved = Boolean(
    activeItem &&
      savedEmbeds.some((s) => s.id === activeItem.id || s.url === activeItem.url)
  );

  return (
    <>
      <MobileSheetShell
        isOpen={isOpen}
        onClose={onClose}
        onBack={onBack}
        backLabel={backLabel}
        sheetId="radio"
        title="Đài phát thanh"
        allowZenMode={true}
        keepMounted={Boolean(activeItem)}
        hiddenStrategy="offscreen"
        onSwipeLeft={handleNextCategory}
        onSwipeRight={handlePrevCategory}
        contentScroll={true}
      >
        <div className="p-3.5 flex flex-col gap-3.5">
          {/* Khung video/nhạc phát nếu đang có bài */}
          {activeItem && (
            <div className="flex flex-col gap-2.5 rounded-2xl bg-white/[0.04] border border-white/10 p-2.5">
              <div
                className={`relative w-full rounded-xl overflow-hidden bg-black shadow-md border border-white/10 ${
                  activeItem.platform === "spotify" ? "h-[152px]" : "aspect-video"
                }`}
              >
                {isIframeLoading && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950 gap-2 pointer-events-none">
                    <span className="text-xs font-medium text-slate-300">Đang tải luồng phát...</span>
                  </div>
                )}
                <iframe
                  key={activeItem.id}
                  src={ensureYouTubeJsApi(activeItem.embedUrl)}
                  title={activeItem.title}
                  className="w-full h-full border-0"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  onLoad={() => setIsIframeLoading(false)}
                />
              </div>

              {/* Thông tin bài & Các nút thao tác nhanh */}
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-semibold text-white truncate">{activeItem.title}</h4>
                  <p className="text-[11px] text-slate-400 capitalize">{activeItem.platform}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    title="Copy link"
                    className="p-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.18] active:scale-90 border border-white/15 text-white/80 hover:text-white transition-all text-xs flex items-center justify-center cursor-pointer touch-manipulation shadow-sm"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleSaveItem(activeItem)}
                    title={isSaved ? "Bỏ lưu đài này" : "Lưu đài này"}
                    className={`p-1.5 rounded-xl border transition-all text-xs flex items-center justify-center cursor-pointer touch-manipulation active:scale-90 shadow-sm ${
                      isSaved
                        ? "bg-amber-400/20 text-amber-300 border-amber-400/30"
                        : "bg-white/[0.08] hover:bg-white/[0.18] text-white/80 hover:text-white border-white/15"
                    }`}
                  >
                    {isSaved ? (
                      <BookmarkSimpleIcon className="w-3.5 h-3.5" weight="fill" />
                    ) : (
                      <BookmarkIcon className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      sendYouTubeCommand("pauseVideo");
                      handleStopStream(e);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 active:scale-95 border border-rose-400/30 text-rose-300 font-medium text-xs flex items-center gap-1 transition-all cursor-pointer touch-manipulation shadow-sm"
                  >
                    <SquareIcon className="w-3 h-3" weight="fill" />
                    <span>Dừng</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Trung tâm khám phá & Danh sách kênh */}
          <DiscoveryHub
            searchOrUrl={searchOrUrl}
            onSearchChange={setSearchOrUrl}
            detectedEmbed={detectedEmbed}
            onPlayFromInput={handlePlayFromInput}
            isResolvingInput={isResolvingInput}
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
      </MobileSheetShell>

      {/* Hộp thoại xác nhận xóa đài đã lưu */}
      <ConfirmDeleteModal
        isOpen={Boolean(embedToDelete)}
        onClose={() => setEmbedToDelete(null)}
        onConfirm={handleConfirmDeleteSaved}
        title="Xóa đài phát thanh đã lưu?"
        description={
          embedToDelete
            ? `Bạn có chắc chắn muốn xóa "${embedToDelete.title}" khỏi danh sách đài phát đã lưu không?`
            : "Bạn có chắc chắn muốn xóa đài này?"
        }
        confirmText="Xóa đài"
      />
    </>
  );
});

MobileRadioSheet.displayName = "MobileRadioSheet";
