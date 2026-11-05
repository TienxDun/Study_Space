"use client";

import { useState, useCallback, useMemo } from "react";
import type { SystemFlags } from "@/lib/system-flags";

interface UsePanelStateOptions {
  systemFlags: SystemFlags;
  isMobile: boolean;
  onCloseEmbed?: () => void;
  onMobileCloseAllSheets?: () => void;
  onMobileOpenRoot?: (id: "music", title: string) => void;
  isEmbedPlayerOpen?: boolean;
  isPipActive?: boolean;
}

export function usePanelState({
  systemFlags,
  isMobile,
  onCloseEmbed,
  onMobileCloseAllSheets,
  onMobileOpenRoot,
  isEmbedPlayerOpen = false,
  isPipActive = false,
}: UsePanelStateOptions) {
  // Widget Panel States
  const [isTasksOpen, setIsTasksOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isScenesOpen, setIsScenesOpen] = useState(false);
  const [isMixerOpen, setIsMixerOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isRoomsOpen, setIsRoomsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Setter có cổng: cờ tắt thì không mở được, nhưng đóng thì luôn cho phép
  const setChatOpenGated = useCallback<React.Dispatch<React.SetStateAction<boolean>>>(
    (value) => {
      setIsChatOpen((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        return systemFlags.chatEnabled ? next : false;
      });
    },
    [systemFlags.chatEnabled]
  );

  const setRoomsOpenGated = useCallback<React.Dispatch<React.SetStateAction<boolean>>>(
    (value) => {
      setIsRoomsOpen((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        return systemFlags.roomsEnabled ? next : false;
      });
    },
    [systemFlags.roomsEnabled]
  );

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
    setIsMixerOpen(false);
    setIsTasksOpen(false);
    setIsNotesOpen(false);
    setIsScenesOpen(false);
    onCloseEmbed?.();
    setIsShortcutsHelpOpen(false);
  }, [onCloseEmbed]);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const handleToggleSettings = useCallback(() => {
    if (isSettingsOpen) {
      handleCloseSettings();
    } else {
      handleOpenSettings();
    }
  }, [isSettingsOpen, handleCloseSettings, handleOpenSettings]);

  const handleToggleShortcutsHelp = useCallback(() => {
    setIsShortcutsHelpOpen((prev) => {
      const next = !prev;
      if (next) handleCloseSettings();
      return next;
    });
    setIsMixerOpen(false);
  }, [handleCloseSettings]);

  const handleToggleTasks = useCallback(() => {
    setIsTasksOpen((prev) => {
      const next = !prev;
      if (next) handleCloseSettings();
      return next;
    });
    setIsScenesOpen(false);
    setIsMixerOpen(false);
  }, [handleCloseSettings]);

  const handleToggleNotes = useCallback(() => {
    setIsNotesOpen((prev) => {
      const next = !prev;
      if (next) handleCloseSettings();
      return next;
    });
    setIsScenesOpen(false);
    setIsMixerOpen(false);
  }, [handleCloseSettings]);

  const handleToggleScenes = useCallback(() => {
    setIsScenesOpen((prev) => {
      const next = !prev;
      if (next) handleCloseSettings();
      return next;
    });
    setIsTasksOpen(false);
    setIsNotesOpen(false);
    setIsMixerOpen(false);
    onCloseEmbed?.();
  }, [handleCloseSettings, onCloseEmbed]);

  const handleCloseMixer = useCallback(() => {
    if (isMobile) {
      onMobileCloseAllSheets?.();
    } else {
      setIsMixerOpen(false);
    }
  }, [isMobile, onMobileCloseAllSheets]);

  const handleToggleMixer = useCallback(() => {
    if (isMobile) {
      if (isMixerOpen) {
        onMobileCloseAllSheets?.();
      } else {
        onMobileOpenRoot?.("music", "Nhạc & Âm thanh");
      }
    } else {
      setIsMixerOpen((prev) => {
        const next = !prev;
        if (next) {
          handleCloseSettings();
          setIsTasksOpen(false);
          setIsNotesOpen(false);
          setIsScenesOpen(false);
          onCloseEmbed?.();
          setIsShortcutsHelpOpen(false);
        }
        return next;
      });
    }
  }, [
    isMobile,
    isMixerOpen,
    onMobileCloseAllSheets,
    onMobileOpenRoot,
    handleCloseSettings,
    onCloseEmbed,
  ]);

  const openPanelOnly = useCallback(
    (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
      handleCloseSettings();
      if (setter !== setIsNotesOpen) setIsTasksOpen(false);
      if (setter !== setIsTasksOpen) setIsNotesOpen(false);
      setIsScenesOpen(false);
      setIsMixerOpen(false);
      onCloseEmbed?.();
      setIsRoomsOpen(false);
      setIsChatOpen(false);
      setter(true);
    },
    [handleCloseSettings, onCloseEmbed]
  );

  const isAnyModalOpen =
    isSettingsOpen ||
    isStatsOpen ||
    isTasksOpen ||
    isScenesOpen ||
    (isEmbedPlayerOpen && !isPipActive) ||
    isMixerOpen ||
    isShortcutsHelpOpen;

  // Mobile: sheet nào che gần hết màn hình cũng coi như modal. Lớp kính tĩnh và
  // việc tạm dừng video nền chạy theo cờ này chứ không theo isAnyModalOpen, vì
  // notes/chat/rooms trên desktop cố ý là widget nền (không làm mờ cảnh).
  const isAnyMobileSheetOpen =
    isTasksOpen ||
    isNotesOpen ||
    isScenesOpen ||
    isSettingsOpen ||
    isStatsOpen ||
    isChatOpen ||
    isMoreOpen ||
    isMixerOpen ||
    isEmbedPlayerOpen ||
    isRoomsOpen;

  return useMemo(
    () => ({
      isTasksOpen,
      setIsTasksOpen,
      handleToggleTasks,
      isNotesOpen,
      setIsNotesOpen,
      handleToggleNotes,
      isScenesOpen,
      setIsScenesOpen,
      handleToggleScenes,
      isMixerOpen,
      setIsMixerOpen,
      handleToggleMixer,
      handleCloseMixer,
      isShortcutsHelpOpen,
      setIsShortcutsHelpOpen,
      handleToggleShortcutsHelp,
      isTourOpen,
      setIsTourOpen,
      isCommandOpen,
      setIsCommandOpen,
      isRoomsOpen,
      setIsRoomsOpen,
      setRoomsOpenGated,
      isChatOpen,
      setIsChatOpen,
      setChatOpenGated,
      isMoreOpen,
      setIsMoreOpen,
      isStatsOpen,
      setIsStatsOpen,
      isSettingsOpen,
      setIsSettingsOpen,
      handleOpenSettings,
      handleCloseSettings,
      handleToggleSettings,
      openPanelOnly,
      isAnyModalOpen,
      isAnyMobileSheetOpen,
    }),
    [
      isTasksOpen,
      handleToggleTasks,
      isNotesOpen,
      handleToggleNotes,
      isScenesOpen,
      handleToggleScenes,
      isMixerOpen,
      handleToggleMixer,
      handleCloseMixer,
      isShortcutsHelpOpen,
      handleToggleShortcutsHelp,
      isTourOpen,
      isCommandOpen,
      isRoomsOpen,
      setRoomsOpenGated,
      isChatOpen,
      setChatOpenGated,
      isMoreOpen,
      isStatsOpen,
      isSettingsOpen,
      handleOpenSettings,
      handleCloseSettings,
      handleToggleSettings,
      openPanelOnly,
      isAnyModalOpen,
      isAnyMobileSheetOpen,
    ]
  );
}
