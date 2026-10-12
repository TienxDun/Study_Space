"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { StudyNote } from "../types";
import { DEFAULT_NOTES } from "../constants/default-notes";
import { sanitizeStoredNoteContent, markdownToHtml } from "../utils/note-markdown";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { saveStorageJSON } from "@/lib/safe-storage";

const STORAGE_MULTI_KEY = STORAGE_KEYS.multiNotes;
const STORAGE_OLD_KEY = STORAGE_KEYS.oldNotes;
const TEMPLATE_UPGRADE_KEY = "study_space_notes_v6_clean_streamlined";
// Id của ghi chú mẫu kèm app — chỉ đúng mẫu gốc mới có id này
const TEMPLATE_NOTE_IDS = new Set([
  "note-1",
  "note-2",
  "note-study-hub",
  "note-project-blueprint",
  "note-cheat-sheet",
  "note-wellness-habits",
]);

// Sao lưu đề phòng trước khi ghi đè/migrate: lỡ sai vẫn cứu được.
// Chỉ giữ 1 bản mới nhất (xóa bản cũ để khỏi phình bộ nhớ).
const backupNotesRaw = (raw: string) => {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${STORAGE_MULTI_KEY}_backup_`)) {
        localStorage.removeItem(key);
      }
    }
    localStorage.setItem(`${STORAGE_MULTI_KEY}_backup_${Date.now()}`, raw);
  } catch {}
};

const isValidNote = (n: unknown): n is StudyNote =>
  typeof n === "object" &&
  n !== null &&
  typeof (n as StudyNote).id === "string" &&
  typeof (n as StudyNote).content === "string";

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
    const saved = saveStorageJSON(STORAGE_MULTI_KEY, updatedNotes);
    // Chỉ báo giờ khi lưu thật sự xong, đầy bộ nhớ thì helper đã toast
    if (saved) {
      const now = new Date();
      setLastSavedTime(
        `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`
      );
    }
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
            // Bỏ ghi chú hỏng cấu trúc, giữ lại cái lành
            const valid = parsed.filter(isValidNote);
            // Chỉ thay bằng mẫu mới khi CHẮC là mẫu gốc chưa ai động vào:
            // mọi id đều là id mẫu. Không đoán bằng tên (dễ xóa nhầm
            // ghi chú của người dùng đặt tên giống mẫu).
            const isUntouchedTemplate =
              !hasUpgraded &&
              valid.length > 0 &&
              valid.length === parsed.length &&
              valid.every((n) => TEMPLATE_NOTE_IDS.has(n.id));

            if (isUntouchedTemplate) {
              backupNotesRaw(savedMulti);
              setNotes(DEFAULT_NOTES);
              setActiveNoteId(DEFAULT_NOTES[0].id);
              localStorage.setItem(STORAGE_MULTI_KEY, JSON.stringify(DEFAULT_NOTES));
              localStorage.setItem(TEMPLATE_UPGRADE_KEY, "true");
              return;
            }

            const formatted = valid.map((n) => ({
              ...n,
              content: sanitizeStoredNoteContent(n.content),
            }));
            if (formatted.length === 0) {
              setNotes([]);
              setActiveNoteId("");
              return;
            }
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

  // Sorted notes (Pinned first, then latest updated)
  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.updatedAt - a.updatedAt;
    });
  }, [notes]);

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
    sortedNotes,
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
