export interface FeatureItem {
  id: string;
  title: string;
  shortcut?: string;
  description: string;
  icon: React.ReactNode;
}

export interface FeatureGroup {
  id: string;
  categoryTitle: string;
  categoryBadge: string;
  categorySubtitle: string;
  features: FeatureItem[];
}

export interface QuestTask {
  id: string;
  title: string;
  shortcut: string;
  hint: string;
  icon: React.ReactNode;
}

export interface StudyOnboardingTourProps {
  isOpen?: boolean;
  onClose?: () => void;
  onOpenScenes?: () => void;
  onOpenMixer?: () => void;
  onTogglePomodoro?: () => void;
  onOpenChat?: () => void;
  onOpenTasks?: () => void;
  onOpenNotes?: () => void;
  onOpenShortcuts?: () => void;
}
