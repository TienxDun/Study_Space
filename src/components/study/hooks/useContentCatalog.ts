"use client";

import { useEffect } from "react";
import { getCatalogMeta, loadCachedCatalog, refreshCatalog } from "@/lib/content-catalog";

// Version đã tải lại trong phiên này; giữ trong session để F5 không lặp vô hạn.
const RELOAD_FLAG = "zenstudy_content_reloaded";

/**
 * Nạp catalog nội dung do admin phát hành.
 *
 * Thứ tự: đọc cache localStorage (mở app là có ngay) → hỏi data-api một lần.
 * Nếu bản đang dùng khác bản vừa nạp, tải lại trang đúng một lần: nhiều widget
 * (nhạc, cảnh nền) chốt mảng nội dung từ lúc mount nên đổi tại chỗ sẽ không tới được.
 */
export function useContentCatalog(): void {
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const cached = loadCachedCatalog();
      const refreshed = await refreshCatalog();
      if (cancelled) return;

      const target = Math.max(getCatalogMeta().version, cached ? 1 : 0);
      if (target < 1) return;
      if (!cached && !refreshed.updated) return;

      let already = "";
      try {
        already = window.sessionStorage.getItem(RELOAD_FLAG) || "";
      } catch {
        // Không có sessionStorage (chế độ riêng tư): chấp nhận tải lại một lần.
      }
      if (already === String(target)) return;
      try {
        window.sessionStorage.setItem(RELOAD_FLAG, String(target));
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
