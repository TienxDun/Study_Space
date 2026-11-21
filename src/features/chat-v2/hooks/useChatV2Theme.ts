"use client";

import { useCallback, useLayoutEffect, type MouseEvent as ReactMouseEvent } from "react";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import {
  APP_THEME_COLOR,
  CHAT_V2_THEME_COLORS,
  DEFAULT_CHAT_V2_THEME,
  type ChatV2Theme,
} from "../lib/theme";

function resolveTheme(value: string | null | undefined): ChatV2Theme {
  return value === "light" ? "light" : DEFAULT_CHAT_V2_THEME;
}

function readStoredTheme(): ChatV2Theme {
  try {
    return resolveTheme(localStorage.getItem(STORAGE_KEYS.chatV2Theme));
  } catch {
    return DEFAULT_CHAT_V2_THEME;
  }
}

function readAppliedTheme(): ChatV2Theme {
  return resolveTheme(document.documentElement.dataset.chatTheme);
}

function setMetaThemeColor(color: string) {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = color;
}

function applyTheme(theme: ChatV2Theme) {
  const root = document.documentElement;
  root.dataset.chatTheme = theme;
  root.style.colorScheme = theme;
  setMetaThemeColor(CHAT_V2_THEME_COLORS[theme]);
}

export function useChatV2Theme() {
  // Script trong <head> đã gắn theme trước paint khi tải trang; chạy lại để phủ
  // soft navigation và lần remount của Strict Mode (remount xoá attribute do script gắn).
  useLayoutEffect(() => {
    applyTheme(readStoredTheme());

    return () => {
      const root = document.documentElement;
      delete root.dataset.chatTheme;
      root.style.colorScheme = "";
      setMetaThemeColor(APP_THEME_COLOR);
    };
  }, []);

  const toggleTheme = useCallback((event?: ReactMouseEvent | MouseEvent) => {
    const next: ChatV2Theme = readAppliedTheme() === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(STORAGE_KEYS.chatV2Theme, next);
    } catch {
      /* bỏ qua */
    }

    const isReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const doc =
      typeof document !== "undefined"
        ? (document as unknown as {
            startViewTransition?: (callback: () => void) => {
              ready: Promise<void>;
            };
          })
        : null;

    if (!doc?.startViewTransition || isReducedMotion) {
      applyTheme(next);
      return;
    }

    const x =
      event && typeof event.clientX === "number" && event.clientX > 0
        ? event.clientX
        : window.innerWidth / 2;
    const y =
      event && typeof event.clientY === "number" && event.clientY > 0
        ? event.clientY
        : window.innerHeight / 2;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = doc.startViewTransition(() => {
      applyTheme(next);
    });

    transition.ready
      .then(() => {
        const clipPath = [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${endRadius}px at ${x}px ${y}px)`,
        ];
        try {
          document.documentElement.animate(
            {
              clipPath,
            },
            {
              duration: 480,
              easing: "cubic-bezier(0.25, 1, 0.5, 1)",
              pseudoElement: "::view-transition-new(root)",
            }
          );
        } catch {
          /* Fallback tự động của browser view-transition */
        }
      })
      .catch(() => {
        /* Bỏ qua nếu transition bị huỷ */
      });
  }, []);

  return { toggleTheme };
}
