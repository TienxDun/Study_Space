import { MoodType, Track, AmbientSound } from "../study-types";
import {
  Icon,
} from "@phosphor-icons/react";

export interface SoundMixerWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: MixerTab;
  onTabChange: (tab: MixerTab) => void;
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
  isShuffle: boolean;
  onToggleShuffle: () => void;
  isLooping: boolean;
  onToggleLoop: () => void;
  ambientVolumes: Record<string, number>;
  activeCount: number;
  toggleSound: (id: string) => void;
  handleSoundVolume: (id: string, volume: number) => void;
  resetAllSounds: () => void;
  handleTogglePreset: (recipe: Record<string, number>) => void;
}

export type DesktopSoundMixerProps = SoundMixerWidgetProps;

export type MixerTab = "music" | "ambience";

export interface AmbientPreset {
  label: string;
  icon: Icon;
  color: string;
  recipe: Record<string, number>;
}

export type { MoodType, Track, AmbientSound };
