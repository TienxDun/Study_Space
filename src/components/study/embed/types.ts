import { StudyEmbedItem } from "../study-types";

export interface StudyEmbedPlayerWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  onPipModeChange?: (isPip: boolean) => void;
  activeItem?: StudyEmbedItem | null;
  onStreamActiveChange?: (isActive: boolean) => void;
  onActiveItemChange?: (item: StudyEmbedItem | null) => void;
  isZenMode?: boolean;
}

export type ViewMode = "grid" | "list";

export interface CategoryOption {
  key: string;
  label: string;
  accent: string;
}

export type { StudyEmbedItem };
