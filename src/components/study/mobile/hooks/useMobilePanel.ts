"use client";

import { useCallback, useState } from "react";

export type MobilePanelId =
  | "none"
  | "pomodoro"
  | "tasks"
  | "scenes"
  | "music"
  | "notes"
  | "embed"
  | "mixer"
  | "rooms"
  | "chat"
  | "settings"
  | "stats"
  | "more";

// Chỉ mở 1 bảng 1 lúc trên điện thoại cho đỡ rối.
export function useMobilePanel() {
  const [active, setActive] = useState<MobilePanelId>("none");

  const open = useCallback((id: MobilePanelId) => setActive(id), []);
  const close = useCallback(() => setActive("none"), []);
  const toggle = useCallback(
    (id: MobilePanelId) =>
      setActive((prev) => (prev === id ? "none" : id)),
    []
  );

  return { active, open, close, toggle, isOpen: active !== "none" };
}
