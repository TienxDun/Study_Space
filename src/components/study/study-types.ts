import rawScenes from "@/data/assets/scenes.json";
import rawTracks from "@/data/assets/tracks.json";
import rawSounds from "@/data/assets/sounds.json";
import { 
  getAssetBaseUrl, 
  resolveScene, 
  resolveTrack, 
  resolveAmbientSound,
  LegacyScene,
  LegacyTrack,
  LegacyAmbientSound
} from "@/lib/asset-resolver";
import { SceneAsset, TrackAsset, AmbientSoundAsset } from "@/types/assets";

// Base URLs tương thích ngược
export const STUDY_CDN_URL = getAssetBaseUrl();
export const STUDY_MUSIC_URL = `${STUDY_CDN_URL}/musics`;
export const STUDY_SOUND_URL = `${STUDY_CDN_URL}/sounds`;
export const STUDY_SCENE_URL = `${STUDY_CDN_URL}/scenes`;
export const STUDY_THUMB_URL = `${STUDY_CDN_URL}/thumbnails`;
export const STUDY_AUTHOR_URL = `${STUDY_CDN_URL}/authors`;

export type MoodType = "lofi" | "jazz" | "relax";

export type Track = LegacyTrack;
export type AmbientSound = LegacyAmbientSound;
export type Scene = LegacyScene;

export interface StudyTask {
  id: string;
  text: string;
  completed: boolean;
  pomodoros: number;
  priority: "low" | "medium" | "high";
  createdAt: number;
}

export interface KanbanChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  columnId: string;
  priority?: "low" | "medium" | "high";
  checklist: KanbanChecklistItem[];
  dueDate?: string;
  completed?: boolean;
  pomodoros?: number;
  createdAt: number;
}

export interface KanbanColumn {
  id: string;
  title: string;
  order: number;
}

export interface KanbanBoard {
  id: string;
  title: string;
  columns: KanbanColumn[];
  cards: KanbanCard[];
  createdAt: number;
}

// Chuyển đổi dữ liệu từ catalog JSON sang objects hoàn chỉnh
export const STUDY_TRACKS_BY_MOOD: Record<MoodType, Track[]> = {
  lofi: (rawTracks.lofi as TrackAsset[]).map(resolveTrack),
  jazz: (rawTracks.jazz as TrackAsset[]).map(resolveTrack),
  relax: (rawTracks.relax as TrackAsset[]).map(resolveTrack),
};

export const ALL_STUDY_TRACKS: Track[] = [
  ...STUDY_TRACKS_BY_MOOD.lofi,
  ...STUDY_TRACKS_BY_MOOD.jazz,
  ...STUDY_TRACKS_BY_MOOD.relax,
];

export const AMBIENT_SOUNDS: AmbientSound[] = (rawSounds as AmbientSoundAsset[]).map(resolveAmbientSound);

export const STUDY_SCENES: Scene[] = (rawScenes as SceneAsset[]).map(resolveScene);

export type EmbedPlatform = "youtube" | "spotify" | "custom";

export interface StudyEmbedItem {
  id: string;
  title: string;
  url: string;
  embedUrl: string;
  platform: EmbedPlatform;
  category?: string;
  thumbnail?: string;
  isLive?: boolean;
  addedAt?: number;
}

export const CURATED_EMBED_PRESETS: StudyEmbedItem[] = [
  {
    id: "preset-chillhop-live",
    title: "Chillhop Radio — Jazzy & Lofi Hip Hop",
    url: "https://www.youtube.com/watch?v=7NOSDKb0HlU",
    embedUrl: "https://www.youtube-nocookie.com/embed/7NOSDKb0HlU?autoplay=1&rel=0&enablejsapi=1",
    platform: "youtube",
    category: "Jazz Lofi",
    thumbnail: "https://img.youtube.com/vi/7NOSDKb0HlU/mqdefault.jpg",
    isLive: true
  },
  {
    id: "preset-synthwave-chill",
    title: "Synthwave Radio — Chill Beats to Code/Chill",
    url: "https://www.youtube.com/watch?v=4xDzrJKXOOY",
    embedUrl: "https://www.youtube-nocookie.com/embed/4xDzrJKXOOY?autoplay=1&rel=0&enablejsapi=1",
    platform: "youtube",
    category: "Synthwave",
    thumbnail: "https://img.youtube.com/vi/4xDzrJKXOOY/mqdefault.jpg",
    isLive: true
  },
  {
    id: "preset-coffee-shop-jazz",
    title: "Coffee Shop Ambience & Bossa Nova Jazz",
    url: "https://www.youtube.com/watch?v=Dx5qFachd3A",
    embedUrl: "https://www.youtube-nocookie.com/embed/Dx5qFachd3A?autoplay=1&rel=0&enablejsapi=1",
    platform: "youtube",
    category: "Coffee Jazz",
    thumbnail: "https://img.youtube.com/vi/Dx5qFachd3A/mqdefault.jpg",
    isLive: true
  },
  {
    id: "preset-spotify-peaceful-piano",
    title: "Peaceful Piano Study",
    url: "https://open.spotify.com/playlist/37i9dQZF1DX4sWSpwq3LiO",
    embedUrl: "https://open.spotify.com/embed/playlist/37i9dQZF1DX4sWSpwq3LiO?utm_source=generator&theme=0",
    platform: "spotify",
    category: "Piano Cổ Điển",
    thumbnail: "https://images.unsplash.com/photo-1513883049090-d0b7439799bf?w=600&auto=format&fit=crop&q=80",
    isLive: false
  },
  {
    id: "preset-spotify-deep-focus",
    title: "Deep Focus Ambient Study",
    url: "https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ",
    embedUrl: "https://open.spotify.com/embed/playlist/37i9dQZF1DWZeKCadgRdKQ?utm_source=generator&theme=0",
    platform: "spotify",
    category: "Ambient",
    thumbnail: "https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=600&auto=format&fit=crop&q=80",
    isLive: false
  }
];

export function parseEmbedUrl(rawUrl: string): { embedUrl: string; platform: EmbedPlatform; title?: string; thumbnail?: string; isLive?: boolean } | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();

  // 1. YouTube URL formats
  const ytPlaylistMatch = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (trimmed.includes("youtube.com") && ytPlaylistMatch && !trimmed.includes("watch?v=")) {
    return {
      embedUrl: `https://www.youtube-nocookie.com/embed/videoseries?list=${ytPlaylistMatch[1]}&autoplay=1&enablejsapi=1`,
      platform: "youtube",
      title: "YouTube Playlist",
      isLive: false
    };
  }

  const ytChannelLive = trimmed.match(/youtube\.com\/channel\/([a-zA-Z0-9_-]+)(?:\/live)?/);
  if (ytChannelLive && trimmed.includes("live")) {
    return {
      embedUrl: `https://www.youtube-nocookie.com/embed/live_stream?channel=${ytChannelLive[1]}&autoplay=1&enablejsapi=1`,
      platform: "youtube",
      title: "YouTube Live Stream",
      isLive: true
    };
  }

  const ytLiveMatch = trimmed.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/);
  if (ytLiveMatch) {
    const videoId = ytLiveMatch[1];
    return {
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&enablejsapi=1`,
      platform: "youtube",
      title: "YouTube Live Stream",
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      isLive: true
    };
  }

  const ytVideoMatch = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytVideoMatch) {
    const videoId = ytVideoMatch[1];
    return {
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&enablejsapi=1`,
      platform: "youtube",
      title: "YouTube Video",
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      isLive: false
    };
  }

  // 2. Spotify URL formats
  const spotifyMatch = trimmed.match(/open\.spotify\.com\/(playlist|track|album|artist|episode|show)\/([a-zA-Z0-9]+)/);
  if (spotifyMatch) {
    const [, type, id] = spotifyMatch;
    return {
      embedUrl: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`,
      platform: "spotify",
      title: `Spotify ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      isLive: false
    };
  }

  const spotifyUriMatch = trimmed.match(/spotify:(playlist|track|album|artist):([a-zA-Z0-9]+)/);
  if (spotifyUriMatch) {
    const [, type, id] = spotifyUriMatch;
    return {
      embedUrl: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`,
      platform: "spotify",
      title: `Spotify ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      isLive: false
    };
  }

  // 3. Fallback: chỉ chấp nhận link nhúng từ máy chủ quen thuộc.
  // Không nhận link lạ (vd evil.com/embed) để khỏi bị nhúng trang giả mạo.
  const TRUSTED_EMBED_HOSTS = [
    "www.youtube-nocookie.com/embed/",
    "www.youtube.com/embed/",
    "open.spotify.com/embed/",
    "player.vimeo.com/",
    "w.soundcloud.com/player/",
  ];
  if (trimmed.startsWith("https://")) {
    const withoutScheme = trimmed.slice("https://".length).toLowerCase();
    const trusted = TRUSTED_EMBED_HOSTS.some((h) => withoutScheme.startsWith(h));
    if (trusted) {
      return {
        embedUrl: trimmed,
        platform: "custom",
        title: "Custom Stream",
        isLive: false
      };
    }
  }

  return null;
}
