"use client";

import React, { useState, useEffect, useCallback, startTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  XIcon,
  ArrowsInSimpleIcon,
  ArrowsOutSimpleIcon,
  CaretLeftIcon,
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
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { saveStorage } from "@/lib/safe-storage";
import { cn } from "@/lib/utils";

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
  // 1. Quản lý chế độ Zen toàn màn hình
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

  const handleToggleZenMode = useCallback(() => {
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
  }, []);

  useEffect(() => {
    if (isOpen) {
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
  }, [isOpen]);

  // 2. Logic dữ liệu kênh và luồng phát
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

  // Không hiển thị nếu đã đóng hoàn toàn và không có bài nào đang phát
  if (!isOpen && !activeItem) return null;

  return (
    <>
      {/* Lớp nền mờ khi mở */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs cursor-default sm:hidden"
          />
        )}
      </AnimatePresence>

      {/* Khung Sheet chuẩn Liquid Glass cho Mobile */}
      <motion.div
        initial={{ opacity: 0, y: 80 }}
        animate={
          isOpen
            ? { opacity: 1, y: 0 }
            : { opacity: 0, y: "100%", transition: { duration: 0.22, ease: [0.32, 0, 0.67, 0] } }
        }
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        style={!isOpen ? { pointerEvents: "none" } : undefined}
        className={cn(
          "fixed z-50 flex flex-col text-white overflow-hidden sm:hidden transform-gpu will-change-transform",
          isZenMode
            ? "inset-x-2 bottom-[calc(var(--mobile-nav-height)+var(--app-safe-bottom)+var(--mobile-nav-safe-gap)+0.75rem)] h-[calc(100dvh-var(--mobile-nav-height)-var(--app-safe-bottom)-var(--mobile-nav-safe-gap)-1.25rem)] max-h-[calc(100dvh-var(--mobile-nav-height)-var(--app-safe-bottom)-var(--mobile-nav-safe-gap)-1.25rem)] rounded-[32px] bg-neutral-950/94 backdrop-blur-xl border border-white/[0.18] shadow-[0_24px_60px_rgba(0,0,0,0.85),inset_0_1px_2px_rgba(255,255,255,0.25)]"
            : "inset-x-3 bottom-[calc(var(--mobile-nav-height)+var(--app-safe-bottom)+var(--mobile-nav-safe-gap)+0.75rem)] h-[72dvh] max-h-[72dvh] rounded-[28px] bg-neutral-950/90 backdrop-blur-lg border border-white/[0.16] shadow-[0_20px_50px_rgba(0,0,0,0.75),inset_0_1px_1.5px_rgba(255,255,255,0.2)]"
        )}
      >
        {/* Mép kính bắt sáng trên đỉnh tấm kính mẹ */}
        <div
          aria-hidden="true"
          className="absolute inset-x-12 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none"
        />

        {/* Tiêu đề & Nút thao tác dạng kính chuẩn Mobile */}
        <div className="shrink-0 select-none">
          <div className="flex items-center px-3.5 py-2.5 border-b border-white/[0.12] gap-2">
            {/* Bên trái: Nút Quay lại + Tiêu đề */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-start">
              {onBack && (
                <button
                  type="button"
                  onClick={() => startTransition(() => onBack())}
                  title={backLabel ? `Quay lại ${backLabel}` : "Quay lại"}
                  aria-label={backLabel ? `Quay lại ${backLabel}` : "Quay lại"}
                  className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.18] active:scale-90 border border-white/15 flex items-center justify-center text-white/90 hover:text-white transition-[background-color,border-color,transform] duration-75 shrink-0 select-none shadow-sm cursor-pointer touch-manipulation"
                >
                  <CaretLeftIcon className="w-4 h-4" weight="bold" />
                </button>
              )}
              <h3 className="min-w-0 flex-1 text-sm font-semibold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] truncate text-left">
                Đài phát thanh
              </h3>
            </div>

            {/* Bên phải: Nút Zen Mode + Đóng */}
            <div className="flex items-center justify-end gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleToggleZenMode}
                title={isZenMode ? "Thu gọn về dạng khay đáy" : "Mở rộng không gian Zen (Toàn màn hình)"}
                aria-label="Chuyển chế độ xem"
                className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.18] active:scale-90 border border-white/15 flex items-center justify-center text-white/80 hover:text-white transition-[background-color,border-color,transform] duration-75 shrink-0 select-none shadow-sm cursor-pointer touch-manipulation"
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
                className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.18] active:scale-90 border border-white/15 flex items-center justify-center text-white/80 hover:text-white transition-[background-color,border-color,transform] duration-75 shrink-0 select-none shadow-sm cursor-pointer touch-manipulation"
                title="Đóng Đài phát thanh"
                aria-label="Đóng Đài phát thanh"
              >
                <XIcon className="w-4 h-4" weight="bold" />
              </button>
            </div>
          </div>
        </div>

        {/* Nội dung chính cuộn dọc */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-study-scroll p-3.5 flex flex-col gap-3.5">
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
      </motion.div>

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
