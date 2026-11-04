"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { isNativeApp } from "@/lib/google-sign-in";
import { exitNativeApp, registerNativeBackHandler } from "@/lib/native-back";
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
  isZenMode?: boolean;
  onExitZen?: () => void;
}

export function useMobileStack(options?: UseMobileStackOptions) {
  const [stack, setStack] = useState<MobileStackItem[]>([]);
  const stackRef = useRef<MobileStackItem[]>([]);
  const onStackChangeRef = useRef(options?.onStackChange);
  const isZenModeRef = useRef(options?.isZenMode || false);
  const onExitZenRef = useRef(options?.onExitZen);
  const lastZenBackTimeRef = useRef<number>(0);

  // Cập nhật ref trong effect để không vi phạm quy tắc render thuần của React
  useEffect(() => {
    stackRef.current = stack;
  }, [stack]);

  useEffect(() => {
    onStackChangeRef.current = options?.onStackChange;
  }, [options?.onStackChange]);

  useEffect(() => {
    isZenModeRef.current = Boolean(options?.isZenMode);
  }, [options?.isZenMode]);

  useEffect(() => {
    onExitZenRef.current = options?.onExitZen;
  }, [options?.onExitZen]);

  // Số lượng history entry đã push vào window.history bởi mobile stack
  const historyEntriesCountRef = useRef(0);
  // Bỏ qua các sự kiện popstate phát sinh do code chủ động lùi (closeAll / tab switch)
  const suppressPopstateCountRef = useRef(0);
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

function createSafeHistoryState<T extends Record<string, unknown>>(data: T): T & { __NA: true } {
  if (typeof window === "undefined") {
    return { ...data, __NA: true };
  }
  const current = window.history.state;
  return {
    ...data,
    __NA: true,
    ...(current && typeof current === "object" && current.__PRIVATE_NEXTJS_INTERNALS_TREE
      ? { __PRIVATE_NEXTJS_INTERNALS_TREE: current.__PRIVATE_NEXTJS_INTERNALS_TREE }
      : {}),
  };
}

function getCurrentUrl(): string {
  if (typeof window === "undefined") return "";
  return window.location.href;
}

  // Luôn duy trì 1 guard state trong window.history khi ở màn hình chính
  // để chặn trình duyệt thoát app ngay lập tức trong lần back đầu tiên
  const ensureRootHistoryGuard = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.history.state?.studyMobileRootGuard && window.history.state?.__NA) {
        return;
      }
      window.history.pushState(
        createSafeHistoryState({ studyMobileRootGuard: true }),
        "",
        getCurrentUrl()
      );
    } catch {}
  }, []);

  // Khởi tạo guard state ban đầu khi component mount
  useEffect(() => {
    ensureRootHistoryGuard();
  }, [ensureRootHistoryGuard]);

  // Đóng toàn bộ stack về 0 và dọn dẹp history đã push một cách an toàn
  const closeAll = useCallback(() => {
    lastRootBackTimeRef.current = 0;
    if (stackRef.current.length === 0) return;
    const entriesToRevert = historyEntriesCountRef.current;
    historyEntriesCountRef.current = 0;
    setStack([]);
    onStackChangeRef.current?.(null, []);

    if (entriesToRevert > 0 && typeof window !== "undefined") {
      // MDN: window.history.go(-n) chỉ phát ra ĐÚNG 1 sự kiện popstate khi hoàn tất, không phải n lần
      suppressPopstateCountRef.current += 1;
      try {
        window.history.go(-entriesToRevert);
      } catch {
        suppressPopstateCountRef.current = Math.max(0, suppressPopstateCountRef.current - 1);
      }
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
    lastRootBackTimeRef.current = 0;
    // Chặn trùng lặp tuyệt đối: Nếu màn hình ở đỉnh ngăn xếp đã là id này thì thoát sớm hoàn toàn
    // (ngăn chặn việc pushState và tăng historyEntriesCountRef khi gõ phím/chọn thuộc tính trong modal)
    const currentStack = stackRef.current;
    if (currentStack.length > 0 && currentStack[currentStack.length - 1].id === id) {
      return;
    }

    const nextItem: MobileStackItem = { id, title, props };
    setStack((prev) => {
      const next = [...prev, nextItem];
      onStackChangeRef.current?.(nextItem, next);
      return next;
    });

    if (typeof window !== "undefined") {
      try {
        historyEntriesCountRef.current += 1;
        window.history.pushState(
          createSafeHistoryState({
            studyMobileStack: true,
            screenId: id,
            depth: historyEntriesCountRef.current,
          }),
          "",
          getCurrentUrl()
        );
      } catch {}
    }
  }, []);

  // Thiết lập 1 màn hình gốc (reset stack cũ hoặc replace mượt mà khi đổi tab)
  const openRoot = useCallback((id: MobilePanelId, title: string, props?: Record<string, unknown>) => {
    lastRootBackTimeRef.current = 0;
    const currentEntries = historyEntriesCountRef.current;
    const newRootItem: MobileStackItem = { id, title, props };

    setStack([newRootItem]);
    onStackChangeRef.current?.(newRootItem, [newRootItem]);

    if (typeof window !== "undefined") {
      try {
        const safeState = createSafeHistoryState({
          studyMobileStack: true,
          screenId: id,
          depth: 1,
        });
        const currentUrl = getCurrentUrl();

        if (currentEntries === 1) {
          // Đang ở 1 root sheet khác -> dùng replaceState để chuyển tab tức thì không race condition
          window.history.replaceState(safeState, "", currentUrl);
        } else if (currentEntries > 1) {
          // Đang ở sub-screen -> lùi các entry con và giữ entry gốc
          const excessEntries = currentEntries - 1;
          suppressPopstateCountRef.current += 1;
          historyEntriesCountRef.current = 1;
          window.history.go(-excessEntries);
          setTimeout(() => {
            try {
              window.history.replaceState(safeState, "", getCurrentUrl());
            } catch {}
          }, 50);
        } else {
          // Đang ở màn hình chính -> push root entry mới
          window.history.pushState(safeState, "", currentUrl);
          historyEntriesCountRef.current = 1;
        }
      } catch {}
    }
  }, []);

  // Một đường xử lý Back duy nhất cho cả popstate (web) và nút Back hệ thống (Android)
  const handleBackNavigation = useCallback(() => {
    // 1. Bỏ qua các sự kiện popstate do code chủ động lùi (closeAll hoặc chuyển root)
    if (suppressPopstateCountRef.current > 0) {
      suppressPopstateCountRef.current -= 1;
      return;
    }

    // 2. Nếu đang trong quá trình thoát app (lần back thứ 2) thì cho trình duyệt back tự nhiên
    if (isAllowingExitRef.current) return;

    const currentStack = stackRef.current;

    // 3. Nếu đang mở Sheet/Modal trong ngăn xếp:
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

    // 4. Nếu đang ở chế độ Zen Mode:
    // Bấm Back 2 lần trong vòng 2 giây để thoát Zen Mode (lần 1 nhắc nhở, lần 2 thoát Zen)
    if (isZenModeRef.current) {
      const now = Date.now();
      const timeDiff = now - lastZenBackTimeRef.current;

      if (timeDiff <= 2000) {
        // Lần back thứ 2 trong 2s -> thoát Zen Mode
        lastZenBackTimeRef.current = 0;
        toast.dismiss("back-to-exit-zen-toast");
        ensureRootHistoryGuard();
        onExitZenRef.current?.();
      } else {
        // Lần back đầu tiên -> Chặn thoát, hiện toast nhắc nhở và khôi phục guard state
        lastZenBackTimeRef.current = now;
        ensureRootHistoryGuard();
        toast("Nhấn Back lần nữa để thoát chế độ Zen", {
          id: "back-to-exit-zen-toast",
          duration: 2000,
          position: "bottom-center",
        });
      }
      return;
    }

    // 5. Nếu đang ở màn hình chính (không có sheet nào mở và không ở Zen Mode):
    // Áp dụng cơ chế "Bấm Back 2 lần trong vòng 2 giây để thoát"
    const now = Date.now();
    const timeDiff = now - lastRootBackTimeRef.current;

    if (timeDiff <= 2000) {
      // Lần back thứ 2 trong 2 giây -> cho phép thoát
      isAllowingExitRef.current = true;
      toast.dismiss("back-to-exit-toast");
      if (isNativeApp()) {
        void exitNativeApp();
      } else if (typeof window !== "undefined") {
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
  }, [ensureRootHistoryGuard]);

  useEffect(() => {
    window.addEventListener("popstate", handleBackNavigation);
    return () => {
      window.removeEventListener("popstate", handleBackNavigation);
    };
  }, [handleBackNavigation]);

  // WebView Android không tự biến Back hệ thống thành popstate: listener này lùi
  // history của WebView để dùng chung đường xử lý với web. Nếu chưa có entry nào
  // (pushState thất bại) thì xử lý trực tiếp; lần Back thứ 2 ở màn hình chính do
  // handleBackNavigation gọi exitNativeApp().
  useEffect(() => {
    if (!isNativeApp()) return;
    return registerNativeBackHandler(() => {
      if (stackRef.current.length > 0 && historyEntriesCountRef.current <= 0) {
        handleBackNavigation();
        return;
      }
      window.history.back();
    });
  }, [handleBackNavigation]);

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
