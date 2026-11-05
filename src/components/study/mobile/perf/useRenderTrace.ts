"use client";

import { useEffect, useRef } from "react";

// Đếm số lần commit của một component và ghi rõ key nào vừa đổi.
// Props không đổi mà vẫn commit nghĩa là nguyên nhân nằm trong state/context
// của chính component đó.
export function useRenderTrace(
  label: string,
  watched: Record<string, unknown>
) {
  const traceRef = useRef({ count: 0, values: watched });

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const previous = traceRef.current;
    const changed = Object.keys(watched).filter(
      (key) => !Object.is(previous.values[key], watched[key])
    );
    const count = previous.count + 1;
    traceRef.current = { count, values: watched };

    console.log(
      `[PERF] #${count} ${label} | doi: ${
        changed.length ? changed.join(", ") : "khong props nao"
      }`
    );
  });
}
