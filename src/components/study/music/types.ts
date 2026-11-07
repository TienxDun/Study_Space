import { Track, MoodType, StudyEmbedItem } from "../study-types";

export interface StudyMusicPlayerProps {
  isGlobalMuted?: boolean;
  onToggleMute?: () => void;
  onMuteChange?: (muted: boolean) => void;
  isMixerOpen?: boolean;
  onToggleMixer?: () => void;
  onCloseMixer?: () => void;
  isExternalStreamActive?: boolean;
  externalStreamItem?: StudyEmbedItem | null;
  onExpandExternalStream?: () => void;
  onStopExternalStream?: () => void;
  isZenMode?: boolean;
  onBack?: () => void;
  backLabel?: string;
  hasEntered?: boolean;
  isHidden?: boolean;
  isMobile?: boolean;
}

export type { Track, MoodType, StudyEmbedItem };
export { STUDY_TRACKS_BY_MOOD } from "../study-types";
