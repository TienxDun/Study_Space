"use client";

import { useState, useEffect } from "react";
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
      <div className="lg-bar relative h-10.5 px-3 rounded-full flex items-center justify-between gap-2 overflow-hidden select-none transition-all shadow-lg">
        {/* Vùng chạm mở lại phòng học */}
        <button
          type="button"
          onClick={onReopen}
          className="flex-1 min-w-0 h-full flex items-center gap-2 text-left active:scale-[0.98] transition-transform cursor-pointer group pr-8"
          title="Chạm để mở lại phòng học"
        >
          <UsersIcon className="w-4 h-4 text-white/80 group-hover:text-white transition-colors shrink-0" weight="bold" />

          <div className="min-w-0 flex-1 truncate">
            <span className="text-xs font-semibold text-white truncate block group-hover:text-white/90 transition-colors">
              {roomName}
            </span>
            <span className="sr-only">(Đang học)</span>
            <span className="sr-only">Mở lại</span>
          </div>
        </button>

        {/* Icon mũi tên ^ nảy ở chính giữa thanh để thu hút người dùng */}
        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none flex items-center justify-center text-white/60 group-hover:text-white transition-colors">
          <CaretUpIcon className="w-4 h-4 animate-bounce text-white/70" weight="bold" />
        </div>

        {/* Nút rời phòng dạng icon tròn nhỏ gọn như nút gác máy iOS */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsLeaveConfirmOpen(true);
          }}
          className="w-7 h-7 rounded-full bg-rose-500/15 hover:bg-rose-500/25 active:bg-rose-500/35 active:scale-90 border border-rose-400/20 text-rose-300 hover:text-rose-200 flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-sm"
          title="Rời phòng"
          aria-label="Rời phòng"
        >
          <SignOutIcon className="w-3.5 h-3.5" weight="bold" />
          <span className="sr-only">Rời</span>
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
