"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { MobilePanelId } from "../types";

export interface MobileStackItem {
  id: MobilePanelId;
  title: string;
  props?: Record<string, unknown>;
}

/**
 * useMobileStack - Quản lý điều hướng dạng ngăn xếp (LIFO Stack Navigation)
 * Hỗ trợ Push/Pop đa tầng, nút Quay lại (Back), và cơ chế "Bấm Back 2 lần liên tục để thoát".
 */
interface UseMobileStackOptions {
  onStackChange?: (current: MobileStackItem | null, stack: MobileStackItem[]) => void;
}

export function useMobileStack(options?: UseMobileStackOptions) {
  const [stack, setStack] = useState<MobileStackItem[]>([]);
  const stackRef = useRef<MobileStackItem[]>([]);
  stackRef.current = stack;

  const onStackChangeRef = useRef(options?.onStackChange);
  onStackChangeRef.current = options?.onStackChange;

  // Số lượng history entry đã push vào window.history bởi mobile stack
  const historyEntriesCountRef = useRef(0);
  // Lưu thời điểm bấm Back lần 1 tại màn hình chính
  const lastRootBackTimeRef = useRef<number>(0);
  // Đánh dấu người dùng đang thực sự thoát app sau 2 lần back liên tục
  const isAllowingExitRef = useRef(false);

  // Màn hình đang hiển thị tại đỉnh stack
  const currentScreen = stack.length > 0 ? stack[stack.length - 1] : null;
  // Màn hình trước đó (để hiển thị nhãn nút Back)
  const previousScreen = stack.length > 1 ? stack[stack.length - 2] : null;
  const canGoBack = stack.length > 1;
  const isOpen = stack.length > 0;

  // Luôn duy trì 1 guard state trong window.history khi ở màn hình chính
  // để chặn trình duyệt thoát app ngay lập tức trong lần back đầu tiên
  const ensureRootHistoryGuard = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.history.pushState({ studyMobileRootGuard: true }, "");
    } catch {}
  }, []);

  // Khởi tạo guard state ban đầu khi component mount
  useEffect(() => {
    ensureRootHistoryGuard();
  }, [ensureRootHistoryGuard]);

  // Đóng toàn bộ stack về 0 và dọn dẹp history đã push
  const closeAll = useCallback(() => {
    if (stackRef.current.length === 0) return;
    const entriesToRevert = historyEntriesCountRef.current;
    historyEntriesCountRef.current = 0;
    setStack([]);
    onStackChangeRef.current?.(null, []);

    if (entriesToRevert > 0 && typeof window !== "undefined") {
      try {
        window.history.go(-entriesToRevert);
      } catch {}
    }
  }, []);

  // Pop màn hình đỉnh ra, quay về màn hình trước
  const pop = useCallback(() => {
    if (typeof window !== "undefined" && historyEntriesCountRef.current > 0) {
      window.history.back();
    } else {
      setStack((prev) => {
        if (prev.length <= 1) {
          onStackChangeRef.current?.(null, []);
          return [];
        }
        const next = prev.slice(0, prev.length - 1);
        onStackChangeRef.current?.(next[next.length - 1], next);
        return next;
      });
    }
  }, []);

  // Push màn hình mới vào đỉnh ngăn xếp
  const push = useCallback((id: MobilePanelId, title: string, props?: Record<string, unknown>) => {
    setStack((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].id === id) return prev;
      const next = [...prev, { id, title, props }];
      onStackChangeRef.current?.(next[next.length - 1], next);
      return next;
    });

    if (typeof window !== "undefined") {
      try {
        window.history.pushState({ studyMobileStack: true, screenId: id, depth: historyEntriesCountRef.current + 1 }, "");
        historyEntriesCountRef.current += 1;
      } catch {}
    }
  }, []);

  // Thiết lập 1 màn hình gốc (reset stack cũ và push 1 entry mới)
  const openRoot = useCallback((id: MobilePanelId, title: string, props?: Record<string, unknown>) => {
    setStack([{ id, title, props }]);
    onStackChangeRef.current?.({ id, title, props }, [{ id, title, props }]);

    if (typeof window !== "undefined") {
      try {
        window.history.pushState({ studyMobileStack: true, screenId: id, depth: 1 }, "");
        historyEntriesCountRef.current += 1;
      } catch {}
    }
  }, []);

  // Lắng nghe sự kiện popstate của trình duyệt (Hardware Back Button / Safari Edge Swipe)
  useEffect(() => {
    const handlePopState = () => {
      // Nếu đang trong quá trình thoát app (lần back thứ 2) thì cho trình duyệt back tự nhiên
      if (isAllowingExitRef.current) return;

      const currentStack = stackRef.current;

      // 1. Nếu đang mở Sheet/Modal trong ngăn xếp:
      if (currentStack.length > 0) {
        if (historyEntriesCountRef.current > 0) {
          historyEntriesCountRef.current -= 1;
        }

        if (currentStack.length <= 1) {
          // Đã lùi về màn hình chính (đóng sheet gốc)
          setStack([]);
          onStackChangeRef.current?.(null, []);
        } else {
          // Lùi về màn hình trước trong stack
          const nextStack = currentStack.slice(0, currentStack.length - 1);
          setStack(nextStack);
          onStackChangeRef.current?.(nextStack[nextStack.length - 1], nextStack);
        }
        return;
      }

      // 2. Nếu đang ở màn hình chính (không có sheet nào mở):
      // Áp dụng cơ chế "Bấm Back 2 lần trong vòng 2 giây để thoát"
      const now = Date.now();
      const timeDiff = now - lastRootBackTimeRef.current;

      if (timeDiff <= 2000) {
        // Lần back thứ 2 trong 2 giây -> cho phép thoát
        isAllowingExitRef.current = true;
        toast.dismiss("back-to-exit-toast");
        if (typeof window !== "undefined") {
          window.history.back();
        }
      } else {
        // Lần back đầu tiên -> Chặn thoát, hiện toast cảnh báo và khôi phục guard state
        lastRootBackTimeRef.current = now;
        ensureRootHistoryGuard();
        toast("Nhấn một lần nữa để thoát", {
          id: "back-to-exit-toast",
          duration: 2000,
          position: "bottom-center",
        });
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [ensureRootHistoryGuard]);

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
