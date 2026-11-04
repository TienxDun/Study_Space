"use client";

import { useEffect } from "react";
import { loadCachedCatalog, refreshCatalog } from "@/lib/content-catalog";
import { isNativeApp } from "@/lib/google-sign-in";

// Version đã tải lại trong phiên này; giữ trong session để F5 không lặp vô hạn.
const RELOAD_FLAG = "zenstudy_content_reloaded";

/**
 * Nạp catalog nội dung do admin phát hành.
 *
 * Thứ tự: đọc cache localStorage (mở app là có ngay) → hỏi data-api một lần.
 * Chỉ tải lại trang khi máy chủ có bản mới hơn bản đang dùng: nhiều widget
 * (nhạc, cảnh nền) chốt mảng nội dung từ lúc mount nên đổi tại chỗ sẽ không tới được.
 */
export function useContentCatalog(): void {
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      loadCachedCatalog();
      const refreshed = await refreshCatalog();
      if (cancelled) return;

      // Phải là bản mới thật sự. Trước đây hễ có cache là reload, nên mỗi lần mở
      // app nguội (sessionStorage trống) đều tải lại trang một lần -> nháy màn hình.
      if (!refreshed.updated || refreshed.version < 1) return;

      // App native chỉ vẽ một lần mỗi lần mở: bản mới đã ghi vào cache và sẽ có
      // hiệu lực từ lần mở kế tiếp, không reload giữa chừng.
      if (isNativeApp()) return;

      let already = "";
      try {
        already = window.sessionStorage.getItem(RELOAD_FLAG) || "";
      } catch {
        // Không có sessionStorage (chế độ riêng tư): chấp nhận tải lại một lần.
      }
      if (already === String(refreshed.version)) return;
      try {
        window.sessionStorage.setItem(RELOAD_FLAG, String(refreshed.version));
      } catch {
        // Bỏ qua: lần sau tải lại trang sẽ vào nhánh còn lại.
      }
      window.location.reload();
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);
}
