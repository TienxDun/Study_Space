/**
 * P2c — Luật nội dung runtime (cảnh / âm thanh / nhạc).
 *
 * File này chỉ chứa logic thuần: kiểu dữ liệu, hằng số, chuẩn hoá tên file và
 * validate catalog. Không truy cập D1/KV/R2 để test được không cần giả lập hạ tầng.
 * Bản ghi thật nằm ở bảng `content_manifest` (xem workers/content-schema.sql).
 */

export type ContentKind = "scenes" | "sounds" | "tracks";
export const CONTENT_KINDS: ContentKind[] = ["scenes", "sounds", "tracks"];

export const SCENE_CATEGORIES = [
  "chill",
  "anime",
  "cyberpunk",
  "dark",
  "urban",
  "nature",
  "cartoon",
  "cute",
];
export const SOUND_CATEGORIES = ["rain", "nature", "indoor"];
export const TRACK_MOODS = ["lofi", "jazz", "relax"] as const;
export type TrackMood = (typeof TRACK_MOODS)[number];

// 15 tên icon web đang hiểu (xem SoundTileItem.renderSoundIcon).
export const SOUND_ICONS = [
  "CloudRain",
  "Zap",
  "Trees",
  "Bird",
  "Flame",
  "Waves",
  "Wind",
  "Keyboard",
  "Coffee",
  "Fan",
  "TrainTrack",
  "Plane",
  "Car",
  "Droplets",
  "Orbit",
];

export const SCENE_BADGES = ["4K", "HD", "MỚI", "HOT"];

export const MAX_ITEMS = { scenes: 200, sounds: 100, tracksPerMood: 100 };
export const FILE_MAX_BYTES = 50 * 1024 * 1024;
export const VERSIONS_PAGE = 20;

export const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".avif"];
export const VIDEO_EXTS = [".mp4", ".webm"];
export const AUDIO_EXTS = [".mp3", ".m4a", ".ogg"];

export type SceneItem = {
  id: string;
  name: string;
  category: string;
  type: "VIDEO" | "IMAGE";
  mediaPath: string;
  thumbnailPath: string;
  badge?: string;
  tags?: string[];
  description?: string;
  hidden?: boolean;
};

export type SoundItem = {
  id: string;
  name: string;
  icon: string;
  category: string;
  audioPath: string;
  hidden?: boolean;
};

export type TrackItem = {
  id: string;
  title: string;
  artist: string;
  genre: string;
  category: TrackMood;
  audioPath: string;
  coverPath: string;
  duration?: number;
  hidden?: boolean;
};

export type TrackCatalog = Record<TrackMood, TrackItem[]>;

export type Catalog = {
  scenes: SceneItem[];
  sounds: SoundItem[];
  tracks: TrackCatalog;
};

export type CatalogCounts = { scenes: number; sounds: number; tracks: number };

export type ValidationError = {
  kind: ContentKind;
  id?: string;
  field?: string;
  message: string;
};

export type ValidationResult =
  | { ok: true; catalog: Catalog; counts: CatalogCounts }
  | { ok: false; errors: ValidationError[] };

export const EMPTY_CATALOG: Catalog = {
  scenes: [],
  sounds: [],
  tracks: { lofi: [], jazz: [], relax: [] },
};

const ID_RE = /^[a-z0-9][a-z0-9._-]{0,79}$/i;

export function isContentKind(value: unknown): value is ContentKind {
  return typeof value === "string" && (CONTENT_KINDS as string[]).includes(value);
}

/** Đường dẫn media phải tương đối và không thoát ra ngoài gốc CDN. */
export function isSafeRelPath(value: string): boolean {
  if (!value || value.length > 200) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return false;
  if (value.startsWith("/") || value.startsWith("\\")) return false;
  if (value.includes("..")) return false;
  return !/[\u0000-\u001F\u007F]/.test(value);
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(value) && value.length <= 500;
}

/** Tên file gọn, không dấu, không ký tự lạ — giữ nguyên quy tắc của studio local. */
export function sanitizeFileName(raw: string): { base: string; ext: string } {
  const input = String(raw || "").replace(/\\/g, "/");
  const name = input.slice(input.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  const ext = (dot >= 0 ? name.slice(dot) : "").toLowerCase();
  const base = (dot >= 0 ? name.slice(0, dot) : name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return { base: base || "tep", ext };
}

export type MediaKind = "image" | "video" | "audio";

export function detectMediaKind(ext: string): MediaKind | null {
  const lower = String(ext || "").toLowerCase();
  if (IMAGE_EXTS.includes(lower)) return "image";
  if (VIDEO_EXTS.includes(lower)) return "video";
  if (AUDIO_EXTS.includes(lower)) return "audio";
  return null;
}

/**
 * Thư mục được phép ghi/xóa từ admin. Đây cũng là toàn bộ tiền tố đang dùng
 * trong bucket study-space; tên khác bị từ chối để không đụng file lạ.
 */
export const MEDIA_FOLDERS = ["scenes", "thumbnails", "sounds", "musics", "authors"] as const;
export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

export const MEDIA_FOLDER_KINDS: Record<MediaFolder, MediaKind[]> = {
  scenes: ["image", "video"],
  thumbnails: ["image"],
  sounds: ["audio"],
  musics: ["audio"],
  authors: ["image"],
};

export function isMediaFolder(value: unknown): value is MediaFolder {
  return typeof value === "string" && (MEDIA_FOLDERS as readonly string[]).includes(value);
}

export function folderAccepts(folder: MediaFolder, ext: string): boolean {
  const kind = detectMediaKind(ext);
  return kind !== null && MEDIA_FOLDER_KINDS[folder].includes(kind);
}

export function contentTypeFor(ext: string): string {
  switch (String(ext || "").toLowerCase()) {
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".mp3":
      return "audio/mpeg";
    case ".m4a":
      return "audio/mp4";
    case ".ogg":
      return "audio/ogg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".avif":
      return "image/avif";
    default:
      return "image/jpeg";
  }
}

/** Tránh ghi đè file có sẵn: `a.mp4` → `a-1.mp4` → `a-2.mp4` … */
export function pickFreeKey(rel: string, used: Set<string>): string {
  if (!used.has(rel)) return rel;
  const dot = rel.lastIndexOf(".");
  const stem = dot >= 0 ? rel.slice(0, dot) : rel;
  const ext = dot >= 0 ? rel.slice(dot) : "";
  let index = 1;
  let candidate = `${stem}-${index}${ext}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${stem}-${index}${ext}`;
  }
  return candidate;
}

/** File media của một mục, dùng để biết mục xóa đi có giải phóng file nào. */
export function filesOf(kind: ContentKind, item: unknown): string[] {
  const row = (item || {}) as Record<string, unknown>;
  if (kind === "scenes") {
    return [...new Set([row.mediaPath, row.thumbnailPath].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    ))];
  }
  if (kind === "sounds") {
    return typeof row.audioPath === "string" && row.audioPath ? [row.audioPath] : [];
  }
  const out: string[] = [];
  if (typeof row.audioPath === "string" && row.audioPath) out.push(row.audioPath);
  const cover = typeof row.coverPath === "string" ? row.coverPath : "";
  if (cover && !/^https?:\/\//i.test(cover)) out.push(cover);
  return out;
}

export type FileUsage = { kind: ContentKind; id: string; name: string };

/** File → các mục đang dùng; dùng để biết file nào được phép xóa khỏi kho. */
export function fileUsage(catalog: Catalog): Map<string, FileUsage[]> {
  const usage = new Map<string, FileUsage[]>();
  const add = (path: string, entry: FileUsage) => {
    const list = usage.get(path);
    if (list) list.push(entry);
    else usage.set(path, [entry]);
  };
  for (const scene of catalog.scenes) {
    for (const file of filesOf("scenes", scene)) {
      add(file, { kind: "scenes", id: scene.id, name: scene.name });
    }
  }
  for (const sound of catalog.sounds) {
    for (const file of filesOf("sounds", sound)) {
      add(file, { kind: "sounds", id: sound.id, name: sound.name });
    }
  }
  for (const track of collectTracks(catalog)) {
    for (const file of filesOf("tracks", track)) {
      add(file, { kind: "tracks", id: track.id, name: track.title });
    }
  }
  return usage;
}

function collectTracks(catalog: Catalog): TrackItem[] {
  return TRACK_MOODS.flatMap((mood) => catalog.tracks[mood]);
}

export function collectCatalogFiles(catalog: Catalog): Set<string> {
  const used = new Set<string>();
  for (const scene of catalog.scenes) for (const file of filesOf("scenes", scene)) used.add(file);
  for (const sound of catalog.sounds) for (const file of filesOf("sounds", sound)) used.add(file);
  for (const track of collectTracks(catalog)) for (const file of filesOf("tracks", track)) used.add(file);
  return used;
}

export function countsOf(catalog: Catalog): CatalogCounts {
  return {
    scenes: catalog.scenes.length,
    sounds: catalog.sounds.length,
    tracks: collectTracks(catalog).length,
  };
}

type Collector = (kind: ContentKind, id: string | undefined, field: string | undefined, message: string) => void;

function text(
  value: unknown,
  max: number,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

function optionalText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

function stringList(value: unknown, maxItems: number, maxLen: number): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length <= maxLen)
    .slice(0, maxItems);
  return list.length > 0 ? list : undefined;
}

function parseScene(raw: unknown, fail: Collector, seen: Set<string>): SceneItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    fail("scenes", undefined, undefined, "Mục không phải object.");
    return null;
  }
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  if (!ID_RE.test(id)) {
    fail("scenes", id, "id", "Thiếu id hợp lệ.");
    return null;
  }
  if (seen.has(id)) {
    fail("scenes", id, "id", "Id bị trùng.");
    return null;
  }
  seen.add(id);

  let bad = false;
  const name = text(row.name, 80);
  if (!name) {
    fail("scenes", id, "name", "Tên cảnh phải có, tối đa 80 ký tự.");
    bad = true;
  }
  const category = text(row.category, 20);
  if (!category || !SCENE_CATEGORIES.includes(category)) {
    fail("scenes", id, "category", "Nhóm cảnh không hợp lệ.");
    bad = true;
  }
  const type = row.type === "VIDEO" || row.type === "IMAGE" ? row.type : null;
  if (!type) {
    fail("scenes", id, "type", "Loại phải là VIDEO hoặc IMAGE.");
    bad = true;
  }
  const mediaPath = typeof row.mediaPath === "string" ? row.mediaPath.trim() : "";
  if (!isSafeRelPath(mediaPath)) {
    fail("scenes", id, "mediaPath", "Đường dẫn media phải tương đối, không chứa ..");
    bad = true;
  }
  const thumbnailPath =
    typeof row.thumbnailPath === "string" ? row.thumbnailPath.trim() : "";
  if (!isSafeRelPath(thumbnailPath)) {
    fail("scenes", id, "thumbnailPath", "Đường dẫn ảnh xem trước phải tương đối.");
    bad = true;
  }
  const badge = optionalText(row.badge, 8);
  if (badge && !SCENE_BADGES.includes(badge)) {
    fail("scenes", id, "badge", "Nhãn phải là 4K, HD, MỚI hoặc HOT.");
    bad = true;
  }
  if (bad) return null;

  const scene: SceneItem = {
    id,
    name: name as string,
    category: category as string,
    type: type as "VIDEO" | "IMAGE",
    mediaPath,
    thumbnailPath,
  };
  if (badge) scene.badge = badge;
  const tags = stringList(row.tags, 10, 30);
  if (tags) scene.tags = tags;
  const description = optionalText(row.description, 300);
  if (description) scene.description = description;
  if (row.hidden === true) scene.hidden = true;
  return scene;
}

function parseSound(raw: unknown, fail: Collector, seen: Set<string>): SoundItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    fail("sounds", undefined, undefined, "Mục không phải object.");
    return null;
  }
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  if (!ID_RE.test(id)) {
    fail("sounds", id, "id", "Thiếu id hợp lệ.");
    return null;
  }
  if (seen.has(id)) {
    fail("sounds", id, "id", "Id bị trùng.");
    return null;
  }
  seen.add(id);

  let bad = false;
  const name = text(row.name, 60);
  if (!name) {
    fail("sounds", id, "name", "Tên âm thanh phải có, tối đa 60 ký tự.");
    bad = true;
  }
  const icon = text(row.icon, 20);
  if (!icon || !SOUND_ICONS.includes(icon)) {
    fail("sounds", id, "icon", "Icon phải nằm trong danh sách cho phép.");
    bad = true;
  }
  const category = text(row.category, 20);
  if (!category || !SOUND_CATEGORIES.includes(category)) {
    fail("sounds", id, "category", "Nhóm âm thanh không hợp lệ.");
    bad = true;
  }
  const audioPath = typeof row.audioPath === "string" ? row.audioPath.trim() : "";
  if (!isSafeRelPath(audioPath)) {
    fail("sounds", id, "audioPath", "Đường dẫn âm thanh phải tương đối.");
    bad = true;
  }
  if (bad) return null;

  const sound: SoundItem = {
    id,
    name: name as string,
    icon: icon as string,
    category: category as string,
    audioPath,
  };
  if (row.hidden === true) sound.hidden = true;
  return sound;
}

function parseTrack(
  raw: unknown,
  mood: TrackMood,
  fail: Collector,
  seen: Set<string>,
): TrackItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    fail("tracks", undefined, undefined, "Mục không phải object.");
    return null;
  }
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  if (!ID_RE.test(id)) {
    fail("tracks", id, "id", "Thiếu id hợp lệ.");
    return null;
  }
  if (seen.has(id)) {
    fail("tracks", id, "id", "Id bị trùng.");
    return null;
  }
  seen.add(id);

  let bad = false;
  const title = text(row.title, 120);
  if (!title) {
    fail("tracks", id, "title", "Tiêu đề phải có, tối đa 120 ký tự.");
    bad = true;
  }
  const artist = text(row.artist, 80);
  if (!artist) {
    fail("tracks", id, "artist", "Tên ca sĩ/nghệ sĩ phải có.");
    bad = true;
  }
  const genre = optionalText(row.genre, 40) || "Khác";
  if (row.category !== undefined && row.category !== mood) {
    fail("tracks", id, "category", `Nhạc nhóm ${mood} phải có category = ${mood}.`);
    bad = true;
  }
  const audioPath = typeof row.audioPath === "string" ? row.audioPath.trim() : "";
  if (!isSafeRelPath(audioPath)) {
    fail("tracks", id, "audioPath", "Đường dẫn nhạc phải tương đối.");
    bad = true;
  }
  const coverRaw = typeof row.coverPath === "string" ? row.coverPath.trim() : "";
  if (!coverRaw) {
    fail("tracks", id, "coverPath", "Thiếu ảnh bìa.");
    bad = true;
  } else if (!isHttpUrl(coverRaw) && !isSafeRelPath(coverRaw)) {
    fail("tracks", id, "coverPath", "Ảnh bìa phải là URL http(s) hoặc đường dẫn tương đối.");
    bad = true;
  }
  if (bad) return null;

  const track: TrackItem = {
    id,
    title: title as string,
    artist: artist as string,
    genre,
    category: mood,
    audioPath,
    coverPath: coverRaw,
  };
  if (typeof row.duration === "number" && Number.isFinite(row.duration) && row.duration > 0) {
    track.duration = Math.round(row.duration);
  }
  if (row.hidden === true) track.hidden = true;
  return track;
}

/**
 * Chuẩn hoá + kiểm tra cả catalog. Trả lỗi thay vì ném, và chỉ giữ các trường
 * đã biết để JSON trong D1 không phình vì dữ liệu lạ.
 */
export function validateCatalog(raw: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const fail: Collector = (kind, id, field, message) => {
    if (errors.length < 40) errors.push({ kind, id, field, message });
  };

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: [{ kind: "scenes", message: "Catalog không phải object." }] };
  }
  const root = raw as Record<string, unknown>;

  if (!Array.isArray(root.scenes)) {
    fail("scenes", undefined, undefined, "Thiếu mảng cảnh.");
  }
  if (!Array.isArray(root.sounds)) {
    fail("sounds", undefined, undefined, "Thiếu mảng âm thanh.");
  }
  const tracksRaw = root.tracks;
  if (!tracksRaw || typeof tracksRaw !== "object" || Array.isArray(tracksRaw)) {
    fail("tracks", undefined, undefined, "Thiếu object nhạc theo nhóm.");
  }

  const scenes: SceneItem[] = [];
  if (Array.isArray(root.scenes)) {
    if (root.scenes.length > MAX_ITEMS.scenes) {
      fail("scenes", undefined, undefined, `Tối đa ${MAX_ITEMS.scenes} cảnh.`);
    }
    const seen = new Set<string>();
    for (const item of root.scenes.slice(0, MAX_ITEMS.scenes)) {
      const parsed = parseScene(item, fail, seen);
      if (parsed) scenes.push(parsed);
    }
  }

  const sounds: SoundItem[] = [];
  if (Array.isArray(root.sounds)) {
    if (root.sounds.length > MAX_ITEMS.sounds) {
      fail("sounds", undefined, undefined, `Tối đa ${MAX_ITEMS.sounds} âm thanh.`);
    }
    const seen = new Set<string>();
    for (const item of root.sounds.slice(0, MAX_ITEMS.sounds)) {
      const parsed = parseSound(item, fail, seen);
      if (parsed) sounds.push(parsed);
    }
  }

  const tracks: TrackCatalog = { lofi: [], jazz: [], relax: [] };
  if (tracksRaw && typeof tracksRaw === "object" && !Array.isArray(tracksRaw)) {
    const byMood = tracksRaw as Record<string, unknown>;
    const seen = new Set<string>();
    for (const mood of TRACK_MOODS) {
      const list = byMood[mood];
      if (!Array.isArray(list)) {
        fail("tracks", undefined, mood, `Thiếu danh sách nhạc ${mood}.`);
        continue;
      }
      if (list.length > MAX_ITEMS.tracksPerMood) {
        fail("tracks", undefined, mood, `Mỗi nhóm tối đa ${MAX_ITEMS.tracksPerMood} bài.`);
      }
      for (const item of list.slice(0, MAX_ITEMS.tracksPerMood)) {
        const parsed = parseTrack(item, mood, fail, seen);
        if (parsed) tracks[mood].push(parsed);
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const catalog: Catalog = { scenes, sounds, tracks };
  return { ok: true, catalog, counts: countsOf(catalog) };
}

/** Các trường được phép sửa qua PATCH; id và loại nhạc nằm ngoài danh sách. */
export function pickItemPatch(kind: ContentKind, patch: unknown): Record<string, unknown> | null {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return null;
  const raw = patch as Record<string, unknown>;
  const allowed =
    kind === "scenes"
      ? ["name", "category", "type", "mediaPath", "thumbnailPath", "badge", "tags", "description", "hidden"]
      : kind === "sounds"
        ? ["name", "icon", "category", "audioPath", "hidden"]
        : ["title", "artist", "genre", "category", "audioPath", "coverPath", "duration", "hidden"];
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in raw) out[key] = raw[key];
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function getItems(catalog: Catalog, kind: ContentKind): unknown[] {
  if (kind === "scenes") return catalog.scenes;
  if (kind === "sounds") return catalog.sounds;
  return collectTracks(catalog);
}

export function insertItem(
  catalog: Catalog,
  kind: ContentKind,
  item: Record<string, unknown>,
): { ok: true; catalog: Catalog } | { ok: false; message: string } {
  if (kind === "scenes") {
    return { ok: true, catalog: { ...catalog, scenes: [...catalog.scenes, item as unknown as SceneItem] } };
  }
  if (kind === "sounds") {
    return { ok: true, catalog: { ...catalog, sounds: [...catalog.sounds, item as unknown as SoundItem] } };
  }
  const mood = item.category;
  if (mood !== "lofi" && mood !== "jazz" && mood !== "relax") {
    return { ok: false, message: "Bài nhạc phải có category là lofi, jazz hoặc relax." };
  }
  const next: Catalog = {
    ...catalog,
    tracks: { ...catalog.tracks, [mood]: [...catalog.tracks[mood], item as unknown as TrackItem] },
  };
  return { ok: true, catalog: next };
}

export function updateItem(
  catalog: Catalog,
  kind: ContentKind,
  id: string,
  patch: Record<string, unknown>,
): { ok: true; catalog: Catalog; before: unknown } | { ok: false; message: string } {
  if (kind === "scenes") {
    const index = catalog.scenes.findIndex((item) => item.id === id);
    if (index < 0) return { ok: false, message: "not_found" };
    const before = catalog.scenes[index];
    const next = [...catalog.scenes];
    next[index] = { ...before, ...patch, id } as SceneItem;
    return { ok: true, catalog: { ...catalog, scenes: next }, before };
  }
  if (kind === "sounds") {
    const index = catalog.sounds.findIndex((item) => item.id === id);
    if (index < 0) return { ok: false, message: "not_found" };
    const before = catalog.sounds[index];
    const next = [...catalog.sounds];
    next[index] = { ...before, ...patch, id } as SoundItem;
    return { ok: true, catalog: { ...catalog, sounds: next }, before };
  }

  for (const mood of TRACK_MOODS) {
    const index = catalog.tracks[mood].findIndex((item) => item.id === id);
    if (index < 0) continue;
    const before = catalog.tracks[mood][index];
    const targetMood = (patch.category as TrackMood | undefined) || mood;
    if (!TRACK_MOODS.includes(targetMood)) return { ok: false, message: "invalid_category" };
    const merged = { ...before, ...patch, id, category: targetMood } as TrackItem;
    const tracks: TrackCatalog = {
      lofi: [...catalog.tracks.lofi],
      jazz: [...catalog.tracks.jazz],
      relax: [...catalog.tracks.relax],
    };
    tracks[mood].splice(index, 1);
    tracks[targetMood].push(merged);
    return { ok: true, catalog: { ...catalog, tracks }, before };
  }
  return { ok: false, message: "not_found" };
}

export function deleteItem(
  catalog: Catalog,
  kind: ContentKind,
  id: string,
): { ok: true; catalog: Catalog; removed: unknown } | { ok: false; message: string } {
  if (kind === "scenes") {
    const index = catalog.scenes.findIndex((item) => item.id === id);
    if (index < 0) return { ok: false, message: "not_found" };
    const removed = catalog.scenes[index];
    return {
      ok: true,
      catalog: { ...catalog, scenes: catalog.scenes.filter((item) => item.id !== id) },
      removed,
    };
  }
  if (kind === "sounds") {
    const index = catalog.sounds.findIndex((item) => item.id === id);
    if (index < 0) return { ok: false, message: "not_found" };
    const removed = catalog.sounds[index];
    return {
      ok: true,
      catalog: { ...catalog, sounds: catalog.sounds.filter((item) => item.id !== id) },
      removed,
    };
  }
  for (const mood of TRACK_MOODS) {
    const index = catalog.tracks[mood].findIndex((item) => item.id === id);
    if (index < 0) continue;
    const removed = catalog.tracks[mood][index];
    return {
      ok: true,
      catalog: {
        ...catalog,
        tracks: { ...catalog.tracks, [mood]: catalog.tracks[mood].filter((item) => item.id !== id) },
      },
      removed,
    };
  }
  return { ok: false, message: "not_found" };
}

/** Sinh id mới; giữ tiền tố theo loại để đọc log là biết ngay. */
export function makeItemId(kind: ContentKind, now = Date.now()): string {
  const prefix = kind === "scenes" ? "scene" : kind === "sounds" ? "sound" : "track";
  return `${prefix}-custom-${now}`;
}

/** Danh sách tên trường khác nhau, dùng cho audit (không ghi cả object). */
export function diffFields(before: unknown, after: unknown): string[] {
  const a = (before || {}) as Record<string, unknown>;
  const b = (after || {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) changed.push(key);
  }
  return changed;
}
