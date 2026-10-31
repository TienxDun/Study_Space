"use client";

import React, { useState, useEffect } from "react";
import { UsersIcon, SignOutIcon, CaretUpIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";

interface MobileActiveRoomPillProps {
  roomName: string;
  onReopen: () => void;
  onLeave: () => void;
}

/**
 * Thanh thông báo cuộc gọi đang chạy ngầm khi người dùng chuyển sang tab khác.
 * Nằm ở tầng dưới (sát trên Navbar) và chừa lề góc phải cho chú Mascot Sprout.
 * Thanh nhạc sẽ tự động xếp tầng lên trên thanh này khi cả hai cùng hoạt động.
 */
export function MobileActiveRoomPill({
  roomName,
  onReopen,
  onLeave,
}: MobileActiveRoomPillProps) {
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);

  useEffect(() => {
    // Thông báo cho thanh phát nhạc và mascot biết thanh phòng học đang hiển thị ở tầng dưới
    window.dispatchEvent(
      new CustomEvent("zenstudy:active-room-pill", { detail: { hasRoomPill: true } })
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent("zenstudy:active-room-pill", { detail: { hasRoomPill: false } })
      );
    };
  }, []);

  return (
    <aside
      id="mobile-active-room-pill"
      aria-label="Phòng học đang hoạt động"
      className="fixed bottom-[calc(var(--mobile-nav-height)+var(--app-safe-bottom)+var(--mobile-nav-safe-gap)+0.75rem)] left-1/2 -translate-x-1/2 w-[calc(100vw-8.5rem)] max-w-[320px] z-40 sm:hidden pointer-events-auto select-none transition-all duration-300 ease-out animate-in slide-in-from-bottom-2"
    >
      <div className="lg-bar h-11 px-3 rounded-full overflow-hidden flex items-center justify-between gap-1.5 select-none transition-all">
        {/* Vùng chạm mở lại phòng học */}
        <button
          type="button"
          onClick={onReopen}
          className="flex-1 min-w-0 flex items-center gap-1.5 text-left active:scale-[0.98] transition-transform cursor-pointer"
          title="Chạm để mở lại phòng học"
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>

          <UsersIcon className="w-4 h-4 text-emerald-400 shrink-0" />

          <div className="min-w-0 flex-1 flex items-center gap-1">
            <span className="text-xs font-bold text-white truncate min-w-0 flex-1">
              {roomName}
            </span>
            <span className="sr-only">(Đang học)</span>
          </div>

          <span className="lg-pill relative h-7 w-7 min-[400px]:w-auto min-[400px]:px-2.5 rounded-full flex items-center justify-center min-[400px]:gap-1 text-[11px] font-semibold text-emerald-300 shrink-0 cursor-pointer">
            <span className="hidden min-[400px]:inline">Mở lại</span>
            <CaretUpIcon className="w-3 h-3" />
          </span>
        </button>

        {/* Nút rời phòng nhanh dạng viên thuốc kính lỏng cảnh báo */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsLeaveConfirmOpen(true);
          }}
          className="h-7 px-2.5 rounded-full bg-rose-500/20 hover:bg-rose-500/30 active:scale-95 border border-rose-400/30 text-rose-300 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0 shadow-sm"
          title="Rời phòng"
        >
          <SignOutIcon className="w-3.5 h-3.5" />
          <span>Rời</span>
        </button>
      </div>

      {/* Hộp thoại xác nhận rời phòng dạng alertdialog */}
      <ConfirmDeleteModal
        isOpen={isLeaveConfirmOpen}
        onClose={() => setIsLeaveConfirmOpen(false)}
        onConfirm={() => {
          onLeave();
          toast.info("Đã rời phòng học");
        }}
        title="Xác nhận rời phòng học"
        description={`Bạn có chắc chắn muốn rời khỏi phòng học "${roomName}" không?`}
        confirmText="Rời phòng"
        cancelText="Ở lại"
      />
    </aside>
  );
}
