"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface DragPos {
  x: number;
  y: number;
}

const STORAGE_KEY = "zenstudy:chat-bubble-pos";

// Kéo bong bóng chat đi khắp màn hình, nhớ chỗ cũ, phân biệt kéo và bấm.
export function useDragBubble() {
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<DragPos | null>(null);
  const drag = useRef({ active: false, moved: false, sx: 0, sy: 0, ox: 0, oy: 0 });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPos(JSON.parse(raw));
    } catch {}
  }, []);

  const clamp = useCallback((x: number, y: number) => {
    const size = 52;
    const navHeight = 90;
    return {
      x: Math.min(Math.max(8, x), Math.max(8, window.innerWidth - size - 8)),
      y: Math.min(Math.max(70, y), Math.max(70, window.innerHeight - size - navHeight)),
    };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      el.setPointerCapture(e.pointerId);
      const rect = el.getBoundingClientRect();
      const start = pos ?? { x: rect.left, y: rect.top };
      drag.current = { active: true, moved: false, sx: e.clientX, sy: e.clientY, ox: start.x, oy: start.y };
    },
    [pos]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag.current.active) return;
      const dx = e.clientX - drag.current.sx;
      const dy = e.clientY - drag.current.sy;
      if (Math.abs(dx) + Math.abs(dy) > 10) drag.current.moved = true;
      if (drag.current.moved) setPos(clamp(drag.current.ox + dx, drag.current.oy + dy));
    },
    [clamp]
  );

  const endDrag = useCallback(() => {
    if (!drag.current.active) return false;
    const wasDrag = drag.current.moved;
    drag.current.active = false;
    if (wasDrag && pos) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
      } catch {}
      // Hít vào mép gần nhất cho gọn
      const middle = window.innerWidth / 2;
      const snapped = { x: pos.x < middle ? 8 : window.innerWidth - 52 - 8, y: pos.y };
      setPos(snapped);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapped));
      } catch {}
    }
    return wasDrag;
  }, [pos]);

  return { ref, pos, onPointerDown, onPointerMove, endDrag };
}
