"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { CircleNotchIcon } from "@phosphor-icons/react";
import { StudyBackground } from "@/components/study/StudyBackground";
import { SystemBanner } from "@/components/study/SystemBanner";
import { StudyMusicPlayer } from "@/components/study/music/StudyMusicPlayer";
import { StudyPomodoroWidget } from "@/components/study/pomodoro/StudyPomodoroWidget";
import { MobilePomodoroView } from "@/components/study/mobile/pomodoro/MobilePomodoroView";
import { StudySeoSemanticContent } from "@/components/study/seo/StudySeoSemanticContent";
import { StudyShortcutsModal } from "@/components/study/StudyShortcutsModal";
import { StudyOnboardingTour } from "@/components/study/tour/StudyOnboardingTour";
import { StudyDesktopLayout } from "@/components/study/layout/StudyDesktopLayout";
import { StudyMobileLayout } from "@/components/study/layout/StudyMobileLayout";
import { MobileWelcomeScreen } from "@/components/study/mobile/welcome/MobileWelcomeScreen";
import { MobileSplashScreen } from "@/components/study/mobile/splash/MobileSplashScreen";
import { MOBILE_SPLASH_ENABLED } from "@/lib/mobile-splash-flag";
import { MobileLandscapeGuard } from "@/components/study/mobile/MobileLandscapeGuard";
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

  return (
    <div className="fixed inset-0 sm:relative sm:w-screen sm:h-dvh overflow-hidden bg-slate-950 text-white select-none font-sans">
      {/* Nền bối cảnh chung */}
      <StudyBackground
        scene={state.currentScene}
        isBlurActive={state.isAnyModalOpen}
        isMobile={state.isMobile}
        onLoaded={() => setIsBackgroundReady(true)}
      />

      {/* Thông báo bảo trì / banner chung từ cờ hệ thống */}
      <SystemBanner flags={state.systemFlags} />

      {/* Thông báo capsule khi đang tải bối cảnh mới */}
      <AnimatePresence>
        {state.isPreloadingScene && state.pendingScene && (
          <motion.div
            initial={state.isMobile ? { opacity: 0, y: -12, scale: 0.95 } : { opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={state.isMobile ? { opacity: 0, y: -12, scale: 0.95 } : { opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed top-[calc(env(safe-area-inset-top,0px)+3.75rem)] sm:top-auto sm:bottom-24 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-black/85 backdrop-blur-2xl border border-white/20 text-white text-xs shadow-[0_12px_40px_rgba(0,0,0,0.8)] pointer-events-none select-none max-w-[calc(100vw-2rem)] w-max"
          >
            <CircleNotchIcon className="w-3.5 h-3.5 animate-spin text-accent-music-glow shrink-0" />
            <span className="text-slate-200 truncate max-w-[190px] sm:max-w-none">
              Đang tải <strong className="text-white font-semibold">{state.pendingScene.name}</strong>...
            </span>
            <span className="shrink-0 text-[10px] text-accent-music-bright font-mono bg-white/10 px-1.5 py-0.5 rounded border border-white/10">
              {state.pendingScene.type === "VIDEO" ? "Video" : "Ảnh"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phân tách 2 tầng hiển thị rõ ràng */}
      {!state.isMobile && <StudyDesktopLayout state={state} />}
      {state.isMobile && <StudyMobileLayout state={state} hasEntered={hasEntered} />}

      {/* Màn hình khởi động Splash Screen chuẩn nhận diện thương hiệu cho Mobile (tự ẩn trên Desktop bằng CSS sm:hidden, hỗ trợ xem thử qua ?splash=preview) */}
      {MOBILE_SPLASH_ENABLED && (
        <MobileSplashScreen
          preview={isSplashPreview}
          isReady={isBackgroundReady && !state.isPreloadingScene}
          onFinish={() => {
            try {
              const isWelcomeDone = Boolean(
                localStorage.getItem(STORAGE_KEYS.mobileWelcomeCompleted) ||
                sessionStorage.getItem(STORAGE_KEYS.mobileWelcomeCompleted)
              );
              if (isWelcomeDone) {
                setHasEntered(true);
              }
            } catch {
              setHasEntered(true);
            }
          }}
        />
      )}

      {/* Màn hình chào mừng Welcome / Onboarding Screen chuyên nghiệp cho Mobile */}
      {state.isMobile && !isSplashPreview && (
        <MobileWelcomeScreen
          sceneName={state.currentScene?.name}
          onSelectScene={state.setCurrentSceneDirectly}
          onStart={() => setHasEntered(true)}
        />
      )}

      {/* Khu vực Đồng hồ Pomodoro trung tâm - Hiệu ứng trượt từ dưới lên (Fly in from bottom) */}
      <main className="relative z-10 w-full h-full flex flex-col items-center justify-center pointer-events-none px-4 pb-14 mobile-content-safe">
        <StudySeoSemanticContent />
        <motion.div
          initial={{ opacity: 0, y: 35 }}
          animate={{
            opacity: state.isMobile ? (hasEntered ? 1 : 0) : 1,
            y: state.isMobile ? (hasEntered ? 0 : 35) : 0,
          }}
          transition={{
            duration: 0.55,
            delay: state.isMobile && hasEntered ? 0.22 : 0,
            ease: [0.16, 1, 0.3, 1],
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
        onClose={state.isMobile ? state.handleMobileCloseAllSheets : () => state.setIsRoomsOpen(false)}
        onOpen={() => {
          if (!state.systemFlags.roomsEnabled) return;
          if (state.isMobile) {
            state.mobileOpenRoot("rooms", "Phòng học nhóm");
          } else {
            state.setIsRoomsOpen(true);
          }
        }}
        onBack={state.isMobile && state.mobileCanGoBack ? state.handleMobileBack : undefined}
        backLabel={state.isMobile && state.mobileCanGoBack ? state.mobilePrevScreen?.title : undefined}
        soundEnabled={state.soundEnabled}
        soundType={state.soundType}
      />

      {/* Bảng phím tắt bàn phím */}
      <StudyShortcutsModal
        isOpen={state.isShortcutsHelpOpen}
        onClose={() => state.setIsShortcutsHelpOpen(false)}
        onOpenTour={() => state.setIsTourOpen(true)}
      />

      {/* Tour giới thiệu tính năng */}
      <StudyOnboardingTour
        isOpen={state.isTourOpen ? true : undefined}
        onClose={() => state.setIsTourOpen(false)}
        onOpenScenes={() => state.setIsScenesOpen(true)}
        onOpenMixer={() => state.setIsMixerOpen(true)}
        onTogglePomodoro={() => state.setIsPomodoroVisible((v) => !v)}
        onOpenChat={() => state.setIsChatOpen(true)}
        onOpenTasks={() => state.setIsTasksOpen(true)}
        onOpenNotes={() => state.setIsNotesOpen(true)}
        onOpenShortcuts={() => state.setIsShortcutsHelpOpen(true)}
      />

      {/* Chặn thao tác khi điện thoại đang xoay ngang (UI mobile chỉ tối ưu cho màn hình dọc) */}
      <MobileLandscapeGuard />
    </div>
  );
}
