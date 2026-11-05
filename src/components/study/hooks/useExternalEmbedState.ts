"use client";

import { useState, useCallback, useMemo } from "react";
import type { StudyEmbedItem } from "@/components/study/study-types";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { sendYouTubeCommand } from "@/lib/youtube-remote";

interface UseExternalEmbedStateOptions {
  isMobile: boolean;
  onBeforeOpen?: () => void;
  onMobileCloseAll?: () => void;
  onMobileOpenRoot?: (id: "embed", title: string) => void;
  getIsMobileEmbedActive?: () => boolean;
}

export function useExternalEmbedState({
  isMobile,
  onBeforeOpen,
  onMobileCloseAll,
  onMobileOpenRoot,
  getIsMobileEmbedActive,
}: UseExternalEmbedStateOptions) {
  const [isEmbedPlayerOpen, setIsEmbedPlayerOpen] = useState(false);
  const [isExternalStreamActive, setIsExternalStreamActive] = useState(false);
  const [externalActiveItem, setExternalActiveItem] = useState<StudyEmbedItem | null>(null);
  const [isPipActive, setIsPipActive] = useState(false);

  const handleStopExternalStream = useCallback(() => {
    setIsExternalStreamActive(false);
    setExternalActiveItem(null);
    sendYouTubeCommand("pauseVideo");
    try {
      localStorage.removeItem(STORAGE_KEYS.activeEmbed);
    } catch {}
  }, []);

  const handleToggleEmbed = useCallback(() => {
    if (isPipActive) {
      setIsEmbedPlayerOpen(true);
      setIsPipActive(false);
    } else {
      setIsEmbedPlayerOpen((prev) => {
        const next = !prev;
        if (next) onBeforeOpen?.();
        return next;
      });
    }
    onBeforeOpen?.();
  }, [isPipActive, onBeforeOpen]);

  const handleOpenEmbedRoot = useCallback(() => {
    if (isMobile) {
      if (getIsMobileEmbedActive?.()) return;
      onMobileOpenRoot?.("embed", "Đài phát");
    } else {
      onBeforeOpen?.();
      setIsEmbedPlayerOpen(true);
      setIsPipActive(false);
    }
  }, [isMobile, getIsMobileEmbedActive, onMobileOpenRoot, onBeforeOpen]);

  const handleCloseEmbed = useCallback(() => {
    if (isMobile) {
      onMobileCloseAll?.();
    } else {
      setIsEmbedPlayerOpen(false);
    }
  }, [isMobile, onMobileCloseAll]);

  return useMemo(
    () => ({
      isEmbedPlayerOpen,
      setIsEmbedPlayerOpen,
      isExternalStreamActive,
      setIsExternalStreamActive,
      externalActiveItem,
      setExternalActiveItem,
      isPipActive,
      setIsPipActive,
      handleToggleEmbed,
      handleOpenEmbedRoot,
      handleCloseEmbed,
      handleStopExternalStream,
    }),
    [
      isEmbedPlayerOpen,
      isExternalStreamActive,
      externalActiveItem,
      isPipActive,
      handleToggleEmbed,
      handleOpenEmbedRoot,
      handleCloseEmbed,
      handleStopExternalStream,
    ]
  );
}
