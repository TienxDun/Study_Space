"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { saveStorageJSON } from "@/lib/safe-storage";
import {
  KanbanBoard,
  KanbanCard,
  KanbanColumn,
  KanbanChecklistItem,
  ViewMode,
  CardPriority,
} from "../types";
import { DEFAULT_BOARDS } from "../constants/default-boards";

const STORAGE_KEY = STORAGE_KEYS.kanbanBoards;
const ACTIVE_BOARD_KEY = STORAGE_KEYS.activeBoard;

export function useKanbanBoards() {
  const [boards, setBoards] = useState<KanbanBoard[]>(DEFAULT_BOARDS);
  const [activeBoardId, setActiveBoardId] = useState<string>("board-default");

  // Deletion modals state
  const [boardToDelete, setBoardToDelete] = useState<KanbanBoard | null>(null);
  const [columnToDelete, setColumnToDelete] = useState<KanbanColumn | null>(null);
  const [cardToDelete, setCardToDelete] = useState<KanbanCard | null>(null);

  // Thẻ vừa xóa để hoàn tác (chỉ nhớ 1 thẻ gần nhất)
  const [lastDeletedCard, setLastDeletedCard] = useState<{
    boardId: string;
    card: KanbanCard;
    index: number;
    deletedAt: number;
  } | null>(null);

  // Search, Views & Selection
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);

  // Quick Inline Add Card state
  const [addingCardColId, setAddingCardColId] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [newCardDescription, setNewCardDescription] = useState("");
  const [newCardPriority, setNewCardPriority] = useState<CardPriority>("medium");
  const [newCardDueDate, setNewCardDueDate] = useState<string>("");

  // Adding & Editing Column
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnTitle, setEditingColumnTitle] = useState("");

  // Board Title Editing & Dropdowns
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isBoardDropdownOpen, setIsBoardDropdownOpen] = useState(false);
  const [isEditingBoardTitle, setIsEditingBoardTitle] = useState(false);
  const [editingBoardTitleText, setEditingBoardTitleText] = useState("");

  // Drag & Drop States
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [dragOverCardPosition, setDragOverCardPosition] = useState<"before" | "after" | null>(null);
  const [draggingColId, setDraggingColId] = useState<string | null>(null);
  const [dragOverColTargetId, setDragOverColTargetId] = useState<string | null>(null);
  const [dragOverColPosition, setDragOverColPosition] = useState<"before" | "after" | null>(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setBoards(parsed);
        }
      }
      const savedActive = localStorage.getItem(ACTIVE_BOARD_KEY);
      if (savedActive) {
        setActiveBoardId(savedActive);
      }
    } catch {}
  }, []);

  // Listen to Pomodoro completion events to synchronize task pomodoros in real time
  useEffect(() => {
    const handlePomoCompleted = (e: Event) => {
      try {
        const custom = e as CustomEvent<{ taskId: string; newCount: number }>;
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setBoards(parsed);
          }
        }
        if (custom.detail?.taskId) {
          setSelectedCard((prev) => {
            if (prev && prev.id === custom.detail.taskId) {
              return { ...prev, pomodoros: custom.detail.newCount };
            }
            return prev;
          });
        }
      } catch {}
    };

    window.addEventListener("study_space_pomo_completed", handlePomoCompleted);
    return () => {
      window.removeEventListener("study_space_pomo_completed", handlePomoCompleted);
    };
  }, []);

  // Save to localStorage
  const saveBoards = useCallback((updated: KanbanBoard[]) => {
    setBoards(updated);
    saveStorageJSON(STORAGE_KEY, updated);
  }, []);

  const currentBoard = useMemo(() => {
    return boards.find((b) => b.id === activeBoardId) || boards[0] || DEFAULT_BOARDS[0];
  }, [boards, activeBoardId]);

  const updateCurrentBoard = useCallback(
    (mutator: (board: KanbanBoard) => KanbanBoard) => {
      setBoards((prevBoards) => {
        const activeBoard = prevBoards.find((b) => b.id === activeBoardId) || prevBoards[0] || DEFAULT_BOARDS[0];
        const updated = prevBoards.map((b) => (b.id === activeBoard.id ? mutator(b) : b));
        saveStorageJSON(STORAGE_KEY, updated);
        return updated;
      });
    },
    [activeBoardId]
  );

  // Add Card
  const handleAddCard = useCallback(
    (columnId: string, openDetail: boolean = false) => {
      if (!newCardTitle.trim()) return;
      const newCard: KanbanCard = {
        id: "card-" + Date.now(),
        columnId,
        title: newCardTitle.trim(),
        description: newCardDescription.trim() || undefined,
        checklist: [],
        priority: newCardPriority,
        dueDate: newCardDueDate ? newCardDueDate : undefined,
        createdAt: Date.now(),
      };

      updateCurrentBoard((board) => ({
        ...board,
        cards: [...board.cards, newCard],
      }));

      setNewCardTitle("");
      setNewCardDescription("");
      setNewCardPriority("medium");
      setNewCardDueDate("");
      setAddingCardColId(null);

      if (openDetail) {
        setSelectedCard(newCard);
      }
    },
    [newCardTitle, newCardDescription, newCardPriority, newCardDueDate, updateCurrentBoard]
  );

  // Card Drag Handlers
  const handleCardDragStart = useCallback((e: React.DragEvent, cardId: string, sourceColId: string) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ type: "CARD", cardId, sourceColId }));
    e.dataTransfer.effectAllowed = "move";
    setDraggingCardId(cardId);
  }, []);

  const handleCardDragEnd = useCallback(() => {
    setDraggingCardId(null);
    setDragOverColId(null);
    setDragOverCardId(null);
    setDragOverCardPosition(null);
  }, []);

  const handleCardDragOverCol = useCallback(
    (e: React.DragEvent, colId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragOverColId !== colId) {
        setDragOverColId(colId);
        setDragOverCardId(null);
        setDragOverCardPosition(null);
      }
    },
    [dragOverColId]
  );

  const handleCardDragOverCard = useCallback(
    (e: React.DragEvent, targetCardId: string) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";

      if (draggingCardId === targetCardId) return;

      const targetRect = e.currentTarget.getBoundingClientRect();
      const offsetY = e.clientY - targetRect.top;
      const position = offsetY < targetRect.height / 2 ? "before" : "after";

      setDragOverCardId(targetCardId);
      setDragOverCardPosition(position);
    },
    [draggingCardId]
  );

  const handleCardDrop = useCallback(
    (
      e: React.DragEvent,
      targetColId: string,
      targetCardId?: string,
      overridePosition?: "before" | "after"
    ) => {
      e.preventDefault();
      e.stopPropagation();
      const position = overridePosition || dragOverCardPosition || "after";
      const cachedDragOverCardId = dragOverCardId;
      setDragOverColId(null);
      setDragOverCardId(null);
      setDragOverCardPosition(null);
      setDraggingCardId(null);

      const rawData = e.dataTransfer.getData("text/plain");
      if (!rawData) return;

      try {
        const data = JSON.parse(rawData);
        if (data.type === "CARD" && data.cardId) {
          const { cardId } = data;
          updateCurrentBoard((board) => {
            const cardIndex = board.cards.findIndex((c) => c.id === cardId);
            if (cardIndex === -1) return board;

            const movedCard = { ...board.cards[cardIndex], columnId: targetColId };
            const remainingCards = board.cards.filter((c) => c.id !== cardId);

            const effectiveTargetCardId =
              targetCardId && targetCardId !== cardId
                ? targetCardId
                : cachedDragOverCardId && cachedDragOverCardId !== cardId
                ? cachedDragOverCardId
                : null;

            if (effectiveTargetCardId) {
              const targetIndex = remainingCards.findIndex((c) => c.id === effectiveTargetCardId);
              if (targetIndex !== -1) {
                const insertIndex = position === "after" ? targetIndex + 1 : targetIndex;
                remainingCards.splice(insertIndex, 0, movedCard);
                return { ...board, cards: remainingCards };
              }
            }

            // Nếu thả vào chính cột cũ mà không có vị trí thẻ đích cụ thể: GIỮ NGUYÊN VỊ TRÍ, KHÔNG ĐỔI!
            if (board.cards[cardIndex].columnId === targetColId) {
              return board;
            }

            return { ...board, cards: [...remainingCards, movedCard] };
          });
        }
      } catch {}
    },
    [dragOverCardId, dragOverCardPosition, updateCurrentBoard]
  );

  // Column Drag Handlers
  const handleColumnDragStart = useCallback((e: React.DragEvent, colId: string) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ type: "COLUMN", colId }));
    e.dataTransfer.effectAllowed = "move";
    setDraggingColId(colId);
  }, []);

  const handleColumnDragEnd = useCallback(() => {
    setDraggingColId(null);
    setDragOverColTargetId(null);
    setDragOverColPosition(null);
  }, []);

  const handleColumnDragOver = useCallback((e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    // Rê ngay trên cột đang cầm: giữ nguyên chỗ cũ, khỏi đảo qua đảo lại
    if (targetColId === draggingColId) return;

    const targetRect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - targetRect.left;
    const position = offsetX < targetRect.width / 2 ? "before" : "after";

    setDragOverColTargetId(targetColId);
    setDragOverColPosition(position);
  }, [draggingColId]);

  const handleColumnDrop = useCallback(
    (e: React.DragEvent, targetColId: string, overridePosition?: "before" | "after") => {
      e.preventDefault();
      e.stopPropagation();
      const position = overridePosition || dragOverColPosition || "after";
      setDraggingColId(null);
      setDragOverColTargetId(null);
      setDragOverColPosition(null);

      const rawData = e.dataTransfer.getData("text/plain");
      if (!rawData) return;

      try {
        const data = JSON.parse(rawData);
        if (data.type === "COLUMN" && data.colId && data.colId !== targetColId) {
          const { colId } = data;
          updateCurrentBoard((board) => {
            const sourceIdx = board.columns.findIndex((c) => c.id === colId);
            if (sourceIdx === -1) return board;

            const movedCol = board.columns[sourceIdx];
            const remaining = board.columns.filter((c) => c.id !== colId);
            const targetIdx = remaining.findIndex((c) => c.id === targetColId);
            if (targetIdx === -1) return board;

            const insertIdx = position === "after" ? targetIdx + 1 : targetIdx;
            remaining.splice(insertIdx, 0, movedCol);

            return {
              ...board,
              columns: remaining.map((col, idx) => ({ ...col, order: idx + 1 })),
            };
          });
        }
      } catch {}
    },
    [dragOverColPosition, updateCurrentBoard]
  );

  // Quick Move Column (Left / Right)
  const handleQuickMoveColumn = useCallback(
    (colId: string, direction: "left" | "right") => {
      updateCurrentBoard((board) => {
        const idx = board.columns.findIndex((c) => c.id === colId);
        if (idx === -1) return board;
        const targetIdx = direction === "left" ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= board.columns.length) return board;

        const newCols = [...board.columns];
        const [removed] = newCols.splice(idx, 1);
        newCols.splice(targetIdx, 0, removed);

        return {
          ...board,
          columns: newCols.map((col, i) => ({ ...col, order: i + 1 })),
        };
      });
    },
    [updateCurrentBoard]
  );

  // Move Card between Columns
  const handleMoveCard = useCallback(
    (cardId: string, targetColId: string) => {
      updateCurrentBoard((board) => ({
        ...board,
        cards: board.cards.map((c) => (c.id === cardId ? { ...c, columnId: targetColId } : c)),
      }));
      setSelectedCard((prev) => (prev && prev.id === cardId ? { ...prev, columnId: targetColId } : prev));
    },
    [updateCurrentBoard]
  );

  // Prompt & Confirm Delete Card
  const promptDeleteCard = useCallback((card: KanbanCard) => {
    setCardToDelete(card);
  }, []);

  // Đặt lại thẻ vừa xóa về đúng chỗ cũ
  const undoDeleteCard = useCallback(() => {
    if (!lastDeletedCard) return;
    const stash = lastDeletedCard;
    setBoards((prevBoards) => {
      const updated = prevBoards.map((b) => {
        if (b.id !== stash.boardId) return b;
        const cards = [...b.cards];
        cards.splice(Math.min(stash.index, cards.length), 0, stash.card);
        return { ...b, cards };
      });
      saveStorageJSON(STORAGE_KEY, updated);
      return updated;
    });
    setLastDeletedCard(null);
  }, [lastDeletedCard]);

  const handleConfirmDeleteCard = useCallback(() => {
    if (!cardToDelete) return;
    const cardId = cardToDelete.id;
    const cardTitle = cardToDelete.title;
    const boardId = activeBoardId;
    const index = currentBoard.cards.findIndex((c) => c.id === cardId);
    setLastDeletedCard({
      boardId,
      card: cardToDelete,
      index: index < 0 ? 0 : index,
      deletedAt: Date.now(),
    });
    updateCurrentBoard((board) => ({
      ...board,
      cards: board.cards.filter((c) => c.id !== cardId),
    }));
    setSelectedCard((prev) => (prev?.id === cardId ? null : prev));
    setCardToDelete(null);
    toast.success(`Đã xóa "${cardTitle}"`, {
      action: {
        label: "Hoàn tác",
        onClick: () => undoDeleteCard(),
      },
    });
  }, [cardToDelete, currentBoard.cards, activeBoardId, updateCurrentBoard, undoDeleteCard]);

  const clearDeletedCard = useCallback(() => {
    setLastDeletedCard(null);
  }, []);

  // Column CRUD
  const handleAddColumn = useCallback(() => {
    if (!newColumnTitle.trim()) return;
    const newCol: KanbanColumn = {
      id: "col-" + Date.now(),
      title: newColumnTitle.trim(),
      order: currentBoard.columns.length + 1,
    };
    updateCurrentBoard((board) => ({
      ...board,
      columns: [...board.columns, newCol],
    }));
    setNewColumnTitle("");
    setIsAddingColumn(false);
  }, [newColumnTitle, currentBoard.columns.length, updateCurrentBoard]);

  const promptDeleteColumn = useCallback(
    (col: KanbanColumn) => {
      if (currentBoard.columns.length <= 1) {
        toast.error("Phải giữ lại ít nhất 1 cột trong bảng.");
        return;
      }
      setColumnToDelete(col);
    },
    [currentBoard.columns.length]
  );

  const handleConfirmDeleteColumn = useCallback(() => {
    if (!columnToDelete) return;
    const colId = columnToDelete.id;
    const colTitle = columnToDelete.title;
    updateCurrentBoard((board) => ({
      ...board,
      columns: board.columns.filter((c) => c.id !== colId),
      cards: board.cards.filter((c) => c.columnId !== colId),
    }));
    setColumnToDelete(null);
    toast.success(`Đã xóa cột "${colTitle}"`);
  }, [columnToDelete, updateCurrentBoard]);

  const handleRenameColumn = useCallback(
    (colId: string) => {
      const trimmed = editingColumnTitle.trim();
      if (trimmed) {
        updateCurrentBoard((board) => ({
          ...board,
          columns: board.columns.map((c) => (c.id === colId ? { ...c, title: trimmed } : c)),
        }));
      }
      setEditingColumnId(null);
      setEditingColumnTitle("");
    },
    [editingColumnTitle, updateCurrentBoard]
  );

  // Toggle Checklist Item
  const handleToggleChecklist = useCallback(
    (cardId: string, itemId: string) => {
      updateCurrentBoard((board) => {
        const updatedCards = board.cards.map((c) => {
          if (c.id !== cardId) return c;
          const updatedList = c.checklist.map((item) =>
            item.id === itemId ? { ...item, completed: !item.completed } : item
          );
          return { ...c, checklist: updatedList };
        });
        return { ...board, cards: updatedCards };
      });

      setSelectedCard((prev) => {
        if (!prev || prev.id !== cardId) return prev;
        return {
          ...prev,
          checklist: prev.checklist.map((item) =>
            item.id === itemId ? { ...item, completed: !item.completed } : item
          ),
        };
      });
    },
    [updateCurrentBoard]
  );

  // Quick Toggle Entire Card Complete
  const handleToggleCardComplete = useCallback(
    (cardId: string) => {
      const card = currentBoard.cards.find((c) => c.id === cardId);
      if (!card) return;

      const doneCol =
        currentBoard.columns.find((col) => /xong|done|hoàn thành/i.test(col.title)) ||
        (currentBoard.columns.length > 1 ? currentBoard.columns[currentBoard.columns.length - 1] : null);

      const isCurrentlyDone = Boolean(card.completed) || (doneCol ? card.columnId === doneCol.id : false);
      const nextCompleted = !isCurrentlyDone;

      const firstCol = currentBoard.columns[0];
      const targetColId =
        nextCompleted && doneCol
          ? doneCol.id
          : !nextCompleted && firstCol
          ? firstCol.id
          : card.columnId;

      updateCurrentBoard((board) => ({
        ...board,
        cards: board.cards.map((c) => {
          if (c.id !== cardId) return c;
          return {
            ...c,
            completed: nextCompleted,
            columnId: targetColId,
            checklist: c.checklist.map((it) => ({ ...it, completed: nextCompleted })),
          };
        }),
      }));

      setSelectedCard((prev) =>
        prev && prev.id === cardId
          ? {
              ...prev,
              completed: nextCompleted,
              columnId: targetColId,
              checklist: prev.checklist.map((it) => ({ ...it, completed: nextCompleted })),
            }
          : prev
      );
    },
    [currentBoard, updateCurrentBoard]
  );

  // Add Checklist Item
  const handleAddChecklistItem = useCallback(
    (cardId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const newItem: KanbanChecklistItem = {
        id: "chk-" + Date.now(),
        text: trimmed,
        completed: false,
      };

      updateCurrentBoard((board) => ({
        ...board,
        cards: board.cards.map((c) =>
          c.id === cardId ? { ...c, checklist: [...c.checklist, newItem] } : c
        ),
      }));

      setSelectedCard((prev) =>
        prev && prev.id === cardId ? { ...prev, checklist: [...prev.checklist, newItem] } : prev
      );
    },
    [updateCurrentBoard]
  );

  // Update Checklist Item Text
  const handleUpdateChecklistItemText = useCallback(
    (cardId: string, itemId: string, newText: string) => {
      const trimmed = newText.trim();
      if (!trimmed) return;
      updateCurrentBoard((board) => ({
        ...board,
        cards: board.cards.map((c) =>
          c.id === cardId
            ? {
                ...c,
                checklist: c.checklist.map((it) =>
                  it.id === itemId ? { ...it, text: trimmed } : it
                ),
              }
            : c
        ),
      }));

      setSelectedCard((prev) =>
        prev && prev.id === cardId
          ? {
              ...prev,
              checklist: prev.checklist.map((it) =>
                it.id === itemId ? { ...it, text: trimmed } : it
              ),
            }
          : prev
      );
    },
    [updateCurrentBoard]
  );

  // Delete Checklist Item
  const handleDeleteChecklistItem = useCallback(
    (cardId: string, itemId: string) => {
      updateCurrentBoard((board) => ({
        ...board,
        cards: board.cards.map((c) =>
          c.id === cardId
            ? { ...c, checklist: c.checklist.filter((it) => it.id !== itemId) }
            : c
        ),
      }));

      setSelectedCard((prev) =>
        prev && prev.id === cardId
          ? { ...prev, checklist: prev.checklist.filter((it) => it.id !== itemId) }
          : prev
      );
      toast.success("Đã xóa mục công việc");
    },
    [updateCurrentBoard]
  );

  // Create New Board (tên nhập trong app, id ngẫu nhiên khỏi trùng)
  const handleCreateBoard = useCallback((title?: string) => {
    const name = (title ?? "").trim();
    if (!name) return;
    if (boards.some((b) => b.title.toLowerCase() === name.toLowerCase())) {
      toast.error("Đã có bảng tên này rồi.");
      return;
    }
    const uid = () =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const stamp = Date.now();
    const newBoard: KanbanBoard = {
      id: `board-${uid()}`,
      title: name,
      createdAt: stamp,
      columns: [
        { id: `col-${uid()}-1`, title: "Cần làm", order: 1 },
        { id: `col-${uid()}-2`, title: "Đang làm", order: 2 },
        { id: `col-${uid()}-3`, title: "Đã xong", order: 3 },
      ],
      cards: [],
    };
    const updated = [...boards, newBoard];
    saveBoards(updated);
    setActiveBoardId(newBoard.id);
    try {
      localStorage.setItem(ACTIVE_BOARD_KEY, newBoard.id);
    } catch {}
  }, [boards, saveBoards]);

  // Prompt & Confirm Delete Board
  const promptDeleteBoard = useCallback(
    (board: KanbanBoard) => {
      if (boards.length <= 1) {
        toast.error("Bạn phải giữ lại ít nhất 1 bảng học tập.");
        return;
      }
      setBoardToDelete(board);
    },
    [boards.length]
  );

  const handleConfirmDeleteBoard = useCallback(() => {
    if (!boardToDelete) return;
    const boardId = boardToDelete.id;
    const boardTitle = boardToDelete.title;
    const updated = boards.filter((b) => b.id !== boardId);
    saveBoards(updated);
    setActiveBoardId(updated[0].id);
    setBoardToDelete(null);
    toast.success(`Đã xóa bảng "${boardTitle}"`);
  }, [boardToDelete, boards, saveBoards]);

  // Update Card Due Date
  const handleUpdateCardDueDate = useCallback(
    (newDueDate?: string) => {
      if (!selectedCard) return;
      setSelectedCard((prev) => (prev ? { ...prev, dueDate: newDueDate } : null));
      updateCurrentBoard((b) => ({
        ...b,
        cards: b.cards.map((c) => (c.id === selectedCard.id ? { ...c, dueDate: newDueDate } : c)),
      }));
    },
    [selectedCard, updateCurrentBoard]
  );

  // Filter cards by search
  const filterCards = useCallback(
    (cards: KanbanCard[]) => {
      if (!searchQuery.trim()) return cards;
      const q = searchQuery.toLowerCase();
      return cards.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q)) ||
          c.checklist.some((it) => it.text.toLowerCase().includes(q))
      );
    },
    [searchQuery]
  );

  // Active dragging items lookup
  const draggingCard = useMemo(
    () => currentBoard.cards.find((c) => c.id === draggingCardId) || null,
    [currentBoard.cards, draggingCardId]
  );
  const draggingCol = useMemo(
    () => currentBoard.columns.find((c) => c.id === draggingColId) || null,
    [currentBoard.columns, draggingColId]
  );

  // Check if column move actually changes its order
  const isMeaningfulColMove = useCallback(
    (targetColId: string, position: "before" | "after"): boolean => {
      if (!draggingColId || draggingColId === targetColId || currentBoard.columns.length <= 1)
        return false;
      const sourceIdx = currentBoard.columns.findIndex((c) => c.id === draggingColId);
      const targetIdx = currentBoard.columns.findIndex((c) => c.id === targetColId);
      if (sourceIdx === -1 || targetIdx === -1) return false;

      if (sourceIdx < targetIdx) {
        if (position === "before" && targetIdx === sourceIdx + 1) return false;
      }
      if (sourceIdx > targetIdx) {
        if (position === "after" && targetIdx === sourceIdx - 1) return false;
      }
      return true;
    },
    [draggingColId, currentBoard.columns]
  );

  // Check if card move actually changes its position
  const isMeaningfulCardMove = useCallback(
    (targetCard: KanbanCard, position: "before" | "after", currentCards: KanbanCard[]): boolean => {
      if (!draggingCard || draggingCard.id === targetCard.id) return false;
      if (draggingCard.columnId !== targetCard.columnId) return true;

      const sourceIdx = currentCards.findIndex((c) => c.id === draggingCard.id);
      const targetIdx = currentCards.findIndex((c) => c.id === targetCard.id);
      if (sourceIdx === -1 || targetIdx === -1) return false;

      if (sourceIdx < targetIdx) {
        if (position === "before" && targetIdx === sourceIdx + 1) return false;
      }
      if (sourceIdx > targetIdx) {
        if (position === "after" && targetIdx === sourceIdx - 1) return false;
      }
      return true;
    },
    [draggingCard]
  );

  return {
    boards,
    activeBoardId,
    setActiveBoardId,
    currentBoard,
    saveBoards,
    updateCurrentBoard,
    boardToDelete,
    setBoardToDelete,
    columnToDelete,
    setColumnToDelete,
    cardToDelete,
    setCardToDelete,
    searchQuery,
    setSearchQuery,
    viewMode,
    setViewMode,
    selectedCard,
    setSelectedCard,
    addingCardColId,
    setAddingCardColId,
    newCardTitle,
    setNewCardTitle,
    newCardDescription,
    setNewCardDescription,
    newCardPriority,
    setNewCardPriority,
    newCardDueDate,
    setNewCardDueDate,
    isAddingColumn,
    setIsAddingColumn,
    newColumnTitle,
    setNewColumnTitle,
    editingColumnId,
    setEditingColumnId,
    editingColumnTitle,
    setEditingColumnTitle,
    isStatusDropdownOpen,
    setIsStatusDropdownOpen,
    isBoardDropdownOpen,
    setIsBoardDropdownOpen,
    isEditingBoardTitle,
    setIsEditingBoardTitle,
    editingBoardTitleText,
    setEditingBoardTitleText,
    draggingCardId,
    dragOverColId,
    dragOverCardId,
    dragOverCardPosition,
    draggingColId,
    dragOverColTargetId,
    dragOverColPosition,
    draggingCard,
    draggingCol,
    handleAddCard,
    handleCardDragStart,
    handleCardDragEnd,
    handleCardDragOverCol,
    handleCardDragOverCard,
    handleCardDrop,
    handleColumnDragStart,
    handleColumnDragEnd,
    handleColumnDragOver,
    handleColumnDrop,
    handleQuickMoveColumn,
    handleMoveCard,
    promptDeleteCard,
    handleConfirmDeleteCard,
    lastDeletedCard,
    undoDeleteCard,
    clearDeletedCard,
    handleAddColumn,
    promptDeleteColumn,
    handleConfirmDeleteColumn,
    handleRenameColumn,
    handleToggleChecklist,
    handleToggleCardComplete,
    handleAddChecklistItem,
    handleUpdateChecklistItemText,
    handleDeleteChecklistItem,
    handleCreateBoard,
    promptDeleteBoard,
    handleConfirmDeleteBoard,
    handleUpdateCardDueDate,
    filterCards,
    isMeaningfulColMove,
    isMeaningfulCardMove,
  };
}
