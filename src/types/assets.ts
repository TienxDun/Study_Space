export interface AssetAuthor {
  name: string;
  source?: string;
  url?: string;
}

export interface BaseAsset {
  id: string;
  name?: string;
  description?: string;
  tags?: string[];
  author?: AssetAuthor;
  isFeatured?: boolean;
  /** Mục ẩn vẫn nằm trong catalog nhưng không hiện cho người học. */
  hidden?: boolean;
}

export type SceneCategory =
  | "chill"
  | "anime"
  | "cyberpunk"
  | "dark"
  | "urban"
  | "nature"
  | "cartoon"
  | "cute";

export interface SceneAsset extends BaseAsset {
  name: string;
  category: SceneCategory | string;
  type: "VIDEO" | "IMAGE";
  /** Đường dẫn tương đối từ gốc CDN, VD: "scenes/chill/cozy-bedroom.mp4" */
  mediaPath: string;
  /** Đường dẫn tương đối thumbnail, VD: "thumbnails/chill/cozy-bedroom.webp" */
  thumbnailPath: string;
  badge?: "4K" | "HD" | "MỚI" | "HOT";
}

export type TrackMood = "lofi" | "jazz" | "relax";

export interface TrackAsset extends BaseAsset {
  title: string;
  artist: string;
  genre: string;
  category: TrackMood;
  /** Đường dẫn file nhạc trên R2/CDN, VD: "musics/lofi/track-01.mp3" */
  audioPath: string;
  /** URL ảnh bìa hoặc relative path */
  coverPath: string;
  duration?: number;
}

export type AmbientSoundCategory = "rain" | "nature" | "indoor";

export interface AmbientSoundAsset extends BaseAsset {
  name: string;
  category: AmbientSoundCategory;
  icon: string;
  /** Đường dẫn file âm thanh, VD: "sounds/rain/heavy-rain.mp3" */
  audioPath: string;
}
