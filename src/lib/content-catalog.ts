import rawScenes from "@/data/assets/scenes.json";
import rawTracks from "@/data/assets/tracks.json";
import rawSounds from "@/data/assets/sounds.json";
import {
  resolveAmbientSound,
  resolveScene,
  resolveTrack,
  type LegacyAmbientSound,
  type LegacyScene,
  type LegacyTrack,
} from "@/lib/asset-resolver";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import type { AmbientSoundAsset, SceneAsset, TrackAsset, TrackMood } from "@/types/assets";

/**
 * Catalog nội dung runtime (cảnh / âm thanh / nhạc).
 *
 * - Bản mặc định đóng gói từ JSON trong `src/data/assets` để app vẫn chạy khi offline.
 * - Admin phát hành bản mới → data-api `/content` → cache localStorage → thay 3 mảng
 *   bên dưới. Các component đọc qua `study-types` nên thấy dữ liệu mới nhờ live binding.
 * - Mục có `hidden: true` bị loại ngay khi áp dụng, không xuống tới UI.
 */

export type ContentCatalog = {
  scenes: SceneAsset[];
  sounds: AmbientSoundAsset[];
  tracks: Record<TrackMood, TrackAsset[]>;
};

export type CatalogMeta = { version: number; updatedAt: number };

const MOODS: TrackMood[] = ["lofi", "jazz", "relax"];

const CATALOG_API_URL = (
  process.env.NEXT_PUBLIC_DATA_API_URL || "https://data-api.leutiendung-hht.workers.dev"
).replace(/\/+$/, "");

function defaultScenes(): LegacyScene[] {
  return (rawScenes as SceneAsset[]).map(resolveScene);
}

function defaultSounds(): LegacyAmbientSound[] {
  return (rawSounds as AmbientSoundAsset[]).map(resolveAmbientSound);
}

function defaultTracks(): Record<TrackMood, LegacyTrack[]> {
  return {
    lofi: (rawTracks.lofi as TrackAsset[]).map(resolveTrack),
    jazz: (rawTracks.jazz as TrackAsset[]).map(resolveTrack),
    relax: (rawTracks.relax as TrackAsset[]).map(resolveTrack),
  };
}

// `let` + gán lại cả mảng (không sửa tại chỗ) để component nhận identity mới.
export let STUDY_SCENES: LegacyScene[] = defaultScenes();
export let AMBIENT_SOUNDS: LegacyAmbientSound[] = defaultSounds();
export let STUDY_TRACKS_BY_MOOD: Record<TrackMood, LegacyTrack[]> = defaultTracks();

let meta: CatalogMeta = { version: 0, updatedAt: 0 };

export function getCatalogMeta(): CatalogMeta {
  return { ...meta };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Mảng mục hợp lệ: object, có `id` chuỗi, và đủ các trường bắt buộc của loại đó. */
function itemList(value: unknown, required: string[]): Record<string, unknown>[] | null {
  if (!Array.isArray(value)) return null;
  const out: Record<string, unknown>[] = [];
  for (const item of value) {
    if (!isObject(item)) return null;
    if (typeof item.id !== "string" || !item.id) return null;
    for (const key of required) {
      if (typeof item[key] !== "string" || !item[key]) return null;
    }
    out.push(item);
  }
  return out;
}

/** Kiểm tra payload từ data-api hoặc từ cache; sai shape thì trả null để bên gọi giữ bundle cũ. */
export function parseCatalog(raw: unknown): ContentCatalog | null {
  if (!isObject(raw)) return null;
  const scenes = itemList(raw.scenes, ["name", "mediaPath", "type"]);
  const sounds = itemList(raw.sounds, ["name", "icon", "audioPath"]);
  if (!scenes || !sounds) return null;
  if (!isObject(raw.tracks)) return null;

  const tracks = {} as Record<TrackMood, TrackAsset[]>;
  for (const mood of MOODS) {
    const list = itemList(raw.tracks[mood], ["title", "artist", "audioPath", "coverPath"]);
    if (!list) return null;
    tracks[mood] = list as unknown as TrackAsset[];
  }

  return {
    scenes: scenes as unknown as SceneAsset[],
    sounds: sounds as unknown as AmbientSoundAsset[],
    tracks,
  };
}

function visible(item: { hidden?: boolean }): boolean {
  return item.hidden !== true;
}

export function applyCatalog(catalog: ContentCatalog): void {
  STUDY_SCENES = catalog.scenes.filter(visible).map(resolveScene);
  AMBIENT_SOUNDS = catalog.sounds.filter(visible).map(resolveAmbientSound);
  STUDY_TRACKS_BY_MOOD = {
    lofi: catalog.tracks.lofi.filter(visible).map(resolveTrack),
    jazz: catalog.tracks.jazz.filter(visible).map(resolveTrack),
    relax: catalog.tracks.relax.filter(visible).map(resolveTrack),
  };
}

/** Trả về catalog mặc định đóng gói trong bundle; dùng cho test và khi cache hỏng. */
export function resetCatalog(): void {
  STUDY_SCENES = defaultScenes();
  AMBIENT_SOUNDS = defaultSounds();
  STUDY_TRACKS_BY_MOOD = defaultTracks();
  meta = { version: 0, updatedAt: 0 };
}

type CatalogCache = {
  version: number;
  updatedAt: number;
  fetchedAt: number;
  catalog: unknown;
};

export function loadCachedCatalog(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.contentCatalog);
    if (!raw) return false;
    const cached = JSON.parse(raw) as CatalogCache;
    if (!isObject(cached)) return false;
    const version = Number(cached.version);
    if (!Number.isInteger(version) || version < 1) return false;
    const catalog = parseCatalog(cached.catalog);
    if (!catalog) return false;

    applyCatalog(catalog);
    meta = { version, updatedAt: Number(cached.updatedAt) || 0 };
    return true;
  } catch {
    return false;
  }
}

export function saveCatalogCache(version: number, updatedAt: number, catalog: ContentCatalog): void {
  if (typeof window === "undefined") return;
  try {
    const payload: CatalogCache = { version, updatedAt, fetchedAt: Date.now(), catalog };
    window.localStorage.setItem(STORAGE_KEYS.contentCatalog, JSON.stringify(payload));
  } catch {
    // Hết quota thì thôi: lần mở sau vẫn lấy bản mới từ mạng.
  }
}

export type RefreshResult = {
  ok: boolean;
  updated: boolean;
  version: number;
  error?: string;
};

/**
 * Hỏi bản phát hành mới nhất. Chỉ thay catalog khi version lớn hơn bản đang dùng,
 * và chỉ ghi cache sau khi payload đã qua `parseCatalog`.
 */
export async function refreshCatalog(): Promise<RefreshResult> {
  if (!CATALOG_API_URL) {
    return { ok: false, updated: false, version: meta.version, error: "missing_url" };
  }
  try {
    const res = await fetch(`${CATALOG_API_URL}/content`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      return { ok: false, updated: false, version: meta.version, error: `status_${res.status}` };
    }
    const body = (await res.json()) as Record<string, unknown>;
    if (!isObject(body) || body.ok !== true) {
      return { ok: false, updated: false, version: meta.version, error: "bad_payload" };
    }
    const version = Number(body.version);
    if (!Number.isInteger(version) || version < 0) {
      return { ok: false, updated: false, version: meta.version, error: "bad_payload" };
    }
    const catalog = parseCatalog(body);
    if (!catalog) {
      return { ok: false, updated: false, version: meta.version, error: "bad_payload" };
    }
    // Chưa ai phát hành bản nào thì giữ bundle đóng gói.
    if (version < 1 || version <= meta.version) {
      return { ok: true, updated: false, version: meta.version };
    }

    const updatedAt = Number(body.updatedAt) || 0;
    saveCatalogCache(version, updatedAt, catalog);
    applyCatalog(catalog);
    meta = { version, updatedAt };
    return { ok: true, updated: true, version };
  } catch {
    return { ok: false, updated: false, version: meta.version, error: "network" };
  }
}
