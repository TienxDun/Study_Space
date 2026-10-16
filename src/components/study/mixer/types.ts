import { MoodType, Track, AmbientSound } from "../study-types";
import {
  Icon,
} from "@phosphor-icons/react";

export interface SoundMixerWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab?: MixerTab;
  onTabChange?: (tab: MixerTab) => void;
  onAmbientActiveCountChange?: (count: number) => void;
  currentMood: MoodType;
  onSelectMood: (mood: MoodType) => void;
  currentTrack: Track;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onSelectTrack: (track: Track) => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  isLooping: boolean;
  onToggleLoop: () => void;
  isGlobalMuted: boolean;
  onBack?: () => void;
  backLabel?: string;
}

export type MixerTab = "music" | "ambience";

export interface AmbientPreset {
  label: string;
  icon: Icon;
  color: string;
  recipe: Record<string, number>;
}

export type { MoodType, Track, AmbientSound };
