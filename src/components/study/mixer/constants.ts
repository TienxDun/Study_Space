import {
  HeadphonesIcon,
  CoffeeIcon,
  MoonIcon,
  FlameIcon,
  CloudRainIcon,
  WavesIcon,
  SparkleIcon,
  TreeEvergreenIcon,
  TrainIcon,
} from "@phosphor-icons/react";
import { AmbientPreset } from "./types";

export const MOOD_OPTIONS = [
  { key: "lofi", label: "Lo-fi", icon: HeadphonesIcon, color: "text-indigo-400" },
  { key: "jazz", label: "Jazz", icon: CoffeeIcon, color: "text-emerald-400" },
  { key: "relax", label: "Relax", icon: MoonIcon, color: "text-amber-400" },
] as const;

export const AMBIENT_PRESETS: AmbientPreset[] = [
  {
    label: "Quán Cafe",
    icon: CoffeeIcon,
    color: "text-amber-400",
    recipe: { "Window Rain": 0.5, "People Talking": 0.35, Keyboard: 0.25 },
  },
  {
    label: "Lửa trại",
    icon: FlameIcon,
    color: "text-orange-400",
    recipe: { Campfire: 0.6, Forest: 0.4, Wind: 0.25 },
  },
  {
    label: "Mưa bão",
    icon: CloudRainIcon,
    color: "text-sky-400",
    recipe: { "Summer Storm": 0.6, Thunders: 0.35, "City Rain": 0.3 },
  },
  {
    label: "Sóng biển",
    icon: WavesIcon,
    color: "text-teal-400",
    recipe: { Waves: 0.6, Wind: 0.25, "Bird Chirping": 0.3 },
  },
  {
    label: "Vũ trụ",
    icon: SparkleIcon,
    color: "text-purple-400",
    recipe: { "Deep Space": 0.6, Underwater: 0.35, Fan: 0.2 },
  },
  {
    label: "Rừng cây",
    icon: TreeEvergreenIcon,
    color: "text-emerald-400",
    recipe: { Forest: 0.55, River: 0.4, "Bird Chirping": 0.35 },
  },
  {
    label: "Tàu đêm",
    icon: TrainIcon,
    color: "text-indigo-400",
    recipe: { Train: 0.55, "City Rain": 0.35, Wind: 0.2 },
  },
  {
    label: "Lò sưởi",
    icon: FlameIcon,
    color: "text-rose-400",
    recipe: { Fireplace: 0.6, "Window Rain": 0.4, Keyboard: 0.25 },
  },
];
