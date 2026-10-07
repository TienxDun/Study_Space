import { KanbanBoard } from "../types";

export const DEFAULT_BOARDS: KanbanBoard[] = [
  {
    id: "board-default",
    title: "Nhiệm vụ học tập",
    createdAt: Date.now(),
    columns: [
      { id: "col-todo", title: "Cần làm", order: 1 },
      { id: "col-in-progress", title: "Đang làm", order: 2 },
      { id: "col-done", title: "Đã xong", order: 3 },
    ],
    cards: [],
  },
];
