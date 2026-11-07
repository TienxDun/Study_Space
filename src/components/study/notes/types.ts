export interface StudyNote {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
  isPinned?: boolean;
  deletedAt?: number;
  restoredAt?: number;
}

export function isNoteActive(note: StudyNote): boolean {
  if (!note) return false;
  if (!note.deletedAt) return true;
  return Boolean(note.restoredAt) && (note.restoredAt ?? 0) > note.deletedAt;
}

export interface StudyNotesWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  zIndex?: number;
  onFocus?: () => void;
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
