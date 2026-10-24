import { SceneAsset, TrackAsset, AmbientSoundAsset } from "@/types/assets";

/**
 * Lấy Base URL của Asset CDN:
 * 1. Nếu có biến môi trường NEXT_PUBLIC_STUDY_CDN_URL (ví dụ Cloudflare R2 Custom Domain), ưu tiên dùng.
 * 2. Ngược lại fallback về đường dẫn nội bộ /study.
 */
export function getAssetBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_STUDY_CDN_URL) {
    return process.env.NEXT_PUBLIC_STUDY_CDN_URL.replace(/\/$/, "");
  }
  return "/study";
}

/**
 * Phân giải đường dẫn tài nguyên:
 * - Nếu là URL tuyệt đối (http:// hoặc https://), giữ nguyên 100%.
 * - Nếu là đường dẫn tương đối (ví dụ "scenes/chill/rain.mp4"), tự động nối với CDN Base URL.
 */
export function resolveAssetUrl(path: string | undefined | null): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  const baseUrl = getAssetBaseUrl();
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${baseUrl}/${cleanPath}`;
}

export interface LegacyScene {
  id: string;
  name: string;
  category: string;
  type: "VIDEO" | "IMAGE";
  bgUrl: string;
  thumbnailUrl: string;
  tags?: string[];
  description?: string;
  badge?: string;
  author?: { name: string; url?: string };
}

export interface LegacyTrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  category: "lofi" | "jazz" | "relax";
  src: string;
  cover: string;
}

export interface LegacyAmbientSound {
  id: string;
  name: string;
  icon: string;
  src: string;
  category: "rain" | "nature" | "indoor";
}

/** Chuyển đổi SceneAsset sang định dạng Scene tương thích ngược cho UI */
export function resolveScene(asset: SceneAsset): LegacyScene {
  return {
    id: asset.id,
    name: asset.name,
    category: asset.category,
    type: asset.type,
    bgUrl: resolveAssetUrl(asset.mediaPath),
    thumbnailUrl: resolveAssetUrl(asset.thumbnailPath),
    tags: asset.tags,
    description: asset.description,
    badge: asset.badge,
    author: asset.author ? { name: asset.author.name, url: asset.author.url } : undefined,
  };
}

/** Chuyển đổi TrackAsset sang định dạng Track tương thích ngược */
export function resolveTrack(asset: TrackAsset): LegacyTrack {
  return {
    id: asset.id,
    title: asset.title,
    artist: asset.artist,
    genre: asset.genre,
    category: asset.category,
    src: resolveAssetUrl(asset.audioPath),
    cover: resolveAssetUrl(asset.coverPath),
  };
}

/** Chuyển đổi AmbientSoundAsset sang định dạng AmbientSound tương thích ngược */
export function resolveAmbientSound(asset: AmbientSoundAsset): LegacyAmbientSound {
  return {
    id: asset.id,
    name: asset.name,
    icon: asset.icon,
    src: resolveAssetUrl(asset.audioPath),
    category: asset.category,
  };
}
