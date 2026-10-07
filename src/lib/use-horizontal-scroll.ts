"use client";

import { useEffect, useRef } from "react";

/**
 * Checks whether an element is horizontally scrollable.
 */
function isHorizontallyScrollable(el: HTMLElement): boolean {
  if (el.scrollWidth <= el.clientWidth + 1) return false;
  const style = window.getComputedStyle(el);
  return style.overflowX === "auto" || style.overflowX === "scroll";
}

/**
 * Checks whether an element is vertically scrollable.
 */
function isVerticallyScrollable(el: HTMLElement): boolean {
  if (el.scrollHeight <= el.clientHeight + 1) return false;
  const style = window.getComputedStyle(el);
  return style.overflowY === "auto" || style.overflowY === "scroll";
}

/**
 * Direct event handler for React `onWheel` prop on any horizontal container.
 * Converts vertical wheel movement (deltaY) into smooth horizontal scroll (scrollLeft).
 */
export function handleHorizontalWheel(e: React.WheelEvent<HTMLElement>) {
  // If user is already scrolling horizontally via trackpad or holding Shift, let browser handle it
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

  const container = e.currentTarget;
  if (!container) return;

  if (container.scrollWidth > container.clientWidth) {
    container.scrollLeft += e.deltaY;
  }
}

/**
 * React Hook that attaches a non-passive wheel listener to a specific container
 * to ensure e.preventDefault() can prevent unwanted page/modal vertical bounce.
 */
export function useHorizontalWheelScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      if (el.scrollWidth > el.clientWidth) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return ref;
}

/**
 * Global hook to enable mouse wheel horizontal scrolling across all
 * single-row horizontal scroll containers (category pills, tabs, toolbars, chips, etc.)
 * without requiring individual hooks or props on every single container.
 */
export function useGlobalHorizontalScroll() {
  useEffect(() => {
    const handleGlobalWheel = (e: WheelEvent) => {
      // If user is already scrolling horizontally (trackpad gestures)
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      // Traverse upwards from event target to find closest horizontal scroll container
      let el = e.target as HTMLElement | null;
      while (el && el !== document.body && el !== document.documentElement) {
        // Check if element has horizontal overflow
        if (isHorizontallyScrollable(el)) {
          // If the element is purely horizontal (not vertically overflowing)
          if (!isVerticallyScrollable(el)) {
            e.preventDefault();
            el.scrollLeft += e.deltaY;
            return;
          }
        }
        el = el.parentElement;
      }
    };

    window.addEventListener("wheel", handleGlobalWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleGlobalWheel);
  }, []);
}
