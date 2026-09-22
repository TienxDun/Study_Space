"use client";

import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

export interface StudyKeyboardApi {
  closeSettings: () => void;
  toggleFullscreen: () => void;
  togglePomodoro: () => void;
  setTasksOpen: Dispatch<SetStateAction<boolean>>;
  setNotesOpen: Dispatch<SetStateAction<boolean>>;
  setScenesOpen: Dispatch<SetStateAction<boolean>>;
  setMixerOpen: Dispatch<SetStateAction<boolean>>;
  setEmbedOpen: Dispatch<SetStateAction<boolean>>;
  setShortcutsOpen: Dispatch<SetStateAction<boolean>>;
  setZenMode: Dispatch<SetStateAction<boolean>>;
}

/** Phím tắt toàn cục của StudySpace. Mọi nhánh chỉ dùng functional
 *  setState nên không bao giờ stale closure. */
export const useStudyKeyboard = (api: StudyKeyboardApi) => {
  const apiRef = useRef(api);
  useEffect(() => {
    apiRef.current = api;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const a = apiRef.current;
      // Bỏ qua khi người dùng đang nhập văn bản
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        activeEl.tagName === "INPUT" ||
        activeEl.tagName === "TEXTAREA" ||
        (activeEl as HTMLElement).isContentEditable
      );

      if (e.key === "Escape") {
        a.closeSettings();
        a.setTasksOpen(false);
        a.setNotesOpen(false);
        a.setScenesOpen(false);
        a.setMixerOpen(false);
        a.setEmbedOpen(false);
        a.setShortcutsOpen(false);
        a.setZenMode(false);
        return;
      }

      if (isInput) return;

      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        a.toggleFullscreen();
      } else if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        a.setZenMode((prev) => {
          const next = !prev;
          if (next) {
            a.setTasksOpen(false);
            a.setNotesOpen(false);
            a.setScenesOpen(false);
            a.setMixerOpen(false);
            a.setEmbedOpen(false);
            a.closeSettings();
          }
          return next;
        });
      } else if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        a.togglePomodoro();
      } else if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        a.setTasksOpen((prev) => {
          const next = !prev;
          if (next) a.closeSettings();
          return next;
        });
        a.setNotesOpen(false);
        a.setScenesOpen(false);
        a.setMixerOpen(false);
        a.setEmbedOpen(false);
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        a.setNotesOpen((prev) => {
          const next = !prev;
          if (next) a.closeSettings();
          return next;
        });
        a.setTasksOpen(false);
        a.setScenesOpen(false);
        a.setMixerOpen(false);
        a.setEmbedOpen(false);
      } else if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        a.setScenesOpen((prev) => {
          const next = !prev;
          if (next) a.closeSettings();
          return next;
        });
        a.setTasksOpen(false);
        a.setNotesOpen(false);
        a.setMixerOpen(false);
        a.setEmbedOpen(false);
      } else if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        a.setEmbedOpen((prev) => {
          const next = !prev;
          if (next) a.closeSettings();
          return next;
        });
        a.setTasksOpen(false);
        a.setNotesOpen(false);
        a.setScenesOpen(false);
        a.setMixerOpen(false);
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        a.setMixerOpen((prev) => {
          const next = !prev;
          if (next) a.closeSettings();
          return next;
        });
        a.setTasksOpen(false);
        a.setNotesOpen(false);
        a.setScenesOpen(false);
        a.setEmbedOpen(false);
      } else if (e.key === "?" || e.key === "h" || e.key === "H") {
        e.preventDefault();
        a.setShortcutsOpen((prev) => {
          const next = !prev;
          if (next) a.closeSettings();
          return next;
        });
        a.setMixerOpen(false);
        a.setEmbedOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
};
