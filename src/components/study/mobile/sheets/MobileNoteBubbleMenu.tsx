"use client";

import React, { useRef } from "react";
import {
  DotsThreeVerticalIcon,
  PushPinIcon,
  PencilLineIcon,
  TrashIcon,
  CaretRightIcon,
} from "@phosphor-icons/react";
import { StudyNote } from "../../notes/types";
import { MobileBubbleMenuOverlay } from "./MobileBubbleMenuOverlay";

interface MobileNoteBubbleMenuProps {
  note: StudyNote;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onEdit: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}

export const MobileNoteBubbleMenu = React.memo(function MobileNoteBubbleMenu({
  note,
  isOpen,
  onToggle,
  onClose,
  onEdit,
  onTogglePin,
  onDelete,
}: MobileNoteBubbleMenuProps) {
  const anchorRef = useRef<HTMLElement | null>(null);

  return (
    <div className="relative shrink-0 flex items-center">
      {/* Nút Trigger 3 chấm tròn kính mờ đồng bộ hoàn toàn với Bảng Việc */}
      <button
        type="button"
        ref={(el) => {
          anchorRef.current = el;
        }}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-label="Tùy chọn ghi chú"
        className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer active:scale-90 shadow-sm ${
          isOpen
            ? "bg-white/20 text-white border-white/30"
            : "bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border-white/15"
        }`}
      >
        <DotsThreeVerticalIcon className="w-4 h-4" weight="bold" />
      </button>

      {/* Menu thả xuống ngữ cảnh có chữ mô tả rõ nghĩa */}
      <MobileBubbleMenuOverlay
        isOpen={isOpen}
        onClose={onClose}
        anchorRef={anchorRef}
        menuKey={`note-menu-${note.id}`}
      >
        <div className="flex flex-col space-y-0.5">
          {/* Mục 1: Xem & Chỉnh sửa chi tiết */}
          <button
            type="button"
            onClick={() => {
              onEdit();
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer group/item"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-white/[0.08] border border-white/10 flex items-center justify-center shrink-0">
                <PencilLineIcon
                  className="w-4 h-4 text-white/80 group-hover:text-white transition-colors"
                  weight="bold"
                />
              </div>
              <span className="truncate">Xem & chỉnh sửa</span>
            </div>
            <CaretRightIcon className="w-3.5 h-3.5 text-white/40 group-hover:text-white/70 shrink-0 ml-2 transition-colors" weight="bold" />
          </button>

          {/* Mục 2: Ghim / Bỏ ghim ghi chú */}
          <button
            type="button"
            onClick={() => {
              onTogglePin();
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer group/item"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-white/[0.08] border border-white/10 flex items-center justify-center shrink-0">
                <PushPinIcon
                  className={`w-4 h-4 transition-colors ${
                    note.isPinned ? "text-amber-300" : "text-white/80 group-hover:text-white"
                  }`}
                  weight={note.isPinned ? "fill" : "bold"}
                />
              </div>
              <span className="truncate">
                {note.isPinned ? "Bỏ ghim ghi chú" : "Ghim lên đầu"}
              </span>
            </div>
          </button>

          {/* Đường phân cách nhẹ */}
          <div className="my-1 border-t border-white/[0.08]" />

          {/* Mục 3: Xóa ghi chú */}
          <button
            type="button"
            onClick={() => {
              onDelete();
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-white/70 hover:text-rose-400 hover:bg-rose-500/10 active:scale-[0.98] transition-all cursor-pointer group/item"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                <TrashIcon
                  className="w-4 h-4 text-rose-400 group-hover:text-rose-300 transition-colors"
                  weight="bold"
                />
              </div>
              <span className="truncate text-rose-300 group-hover:text-rose-200">Xóa ghi chú</span>
            </div>
          </button>
        </div>
      </MobileBubbleMenuOverlay>
    </div>
  );
});
