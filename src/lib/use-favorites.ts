"use client";

import { useState, useEffect, useCallback } from "react";
import { STORAGE_KEYS } from "@/lib/storage-keys";

export function useFavoriteScenes() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.favoriteScenes);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setFavoriteIds(parsed);
        }
      }
    } catch {
      // Fallback empty if corrupt
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem(STORAGE_KEYS.favoriteScenes, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (id: string) => favoriteIds.includes(id),
    [favoriteIds]
  );

  return {
    favoriteIds,
    isFavorite,
    toggleFavorite,
    isLoaded,
    count: favoriteIds.length,
  };
}

export function useFavoriteTracks() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.favoriteTracks);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setFavoriteIds(parsed);
        }
      }
    } catch {} finally {
      setIsLoaded(true);
    }
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem(STORAGE_KEYS.favoriteTracks, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (id: string) => favoriteIds.includes(id),
    [favoriteIds]
  );

  return {
    favoriteIds,
    isFavorite,
    toggleFavorite,
    isLoaded,
    count: favoriteIds.length,
  };
}
