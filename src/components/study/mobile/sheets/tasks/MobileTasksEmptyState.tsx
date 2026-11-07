"use client";

import React from "react";
import { CheckCircleIcon, CheckSquareIcon } from "@phosphor-icons/react";
import { KanbanColumn } from "../../../tasks/types";

export interface MobileTasksEmptyStateProps {
  selectedColumnFilter: string;
  columns: KanbanColumn[];
  searchQuery: string;
}

/**
 * Hiển thị trạng thái rỗng khi danh sách không có việc
 * hoặc không tìm thấy kết quả tìm kiếm.
 */
export const MobileTasksEmptyState = React.memo(function MobileTasksEmptyState({
  selectedColumnFilter,
  columns,
  searchQuery,
}: MobileTasksEmptyStateProps) {
  const isDoneColumn =
    selectedColumnFilter !== "all" &&
    columns.find((c) => c.id === selectedColumnFilter)?.title.toLowerCase().includes("xong");

  if (isDoneColumn) {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-center px-4">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-3">
          <CheckCircleIcon className="w-6 h-6 text-emerald-400/50" />
        </div>
        <p className="text-sm font-semibold text-white/80">Chưa có việc nào hoàn thành</p>
        <p className="text-xs text-white/40 mt-1 max-w-[240px]">
          Chạm vào vòng tròn trên mỗi việc khi làm xong để lưu vào đây nhé!
        </p>
      </div>
    );
  }

  return (
    <div className="py-16 flex flex-col items-center justify-center text-center px-4">
      <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-3">
        <CheckSquareIcon className="w-6 h-6 text-white/30" />
      </div>
      <p className="text-sm font-semibold text-white/80">
        {searchQuery ? "Không tìm thấy việc phù hợp" : "Chưa có việc trong mục này"}
      </p>
      <p className="text-xs text-white/40 mt-1">
        {searchQuery ? "Thử tìm kiếm với từ khóa khác" : "Nhập việc mới ở thanh bên dưới để thêm ngay"}
      </p>
    </div>
  );
});
