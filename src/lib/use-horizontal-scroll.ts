"use client";

import { useEffect, useRef } from "react";

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
