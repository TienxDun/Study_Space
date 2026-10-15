"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  SparkleIcon,
  VideoCameraIcon,
  MagnifyingGlassIcon,
  CoffeeIcon,
  TreeEvergreenIcon,
  BuildingsIcon,
  HeartIcon,
  TelevisionIcon,
  ShuffleIcon,
  SmileyIcon,
  TimerIcon,
  XIcon,
} from "@phosphor-icons/react";
import { Scene, STUDY_SCENES } from "../../study-types";
import { useFavoriteScenes } from "@/lib/use-favorites";
import { MobileSheetShell } from "./MobileSheetShell";

interface MobileSceneSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentScene: Scene;
  pendingScene?: Scene | null;
  isPreloading?: boolean;
  onSelectScene: (scene: Scene) => void;
  slideshowEnabled?: boolean;
  slideshowIntervalMin?: number;
  slideshowPoolLabel?: string;
  onToggleSlideshow?: () => void;
  onCycleSlideshowInterval?: () => void;
}

const MobileSceneCard = React.memo<{
  scene: Scene;
  isSelected: boolean;
  isPending?: boolean;
  isFav: boolean;
  onSelect: (scene: Scene) => void;
  onToggleFavorite: (id: string) => void;
}>(({ scene, isSelected, isPending, isFav, onSelect, onToggleFavorite }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const isVideo = scene.type === "VIDEO";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(scene)}
      className={`group relative aspect-[16/10] w-full rounded-2xl overflow-hidden border transition-all text-left cursor-pointer shrink-0 select-none active:scale-[0.98] ${
        isPending
          ? "border-amber-400 ring-2 ring-amber-400/50 shadow-[0_0_15px_rgba(251,191,36,0.35)] animate-pulse"
          : isSelected
          ? "border-emerald-400 ring-2 ring-emerald-400/40 shadow-[0_0_15px_rgba(52,211,153,0.3)]"
          : "border-white/[0.08] hover:border-white/[0.18] bg-white/[0.04]"
      }`}
    >
      {/* Ảnh thumbnail */}
      {!isLoaded && <div className="absolute inset-0 bg-white/5 animate-pulse" />}
      <img
        src={scene.thumbnailUrl}
        alt={scene.name}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
        loading="lazy"
        decoding="async"
        onLoad={() => setIsLoaded(true)}
      />

      {/* Dải gradient mượt mà che đáy để chữ nổi bật */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />

      {/* Chỉ báo trạng thái đang phát tinh tế (Living Pulse Indicator) - Không che ảnh */}
      {isSelected && (
        <div className="absolute top-1.5 left-1.5 z-10 px-2 py-0.5 rounded-full bg-black/85 border border-emerald-400/40 flex items-center gap-1.5 shadow-sm">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          <span className="text-[10px] font-semibold text-emerald-300 tracking-wide">Đang bật</span>
        </div>
      )}

      {/* Trạng thái đang tải chuyển cảnh */}
      {isPending && (
        <div className="absolute top-1.5 left-1.5 z-10 px-2 py-0.5 rounded-full bg-black/85 border border-amber-400/40 flex items-center gap-1.5 shadow-sm">
          <span className="animate-spin h-1.5 w-1.5 rounded-full border border-amber-400 border-t-transparent" />
          <span className="text-[10px] font-semibold text-amber-300">Đang tải...</span>
        </div>
      )}

      {/* Nút thả tim yêu thích dạng kính lỏng tối giản */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(scene.id);
        }}
        aria-label={isFav ? "Bỏ yêu thích" : "Yêu thích"}
        className="absolute top-1.5 right-1.5 z-10 w-7 h-7 rounded-full bg-black/35 hover:bg-black/55 backdrop-blur-md border border-white/10 flex items-center justify-center text-white active:scale-90 transition-all"
      >
        <HeartIcon
          weight={isFav ? "fill" : "regular"}
          className={`w-3.5 h-3.5 transition-colors ${isFav ? "text-rose-400" : "text-white/70"}`}
        />
      </button>

      {/* Tên cảnh và icon loại cảnh ở đáy card */}
      <div className="absolute bottom-1.5 inset-x-2 flex items-center justify-between gap-1 pointer-events-none">
        <p className="text-[11.5px] font-medium text-white truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          {scene.name}
        </p>
        {isVideo && (
          <span className="shrink-0 text-white/50" title="Video 4K">
            <VideoCameraIcon className="w-3.5 h-3.5 text-sky-300/80 drop-shadow-sm" />
          </span>
        )}
      </div>
    </div>
  );
});
MobileSceneCard.displayName = "MobileSceneCard";

export const MobileSceneSheet = React.memo(function MobileSceneSheet({
  isOpen,
  onClose,
  currentScene,
  pendingScene,
  onSelectScene,
  slideshowEnabled,
  slideshowIntervalMin = 15,
  onToggleSlideshow,
  onCycleSlideshowInterval,
}: MobileSceneSheetProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { isFavorite, toggleFavorite, count: favoriteCount } = useFavoriteScenes();

  const categories = useMemo(() => [
    { key: "all", label: "Tất cả", icon: SparkleIcon },
    { key: "favorites", label: `Yêu thích${favoriteCount > 0 ? ` (${favoriteCount})` : ""}`, icon: HeartIcon },
    { key: "video", label: "Video 4K", icon: VideoCameraIcon },
    { key: "chill", label: "Chill & Lofi", icon: CoffeeIcon },
    { key: "anime", label: "Anime", icon: TelevisionIcon },
    { key: "nature", label: "Thiên nhiên", icon: TreeEvergreenIcon },
    { key: "urban", label: "Đô thị", icon: BuildingsIcon },
    { key: "cute", label: "Đáng yêu", icon: SmileyIcon },
  ], [favoriteCount]);

  const filteredScenes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return STUDY_SCENES.filter((s) => {
      const matchCategory =
        selectedCategory === "all" ? true :
        selectedCategory === "favorites" ? isFavorite(s.id) :
        selectedCategory === "video" ? s.type === "VIDEO" :
        s.category === selectedCategory;

      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        (Array.isArray(s.tags) && s.tags.some((t) => t.toLowerCase().includes(q)));

      return matchCategory && matchSearch;
    });
  }, [selectedCategory, searchQuery, isFavorite]);

  // Đổi cảnh ngẫu nhiên
  const handleShuffle = () => {
    const candidates = filteredScenes.length > 1 ? filteredScenes : STUDY_SCENES;
    const available = candidates.filter((s) => s.id !== currentScene.id);
    const next = available[Math.floor(Math.random() * available.length)] || candidates[0];
    if (next) onSelectScene(next);
  };

  // Danh sách key danh mục theo thứ tự
  const categoryKeys = useMemo(() => categories.map((c) => c.key), [categories]);

  const goToNextCategory = () => {
    setSelectedCategory((curr) => {
      const idx = categoryKeys.indexOf(curr);
      if (idx === -1 || idx >= categoryKeys.length - 1) return curr;
      return categoryKeys[idx + 1];
    });
  };

  const goToPrevCategory = () => {
    setSelectedCategory((curr) => {
      const idx = categoryKeys.indexOf(curr);
      if (idx <= 0) return curr;
      return categoryKeys[idx - 1];
    });
  };

  // Tự động cuộn viên nhộng danh mục đang active vào giữa
  const pillRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    const el = pillRefs.current.get(selectedCategory);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [selectedCategory]);

  return (
    <MobileSheetShell
      isOpen={isOpen}
      onClose={onClose}
      title="Không gian bối cảnh"
      heightClassName="h-[80dvh] max-h-[85dvh]"
      onSwipeLeft={goToNextCategory}
      onSwipeRight={goToPrevCategory}
      footer={
        /* Thanh danh mục cuộn ngang công thái học Thumb-Zone ghim ở đáy */
        <div className="px-3 py-2 overflow-x-auto no-scrollbar flex items-center gap-1.5 select-none">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.key;
            const Icon = cat.icon;
            return (
              <button
                ref={(el) => {
                  if (el) pillRefs.current.set(cat.key, el);
                  else pillRefs.current.delete(cat.key);
                }}
                key={cat.key}
                type="button"
                onClick={() => setSelectedCategory(cat.key)}
                className={`h-8 px-3.5 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all active:scale-95 shrink-0 ${
                  isActive
                    ? "bg-white text-black font-semibold shadow-md"
                    : "bg-white/[0.06] hover:bg-white/[0.12] text-white/75 border border-white/[0.08]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      }
    >
      <div className="flex-1 flex flex-col space-y-2.5 pt-1 select-none">
        {/* Thanh tìm kiếm & Cụm thao tác nhanh tích hợp 1 hàng ngang siêu gọn */}
        <div className="px-3 flex items-center gap-1.5">
          {/* Ô tìm kiếm chiếm phần lớn không gian */}
          <div className="relative flex-1 flex items-center min-w-0">
            <MagnifyingGlassIcon className="absolute left-3 w-3.5 h-3.5 text-white/40 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm cảnh..."
              className="w-full h-8.5 pl-8.5 pr-8 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-white/40 focus:outline-none focus:border-white/20 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 p-1 text-white/40 hover:text-white"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Nút Đổi ngẫu nhiên */}
          <button
            type="button"
            onClick={handleShuffle}
            title="Đổi bối cảnh ngẫu nhiên"
            aria-label="Đổi ngẫu nhiên"
            className="w-8.5 h-8.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] active:scale-95 border border-white/[0.08] flex items-center justify-center text-white/80 hover:text-white transition-all shrink-0 shadow-xs"
          >
            <ShuffleIcon className="w-4 h-4 text-emerald-400" />
          </button>

          {/* Cụm Tự xoay bối cảnh */}
          {onToggleSlideshow && (
            <div className="flex items-center shrink-0">
              <button
                type="button"
                onClick={onToggleSlideshow}
                title={slideshowEnabled ? "Tắt tự động đổi cảnh" : "Bật tự động đổi cảnh"}
                aria-label="Tự xoay cảnh"
                className={`h-8.5 border flex items-center justify-center transition-all active:scale-95 shadow-xs ${
                  slideshowEnabled
                    ? "px-2 bg-emerald-500/20 border-emerald-400/40 text-emerald-300 font-semibold gap-1.5 rounded-l-xl border-r-0"
                    : "w-8.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-white/70 hover:text-white"
                }`}
              >
                {slideshowEnabled ? (
                  <>
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="text-[11px] leading-none">Tự đổi</span>
                  </>
                ) : (
                  <TimerIcon className="w-4 h-4" />
                )}
              </button>

              {/* Nút chọn chu kỳ phút (khi đang bật tự đổi) */}
              {slideshowEnabled && onCycleSlideshowInterval && (
                <button
                  type="button"
                  onClick={onCycleSlideshowInterval}
                  title={`Đổi mỗi ${slideshowIntervalMin} phút. Chạm để thay đổi thời gian.`}
                  aria-label="Đổi thời gian tự xoay"
                  className="h-8.5 px-2 rounded-r-xl bg-emerald-500/25 hover:bg-emerald-500/35 border-y border-r border-emerald-400/40 text-[11px] font-bold text-emerald-200 active:scale-95 transition-all"
                >
                  {slideshowIntervalMin}m
                </button>
              )}
            </div>
          )}
        </div>

        {/* Lưới hiển thị các bối cảnh (2 cột) */}
        <div className="flex-1 px-3 grid grid-cols-2 gap-2.5 pb-4 content-start">
          {filteredScenes.length > 0 ? (
            filteredScenes.map((scene) => (
              <MobileSceneCard
                key={scene.id}
                scene={scene}
                isSelected={currentScene.id === scene.id}
                isPending={pendingScene?.id === scene.id}
                isFav={isFavorite(scene.id)}
                onSelect={onSelectScene}
                onToggleFavorite={toggleFavorite}
              />
            ))
          ) : (
            <div className="col-span-2 py-16 flex flex-col items-center justify-center text-center px-4">
              {selectedCategory === "favorites" ? (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-3">
                    <HeartIcon className="w-6 h-6 text-rose-400/60" />
                  </div>
                  <p className="text-sm font-semibold text-white/80">Chưa có bối cảnh yêu thích</p>
                  <p className="text-xs text-white/40 mt-1 max-w-[240px]">
                    Chạm vào biểu tượng ❤️ trên các cảnh để lưu và mở nhanh tại đây
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("all")}
                    className="mt-4 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-medium text-white transition-all active:scale-95"
                  >
                    Xem tất cả bối cảnh
                  </button>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-3">
                    <MagnifyingGlassIcon className="w-6 h-6 text-white/30" />
                  </div>
                  <p className="text-sm font-semibold text-white/80">Không tìm thấy bối cảnh phù hợp</p>
                  <p className="text-xs text-white/40 mt-1">
                    Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc
                  </p>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="mt-4 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-medium text-white transition-all active:scale-95"
                    >
                      Xóa tìm kiếm
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </MobileSheetShell>
  );
});
