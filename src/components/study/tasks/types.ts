export type {
  KanbanBoard,
  KanbanCard,
  KanbanColumn,
  KanbanChecklistItem,
} from "../study-types";

export interface StudyTasksWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  zIndex?: number;
  onFocus?: () => void;
}

export type ViewMode = "board" | "list";

export type CardPriority = "high" | "medium" | "low";

export interface DeadlineStatus {
  status: "overdue" | "today" | "tomorrow" | "future";
  label: string;
  shortLabel: string;
  badgeClass: string;
  isOverdue?: boolean;
  isToday?: boolean;
  isTomorrow?: boolean;
  formattedFull: string;
}
