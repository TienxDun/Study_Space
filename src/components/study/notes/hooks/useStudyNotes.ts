"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { StudyNote } from "../types";
import { DEFAULT_NOTES } from "../constants/default-notes";
import { sanitizeStoredNoteContent, markdownToHtml } from "../utils/note-markdown";
import { STORAGE_KEYS } from "@/lib/storage-keys";

const STORAGE_MULTI_KEY = STORAGE_KEYS.multiNotes;
const STORAGE_OLD_KEY = STORAGE_KEYS.oldNotes;
const TEMPLATE_UPGRADE_KEY = "study_space_notes_v6_clean_streamlined";

export function useStudyNotes() {
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tất cả");
  const [lastSavedTime, setLastSavedTime] = useState<string>("Vừa xong");
  const [noteToDelete, setNoteToDelete] = useState<StudyNote | null>(null);

  // Helper to persist notes to localStorage
  const saveNotesToStorage = useCallback((updatedNotes: StudyNote[]) => {
    setNotes(updatedNotes);
    try {
      localStorage.setItem(STORAGE_MULTI_KEY, JSON.stringify(updatedNotes));
      const now = new Date();
      setLastSavedTime(
        `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`
      );
    } catch {}
  }, []);

  // Load notes on mount with migration and template upgrade handling
  useEffect(() => {
    try {
      const hasUpgraded = localStorage.getItem(TEMPLATE_UPGRADE_KEY);
      const savedMulti = localStorage.getItem(STORAGE_MULTI_KEY);

      if (savedMulti) {
        const parsed: StudyNote[] = JSON.parse(savedMulti);
        if (Array.isArray(parsed)) {
          if (parsed.length > 0) {
            const isSampleOrCorrupted =
              !hasUpgraded &&
              (parsed.every(
                (n) =>
                  n.id === "note-1" ||
                  n.id === "note-2" ||
                  n.id === "note-study-hub" ||
                  n.id === "note-project-blueprint" ||
                  n.id === "note-cheat-sheet" ||
                  n.id === "note-wellness-habits" ||
                  n.title.includes("Kế hoạch") ||
                  n.title.includes("Từ vựng") ||
                  n.title.includes("Sổ tay") ||
                  n.title.includes("Dự án") ||
                  n.title.includes("Thói quen")
              ) ||
                parsed.some(
                  (n) =>
                    n.content.includes("&gt; 💡") ||
                    n.content.includes("&gt; 🚀") ||
                    n.content.includes("<pre><code>typescript")
                ));

            if (isSampleOrCorrupted) {
              setNotes(DEFAULT_NOTES);
              setActiveNoteId(DEFAULT_NOTES[0].id);
              localStorage.setItem(STORAGE_MULTI_KEY, JSON.stringify(DEFAULT_NOTES));
              localStorage.setItem(TEMPLATE_UPGRADE_KEY, "true");
              return;
            }

            const formatted = parsed.map((n) => ({
              ...n,
              content: sanitizeStoredNoteContent(n.content),
            }));
            setNotes(formatted);
            setActiveNoteId(formatted[0].id);
            localStorage.setItem(STORAGE_MULTI_KEY, JSON.stringify(formatted));
            localStorage.setItem(TEMPLATE_UPGRADE_KEY, "true");
            return;
          } else {
            setNotes([]);
            setActiveNoteId("");
          }
          return;
        }
      }

      // Check migration from old single note
      const oldNote = localStorage.getItem(STORAGE_OLD_KEY);
      if (oldNote) {
        const migratedNote: StudyNote = {
          id: `note-${Date.now()}`,
          title: "Ghi chú nhanh",
          category: "Học tập",
          isPinned: true,
          content: markdownToHtml(oldNote),
          updatedAt: Date.now(),
        };
        const initial = [migratedNote, ...DEFAULT_NOTES];
        setNotes(initial);
        setActiveNoteId(migratedNote.id);
        localStorage.setItem(STORAGE_MULTI_KEY, JSON.stringify(initial));
        return;
      }

      // Default fallback
      setNotes(DEFAULT_NOTES);
      setActiveNoteId(DEFAULT_NOTES[0].id);
      localStorage.setItem(STORAGE_MULTI_KEY, JSON.stringify(DEFAULT_NOTES));
      localStorage.setItem(TEMPLATE_UPGRADE_KEY, "true");
    } catch {
      setNotes(DEFAULT_NOTES);
      setActiveNoteId(DEFAULT_NOTES[0].id);
    }
  }, []);

  // Active note lookup
  const activeNote = useMemo(() => {
    return notes.find((n) => n.id === activeNoteId) || null;
  }, [notes, activeNoteId]);

  // Checklist statistics (from activeNote HTML)
  const checklistStats = useMemo(() => {
    if (!activeNote?.content || typeof document === "undefined") {
      return { total: 0, completed: 0, percent: 0 };
    }
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = activeNote.content;
    const checkboxes = Array.from(
      tempDiv.querySelectorAll<HTMLInputElement>(".todo-checkbox, input[type='checkbox']")
    );
    const total = checkboxes.length;
    const completed = checkboxes.filter(
      (cb) => cb.checked || cb.getAttribute("checked") === "true" || cb.hasAttribute("checked")
    ).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percent };
  }, [activeNote]);

  // Filtered and Sorted notes (Pinned first, then latest updated)
  const filteredNotes = useMemo(() => {
    return notes
      .filter((n) => {
        const matchCat = selectedCategory === "Tất cả" || n.category === selectedCategory;
        const strippedContent = n.content.replace(/<[^>]*>/g, " ").toLowerCase();
        const matchQuery =
          !searchQuery.trim() ||
          n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          strippedContent.includes(searchQuery.toLowerCase());
        return matchCat && matchQuery;
      })
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return b.updatedAt - a.updatedAt;
      });
  }, [notes, selectedCategory, searchQuery]);

  // Actions
  const handleCreateNote = useCallback(() => {
    const newNote: StudyNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: "Ghi chú không tên",
      category: selectedCategory === "Tất cả" ? "Học tập" : selectedCategory,
      isPinned: false,
      content: "<p>Bắt đầu ghi chép nội dung...</p>",
      updatedAt: Date.now(),
    };
    const updated = [newNote, ...notes];
    saveNotesToStorage(updated);
    setActiveNoteId(newNote.id);
    return newNote;
  }, [notes, selectedCategory, saveNotesToStorage]);

  const handleResetDefaultNotes = useCallback(() => {
    setNotes(DEFAULT_NOTES);
    setActiveNoteId(DEFAULT_NOTES[0].id);
    saveNotesToStorage(DEFAULT_NOTES);
  }, [saveNotesToStorage]);

  const handleUpdateTitle = useCallback(
    (newTitle: string) => {
      if (!activeNote) return;
      const updated = notes.map((n) =>
        n.id === activeNote.id ? { ...n, title: newTitle, updatedAt: Date.now() } : n
      );
      saveNotesToStorage(updated);
    },
    [activeNote, notes, saveNotesToStorage]
  );

  const handleTogglePin = useCallback(
    (noteId: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      const updated = notes.map((n) =>
        n.id === noteId ? { ...n, isPinned: !n.isPinned, updatedAt: Date.now() } : n
      );
      saveNotesToStorage(updated);
    },
    [notes, saveNotesToStorage]
  );

  const handleUpdateCategory = useCallback(
    (newCat: string, targetNoteId?: string) => {
      const noteId = targetNoteId || activeNote?.id;
      if (!noteId) return;
      const updated = notes.map((n) =>
        n.id === noteId ? { ...n, category: newCat, updatedAt: Date.now() } : n
      );
      saveNotesToStorage(updated);
    },
    [activeNote, notes, saveNotesToStorage]
  );

  const updateNoteContent = useCallback(
    (noteId: string, newHtml: string) => {
      const updated = notes.map((n) =>
        n.id === noteId ? { ...n, content: newHtml, updatedAt: Date.now() } : n
      );
      saveNotesToStorage(updated);
    },
    [notes, saveNotesToStorage]
  );

  const promptDeleteNote = useCallback((note: StudyNote, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNoteToDelete(note);
  }, []);

  const handleConfirmDeleteNote = useCallback(() => {
    if (!noteToDelete) return;
    const idToDelete = noteToDelete.id;
    const updated = notes.filter((n) => n.id !== idToDelete);
    saveNotesToStorage(updated);
    if (activeNoteId === idToDelete) {
      setActiveNoteId(updated.length > 0 ? updated[0].id : "");
    }
    setNoteToDelete(null);
  }, [noteToDelete, notes, activeNoteId, saveNotesToStorage]);

  return {
    notes,
    setNotes,
    activeNoteId,
    setActiveNoteId,
    activeNote,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    lastSavedTime,
    noteToDelete,
    setNoteToDelete,
    checklistStats,
    filteredNotes,
    handleCreateNote,
    handleResetDefaultNotes,
    handleUpdateTitle,
    handleTogglePin,
    handleUpdateCategory,
    updateNoteContent,
    promptDeleteNote,
    handleConfirmDeleteNote,
    saveNotesToStorage,
  };
}
