"use client";

import { Search, Play, Bookmark, LayoutGrid, ListFilter } from "lucide-react";
import { StudyEmbedItem, ViewMode } from "../types";
import { CATEGORY_DEFINITIONS } from "../constants";
import { handleHorizontalWheel } from "@/lib/use-horizontal-scroll";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmbedCardItem } from "./EmbedCardItem";
import { EmbedListItem } from "./EmbedListItem";

interface DiscoveryHubProps {
  searchOrUrl: string;
  onSearchChange: (value: string) => void;
  detectedEmbed: ReturnType<typeof import("@/components/study/study-types").parseEmbedUrl>;
  onPlayFromInput: (save: boolean) => void;
  viewMode: ViewMode;
  onToggleViewMode: (mode: ViewMode) => void;
  activeCategory: string;
  onSelectCategory: (cat: string) => void;
  savedEmbedsCount: number;
  displayedItems: StudyEmbedItem[];
  activeItem: StudyEmbedItem | null;
  savedEmbeds: StudyEmbedItem[];
  failedImages: Record<string, boolean>;
  loadedImages: Record<string, boolean>;
  onImageLoad: (id: string) => void;
  onImageError: (id: string) => void;
  onPlayItem: (item: StudyEmbedItem) => void;
  onDeleteSaved: (id: string, e: React.MouseEvent) => void;
}

export function DiscoveryHub({
  searchOrUrl,
  onSearchChange,
  detectedEmbed,
  onPlayFromInput,
  viewMode,
  onToggleViewMode,
  activeCategory,
  onSelectCategory,
  savedEmbedsCount,
  displayedItems,
  activeItem,
  savedEmbeds,
  failedImages,
  loadedImages,
  onImageLoad,
  onImageError,
  onPlayItem,
  onDeleteSaved,
}: DiscoveryHubProps) {
  const categories = CATEGORY_DEFINITIONS.map((c) => ({
    ...c,
    label:
      c.key === "all"
        ? "Tất cả"
        : c.key === "youtube"
        ? "YouTube"
        : c.key === "spotify"
        ? "Spotify"
        : `Đã lưu (${savedEmbedsCount})`,
  }));

  return (
    <div className="@container flex-1 min-h-0 min-w-0 flex flex-col p-3.5 sm:p-4 md:p-5 bg-black/20 overflow-hidden">
      {/* Search Bar & Quick URL Input */}
      <div className="space-y-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search aria-hidden="true" className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <label htmlFor="embed-search-input" className="sr-only">
              Tìm kiếm hoặc dán liên kết video
            </label>
            <input
              id="embed-search-input"
              type="text"
              value={searchOrUrl}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Tìm kiếm hoặc dán liên kết..."
              aria-label="Tìm kiếm hoặc dán liên kết video"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/15 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-white/30 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]"
            />
          </div>

          {detectedEmbed ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => onPlayFromInput(false)}
                className="px-3.5 py-2.5 rounded-xl bg-accent-music hover:bg-accent-music-glow text-xs font-bold text-panel flex items-center gap-1.5 shadow-md shadow-accent-music/20 transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Phát ngay</span>
              </button>
              <button
                onClick={() => onPlayFromInput(true)}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-all border border-line/15 cursor-pointer"
                title="Lưu vào danh sách & Phát"
              >
                <Bookmark className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* Grid / List Layout Switcher */
            <div className="flex items-center p-1 rounded-xl bg-black/40 border border-white/15 shrink-0">
              <button
                onClick={() => onToggleViewMode("grid")}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Dạng lưới thẻ"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => onToggleViewMode("list")}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === "list"
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Dạng danh sách gọn"
              >
                <ListFilter className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Filter Category Chips */}
        <div
          onWheel={handleHorizontalWheel}
          className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none"
        >
          {categories.map((cat) => {
            const isActive = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => onSelectCategory(cat.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer border ${
                  isActive
                    ? "bg-white/15 text-white border-line/30 shadow-sm"
                    : "bg-black/30 text-slate-400 hover:text-slate-200 border-white/10 hover:bg-white/[0.08]"
                }`}
              >
                <span className={cat.accent}>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Independent Scrollable Discovery Presets Area */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-study-scroll pr-1 mt-3">
        {displayedItems.length === 0 ? (
          <EmptyState
            className="py-14"
            message="Không tìm thấy kênh hoặc đài phát phù hợp."
          />
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3 pb-2">
            {displayedItems.map((item) => {
              const isCurrent =
                activeItem?.id === item.id || activeItem?.embedUrl === item.embedUrl;
              const isSaved = savedEmbeds.some((s) => s.id === item.id);
              const hasImageError = Boolean(failedImages[item.id]);
              const isImageLoaded = Boolean(loadedImages[item.id]);

              return (
                <EmbedCardItem
                  key={item.id}
                  item={item}
                  isCurrent={isCurrent}
                  isSaved={isSaved}
                  hasImageError={hasImageError}
                  isImageLoaded={isImageLoaded}
                  onImageLoad={() => onImageLoad(item.id)}
                  onImageError={() => onImageError(item.id)}
                  onPlay={() => onPlayItem(item)}
                  onDeleteSaved={(e) => onDeleteSaved(item.id, e)}
                />
              );
            })}
          </div>
        ) : (
          <div className="space-y-2 pb-2">
            {displayedItems.map((item) => {
              const isCurrent =
                activeItem?.id === item.id || activeItem?.embedUrl === item.embedUrl;
              const isSaved = savedEmbeds.some((s) => s.id === item.id);
              const hasImageError = Boolean(failedImages[item.id]);
              const isImageLoaded = Boolean(loadedImages[item.id]);

              return (
                <EmbedListItem
                  key={item.id}
                  item={item}
                  isCurrent={isCurrent}
                  isSaved={isSaved}
                  hasImageError={hasImageError}
                  isImageLoaded={isImageLoaded}
                  onImageLoad={() => onImageLoad(item.id)}
                  onImageError={() => onImageError(item.id)}
                  onPlay={() => onPlayItem(item)}
                  onDeleteSaved={(e) => onDeleteSaved(item.id, e)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
