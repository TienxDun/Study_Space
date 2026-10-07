import { MoodType, Track, AmbientSound } from "../study-types";
import { LucideIcon } from "lucide-react";

export interface SoundMixerWidgetProps {
  isOpen: boolean;
  onClose: () => void;
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
}

export type MixerTab = "music" | "ambience";

export interface AmbientPreset {
  label: string;
  icon: LucideIcon;
  color: string;
  recipe: Record<string, number>;
}

export type { MoodType, Track, AmbientSound };
