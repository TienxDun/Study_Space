"use client";

import { useState, useEffect, useCallback, useTransition, useRef } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import {
  XIcon,
  CaretRightIcon,
  CaretLeftIcon,
  SparkleIcon,
  CheckCircleIcon,
  CircleIcon,
  CaretUpIcon,
  ArrowSquareOutIcon,
} from "@phosphor-icons/react";
import { ZenStudyLogo } from "../brand/ZenStudyLogo";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { TOUR_GROUPS, QUEST_TASKS } from "./constants";
import type { StudyOnboardingTourProps } from "./types";

export function StudyOnboardingTour({
  isOpen: externalIsOpen,
  onClose: externalOnClose,
  onOpenScenes,
  onOpenMixer,
  onTogglePomodoro,
  onOpenChat,
}: StudyOnboardingTourProps) {
  // Trạng thái Welcome Modal (Kiểu B)
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [, startTransition] = useTransition();

  // Trạng thái Bảng nhiệm vụ làm quen (Kiểu C)
  const [isQuestVisible, setIsQuestVisible] = useState(false);
  const [isQuestMinimized, setIsQuestMinimized] = useState(false);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [isQuestDragging, setIsQuestDragging] = useState(false);
  const questDragControls = useDragControls();
  const isPillDragMoveRef = useRef(false);

  // Giữ thẻ nhiệm vụ không bị kéo lọt ra ngoài màn hình máy tính (tính từ tâm màn hình)
  const clampQuestPos = useCallback((x: number, y: number) => {
    if (typeof window === "undefined") return { x, y };
    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;
    // Bảng rộng 340px -> nửa chiều rộng là 170px, chừa lề tối thiểu 20px
    const maxHoriz = Math.max(0, halfW - 170 - 20);
    // Bảng cao ~380px -> nửa chiều cao là 190px, chừa lề tối thiểu 20px
    const maxVert = Math.max(0, halfH - 190 - 20);
    return {
      x: Math.round(Math.max(-maxHoriz, Math.min(maxHoriz, x))),
      y: Math.round(Math.max(-maxVert, Math.min(maxVert, y))),
    };
  }, []);

  // Tọa độ kéo thả của bảng nhiệm vụ (gốc tọa độ đặt ở chính giữa màn hình)
  const [questPos, setQuestPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.tourQuestPos);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
            const halfW = window.innerWidth / 2;
            const halfH = window.innerHeight / 2;
            if (Math.abs(parsed.x) < halfW && Math.abs(parsed.y) < halfH) {
              return parsed;
            }
          }
        }
      } catch {}
    }
    return { x: 0, y: 0 };
  });

  const isModalActive =
    externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  // 1. Tự động kích hoạt khi người dùng lần đầu truy cập trang web
  useEffect(() => {
    if (externalIsOpen !== undefined) return;
    try {
      const tourDone = localStorage.getItem(STORAGE_KEYS.tourCompleted);
      if (!tourDone) {
        // Chờ 750ms để các thanh dock và giao diện desktop ổn định vị trí
        const timer = setTimeout(() => {
          setInternalIsOpen(true);
        }, 750);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, [externalIsOpen]);

  // Đồng bộ mở modal khi prop từ bên ngoài thay đổi (ví dụ: bấm Xem lại tour)
  useEffect(() => {
    if (externalIsOpen === true) {
      setCurrentGroupIndex(0);
      setInternalIsOpen(true);
      setIsQuestVisible(true);
      setIsQuestMinimized(false);
      setQuestPos({ x: 0, y: 0 });
    } else if (externalIsOpen === false) {
      setInternalIsOpen(false);
    }
  }, [externalIsOpen]);

  // Đọc trạng thái nhiệm vụ đã hoàn thành từ LocalStorage
  useEffect(() => {
    try {
      const savedTasks = localStorage.getItem(STORAGE_KEYS.tourQuestState);
      if (savedTasks) {
        setCompletedTaskIds(JSON.parse(savedTasks));
      }
      const savedMinimized = localStorage.getItem(STORAGE_KEYS.tourQuestMinimized);
      if (savedMinimized === "true") {
        setIsQuestMinimized(true);
      }
    } catch {}
  }, []);

  // Đóng Welcome Modal và kích hoạt mở Bảng nhiệm vụ làm quen ở chính giữa màn hình
  const handleCompleteModal = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.tourCompleted, "true");
      localStorage.removeItem(STORAGE_KEYS.tourQuestPos);
    } catch {}

    setQuestPos({ x: 0, y: 0 });
    setInternalIsOpen(false);
    setIsQuestVisible(true);
    setIsQuestMinimized(false);

    if (externalOnClose) {
      externalOnClose();
    }
  }, [externalOnClose]);

  // Đóng hẳn cả Welcome Modal mà không mở bảng nhiệm vụ
  const handleDismissAll = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.tourCompleted, "true");
    } catch {}

    setInternalIsOpen(false);
    setIsQuestVisible(false);

    if (externalOnClose) {
      externalOnClose();
    }
  }, [externalOnClose]);

  // Điều khiển chuyển nhóm tính năng trong Modal
  const handleNextGroup = () => {
    if (currentGroupIndex < TOUR_GROUPS.length - 1) {
      startTransition(() => setCurrentGroupIndex((prev) => prev + 1));
    } else {
      handleCompleteModal();
    }
  };

  const handlePrevGroup = () => {
    if (currentGroupIndex > 0) {
      startTransition(() => setCurrentGroupIndex((prev) => prev - 1));
    }
  };

  // Điều hướng bằng bàn phím cho Modal
  useEffect(() => {
    if (!isModalActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleDismissAll();
      } else if (e.key === "ArrowRight") {
        if (currentGroupIndex < TOUR_GROUPS.length - 1) {
          startTransition(() => setCurrentGroupIndex((prev) => prev + 1));
        } else {
          handleCompleteModal();
        }
      } else if (e.key === "ArrowLeft") {
        if (currentGroupIndex > 0) {
          startTransition(() => setCurrentGroupIndex((prev) => prev - 1));
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalActive, currentGroupIndex, handleCompleteModal, handleDismissAll]);

  // Thao tác đánh dấu nhiệm vụ hoàn thành
  const toggleTaskCompleted = useCallback((taskId: string) => {
    setCompletedTaskIds((prev) => {
      const isAlreadyDone = prev.includes(taskId);
      const next = isAlreadyDone
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId];
      try {
        localStorage.setItem(STORAGE_KEYS.tourQuestState, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // Xử lý nút "Thử ngay" tương tác trực tiếp từng tính năng
  const handleTriggerAction = (taskId: string) => {
    toggleTaskCompleted(taskId);

    if (taskId === "quest-scene") {
      onOpenScenes?.();
    } else if (taskId === "quest-mixer") {
      onOpenMixer?.();
    } else if (taskId === "quest-pomodoro") {
      onTogglePomodoro?.();
    } else if (taskId === "quest-chat") {
      onOpenChat?.();
    }
  };

  // Thu nhỏ hoặc mở rộng bảng nhiệm vụ
  const handleToggleMinimizeQuest = () => {
    setIsQuestMinimized((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.tourQuestMinimized, String(next));
      } catch {}
      return next;
    });
  };

  const currentGroup = TOUR_GROUPS[currentGroupIndex] || TOUR_GROUPS[0];
  const isLastGroup = currentGroupIndex === TOUR_GROUPS.length - 1;
  const completedCount = completedTaskIds.length;
  const totalTasks = QUEST_TASKS.length;
  const isAllTasksDone = completedCount >= totalTasks;

  return (
    <div className="hidden sm:block select-none font-sans">
      {/* ================================================================= */}
      {/* KIỂU B: HỘP THOẠI CHÀO MỪNG CHÍNH GIỮA MÀN HÌNH (WELCOME MODAL)     */}
      {/* ================================================================= */}
      <AnimatePresence>
        {isModalActive && (
          <div className="fixed inset-0 z-[99990] flex items-center justify-center p-4">
            {/* Lớp nền phủ Dark Glassmorphism mờ sương đêm cho toàn màn hình */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={handleDismissAll}
              className="absolute inset-0 bg-black/55 backdrop-blur-md"
            />

              {/* Hộp thoại kính mờ bóng đêm chuẩn mực (Dark Glassmorphism glass-panel) */}
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 16 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="relative z-10 w-full max-w-2xl sm:max-w-[720px] glass-panel hover:bg-black/45 p-6 sm:p-7 text-white overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.2)] focus:outline-none"
              >
                {/* Vệt ánh sáng viền phản xạ quang học trên đỉnh kính */}
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none z-10"
                />

                {/* Header Modal */}
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center shrink-0">
                      <ZenStudyLogo
                        variant="icon"
                        className="w-10 h-10 object-contain drop-shadow-[0_0_12px_rgba(56,189,248,0.35)]"
                      />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                        Chào bạn tới ZenStudy Space
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                        Không gian học tập và làm việc tập trung tất-cả-trong-một
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleDismissAll}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                    title="Đóng / Bỏ qua (Esc)"
                    aria-label="Đóng hướng dẫn"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Thanh chọn 3 nhóm tính năng (Tabs / Pills) */}
                <div className="grid grid-cols-3 gap-2 mt-5">
                  {TOUR_GROUPS.map((group, index) => {
                    const isActive = index === currentGroupIndex;
                    return (
                      <button
                        key={group.id}
                        onClick={() =>
                          startTransition(() => setCurrentGroupIndex(index))
                        }
                        className={`px-3 py-2 rounded-xl text-left transition-all cursor-pointer border backdrop-blur-md ${
                          isActive
                            ? "bg-white/15 border-sky-400/50 text-white shadow-sm"
                            : "bg-white/[0.04] border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/[0.08]"
                        }`}
                      >
                        <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-sky-400">
                          {`Nhóm ${index + 1}`}
                        </div>
                        <div className="text-xs font-semibold truncate mt-0.5">
                          {group.categoryBadge}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Giới thiệu nhóm tính năng đang chọn */}
                <div className="mt-4">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>{currentGroup.categoryTitle}</span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {currentGroup.categorySubtitle}
                  </p>
                </div>

                {/* Danh sách các thẻ tính năng (Feature Cards Grid) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-4">
                  {currentGroup.features.map((feature) => (
                    <div
                      key={feature.id}
                      title={feature.description}
                      className="p-3 sm:p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all flex items-start gap-3 min-h-[78px]"
                    >
                      <div className="w-9 h-9 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center shrink-0 shadow-inner mt-0.5">
                        {feature.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-semibold text-xs sm:text-[13px] text-slate-100 truncate">
                            {feature.title}
                          </span>
                          {feature.shortcut && (
                            <kbd className="px-1.5 py-0.5 rounded-md bg-white/15 text-white font-mono text-[10px] font-semibold border border-white/25 shadow-xs shrink-0">
                              {feature.shortcut}
                            </kbd>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-300/80 mt-1 leading-snug line-clamp-2 sm:line-clamp-none">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

              {/* Footer Modal: Tiến độ & Nút điều hướng */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
                {/* Chỉ số nhóm */}
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-slate-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full select-none">
                    {`${currentGroupIndex + 1} / ${TOUR_GROUPS.length}`}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {TOUR_GROUPS.map((_, idx) => (
                      <span
                        key={idx}
                        className={`w-2 h-2 rounded-full transition-all ${
                          idx === currentGroupIndex
                            ? "w-6 bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]"
                            : "bg-white/20"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Cụm nút bấm */}
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handlePrevGroup}
                    disabled={currentGroupIndex === 0}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                      currentGroupIndex === 0
                        ? "opacity-25 cursor-not-allowed text-slate-500 border border-transparent"
                        : "text-slate-300 hover:text-white bg-white/6 hover:bg-white/12 border border-white/12 cursor-pointer active:scale-95 shadow-xs"
                    }`}
                  >
                    <CaretLeftIcon className="w-3.5 h-3.5" />
                    <span>Quay lại</span>
                  </button>

                  <button
                    onClick={handleNextGroup}
                    className="relative px-5 py-2 rounded-full text-xs font-semibold text-slate-950 bg-white hover:bg-slate-100 active:scale-95 transition-all duration-200 cursor-pointer flex items-center gap-1.5 shadow-[0_2px_14px_rgba(255,255,255,0.22),inset_0_1px_1px_rgba(255,255,255,1)] hover:shadow-[0_4px_20px_rgba(255,255,255,0.35)] border border-white/80"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>{isLastGroup ? "Bắt đầu làm quen" : "Tiếp tục"}</span>
                      {isLastGroup ? (
                        <SparkleIcon className="w-3.5 h-3.5 text-slate-900" weight="fill" />
                      ) : (
                        <CaretRightIcon className="w-3.5 h-3.5 text-slate-900" weight="bold" />
                      )}
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================================================================= */}
      {/* KIỂU C: BẢNG NHIỆM VỤ LÀM QUEN TƯƠNG TÁC (INTERACTIVE QUEST CARD)   */}
      {/* ================================================================= */}
      <AnimatePresence>
        {isQuestVisible && !isModalActive && (
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 select-none pointer-events-none">
            {isQuestMinimized ? (
              /* Trạng thái thu nhỏ (Pill Capsule - Kéo thả di chuyển được) */
              <motion.button
                drag
                dragMomentum={false}
                dragElastic={0.06}
                onDragStart={() => {
                  isPillDragMoveRef.current = false;
                  setIsQuestDragging(true);
                }}
                onDragEnd={(_, info) => {
                  setIsQuestDragging(false);
                  if (Math.hypot(info.offset.x, info.offset.y) > 4) {
                    isPillDragMoveRef.current = true;
                    setQuestPos((prev) => {
                      const next = clampQuestPos(prev.x + info.offset.x, prev.y + info.offset.y);
                      try {
                        localStorage.setItem(STORAGE_KEYS.tourQuestPos, JSON.stringify(next));
                      } catch {}
                      return next;
                    });
                  }
                }}
                style={{ x: questPos.x, y: questPos.y }}
                initial={{ opacity: 0, scale: 0.85, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: 10 }}
                onClick={() => {
                  if (isPillDragMoveRef.current) {
                    isPillDragMoveRef.current = false;
                    return;
                  }
                  handleToggleMinimizeQuest();
                }}
                className="pointer-events-auto group flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/60 hover:bg-black/75 backdrop-blur-2xl border border-sky-400/40 text-white shadow-[0_12px_32px_rgba(0,0,0,0.6)] hover:border-sky-400/70 hover:scale-105 active:scale-95 transition-all cursor-grab active:cursor-grabbing"
                title="Nhấn để mở rộng, hoặc nhấn giữ để kéo di chuyển"
              >
                <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)] animate-pulse" />
                <span className="text-xs font-semibold text-slate-100 group-hover:text-white">
                  Nhiệm vụ làm quen
                </span>
                <span className="font-mono text-[11px] font-bold text-sky-400 bg-white/10 px-2 py-0.5 rounded-full border border-white/10">
                  {`${completedCount}/${totalTasks}`}
                </span>
                <CaretUpIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
              </motion.button>
            ) : (
              /* Trạng thái mở rộng (Expanded Card - Đồng bộ style macOS Window với Sticky Note) */
              <motion.div
                drag
                dragControls={questDragControls}
                dragListener={false}
                dragMomentum={false}
                dragElastic={0.06}
                onDragStart={() => setIsQuestDragging(true)}
                onDragEnd={(_, info) => {
                  setIsQuestDragging(false);
                  if (Math.hypot(info.offset.x, info.offset.y) < 2) return;
                  setQuestPos((prev) => {
                    const next = clampQuestPos(prev.x + info.offset.x, prev.y + info.offset.y);
                    try {
                      localStorage.setItem(STORAGE_KEYS.tourQuestPos, JSON.stringify(next));
                    } catch {}
                    return next;
                  });
                }}
                style={{ x: questPos.x, y: questPos.y }}
                initial={{ opacity: 0, scale: 0.9, y: 14 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 14 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className={`pointer-events-auto relative w-[340px] rounded-3xl backdrop-blur-2xl border flex flex-col overflow-hidden select-none focus:outline-none group/compact ${
                  isQuestDragging
                    ? "shadow-[0_30px_80px_rgba(0,0,0,0.65)] ring-2 ring-sky-500/40 cursor-grabbing border-white/20"
                    : "transition-colors duration-150 shadow-[0_20px_50px_rgba(0,0,0,0.6)] border-white/15"
                } bg-black/60 hover:bg-black/65 text-white`}
              >
                {/* Vệt ánh sáng viền phản xạ quang học trên đỉnh kính */}
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none z-10"
                />

                {/* 1. Header Bar: Grid 3 cột chuẩn macOS Window với thanh kéo Drag Indicator ở giữa */}
                <div
                  onPointerDown={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest("button") || target.closest("input") || target.closest("[role='button']")) {
                      return;
                    }
                    questDragControls.start(e, { snapToCursor: false });
                  }}
                  className="relative px-3 py-2 border-b grid grid-cols-[minmax(96px,1fr)_auto_minmax(96px,1fr)] items-center gap-2 shrink-0 select-none touch-none cursor-grab active:cursor-grabbing group/compact border-white/10 bg-white/[0.03]"
                  title="Nhấn giữ & kéo thả để di chuyển bảng nhiệm vụ"
                >
                  {/* Cột trái: Nhãn hành trình làm quen */}
                  <div className="flex items-center min-w-0 max-w-full justify-self-start">
                    <span className="text-xs font-semibold text-slate-200 truncate px-1">
                      Làm quen
                    </span>
                  </div>

                  {/* Cột giữa: Thanh kéo Drag Indicator - căn giữa đối xứng chuẩn xác */}
                  <div className="flex items-center justify-center h-full px-2 min-w-0 pointer-events-none select-none transition-all duration-200 justify-self-center col-start-2">
                    <div
                      className={`h-1 rounded-full transition-all duration-200 ${
                        isQuestDragging
                          ? "w-9 bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.9)]"
                          : "w-7 bg-white/20 group-hover/compact:bg-white/40 group-hover/compact:w-9"
                      }`}
                    />
                  </div>

                  {/* Cột phải: Nút đóng bảng nhiệm vụ */}
                  <div className="flex items-center gap-1.5 shrink-0 justify-self-end col-start-3">
                    <button
                      type="button"
                      onClick={() => setIsQuestVisible(false)}
                      className="w-7 h-7 rounded-xl border transition-colors flex items-center justify-center cursor-pointer hover:bg-rose-500/10 border-white/10 text-slate-400 hover:text-rose-400 hover:border-rose-500/30"
                      title="Đóng bảng nhiệm vụ"
                    >
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 2. Sub-header: Thanh hiển thị tiến độ và chỉ số phần trăm */}
                <div className="px-3 py-1.5 border-b flex items-center justify-between gap-2 shrink-0 border-white/10 bg-white/[0.03]">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Tiến độ</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-mono text-[10px] font-bold">
                      {`${completedCount}/${totalTasks} việc`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 rounded-full transition-all duration-300"
                        style={{
                          width: `${(completedCount / totalTasks) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="font-mono text-[10px] font-bold text-slate-300">
                      {`${Math.round((completedCount / totalTasks) * 100)}%`}
                    </span>
                  </div>
                </div>

                {/* 3. Danh sách 4 nhiệm vụ khám phá */}
                <div className="p-3 space-y-2 overflow-y-auto custom-study-scroll max-h-[300px]">
                  {QUEST_TASKS.map((task) => {
                    const isDone = completedTaskIds.includes(task.id);
                    return (
                      <div
                        key={task.id}
                        className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                          isDone
                            ? "bg-emerald-500/[0.06] border-emerald-400/20 text-slate-300"
                            : "bg-white/[0.03] border-white/10 text-white hover:bg-white/[0.06] hover:border-white/15"
                        }`}
                      >
                        <div
                          onClick={() => toggleTaskCompleted(task.id)}
                          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer select-none"
                        >
                          <button
                            type="button"
                            className="shrink-0 text-emerald-400 cursor-pointer"
                            title={isDone ? "Đã xong (Bấm để hoàn tác)" : "Chưa xong (Bấm để hoàn thành)"}
                          >
                            {isDone ? (
                              <CheckCircleIcon className="w-4 h-4 fill-emerald-400 text-black" />
                            ) : (
                              <CircleIcon className="w-4 h-4 text-slate-500 hover:text-slate-300 transition-colors" />
                            )}
                          </button>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="shrink-0">{task.icon}</span>
                              <span
                                className={`text-xs font-medium truncate ${
                                  isDone
                                    ? "line-through text-slate-400"
                                    : "text-slate-100"
                                }`}
                              >
                                {task.title}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                              {task.hint}
                            </span>
                          </div>
                        </div>

                        {/* Nút Thử ngay */}
                        <button
                          type="button"
                          onClick={() => handleTriggerAction(task.id)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white bg-white/10 hover:bg-emerald-500/20 hover:text-emerald-300 border border-white/12 hover:border-emerald-400/40 transition-all cursor-pointer shrink-0 flex items-center gap-1 active:scale-95 shadow-xs"
                          title={`Mở tính năng (Phím tắt: ${task.shortcut})`}
                        >
                          <span>Thử</span>
                          <ArrowSquareOutIcon className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* 4. Footer Bar: Đồng bộ với chân trang Sticky Note */}
                <div className="px-3 py-1.5 border-t flex items-center justify-between text-xs select-none shrink-0 border-white/10 bg-white/[0.02] text-slate-400">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentGroupIndex(0);
                      setInternalIsOpen(true);
                    }}
                    className="text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                    title="Xem lại hộp thoại chào mừng đầy đủ"
                  >
                    <SparkleIcon className="w-3 h-3 text-emerald-400" />
                    <span>Xem lại tour đầy đủ</span>
                  </button>

                  {isAllTasksDone ? (
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold animate-pulse">
                      Sẵn sàng học! 🌿
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500">
                      Khám phá tính năng
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
