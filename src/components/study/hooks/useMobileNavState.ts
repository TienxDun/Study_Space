"use client";

import { useState, useCallback, useMemo, useRef, useEffect, startTransition } from "react";
import type { MobileNavId } from "@/components/study/mobile/navigation/types";
import type { MobilePanelId } from "@/components/study/mobile/types";
import {
  useMobileStack,
  type MobileStackItem,
} from "@/components/study/mobile/navigation/useMobileStack";
import type { SystemFlags } from "@/lib/system-flags";

interface PanelStateRefs {
  isTasksOpen: boolean;
  isNotesOpen: boolean;
  isScenesOpen: boolean;
  isMixerOpen: boolean;
  isEmbedPlayerOpen: boolean;
  isRoomsOpen: boolean;
  isChatOpen: boolean;
  isMoreOpen: boolean;
  isStatsOpen: boolean;
  isSettingsOpen: boolean;
  isFeedbackOpen: boolean;
}

interface PanelSetters {
  setIsTasksOpen: (v: boolean) => void;
  setIsNotesOpen: (v: boolean) => void;
  setIsScenesOpen: (v: boolean) => void;
  setIsMixerOpen: (v: boolean) => void;
  setIsEmbedPlayerOpen: (v: boolean) => void;
  setIsRoomsOpen: (v: boolean) => void;
  setIsChatOpen: (v: boolean) => void;
  setIsStatsOpen: (v: boolean) => void;
  setIsSettingsOpen: (v: boolean) => void;
  setIsFeedbackOpen: (v: boolean) => void;
  setIsMoreOpen: (v: boolean) => void;
}

interface UseMobileNavStateOptions {
  isMobile: boolean;
  isZenMode: boolean;
  onExitZen: () => void;
  setIsZenMode: (v: boolean) => void;
  systemFlags: SystemFlags;
  panelStates: PanelStateRefs;
  panelSetters: PanelSetters;
  handleTogglePomodoroVisibility: () => void;
  setIsPomodoroVisible: (v: boolean) => void;
}

export function useMobileNavState({
  isMobile,
  isZenMode,
  onExitZen,
  setIsZenMode,
  systemFlags,
  panelStates,
  panelSetters,
  handleTogglePomodoroVisibility,
  setIsPomodoroVisible,
}: UseMobileNavStateOptions) {
  const [isPomodoroNavActive, setIsPomodoroNavActive] = useState(false);

  // Ref lưu trạng thái panels để cắt đứt re-render cascade cho callbacks
  const panelStatesRef = useRef(panelStates);
  const panelSettersRef = useRef(panelSetters);

  useEffect(() => {
    panelStatesRef.current = panelStates;
    panelSettersRef.current = panelSetters;
  });

  // Đồng bộ mở đúng Sheet theo màn hình đỉnh stack mobile
  const syncScreenToStates = useCallback((screen: MobileStackItem | null) => {
    const setters = panelSettersRef.current;
    setters.setIsTasksOpen(false);
    setters.setIsNotesOpen(false);
    setters.setIsScenesOpen(false);
    setters.setIsMixerOpen(false);
    setters.setIsEmbedPlayerOpen(false);
    setters.setIsRoomsOpen(false);
    setters.setIsChatOpen(false);
    setters.setIsStatsOpen(false);
    setters.setIsSettingsOpen(false);
    setters.setIsFeedbackOpen(false);
    setters.setIsMoreOpen(false);

    if (!screen) return;
    setIsPomodoroNavActive(false);
    if (screen.id === "more") setters.setIsMoreOpen(true);
    else if (screen.id === "tasks" || screen.id === "tasks-detail") setters.setIsTasksOpen(true);
    else if (screen.id === "notes" || screen.id === "notes-detail") setters.setIsNotesOpen(true);
    else if (screen.id === "scenes") setters.setIsScenesOpen(true);
    else if (screen.id === "stats") setters.setIsStatsOpen(true);
    else if (screen.id === "settings") setters.setIsSettingsOpen(true);
    else if (screen.id === "feedback") setters.setIsFeedbackOpen(true);
    else if (screen.id === "rooms") setters.setIsRoomsOpen(true);
    else if (screen.id === "chat") setters.setIsChatOpen(true);
    else if (screen.id === "embed") setters.setIsEmbedPlayerOpen(true);
    else if (screen.id === "music") setters.setIsMixerOpen(true);
  }, []);

  // Stack navigation cho mobile với đồng bộ hai chiều
  const {
    currentScreen: mobileCurrentScreen,
    canGoBack: mobileCanGoBack,
    previousScreen: mobilePrevScreen,
    push: mobilePush,
    pop: mobilePop,
    closeAll: mobileCloseAll,
    openRoot: mobileOpenRoot,
  } = useMobileStack({
    isZenMode,
    onExitZen,
    onStackChange: (current) => {
      syncScreenToStates(current);
    },
  });

  const mobileCurrentScreenRef = useRef(mobileCurrentScreen);
  useEffect(() => {
    mobileCurrentScreenRef.current = mobileCurrentScreen;
  }, [mobileCurrentScreen]);

  const handleMobileCloseAllSheets = useCallback(() => {
    mobileCloseAll();
    syncScreenToStates(null);
    setIsPomodoroNavActive(false);
  }, [mobileCloseAll, syncScreenToStates]);

  const handleMobileBack = useCallback(() => {
    if (mobileCanGoBack) {
      mobilePop();
    } else {
      handleMobileCloseAllSheets();
    }
  }, [mobileCanGoBack, mobilePop, handleMobileCloseAllSheets]);

  // Handlers mở màn hình ổn định
  const handleOpenTasksDetail = useCallback(
    () => mobilePush("tasks-detail", "Công việc"),
    [mobilePush]
  );
  const handleOpenNotesDetail = useCallback(
    () => mobilePush("notes-detail", "Ghi chú"),
    [mobilePush]
  );
  const handleCloseDetail = useCallback(() => mobilePop(), [mobilePop]);

  const handleOpenChatRoot = useCallback(() => {
    if (!systemFlags.chatEnabled) return;
    mobileOpenRoot("chat", "Trợ lý AI");
  }, [mobileOpenRoot, systemFlags.chatEnabled]);

  const handleOpenScenesRoot = useCallback(
    () => mobileOpenRoot("scenes", "Không gian"),
    [mobileOpenRoot]
  );

  const handleOpenRoomsRoot = useCallback(() => {
    if (!systemFlags.roomsEnabled) return;
    mobileOpenRoot("rooms", "Phòng học nhóm");
  }, [mobileOpenRoot, systemFlags.roomsEnabled]);

  const handleOpenRadioRoot = useCallback(
    () => mobileOpenRoot("embed", "Đài phát"),
    [mobileOpenRoot]
  );

  const handleOpenStatsRoot = useCallback(
    () => mobileOpenRoot("stats", "Thống kê"),
    [mobileOpenRoot]
  );

  // Tối ưu hóa: đọc sheet states từ ref để không tạo lại callback khi bất kỳ panel nào toggle
  const handleMobileNavSelect = useCallback(
    (id: MobileNavId) => {
      const states = panelStatesRef.current;
      const isAnySheetOpen =
        states.isMoreOpen ||
        states.isTasksOpen ||
        states.isNotesOpen ||
        states.isScenesOpen ||
        states.isMixerOpen ||
        states.isEmbedPlayerOpen ||
        states.isRoomsOpen ||
        states.isChatOpen ||
        states.isStatsOpen ||
        states.isSettingsOpen ||
        states.isFeedbackOpen;

      if (id === "pomodoro") {
        if (isAnySheetOpen) {
          handleMobileCloseAllSheets();
          setIsPomodoroVisible(true);
          setIsPomodoroNavActive(true);
          return;
        }
        handleTogglePomodoroVisibility();
        return;
      }

      setIsPomodoroNavActive(false);

      const isMoreGroupActive =
        states.isMoreOpen ||
        states.isScenesOpen ||
        states.isEmbedPlayerOpen ||
        states.isRoomsOpen ||
        states.isChatOpen ||
        states.isStatsOpen ||
        states.isSettingsOpen ||
        states.isFeedbackOpen;

      const isCurrentlyActive =
        (id === "more" && isMoreGroupActive) ||
        (id === "tasks" && states.isTasksOpen) ||
        (id === "notes" && states.isNotesOpen) ||
        (id === "music" && states.isMixerOpen);

      if (isCurrentlyActive) {
        handleMobileCloseAllSheets();
        return;
      }

      if (id === "more") {
        mobileOpenRoot("more", "Thêm");
      } else if (id === "tasks") {
        mobileOpenRoot("tasks", "Công việc");
      } else if (id === "notes") {
        mobileOpenRoot("notes", "Ghi chú");
      } else if (id === "music") {
        mobileOpenRoot("music", "Nhạc & Âm thanh");
      }
    },
    [
      handleMobileCloseAllSheets,
      handleTogglePomodoroVisibility,
      setIsPomodoroVisible,
      mobileOpenRoot,
    ]
  );

  const handleMoreSelect = useCallback(
    (id: MobilePanelId) => {
      startTransition(() => {
        if (id === "notes") {
          mobilePush("notes", "Ghi chú");
        } else if (id === "scenes") {
          mobilePush("scenes", "Không gian");
        } else if (id === "embed") {
          mobilePush("embed", "Đài phát");
        } else if (id === "rooms") {
          if (systemFlags.roomsEnabled) mobilePush("rooms", "Phòng học nhóm");
        } else if (id === "chat") {
          if (systemFlags.chatEnabled) mobilePush("chat", "Trợ lý AI");
        } else if (id === "settings") {
          mobilePush("settings", "Cài đặt");
        } else if (id === "feedback") {
          mobilePush("feedback", "Gửi góp ý");
        } else if (id === "stats") {
          mobilePush("stats", "Thống kê");
        } else if (id === "pomodoro") {
          handleMobileCloseAllSheets();
          setIsZenMode(true);
        }
      });
    },
    [
      mobilePush,
      handleMobileCloseAllSheets,
      setIsZenMode,
      systemFlags.chatEnabled,
      systemFlags.roomsEnabled,
    ]
  );

  // Tab active của navigation mobile
  const activeNavTab = useMemo<MobileNavId | null>(() => {
    const currentId = mobileCurrentScreen?.id;
    const states = panelStates;
    if (currentId === "tasks" || currentId === "tasks-detail" || states.isTasksOpen) return "tasks";
    if (currentId === "notes" || currentId === "notes-detail" || states.isNotesOpen) return "notes";
    if (currentId === "music" || currentId === "mixer" || states.isMixerOpen) return "music";
    if (
      currentId === "more" ||
      currentId === "scenes" ||
      currentId === "embed" ||
      currentId === "rooms" ||
      currentId === "chat" ||
      currentId === "stats" ||
      currentId === "settings" ||
      currentId === "feedback" ||
      states.isMoreOpen ||
      states.isScenesOpen ||
      states.isEmbedPlayerOpen ||
      states.isRoomsOpen ||
      states.isChatOpen ||
      states.isStatsOpen ||
      states.isSettingsOpen ||
      states.isFeedbackOpen
    ) {
      return "more";
    }
    if (isPomodoroNavActive) {
      return "pomodoro";
    }
    return null;
  }, [
    mobileCurrentScreen,
    panelStates,
    isPomodoroNavActive,
  ]);

  // Lắng nghe sự kiện mở Takenote từ các component khác
  useEffect(() => {
    const handleOpenNotes = () => {
      if (isMobile) {
        if (mobileCurrentScreenRef.current) {
          mobilePush("notes", "Ghi chú");
        } else {
          mobileOpenRoot("notes", "Ghi chú");
        }
      } else {
        panelSettersRef.current.setIsNotesOpen(true);
      }
    };
    window.addEventListener("study-space:open-notes", handleOpenNotes);
    return () => {
      window.removeEventListener("study-space:open-notes", handleOpenNotes);
    };
  }, [isMobile, mobilePush, mobileOpenRoot]);

  // Lắng nghe sự kiện gửi ghi chú sang Trợ lý AI
  useEffect(() => {
    const handleSendToChat = () => {
      if (!systemFlags.chatEnabled) return;
      if (isMobile) {
        if (mobileCurrentScreenRef.current) {
          mobilePush("chat", "Trợ lý AI");
        } else {
          mobileOpenRoot("chat", "Trợ lý AI");
        }
      } else {
        panelSettersRef.current.setIsChatOpen(true);
      }
    };
    window.addEventListener("study-space:send-to-chat", handleSendToChat);
    return () => {
      window.removeEventListener("study-space:send-to-chat", handleSendToChat);
    };
  }, [isMobile, mobilePush, mobileOpenRoot, systemFlags.chatEnabled]);

  return useMemo(
    () => ({
      isPomodoroNavActive,
      setIsPomodoroNavActive,
      mobileCurrentScreen,
      mobileCanGoBack,
      mobilePrevScreen,
      mobilePush,
      mobilePop,
      mobileOpenRoot,
      handleMobileBack,
      handleMobileCloseAllSheets,
      handleOpenTasksDetail,
      handleOpenNotesDetail,
      handleCloseDetail,
      handleOpenChatRoot,
      handleOpenScenesRoot,
      handleOpenRoomsRoot,
      handleOpenRadioRoot,
      handleOpenStatsRoot,
      handleMobileNavSelect,
      handleMoreSelect,
      activeNavTab,
      syncScreenToStates,
    }),
    [
      isPomodoroNavActive,
      mobileCurrentScreen,
      mobileCanGoBack,
      mobilePrevScreen,
      mobilePush,
      mobilePop,
      mobileOpenRoot,
      handleMobileBack,
      handleMobileCloseAllSheets,
      handleOpenTasksDetail,
      handleOpenNotesDetail,
      handleCloseDetail,
      handleOpenChatRoot,
      handleOpenScenesRoot,
      handleOpenRoomsRoot,
      handleOpenRadioRoot,
      handleOpenStatsRoot,
      handleMobileNavSelect,
      handleMoreSelect,
      activeNavTab,
      syncScreenToStates,
    ]
  );
}
