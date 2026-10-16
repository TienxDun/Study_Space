"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { MobilePanelId } from "../types";

export interface MobileStackItem {
  id: MobilePanelId;
  title: string;
  props?: Record<string, unknown>;
}

/**
 * useMobileStack - Quản lý điều hướng dạng ngăn xếp (LIFO Stack Navigation)
 * Hỗ trợ Push/Pop đa tầng, nút Quay lại (Back), và đồng bộ nút Back phần cứng của trình duyệt di động.
 */
export function useMobileStack() {
  const [stack, setStack] = useState<MobileStackItem[]>([]);
  const isHistoryPushedRef = useRef(false);

  // Màn hình đang hiển thị tại đỉnh stack
  const currentScreen = stack.length > 0 ? stack[stack.length - 1] : null;
  // Màn hình trước đó (để hiển thị nhãn nút Back)
  const previousScreen = stack.length > 1 ? stack[stack.length - 2] : null;
  const canGoBack = stack.length > 1;
  const isOpen = stack.length > 0;

  // Push màn hình mới vào đỉnh ngăn xếp
  const push = useCallback((id: MobilePanelId, title: string, props?: Record<string, unknown>) => {
    setStack((prev) => {
      // Nếu màn hình hiện tại chính là màn hình muốn push thì không làm gì
      if (prev.length > 0 && prev[prev.length - 1].id === id) return prev;
      return [...prev, { id, title, props }];
    });

    if (typeof window !== "undefined") {
      try {
        window.history.pushState({ studyMobileStack: true, screenId: id }, "");
        isHistoryPushedRef.current = true;
      } catch {}
    }
  }, []);

  // Pop màn hình đỉnh ra, quay về màn hình trước
  const pop = useCallback(() => {
    setStack((prev) => {
      if (prev.length <= 1) return [];
      return prev.slice(0, prev.length - 1);
    });
  }, []);

  // Đóng toàn bộ stack về 0
  const closeAll = useCallback(() => {
    setStack([]);
  }, []);

  // Thiết lập 1 màn hình gốc duy nhất (reset toàn bộ stack cũ)
  const openRoot = useCallback((id: MobilePanelId, title: string, props?: Record<string, unknown>) => {
    setStack([{ id, title, props }]);
  }, []);

  // Lắng nghe sự kiện popstate của trình duyệt (Hardware Back Button / Safari Edge Swipe)
  useEffect(() => {
    const handlePopState = () => {
      setStack((prev) => {
        if (prev.length <= 1) return [];
        return prev.slice(0, prev.length - 1);
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return {
    stack,
    currentScreen,
    previousScreen,
    canGoBack,
    isOpen,
    push,
    pop,
    closeAll,
    openRoot,
  };
}
