"use client";

import { useState, useCallback, useMemo } from "react";
import type { SystemFlags } from "@/lib/system-flags";

export type FloatingPanelId = "tasks" | "notes" | "rooms";

const BASE_FLOATING_Z_INDEX = 50;
const FLOATING_Z_INDEX_STEP = 5;

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
  const [isTasksOpen, setIsTasksOpenRaw] = useState(false);
  const [isNotesOpen, setIsNotesOpenRaw] = useState(false);
  const [isScenesOpen, setIsScenesOpen] = useState(false);
  const [isMixerOpen, setIsMixerOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isRoomsOpen, setIsRoomsOpenRaw] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Thứ tự hiển thị nổi (z-index) cho các bảng desktop: cái nào mở sau hoặc được click vào sẽ ở trên cùng
  const [panelStack, setPanelStack] = useState<FloatingPanelId[]>(["tasks", "notes", "rooms"]);

  const bringPanelToFront = useCallback((id: FloatingPanelId) => {
    setPanelStack((prev) => {
      if (prev[prev.length - 1] === id) return prev;
      return [...prev.filter((p) => p !== id), id];
    });
  }, []);

  const getPanelZIndex = useCallback(
    (id: FloatingPanelId): number => {
      const index = panelStack.indexOf(id);
      if (index === -1) return BASE_FLOATING_Z_INDEX;
      return BASE_FLOATING_Z_INDEX + index * FLOATING_Z_INDEX_STEP;
    },
    [panelStack]
  );

  const setIsTasksOpen = useCallback<React.Dispatch<React.SetStateAction<boolean>>>(
    (value) => {
      setIsTasksOpenRaw((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        if (next && !prev) {
          bringPanelToFront("tasks");
        }
        return next;
      });
    },
    [bringPanelToFront]
  );

  const setIsNotesOpen = useCallback<React.Dispatch<React.SetStateAction<boolean>>>(
    (value) => {
      setIsNotesOpenRaw((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        if (next && !prev) {
          bringPanelToFront("notes");
        }
        return next;
      });
    },
    [bringPanelToFront]
  );

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
      setIsRoomsOpenRaw((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        const gated = systemFlags.roomsEnabled ? next : false;
        if (gated && !prev) {
          bringPanelToFront("rooms");
        }
        return gated;
      });
    },
    [systemFlags.roomsEnabled, bringPanelToFront]
  );

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
    setIsMixerOpen(false);
    setIsTasksOpenRaw(false);
    setIsNotesOpenRaw(false);
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
    setIsTasksOpenRaw((prev) => {
      const next = !prev;
      if (next) {
        handleCloseSettings();
        bringPanelToFront("tasks");
      }
      return next;
    });
    setIsScenesOpen(false);
    setIsMixerOpen(false);
  }, [handleCloseSettings, bringPanelToFront]);

  const handleToggleNotes = useCallback(() => {
    setIsNotesOpenRaw((prev) => {
      const next = !prev;
      if (next) {
        handleCloseSettings();
        bringPanelToFront("notes");
      }
      return next;
    });
    setIsScenesOpen(false);
    setIsMixerOpen(false);
  }, [handleCloseSettings, bringPanelToFront]);

  const handleToggleScenes = useCallback(() => {
    setIsScenesOpen((prev) => {
      const next = !prev;
      if (next) handleCloseSettings();
      return next;
    });
    setIsTasksOpenRaw(false);
    setIsNotesOpenRaw(false);
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
          setIsTasksOpenRaw(false);
          setIsNotesOpenRaw(false);
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
      if (setter !== setIsNotesOpen && setter !== setIsNotesOpenRaw) setIsNotesOpenRaw(false);
      if (setter !== setIsTasksOpen && setter !== setIsTasksOpenRaw) setIsTasksOpenRaw(false);
      setIsScenesOpen(false);
      setIsMixerOpen(false);
      onCloseEmbed?.();
      setIsRoomsOpenRaw(false);
      setIsChatOpen(false);
      setter(true);
    },
    [handleCloseSettings, onCloseEmbed, setIsNotesOpen, setIsTasksOpen]
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
      setIsRoomsOpen: setRoomsOpenGated,
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
      bringPanelToFront,
      getPanelZIndex,
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
      bringPanelToFront,
      getPanelZIndex,
    ]
  );
}
