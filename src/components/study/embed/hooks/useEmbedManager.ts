"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { StudyEmbedItem, ViewMode } from "../types";
import {
  STORAGE_CUSTOM_EMBEDS_KEY,
  STORAGE_ACTIVE_EMBED_KEY,
  STORAGE_VIEW_MODE_KEY,
  GENERIC_STREAM_TITLES,
} from "../constants";
import { filterEmbedItems } from "../utils/embed-helpers";
import { CURATED_EMBED_PRESETS, parseEmbedUrl } from "../../study-types";
import {
  fetchSpotifyMetadata,
  fetchYoutubeMetadata,
} from "@/lib/embed-metadata";

interface UseEmbedManagerOptions {
  onStreamActiveChange?: (isActive: boolean) => void;
  onActiveItemChange?: (item: StudyEmbedItem | null) => void;
  onPlaySuccess?: () => void;
}

export function useEmbedManager({
  onStreamActiveChange,
  onActiveItemChange,
  onPlaySuccess,
}: UseEmbedManagerOptions) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [savedEmbeds, setSavedEmbeds] = useState<StudyEmbedItem[]>([]);
  const [searchOrUrl, setSearchOrUrl] = useState("");
  const [isIframeLoading, setIsIframeLoading] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const [fetchedMetadata, setFetchedMetadata] = useState<{
    title?: string;
    author?: string;
    thumbnail?: string;
  } | null>(null);

  const changeActiveItem = useCallback(
    (item: StudyEmbedItem | null) => {
      if (onActiveItemChange) {
        onActiveItemChange(item);
      }
      if (onStreamActiveChange) {
        onStreamActiveChange(item !== null);
      }
      try {
        if (item) {
          localStorage.setItem(STORAGE_ACTIVE_EMBED_KEY, JSON.stringify(item));
        } else {
          localStorage.removeItem(STORAGE_ACTIVE_EMBED_KEY);
        }
      } catch {}
    },
    [onActiveItemChange, onStreamActiveChange]
  );

  // Khôi phục cài đặt từ LocalStorage khi mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_CUSTOM_EMBEDS_KEY);
      if (stored) {
        setSavedEmbeds(JSON.parse(stored));
      }
      const lastActive = localStorage.getItem(STORAGE_ACTIVE_EMBED_KEY);
      if (lastActive) {
        const parsed = JSON.parse(lastActive);
        const matchedPreset = CURATED_EMBED_PRESETS.find((p: StudyEmbedItem) => p.id === parsed.id);
        const target = matchedPreset || parsed;
        changeActiveItem(target);
      }
      const savedView = localStorage.getItem(STORAGE_VIEW_MODE_KEY);
      if (savedView === "grid" || savedView === "list") {
        setViewMode(savedView);
      } else {
        setViewMode("list");
      }
    } catch {}
  }, [changeActiveItem]);

  // Real-time URL parse detection
  const detectedEmbed = useMemo(() => {
    if (!searchOrUrl.trim()) return null;
    return parseEmbedUrl(searchOrUrl);
  }, [searchOrUrl]);

  // Fetch metadata từ oEmbed API khi người dùng dán URL
  useEffect(() => {
    if (!detectedEmbed || !searchOrUrl.trim()) {
      setFetchedMetadata(null);
      return;
    }

    let isMounted = true;
    const url = searchOrUrl.trim();

    const fetchRealOembed = async () => {
      const meta =
        detectedEmbed.platform === "youtube"
          ? await fetchYoutubeMetadata(url)
          : detectedEmbed.platform === "spotify"
          ? await fetchSpotifyMetadata(url)
          : null;
      if (meta && isMounted) {
        setFetchedMetadata({
          title: meta.title,
          author: meta.author,
          thumbnail: meta.thumbnail || detectedEmbed.thumbnail,
        });
      }
    };

    fetchRealOembed();

    return () => {
      isMounted = false;
    };
  }, [detectedEmbed, searchOrUrl]);

  // Background resolver: Tự động bổ sung title thật nếu item đang phát là placeholder chung
  const resolveActiveItemMetadata = useCallback(
    async (item: StudyEmbedItem) => {
      if (!item.url || !GENERIC_STREAM_TITLES.includes(item.title)) return;
      try {
        if (item.platform === "youtube") {
          const meta = await fetchYoutubeMetadata(item.url);
          if (meta?.title) {
            changeActiveItem({
              ...item,
              title: meta.title,
              category: meta.author || item.category || "YouTube",
              thumbnail: meta.thumbnail || item.thumbnail,
            });
          }
        } else if (item.platform === "spotify") {
          const meta = await fetchSpotifyMetadata(item.url);
          if (meta?.title) {
            changeActiveItem({
              ...item,
              title: meta.title,
              thumbnail: meta.thumbnail || item.thumbnail,
            });
          }
        }
      } catch {}
    },
    [changeActiveItem]
  );

  const handlePlayItem = useCallback(
    (item: StudyEmbedItem) => {
      setIsIframeLoading(true);
      changeActiveItem(item);
      if (onPlaySuccess) onPlaySuccess();
      toast.success(item.title, {
        description:
          item.platform === "spotify"
            ? "Nhấn nút ▶ trên khung Spotify để bắt đầu phát"
            : "Đang phát luồng âm thanh",
      });
    },
    [changeActiveItem, onPlaySuccess]
  );

  const handleStopStream = useCallback(
    (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      changeActiveItem(null);
      toast.info("Đã dừng phát đài này");
    },
    [changeActiveItem]
  );

  const toggleViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(STORAGE_VIEW_MODE_KEY, mode);
    } catch {}
  }, []);

  const handlePlayFromInput = useCallback(
    async (save: boolean) => {
      if (!detectedEmbed) return;

      let resolvedTitle = fetchedMetadata?.title;
      let resolvedAuthor = fetchedMetadata?.author;
      let resolvedThumb = fetchedMetadata?.thumbnail || detectedEmbed.thumbnail;

      if (!resolvedTitle && detectedEmbed.platform === "youtube") {
        try {
          const meta = await fetchYoutubeMetadata(searchOrUrl.trim());
          if (meta?.title) {
            resolvedTitle = meta.title;
            resolvedAuthor = meta.author;
            resolvedThumb = meta.thumbnail || resolvedThumb;
          }
        } catch {}
      }

      const title =
        resolvedTitle ||
        detectedEmbed.title ||
        (detectedEmbed.platform === "spotify" ? "Spotify Stream" : "YouTube Video");

      const newItem: StudyEmbedItem = {
        id: "custom-" + Date.now(),
        title,
        url: searchOrUrl.trim(),
        embedUrl: detectedEmbed.embedUrl,
        platform: detectedEmbed.platform,
        category: resolvedAuthor || "Tùy chỉnh",
        thumbnail: resolvedThumb,
        isLive: detectedEmbed.isLive || false,
        addedAt: Date.now(),
      };

      if (save) {
        const updated = [newItem, ...savedEmbeds.filter((s) => s.url !== newItem.url)];
        setSavedEmbeds(updated);
        try {
          localStorage.setItem(STORAGE_CUSTOM_EMBEDS_KEY, JSON.stringify(updated));
        } catch {}
        toast.success("Đã lưu vào danh sách!");
      }

      handlePlayItem(newItem);
      setSearchOrUrl("");
    },
    [detectedEmbed, fetchedMetadata, handlePlayItem, savedEmbeds, searchOrUrl]
  );

  const handleDeleteSaved = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const updated = savedEmbeds.filter((item) => item.id !== id);
      setSavedEmbeds(updated);
      try {
        localStorage.setItem(STORAGE_CUSTOM_EMBEDS_KEY, JSON.stringify(updated));
      } catch {}
      toast.success("Đã xóa khỏi danh sách đã lưu");
    },
    [savedEmbeds]
  );

  const handleToggleSaveItem = useCallback(
    (item: StudyEmbedItem) => {
      const exists = savedEmbeds.some((s) => s.id === item.id || s.url === item.url);
      const updated = exists
        ? savedEmbeds.filter((s) => s.id !== item.id && s.url !== item.url)
        : [{ ...item, addedAt: Date.now() }, ...savedEmbeds];
      setSavedEmbeds(updated);
      try {
        localStorage.setItem(STORAGE_CUSTOM_EMBEDS_KEY, JSON.stringify(updated));
      } catch {}
      toast.success(exists ? "Đã xóa khỏi danh sách đã lưu" : "Đã lưu đài này");
    },
    [savedEmbeds]
  );

  // Danh sách hiển thị sau khi lọc
  const displayedItems = useMemo(() => {
    const isUrlInput = detectedEmbed !== null;
    const query = isUrlInput ? "" : searchOrUrl;

    if (activeCategory === "saved") {
      return filterEmbedItems(savedEmbeds, query, "saved");
    }

    const sourceList = [...CURATED_EMBED_PRESETS, ...savedEmbeds];
    return filterEmbedItems(sourceList, query, activeCategory);
  }, [activeCategory, searchOrUrl, detectedEmbed, savedEmbeds]);

  return {
    activeCategory,
    setActiveCategory,
    viewMode,
    toggleViewMode,
    savedEmbeds,
    searchOrUrl,
    setSearchOrUrl,
    detectedEmbed,
    fetchedMetadata,
    isIframeLoading,
    setIsIframeLoading,
    failedImages,
    setFailedImages,
    loadedImages,
    setLoadedImages,
    displayedItems,
    changeActiveItem,
    handlePlayItem,
    handleStopStream,
    handlePlayFromInput,
    handleDeleteSaved,
    handleToggleSaveItem,
    resolveActiveItemMetadata,
  };
}
