export interface StudyNote {
  id: string;
  title: string;
  content: string;
  category: string;
  updatedAt: number;
  isPinned?: boolean;
}

export interface StudyNotesWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  onCompactModeChange?: (isCompact: boolean) => void;
}

export interface ActiveFormats {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  highlight: boolean;
  h1: boolean;
  h2: boolean;
  quote: boolean;
  code: boolean;
  todo: boolean;
  unorderedList: boolean;
  orderedList: boolean;
}

export const NOTE_CATEGORIES = ["Tất cả", "Học tập", "Dự án", "Công thức", "Cá nhân"] as const;

export const CATEGORY_COLORS: Record<
  string,
  {
    dot: string;
    bgDark: string;
    textDark: string;
    borderDark: string;
    bgLight: string;
    textLight: string;
    borderLight: string;
  }
> = {
  "Học tập": {
    dot: "bg-emerald-500",
    bgDark: "bg-emerald-500/15",
    textDark: "text-emerald-300",
    borderDark: "border-emerald-500/30",
    bgLight: "bg-emerald-50",
    textLight: "text-emerald-700",
    borderLight: "border-emerald-300",
  },
  "Dự án": {
    dot: "bg-sky-500",
    bgDark: "bg-sky-500/15",
    textDark: "text-sky-300",
    borderDark: "border-sky-500/30",
    bgLight: "bg-sky-50",
    textLight: "text-sky-700",
    borderLight: "border-sky-300",
  },
  "Công thức": {
    dot: "bg-amber-500",
    bgDark: "bg-amber-500/15",
    textDark: "text-amber-300",
    borderDark: "border-amber-500/30",
    bgLight: "bg-amber-50",
    textLight: "text-amber-700",
    borderLight: "border-amber-300",
  },
  "Cá nhân": {
    dot: "bg-purple-500",
    bgDark: "bg-purple-500/15",
    textDark: "text-purple-300",
    borderDark: "border-purple-500/30",
    bgLight: "bg-purple-50",
    textLight: "text-purple-700",
    borderLight: "border-purple-300",
  },
};
