"use client";

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
