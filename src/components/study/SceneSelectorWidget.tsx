"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  XIcon,
  SparkleIcon,
  VideoCameraIcon,
  MagnifyingGlassIcon,
  CoffeeIcon,
  TreeEvergreenIcon,
  BuildingsIcon,
  HeartIcon,
  TelevisionIcon,
  CheckIcon,
  ShuffleIcon,
  SmileyIcon,
  CircleNotchIcon,
  PlayIcon,
  PauseIcon,
  TimerIcon,
} from "@phosphor-icons/react";
import { Scene, STUDY_SCENES } from "./study-types";
import { useFavoriteScenes } from "@/lib/use-favorites";
import { motion } from "framer-motion";
import { ModalShell } from "../ui/ModalShell";
import { EmptyState } from "../ui/EmptyState";
import { Badge } from "../ui/Badge";

interface SceneSelectorWidgetProps {
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

const SceneThumbnail = React.memo<{ scene: Scene }>(({ scene }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="relative w-full h-full bg-slate-900/80 overflow-hidden">
      {!isLoaded && (
        <div className="absolute inset-0 bg-white/5 animate-pulse" />
      )}
      <img
        ref={(el) => {
          if (el && el.complete && el.naturalWidth > 0 && !isLoaded) {
            setIsLoaded(true);
          }
        }}
        src={scene.thumbnailUrl}
        alt={scene.name}
        className={`w-full h-full object-cover transform-gpu [@media(hover:hover)]:group-hover:scale-105 [@media(hover:hover)]:transition-transform [@media(hover:hover)]:duration-500 [@media(hover:hover)]:ease-out transition-opacity duration-300 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
        decoding="async"
        onLoad={() => setIsLoaded(true)}
      />
    </div>
  );
});
SceneThumbnail.displayName = "SceneThumbnail";

interface SceneCardItemProps {
  scene: Scene;
  isSelected: boolean;
  isPending?: boolean;
  isFav: boolean;
  onSelect: (scene: Scene) => void;
  onToggleFavorite: (id: string) => void;
}

const SceneCardItem = React.memo<SceneCardItemProps>(
  ({ scene, isSelected, isPending, isFav, onSelect, onToggleFavorite }) => {
    const isVideo = scene.type === "VIDEO";

    return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(scene)}
      onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(scene);
          }
        }}
        className={`group relative aspect-[16/10] w-full rounded-2xl overflow-hidden border transition-all duration-300 text-left cursor-pointer shrink-0 shadow-sm hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-emerald-400/50 ${
          isPending
            ? "border-amber-400/90 ring-2 ring-amber-400/40 shadow-[0_0_20px_rgba(251,191,36,0.3)] scale-[1.01] animate-pulse"
            : isSelected
            ? "border-emerald-400/90 ring-2 ring-emerald-400/40 shadow-[0_0_20px_rgba(52,211,153,0.3)] scale-[1.01]"
            : "border-white/10 hover:border-white/30"
        }`}
      >
        {/* Thumbnail Image tràn viền */}
        <SceneThumbnail scene={scene} />

        {/* Gradient bóng đổ nhẹ nhàng ở đáy */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />

        {/* Top Actions & Badges Area */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10">
          {/* Left Badges */}
          <div className="flex items-center gap-1.5 pointer-events-none">
            {isPending ? (
              <Badge tone="amber" className="shadow-md flex items-center gap-1">
                <CircleNotchIcon className="w-2.5 h-2.5 animate-spin" />
                <span>Đang nạp...</span>
              </Badge>
            ) : isSelected ? (
              <div className="w-5 h-5 rounded-full bg-emerald-400 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-400/40 font-bold animate-in zoom-in-75 duration-200">
                <CheckIcon weight="bold" className="w-3 h-3" />
              </div>
            ) : null}
            {isVideo && !isPending && (
              <Badge tone="amber" className="shadow-md">
                <VideoCameraIcon className="w-2.5 h-2.5" /> 4K Động
              </Badge>
            )}
          </div>

          {/* Right: Nút Thả tim (Chỉ hiển thị khi hover vào thẻ card) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(scene.id);
            }}
            className="p-1 -mr-1 -mt-1 rounded-full cursor-pointer transition-all duration-200 active:scale-75 hover:scale-125 focus:outline-none opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            title={isFav ? "Bỏ yêu thích" : "Lưu vào yêu thích"}
          >
            <HeartIcon
              weight={isFav ? "fill" : "bold"}
              className={`w-4 h-4 transition-all duration-200 ${
                isFav
                  ? "text-rose-500 drop-shadow-[0_2px_8px_rgba(244,63,94,0.7)] scale-105"
                  : "text-white/80 hover:text-rose-400 drop-shadow-[0_2px_5px_rgba(0,0,0,0.85)]"
              }`}
            />
          </button>
        </div>

        {/* Scene Title at Bottom */}
        <div className="absolute bottom-0 inset-x-0 p-2.5 pointer-events-none">
          <p className="text-xs font-semibold text-white leading-snug truncate drop-shadow group-hover:text-emerald-300 transition-colors">
            {scene.name}
          </p>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.scene.id === next.scene.id &&
    prev.isSelected === next.isSelected &&
    prev.isPending === next.isPending &&
    prev.isFav === next.isFav
);
SceneCardItem.displayName = "SceneCardItem";

interface CategoryItem {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const SceneSelectorWidget = ({
  isOpen,
  onClose,
  currentScene,
  pendingScene,
  onSelectScene,
  slideshowEnabled = true,
  slideshowIntervalMin = 5,
  slideshowPoolLabel = "",
  onToggleSlideshow,
  onCycleSlideshowInterval,
}: SceneSelectorWidgetProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  // Đợi khung chạy hình xong 1 nhịp rồi mới dựng lưới hình.
  // Máy yếu (tablet) sẽ không bị vừa chạy hình vừa tải 30+ tấm cùng lúc.
  const [isPanelReady, setIsPanelReady] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef<number>(0);
  const lastCategoryScrollLeftRef = useRef<number>(0);
  const isRestoringScrollRef = useRef<boolean>(false);

  const scenes = STUDY_SCENES;
  const { isFavorite, toggleFavorite, count: favoriteCount } = useFavoriteScenes();

  // Khôi phục toàn bộ trạng thái (category, search, scroll) từ sessionStorage khi component mount
  useEffect(() => {
    try {
      const savedCategory = sessionStorage.getItem("study_scene_category");
      if (savedCategory) setSelectedCategory(savedCategory);

      const savedSearch = sessionStorage.getItem("study_scene_search");
      if (savedSearch) setSearchQuery(savedSearch);

      const savedTop = sessionStorage.getItem("study_scene_scroll_top");
      if (savedTop) lastScrollTopRef.current = Number(savedTop) || 0;

      const savedLeft = sessionStorage.getItem("study_scene_category_scroll_left");
      if (savedLeft) lastCategoryScrollLeftRef.current = Number(savedLeft) || 0;
    } catch { }
  }, []);

  // Đợi khung mở xong 1 nhịp rồi mới cho lưới hình hiện ra (mượt hơn trên tablet)
  useEffect(() => {
    if (!isOpen) {
      setIsPanelReady(false);
      return;
    }
    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;
    const timer = window.setTimeout(() => {
      if (!cancelled) setIsPanelReady(true);
    }, 140);
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (!cancelled) setIsPanelReady(true);
        window.clearTimeout(timer);
      });
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [isOpen]);

  // Khôi phục chính xác vị trí cuộn mỗi khi mở lại modal (dùng flag isRestoringScrollRef chống ghi đè 0)
  useEffect(() => {
    if (isOpen && isPanelReady) {
      isRestoringScrollRef.current = true;
      const frameId = requestAnimationFrame(() => {
        if (gridScrollRef.current && lastScrollTopRef.current > 0) {
          gridScrollRef.current.scrollTop = lastScrollTopRef.current;
        }
        if (scrollContainerRef.current && lastCategoryScrollLeftRef.current > 0) {
          scrollContainerRef.current.scrollLeft = lastCategoryScrollLeftRef.current;
        }

        // Sau khi browser hoàn tất dựng hình và áp dụng scrollTop, mở lại lắng nghe scroll event
        setTimeout(() => {
          isRestoringScrollRef.current = false;
        }, 120);
      });

      return () => {
        cancelAnimationFrame(frameId);
        isRestoringScrollRef.current = false;
      };
    }
  }, [isOpen, isPanelReady]);

  const handleGridScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isRestoringScrollRef.current) return;
    const top = e.currentTarget.scrollTop;
    lastScrollTopRef.current = top;
    try {
      sessionStorage.setItem("study_scene_scroll_top", String(top));
    } catch { }
  };

  const handleCategoryScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isRestoringScrollRef.current) return;
    const left = e.currentTarget.scrollLeft;
    lastCategoryScrollLeftRef.current = left;
    try {
      sessionStorage.setItem("study_scene_category_scroll_left", String(left));
    } catch { }
  };

  const handleSelectCategory = (catKey: string) => {
    if (catKey !== selectedCategory) {
      setSelectedCategory(catKey);
      lastScrollTopRef.current = 0;
      try {
        sessionStorage.setItem("study_scene_category", catKey);
        sessionStorage.setItem("study_scene_scroll_top", "0");
      } catch { }
      if (gridScrollRef.current) gridScrollRef.current.scrollTop = 0;
    }
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    lastScrollTopRef.current = 0;
    try {
      sessionStorage.setItem("study_scene_search", val);
      sessionStorage.setItem("study_scene_scroll_top", "0");
    } catch { }
    if (gridScrollRef.current) gridScrollRef.current.scrollTop = 0;
  };

  const categories: CategoryItem[] = useMemo(() => [
    { key: "all", label: "Tất cả", icon: SparkleIcon },
    { key: "favorites", label: `Yêu thích${favoriteCount > 0 ? ` (${favoriteCount})` : ""}`, icon: HeartIcon },
    { key: "video", label: "Video 4K", icon: VideoCameraIcon },
    { key: "chill", label: "Chill & Lofi", icon: CoffeeIcon },
    { key: "anime", label: "Anime", icon: TelevisionIcon },
    { key: "nature", label: "Thiên nhiên", icon: TreeEvergreenIcon },
    { key: "urban", label: "Đô thị", icon: BuildingsIcon },
    { key: "cute", label: "Đáng yêu", icon: SmileyIcon },
  ], [favoriteCount]);

  const availableCategories = useMemo(() => {
    return categories.filter((cat) => {
      if (cat.key === "favorites") return favoriteCount > 0;
      const count = scenes.filter((s) => {
        if (cat.key === "all") return true;
        if (cat.key === "video") return s.type === "VIDEO";
        return s.category === cat.key;
      }).length;
      return count > 0;
    });
  }, [categories, scenes, favoriteCount]);

  const filteredScenes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scenes.filter((s) => {
      const matchCategory =
        selectedCategory === "all" ? true :
          selectedCategory === "favorites" ? isFavorite(s.id) :
            selectedCategory === "video" ? s.type === "VIDEO" :
              s.category === selectedCategory;

      const matchSearch = !q ||
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        (Boolean(s.tags) && (s.tags as string[]).some((t) => t.toLowerCase().includes(q)));

      return matchCategory && matchSearch;
    });
  }, [scenes, selectedCategory, searchQuery, isFavorite]);

  // Hỗ trợ cuộn ngang mượt mà bằng chuột / trackpad
  const handleWheelScroll = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (scrollContainerRef.current && e.deltaY !== 0) {
      scrollContainerRef.current.scrollLeft += e.deltaY;
    }
  };

  // Tính năng đổi ngẫu nhiên bối cảnh (Shuffle)
  const handleShuffle = () => {
    const candidateScenes = filteredScenes.length > 1 ? filteredScenes : scenes;
    const available = candidateScenes.filter((s) => s.id !== currentScene.id);
    const next = available[Math.floor(Math.random() * available.length)] || candidateScenes[0];
    if (next) onSelectScene(next);
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      panelKey="scene-selector"
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      panelClassName="fixed top-16 bottom-20 left-20 sm:left-24 z-50 w-[410px] sm:w-[450px] max-w-[calc(100vw-96px)] flex flex-col glass-panel hover:bg-black/45 text-white overflow-hidden transform-gpu will-change-[transform,opacity]"
    >
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none z-10" />
      {/* Header & Search Bar gọn gàng, tinh tế */}
      <div className="p-4 pb-3 border-b border-white/10 shrink-0 space-y-3">
        {/* Hàng 1: Tiêu đề + Đóng */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2 whitespace-nowrap min-w-0">
              <span className="truncate min-w-0">Không gian làm việc</span>
              <span className="text-xs text-slate-400 font-normal shrink-0">
                ({filteredScenes.length})
              </span>
            </h3>
          </div>

          {/* Nút Đóng */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer active:scale-95 shrink-0"
            title="Đóng (ESC)"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Hàng 2: Thanh công cụ (hàng riêng nên không bao giờ chen tiêu đề) */}
        <div className="flex items-center gap-1.5">
          {/* Nút Bật/Tắt tự xoay bối cảnh */}
          <button
            onClick={onToggleSlideshow}
            className={`p-1.5 px-2.5 rounded-xl transition-colors cursor-pointer border flex flex-1 items-center justify-center gap-1.5 text-xs active:scale-95 ${
              slideshowEnabled
                ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300 font-bold"
                : "text-slate-300 hover:text-white hover:bg-white/10 border-transparent hover:border-white/10 font-medium"
            }`}
              title={
                slideshowEnabled
                  ? `Tự xoay cảnh mỗi ${slideshowIntervalMin} phút (${slideshowPoolLabel}) — bấm để tắt`
                  : "Tự xoay bối cảnh — bấm để bật"
              }
            >
              {slideshowEnabled ? (
                <PauseIcon weight="fill" className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <PlayIcon className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span className="hidden sm:inline font-medium whitespace-nowrap">Tự xoay cảnh</span>
          </button>

          {/* Nút chọn thời gian mỗi lượt (chỉ hiện khi đang bật tự xoay) */}
          {slideshowEnabled && (
            <button
              onClick={onCycleSlideshowInterval}
              className="p-1.5 px-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer border border-transparent hover:border-white/10 flex flex-1 items-center justify-center gap-1.5 text-xs active:scale-95 font-bold"
              title="Bấm để đổi thời gian mỗi lượt (5 → 15 → 30 → 60 phút)"
            >
                <TimerIcon className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline font-medium whitespace-nowrap">{slideshowIntervalMin} phút</span>
            </button>
          )}

          {/* Nút Đổi ngẫu nhiên không gian (icon phổ quát nên icon-only) */}
          <button
            onClick={handleShuffle}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer border border-transparent hover:border-white/10 flex flex-1 items-center justify-center gap-1.5 text-xs active:scale-95"
            title="Đổi cảnh ngẫu nhiên"
          >
            <ShuffleIcon className="w-3.5 h-3.5 text-emerald-400" />
          </button>

          {/* Nút Mở Studio Quản lý Background (Chỉ hiện ở môi trường Local Development) */}
          {process.env.NODE_ENV === "development" && (
            <Link
              href="/admin/scenes/"
              target="_blank"
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer border border-transparent hover:border-white/10 flex flex-1 items-center justify-center gap-1.5 text-xs active:scale-95"
              title="Mở Studio quản lý bối cảnh"
            >
              <SparkleIcon className="w-3.5 h-3.5 text-indigo-400" />
            </Link>
          )}
        </div>

        {/* Quick Search Bar thanh mảnh */}
        <div className="relative flex items-center">
          <MagnifyingGlassIcon className="w-3.5 h-3.5 absolute left-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Tìm kiếm bối cảnh (Tokyo, cafe, mưa, lofi...)"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full bg-white/[0.04] hover:bg-white/[0.07] focus:bg-white/[0.08] border border-white/10 focus:border-emerald-400/40 rounded-xl pl-8.5 pr-8 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none transition-all shadow-inner"
          />
          {Boolean(searchQuery) && (
            <button
              onClick={() => handleSearchChange("")}
              className="absolute right-2.5 text-slate-400 hover:text-white text-xs cursor-pointer p-0.5 rounded-full hover:bg-white/10"
              title="Xóa tìm kiếm"
            >
              <XIcon className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs: Tối giản, cuộn tự nhiên với Edge Fade */}
      <div className="relative shrink-0 border-b border-white/5 bg-black/20">
        {/* Left Fade Mask */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-[#0b0f17] to-transparent z-10" />

        <div
          ref={scrollContainerRef}
          onWheel={handleWheelScroll}
          onScroll={handleCategoryScroll}
          className="flex items-center gap-1.5 overflow-x-auto px-3 py-2 scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {availableCategories.map((cat, idx) => {
            const isSelected = selectedCategory === cat.key;

            return (
              <button
                key={cat.key || `cat-scene-${idx}`}
                onClick={() => handleSelectCategory(cat.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors shrink-0 cursor-pointer active:scale-95 ${
                  isSelected
                    ? "bg-white/15 text-white border border-white/15"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Right Fade Mask */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-3 bg-gradient-to-l from-black/50 to-transparent z-10" />
      </div>

      {/* Scene Cards Grid: Borderless Gallery điện ảnh 16:10 */}
      <div
        ref={gridScrollRef}
        onScroll={handleGridScroll}
        className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-3.5 grid grid-cols-2 gap-2.5 sm:gap-3 auto-rows-max content-start custom-study-scroll"
      >
        {!isPanelReady ? (
          // Khung xương nhẹ lúc mới mở: cho hình chạy mượt trước, lưới hình vào sau
          Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={`scene-skeleton-${idx}`}
              className="aspect-[16/10] w-full rounded-2xl bg-white/5 animate-pulse border border-white/5"
            />
          ))
        ) : filteredScenes.length === 0 ? (
          <EmptyState
            className="col-span-full py-12 px-4 text-center"
            icon={
              selectedCategory === "favorites" ? (
                <HeartIcon className="w-8 h-8 opacity-40 text-rose-400 stroke-1" />
              ) : (
                <MagnifyingGlassIcon className="w-8 h-8 opacity-40 text-slate-400 stroke-1" />
              )
            }
            message={
              selectedCategory === "favorites"
                ? "Chưa có bối cảnh yêu thích nào. Bấm biểu tượng trái tim trên bối cảnh để lưu vào đây!"
                : "Không tìm thấy bối cảnh nào phù hợp"
            }
          />
        ) : (
          filteredScenes.map((scene) => (
            <SceneCardItem
              key={scene.id}
              scene={scene}
              isSelected={currentScene.id === scene.id}
              isPending={pendingScene?.id === scene.id}
              isFav={isFavorite(scene.id)}
              onSelect={onSelectScene}
              onToggleFavorite={toggleFavorite}
            />
          ))
        )}
      </div>
    </ModalShell>
  );
};
