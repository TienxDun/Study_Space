"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { CircleNotchIcon } from "@phosphor-icons/react";
import { StudyBackground } from "@/components/study/StudyBackground";
import { MobilePerfProbe } from "@/components/study/mobile/perf/MobilePerfProbe";
import { SystemBanner } from "@/components/study/SystemBanner";
import { StudyMusicPlayer } from "@/components/study/music/StudyMusicPlayer";
import { StudyPomodoroWidget } from "@/components/study/pomodoro/StudyPomodoroWidget";
import { MobilePomodoroView } from "@/components/study/mobile/pomodoro/MobilePomodoroView";
import { StudySeoSemanticContent } from "@/components/study/seo/StudySeoSemanticContent";
import { StudyDesktopLayout } from "@/components/study/layout/StudyDesktopLayout";
import { StudyMobileLayout } from "@/components/study/layout/StudyMobileLayout";
import { MOBILE_SPLASH_ENABLED } from "@/lib/mobile-splash-flag";
import { useStudySpaceState } from "@/components/study/hooks/useStudySpaceState";
import { useContentCatalog } from "@/components/study/hooks/useContentCatalog";
import { useAuth } from "@/lib/use-auth";
import { useCloudSync } from "@/lib/use-cloud-sync";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { initNativeStatusBar } from "@/lib/native-status-bar";

// Dynamic imports cho các widget đa phương tiện dùng chung
const StudyEmbedPlayerWidget = dynamic(
  () => import("@/components/study/embed/StudyEmbedPlayerWidget").then((mod) => mod.StudyEmbedPlayerWidget),
  { ssr: false }
);

const StudyRoomsWidget = dynamic(
  () => import("@/components/study/rooms/StudyRoomsWidget").then((mod) => mod.StudyRoomsWidget),
  { ssr: false }
);

const StudyShortcutsModal = dynamic(
  () => import("@/components/study/StudyShortcutsModal").then((mod) => mod.StudyShortcutsModal),
  { ssr: false }
);

const StudyOnboardingTour = dynamic(
  () => import("@/components/study/tour/StudyOnboardingTour").then((mod) => mod.StudyOnboardingTour),
  { ssr: false }
);

const MobileSplashScreen = dynamic(
  () => import("@/components/study/mobile/splash/MobileSplashScreen").then((mod) => mod.MobileSplashScreen),
  { ssr: false }
);

const MobileWelcomeScreen = dynamic(
  () => import("@/components/study/mobile/welcome/MobileWelcomeScreen").then((mod) => mod.MobileWelcomeScreen),
  { ssr: false }
);

const MobileLandscapeGuard = dynamic(
  () => import("@/components/study/mobile/MobileLandscapeGuard").then((mod) => mod.MobileLandscapeGuard),
  { ssr: false }
);

export default function StudySpacePage() {
  const state = useStudySpaceState();
  // Lấy catalog cảnh/âm thanh/nhạc do admin phát hành (cache trong máy, tự làm mới 1 lần/phiên).
  useContentCatalog();

  // Đồng bộ dữ liệu học tập lên Cloudflare D1 khi đã đăng nhập (localStorage vẫn là bản chính).
  const { user, loading, getToken } = useAuth();
  useCloudSync(user?.uid, loading, getToken);

  // Cho phép xem thử Splash Screen qua URL (?splash=preview, ?splash=true, ?preview=splash)
  const [isSplashPreview, setIsSplashPreview] = useState(false);

  useEffect(() => {
    initNativeStatusBar();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const splash = params.get("splash");
      const preview = params.get("preview");
      if (splash === "preview" || splash === "true" || splash === "1" || preview === "splash") {
        setIsSplashPreview(true);
      }
    }
  }, []);

  // Kiểm soát hiệu ứng hiển thị tuần tự (Fly in from bottom) khi vào trang chính
  const [hasEntered, setHasEntered] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const isWelcomeDone = Boolean(
        localStorage.getItem(STORAGE_KEYS.mobileWelcomeCompleted) ||
        sessionStorage.getItem(STORAGE_KEYS.mobileWelcomeCompleted)
      );
      const isSplashDone = MOBILE_SPLASH_ENABLED
        ? Boolean(sessionStorage.getItem("zenstudy_mobile_splash_completed"))
        : true;
      return isWelcomeDone && isSplashDone;
    } catch {
      return true;
    }
  });

  // Theo dõi trạng thái nạp bối cảnh ban đầu để đồng bộ đóng Splash Screen chuẩn xác
  const [isBackgroundReady, setIsBackgroundReady] = useState(false);

  // Callback ổn định: tránh tạo closure mới mỗi lần state đổi (React.memo của con sẽ vô hiệu)
  const handleBackgroundLoaded = useCallback(() => setIsBackgroundReady(true), []);
  const handleWelcomeStart = useCallback(() => setHasEntered(true), []);
  const handleSplashFinish = useCallback(() => {
    try {
      const isWelcomeDone = Boolean(
        localStorage.getItem(STORAGE_KEYS.mobileWelcomeCompleted) ||
          sessionStorage.getItem(STORAGE_KEYS.mobileWelcomeCompleted)
      );
      if (isWelcomeDone) setHasEntered(true);
    } catch {
      setHasEntered(true);
    }
  }, []);

  const handleCloseRooms = useCallback(() => {
    if (state.isMobile) state.handleMobileCloseAllSheets();
    else state.setIsRoomsOpen(false);
  }, [state.isMobile, state.handleMobileCloseAllSheets, state.setIsRoomsOpen]);

  const handleOpenRooms = useCallback(() => {
    if (!state.systemFlags.roomsEnabled) return;
    if (state.isMobile) state.mobileOpenRoot("rooms", "Phòng học nhóm");
    else state.setIsRoomsOpen(true);
  }, [state.systemFlags.roomsEnabled, state.isMobile, state.mobileOpenRoot, state.setIsRoomsOpen]);

  const handleCloseShortcuts = useCallback(
    () => state.setIsShortcutsHelpOpen(false),
    [state.setIsShortcutsHelpOpen]
  );
  const handleCloseTour = useCallback(() => state.setIsTourOpen(false), [state.setIsTourOpen]);
  const handleOpenTour = useCallback(() => state.setIsTourOpen(true), [state.setIsTourOpen]);

  const handleOpenScenes = useCallback(() => state.setIsScenesOpen(true), [state.setIsScenesOpen]);
  const handleOpenMixer = useCallback(() => state.setIsMixerOpen(true), [state.setIsMixerOpen]);
  const handleTogglePomodoro = useCallback(() => state.setIsPomodoroVisible((v) => !v), [state.setIsPomodoroVisible]);
  const handleOpenChat = useCallback(() => state.setIsChatOpen(true), [state.setIsChatOpen]);
  const handleOpenTasks = useCallback(() => state.setIsTasksOpen(true), [state.setIsTasksOpen]);
  const handleOpenNotes = useCallback(() => state.setIsNotesOpen(true), [state.setIsNotesOpen]);
  const handleOpenShortcuts = useCallback(() => state.setIsShortcutsHelpOpen(true), [state.setIsShortcutsHelpOpen]);

  // Đồng hồ giữa màn: mobile ẩn hẳn (visibility hidden, vẫn mounted để chạy
  // tiếp countdown) khi chưa vào màn hình chính hoặc khi có bảng che nền,
  // khỏi phải vẽ chữ số khổng lồ rò xuyên qua sheet và đỡ tải GPU.
  const isCenterHidden =
    state.isMobile && (!hasEntered || state.isAnyMobileSheetOpen);

  // Chỉ lần hiện đầu tiên sau splash/welcome mới so le 0.22s cho đúng nhịp
  // cũ; các lần đóng sheet sau đó đồng hồ phải hiện ngay theo bảng.
  const [hasRevealedCenter, setHasRevealedCenter] = useState(false);
  useEffect(() => {
    if (!isCenterHidden) setHasRevealedCenter(true);
  }, [isCenterHidden]);
  const centerRevealDelay = state.isMobile && !hasRevealedCenter ? 0.22 : 0;

  return (
    <div className="fixed inset-0 sm:relative sm:w-screen sm:h-dvh overflow-hidden bg-slate-950 text-white select-none font-sans">
      {/* Nền bối cảnh chung */}
      <MobilePerfProbe name="background">
        <StudyBackground
          scene={state.currentScene}
          isBlurActive={state.isMobile ? state.isAnyMobileSheetOpen : state.isAnyModalOpen}
          isMobile={state.isMobile}
          onLoaded={handleBackgroundLoaded}
        />
      </MobilePerfProbe>

      {/* Thông báo bảo trì / banner chung từ cờ hệ thống */}
      <SystemBanner flags={state.systemFlags} />

      {/* Thông báo capsule khi đang tải bối cảnh mới - Chuẩn Kính lỏng (Frosted Liquid Glass) */}
      <AnimatePresence>
        {state.isPreloadingScene && state.pendingScene && (
          <motion.div
            initial={state.isMobile ? { opacity: 0, y: -12, scale: 0.95 } : { opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={state.isMobile ? { opacity: 0, y: -12, scale: 0.95 } : { opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed top-[calc(env(safe-area-inset-top,0px)+3.75rem)] sm:top-auto sm:bottom-24 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-2.5 px-4 py-2 rounded-full surface-frost border border-white/20 text-white text-xs shadow-[0_16px_40px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.35),inset_0_-1px_1px_rgba(0,0,0,0.15)] backdrop-blur-2xl pointer-events-none select-none max-w-[calc(100vw-2rem)] w-max"
          >
            <CircleNotchIcon className="w-4 h-4 animate-spin text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)] shrink-0" />
            <span className="text-slate-200 text-xs tracking-tight truncate max-w-[190px] sm:max-w-none">
              Đang tải <strong className="text-white font-semibold">{state.pendingScene.name}</strong>...
            </span>
            <span className="shrink-0 text-[10px] font-medium text-sky-300 bg-white/[0.08] px-2 py-0.5 rounded-full border border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
              {state.pendingScene.type === "VIDEO" ? "Video" : "Ảnh"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phân tách 2 tầng hiển thị rõ ràng */}
      {!state.isMobile && <StudyDesktopLayout state={state} />}
      {state.isMobile && (
        <MobilePerfProbe name="MOBILE-LAYOUT">
          <StudyMobileLayout state={state} hasEntered={hasEntered} />
        </MobilePerfProbe>
      )}

      {/* Màn hình khởi động Splash Screen chuẩn nhận diện thương hiệu cho Mobile (chỉ render trên Mobile) */}
      {state.isMobile && MOBILE_SPLASH_ENABLED && (
        <MobileSplashScreen
          preview={isSplashPreview}
          isReady={isBackgroundReady && !state.isPreloadingScene}
          onFinish={handleSplashFinish}
        />
      )}

      {/* Màn hình chào mừng Welcome / Onboarding Screen chuyên nghiệp cho Mobile */}
      {state.isMobile && !isSplashPreview && (
        <MobileWelcomeScreen
          sceneName={state.currentScene?.name}
          onSelectScene={state.setCurrentSceneDirectly}
          onStart={handleWelcomeStart}
        />
      )}

      {/* Khu vực Đồng hồ Pomodoro trung tâm - Hiệu ứng trượt từ dưới lên (Fly in from bottom) */}
      <MobilePerfProbe name="center">
      <main className="relative z-10 w-full h-full flex flex-col items-center justify-center pointer-events-none px-4 pb-14 mobile-content-safe">
        <StudySeoSemanticContent />
        <motion.div
          initial={{ opacity: 0, y: 35, visibility: "hidden" }}
          animate={isCenterHidden ? "off" : "on"}
          variants={{
            on: {
              opacity: 1,
              y: 0,
              visibility: "visible",
              transition: { duration: 0.55, delay: centerRevealDelay, ease: [0.16, 1, 0.3, 1] },
            },
            off: {
              opacity: 0,
              transition: { duration: 0.25, ease: "easeIn" },
              transitionEnd: { visibility: "hidden" },
            },
          }}
          className="w-full flex justify-center pointer-events-none"
        >
          <MobilePomodoroView
            className={state.centerTab === "stopwatch" ? "stopwatch-pin-top" : undefined}
          >
            <StudyPomodoroWidget
              isVisible={state.isPomodoroVisible}
              activeTab={state.centerTab}
              onTabChange={state.setCenterTab}
              onToggleVisibility={state.handleWidgetToggleVisibility}
              onRunningChange={state.setIsTimerRunning}
              showClockSeconds={state.showClockSeconds}
              isClock12Hour={state.isClock12Hour}
              showStopwatchMilliseconds={state.showStopwatchMilliseconds}
              durations={state.pomodoroDurations}
              soundEnabled={state.soundEnabled}
              soundType={state.soundType}
            />
          </MobilePomodoroView>
        </motion.div>
      </main>
      </MobilePerfProbe>

      {/* Trình phát nhạc nền Lo-fi (Luôn giữ mounted để không ngắt nhạc khi ẩn UI) */}
      <StudyMusicPlayer
        isGlobalMuted={state.isGlobalMuted}
        onToggleMute={state.toggleGlobalMute}
        onMuteChange={state.setGlobalMute}
        isZenMode={state.isZenMode}
        isMixerOpen={state.isMixerOpen}
        isExternalStreamActive={state.isExternalStreamActive}
        externalStreamItem={state.externalActiveItem}
        onExpandExternalStream={state.handleOpenEmbedRoot}
        onStopExternalStream={state.handleStopExternalStream}
        onToggleMixer={state.handleToggleMixer}
        onCloseMixer={state.handleCloseMixer}
        onBack={state.isMobile && state.mobileCanGoBack ? state.handleMobileBack : undefined}
        backLabel={state.isMobile && state.mobileCanGoBack ? state.mobilePrevScreen?.title : undefined}
        hasEntered={state.isMobile ? hasEntered : true}
      />

      {/* Đài phát video YouTube & Spotify (Dùng chung cho cả 2 layout) */}
      <StudyEmbedPlayerWidget
        isOpen={state.isEmbedPlayerOpen}
        onClose={state.handleCloseEmbed}
        onBack={state.isMobile && state.mobileCanGoBack ? state.handleMobileBack : undefined}
        backLabel={state.isMobile && state.mobileCanGoBack ? state.mobilePrevScreen?.title : undefined}
        onOpen={state.handleOpenEmbedRoot}
        onPipModeChange={state.setIsPipActive}
        activeItem={state.externalActiveItem}
        onStreamActiveChange={state.setIsExternalStreamActive}
        onActiveItemChange={state.setExternalActiveItem}
        isZenMode={state.isZenMode}
      />

      {/* Phòng học nhóm LiveKit WebRTC (Dùng chung) */}
      <StudyRoomsWidget
        isOpen={state.isRoomsOpen}
        onClose={handleCloseRooms}
        onOpen={handleOpenRooms}
        onBack={state.isMobile && state.mobileCanGoBack ? state.handleMobileBack : undefined}
        backLabel={state.isMobile && state.mobileCanGoBack ? state.mobilePrevScreen?.title : undefined}
        soundEnabled={state.soundEnabled}
        soundType={state.soundType}
      />

      {/* Bảng danh sách phím tắt (Tải động khi được kích hoạt bởi phím ? hoặc sự kiện) */}
      {state.isShortcutsHelpOpen && (
        <StudyShortcutsModal
          isOpen={state.isShortcutsHelpOpen}
          onClose={handleCloseShortcuts}
          onOpenTour={handleOpenTour}
        />
      )}

      {/* Tour giới thiệu tính năng (Chỉ dành cho Desktop) */}
      {!state.isMobile && (
        <StudyOnboardingTour
          isOpen={state.isTourOpen ? true : undefined}
          onClose={handleCloseTour}
          onOpenScenes={handleOpenScenes}
          onOpenMixer={handleOpenMixer}
          onTogglePomodoro={handleTogglePomodoro}
          onOpenChat={handleOpenChat}
          onOpenTasks={handleOpenTasks}
          onOpenNotes={handleOpenNotes}
          onOpenShortcuts={handleOpenShortcuts}
        />
      )}

      {/* Chặn thao tác khi điện thoại đang xoay ngang (UI mobile chỉ tối ưu cho màn hình dọc) */}
      {state.isMobile && <MobileLandscapeGuard />}
    </div>
  );
}
