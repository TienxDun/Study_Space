export interface StudyNote {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
  isPinned?: boolean;
}

export interface StudyNotesWidgetProps {
  isOpen: boolean;
  onClose: () => void;
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
