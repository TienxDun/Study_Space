import { STORAGE_KEYS } from "@/lib/storage-keys";
import { CategoryOption } from "./types";

export const STORAGE_CUSTOM_EMBEDS_KEY = STORAGE_KEYS.customEmbeds;
export const STORAGE_ACTIVE_EMBED_KEY = STORAGE_KEYS.activeEmbed;
export const STORAGE_VIEW_MODE_KEY = STORAGE_KEYS.embedViewMode;
export const STORAGE_SPLIT_RATIO_KEY = "study_embed_split_ratio";

export const DEFAULT_SPLIT_RATIO = 58;
export const MIN_SPLIT_RATIO = 28;
export const MAX_SPLIT_RATIO = 72;

export const GENERIC_STREAM_TITLES = [
  "YouTube Video",
  "YouTube Live Stream",
  "YouTube Playlist",
  "Custom Stream",
  "Spotify Playlist",
  "Spotify Track",
  "Spotify Album",
];

export const CATEGORY_DEFINITIONS: Omit<CategoryOption, "label">[] = [
  { key: "all", accent: "text-white" },
  { key: "youtube", accent: "text-accent-stream-bright" },
  { key: "spotify", accent: "text-accent-music-bright" },
  { key: "saved", accent: "text-accent-scene-bright" },
];
