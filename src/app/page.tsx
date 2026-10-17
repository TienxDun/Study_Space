"use client";

import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { CircleNotchIcon } from "@phosphor-icons/react";
import { StudyBackground } from "@/components/study/StudyBackground";
import { StudyMusicPlayer } from "@/components/study/music/StudyMusicPlayer";
import { StudyPomodoroWidget } from "@/components/study/pomodoro/StudyPomodoroWidget";
import { MobilePomodoroView } from "@/components/study/mobile/pomodoro/MobilePomodoroView";
import { StudySeoSemanticContent } from "@/components/study/seo/StudySeoSemanticContent";
import { StudyShortcutsModal } from "@/components/study/StudyShortcutsModal";
import { StudyOnboardingTour } from "@/components/study/tour/StudyOnboardingTour";
import { StudyDesktopLayout } from "@/components/study/layout/StudyDesktopLayout";
import { StudyMobileLayout } from "@/components/study/layout/StudyMobileLayout";
import { useStudySpaceState } from "@/components/study/hooks/useStudySpaceState";

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

  return (
    <div className="fixed inset-0 sm:relative sm:w-screen sm:h-dvh overflow-hidden bg-slate-950 text-white select-none font-sans">
      {/* Nền bối cảnh chung */}
      <StudyBackground scene={state.currentScene} isBlurActive={state.isAnyModalOpen} />

      {/* Thông báo capsule khi đang tải bối cảnh mới */}
      <AnimatePresence>
        {state.isPreloadingScene && state.pendingScene && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 px-4 py-2 rounded-full bg-black/85 backdrop-blur-2xl border border-white/20 text-white text-xs shadow-[0_12px_40px_rgba(0,0,0,0.8)] pointer-events-none select-none"
          >
            <CircleNotchIcon className="w-3.5 h-3.5 animate-spin text-accent-music-glow shrink-0" />
            <span className="text-slate-200">
              Đang tải bối cảnh <strong className="text-white font-semibold">{state.pendingScene.name}</strong>...
            </span>
            <span className="text-[10px] text-accent-music-bright font-mono bg-white/10 px-1.5 py-0.5 rounded border border-white/10">
              {state.pendingScene.type === "VIDEO" ? "Video" : "Ảnh"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phân tách 2 tầng hiển thị rõ ràng */}
      {!state.isMobile && <StudyDesktopLayout state={state} />}
      {state.isMobile && <StudyMobileLayout state={state} />}

      {/* Khu vực Đồng hồ Pomodoro trung tâm */}
      <main className="relative z-10 w-full h-full flex flex-col items-center justify-center pointer-events-none px-4 pb-14 mobile-content-safe">
        <StudySeoSemanticContent />
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
          if (state.isMobile) {
            state.mobileOpenRoot("rooms", "Phòng học nhóm");
          } else {
            state.setIsRoomsOpen(true);
          }
        }}
        onBack={state.isMobile && state.mobileCanGoBack ? state.handleMobileBack : undefined}
        backLabel={state.isMobile && state.mobileCanGoBack ? state.mobilePrevScreen?.title : undefined}
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
      />
    </div>
  );
}
