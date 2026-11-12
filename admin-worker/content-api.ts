/**
 * P2c — Lớp API nội dung runtime: đọc/ghi bảng `content_manifest` (D1), lập
 * chỉ mục file R2 và định tuyến `/api/admin/content/*`. Luật thuần nằm ở
 * `content.ts`; file này chỉ lo hạ tầng và HTTP.
 *
 * Mỗi lần lưu = một version mới đủ 3 dòng; lịch sử chỉ thêm, không sửa.
 */

import { allowContentWrite, logAudit } from "./audit";
import {
  FILE_MAX_BYTES,
  VERSIONS_PAGE,
  contentTypeFor,
  countsOf,
  deleteItem,
  diffFields,
  fileUsage,
  filesOf,
  folderAccepts,
  getItems,
  insertItem,
  isContentKind,
  isMediaFolder,
  isSafeRelPath,
  makeItemId,
  pickFreeKey,
  pickItemPatch,
  sanitizeFileName,
  updateItem,
  validateCatalog,
  type Catalog,
  type CatalogCounts,
  type ContentKind,
  type FileUsage,
} from "./content";
import {
  API_PREFIX,
  R2_CACHE_TTL_MS,
  R2_LIST_MAX_PAGES,
  R2_LIST_PAGE,
  json,
  type AdminEnv,
} from "./shared";

type ContentRow = {
  version?: number;
  kind?: string;
  json?: string;
  created_at?: number;
  created_by?: string;
};

type PublishedCatalog =
  | {
      ok: true;
      version: number;
      createdAt: number;
      createdBy: string;
      catalog: Catalog;
    }
  | { ok: false; error: string };

/** Dựng catalog từ các dòng của một version; thiếu loại nào thì loại đó rỗng. */
function catalogFromRows(
  rows: ContentRow[],
): { ok: true; catalog: Catalog } | { ok: false; error: string } {
  const raw: Record<string, unknown> = {
    scenes: [],
    sounds: [],
    tracks: { lofi: [], jazz: [], relax: [] },
  };
  for (const row of rows) {
    if (!isContentKind(row.kind) || typeof row.json !== "string") {
      return { ok: false, error: "invalid_json" };
    }
    try {
      raw[row.kind] = JSON.parse(row.json);
    } catch {
      return { ok: false, error: "invalid_json" };
    }
  }
  // Đọc lại qua validate để dữ liệu cũ/hỏng không lọt ra ngoài.
  const checked = validateCatalog(raw);
  if (!checked.ok) return { ok: false, error: "invalid_json" };
  return { ok: true, catalog: checked.catalog };
}

async function readPublished(env: AdminEnv): Promise<PublishedCatalog> {
  if (!env.DB) return { ok: false, error: "missing_binding" };
  try {
    const res = await env.DB.prepare(
      "SELECT version, kind, json, created_at, created_by FROM content_manifest " +
        "WHERE version = (SELECT MAX(version) FROM content_manifest)",
    ).all<ContentRow>();
    const rows = Array.isArray(res?.results) ? res.results : [];
    const built = catalogFromRows(rows);
    if (!built.ok) return built;
    const first = rows[0] || {};
    return {
      ok: true,
      version: Number(first.version) || 0,
      createdAt: Number(first.created_at) || 0,
      createdBy: String(first.created_by || ""),
      catalog: built.catalog,
    };
  } catch {
    return { ok: false, error: "d1_error" };
  }
}

async function readVersion(env: AdminEnv, version: number): Promise<PublishedCatalog> {
  if (!env.DB) return { ok: false, error: "missing_binding" };
  try {
    const res = await env.DB.prepare(
      "SELECT version, kind, json, created_at, created_by FROM content_manifest WHERE version = ?",
    )
      .bind(version)
      .all<ContentRow>();
    const rows = Array.isArray(res?.results) ? res.results : [];
    if (rows.length === 0) return { ok: false, error: "not_found" };
    const built = catalogFromRows(rows);
    if (!built.ok) return built;
    const first = rows[0] || {};
    return {
      ok: true,
      version: Number(first.version) || version,
      createdAt: Number(first.created_at) || 0,
      createdBy: String(first.created_by || ""),
      catalog: built.catalog,
    };
  } catch {
    return { ok: false, error: "d1_error" };
  }
}

/** Ghi một version mới đủ 3 dòng bằng một câu INSERT để không có version nửa vời. */
async function writeVersion(
  env: AdminEnv,
  catalog: Catalog,
  actor: string,
  currentVersion: number,
): Promise<{ ok: true; version: number } | { ok: false; error: string }> {
  if (!env.DB) return { ok: false, error: "missing_binding" };
  const version = currentVersion + 1;
  const createdAt = Date.now();
  try {
    await env.DB.prepare(
      "INSERT INTO content_manifest (version, kind, json, created_at, created_by) " +
        "VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)",
    )
      .bind(
        version,
        "scenes",
        JSON.stringify(catalog.scenes),
        createdAt,
        actor,
        version,
        "sounds",
        JSON.stringify(catalog.sounds),
        createdAt,
        actor,
        version,
        "tracks",
        JSON.stringify(catalog.tracks),
        createdAt,
        actor,
      )
      .run();
    return { ok: true, version };
  } catch (error) {
    const message = String((error as { message?: string })?.message || "");
    return {
      ok: false,
      error: /unique|primary key|constraint/i.test(message) ? "version_conflict" : "d1_error",
    };
  }
}

async function readVersions(env: AdminEnv): Promise<
  | {
      ok: true;
      versions: Array<{
        version: number;
        createdAt: number;
        createdBy: string;
        counts: CatalogCounts | null;
      }>;
    }
  | { ok: false; error: string }
> {
  if (!env.DB) return { ok: false, error: "missing_binding" };
  try {
    const res = await env.DB.prepare(
      "SELECT version, kind, json, created_at, created_by FROM content_manifest " +
        "ORDER BY version DESC LIMIT ?",
    )
      .bind(VERSIONS_PAGE * 3)
      .all<ContentRow>();
    const rows = Array.isArray(res?.results) ? res.results : [];
    const groups = new Map<number, ContentRow[]>();
    for (const row of rows) {
      const version = Number(row.version) || 0;
      if (version <= 0) continue;
      const list = groups.get(version);
      if (list) list.push(row);
      else groups.set(version, [row]);
    }
    const versions = [...groups.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([version, list]) => {
        const built = catalogFromRows(list);
        return {
          version,
          createdAt: Number(list[0]?.created_at) || 0,
          createdBy: String(list[0]?.created_by || ""),
          counts: built.ok ? countsOf(built.catalog) : null,
        };
      });
    return { ok: true, versions };
  } catch {
    return { ok: false, error: "d1_error" };
  }
}

type FileEntry = { size: number; uploaded: number };
type FileIndex =
  | { ok: true; objects: Map<string, FileEntry>; partial: boolean }
  | { ok: false; error: string };

let fileIndexCache: { at: number; value: FileIndex } | null = null;

/** Test dùng để xóa cache danh sách file R2 giữa các ca. */
export function __resetContentCaches(): void {
  fileIndexCache = null;
}

function uploadedAt(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return Date.parse(value) || 0;
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

/**
 * Danh sách key + dung lượng trong bucket, cache 60 giây như `readR2Usage`.
 * Một lần list dùng cho cả tab nội dung và tab kho tệp để không đốt Class A.
 * `force` dùng trước khi upload để không chọn trùng key vừa được thêm.
 */
async function readFileIndex(env: AdminEnv, force = false): Promise<FileIndex> {
  const now = Date.now();
  if (!force && fileIndexCache && now - fileIndexCache.at < R2_CACHE_TTL_MS) {
    return fileIndexCache.value;
  }

  let result: FileIndex;
  if (!env.R2) {
    result = { ok: false, error: "missing_binding" };
  } else {
    const objects = new Map<string, FileEntry>();
    let cursor: string | undefined;
    let partial = false;
    try {
      for (let page = 1; ; page += 1) {
        const res = await env.R2.list({ limit: R2_LIST_PAGE, cursor });
        for (const object of res?.objects || []) {
          const key = typeof object?.key === "string" ? object.key : "";
          // Ảnh góp ý dùng chung bucket nhưng không thuộc kho nội dung:
          // lẫn vào đây sẽ bị tính là mồ côi và có nguy cơ bị dọn.
          if (key && !key.startsWith("feedback/")) {
            objects.set(key, {
              size: Number(object?.size) || 0,
              uploaded: uploadedAt(object?.uploaded),
            });
          }
        }
        if (!res?.truncated) break;
        if (!res.cursor || page >= R2_LIST_MAX_PAGES) {
          partial = true;
          break;
        }
        cursor = res.cursor;
      }
      result = { ok: true, objects, partial };
    } catch {
      result = { ok: false, error: "r2_error" };
    }
  }

  fileIndexCache = { at: now, value: result };
  return result;
}

/** Trạng thái file của từng mục: có trong R2 thì trả dung lượng, không có thì null. */
function mediaState(files: Set<string>, index: FileIndex): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const path of files) {
    const entry = index.ok ? index.objects.get(path) : undefined;
    out[path] = entry ? entry.size : null;
  }
  return out;
}

function contentStatus(error: string): number {
  if (error === "not_found") return 404;
  if (error === "version_conflict" || error === "media_in_use") return 409;
  if (error === "too_large") return 413;
  if (error === "unsupported_type") return 415;
  if (error === "missing_binding" || error === "d1_error" || error === "r2_error") return 500;
  if (error === "invalid_json" || error === "r2_write_failed") return 500;
  return 400;
}

const MEDIA_ENTRY_LIMIT = 500;
const MEDIA_ORPHAN_LIMIT = 200;
const MEDIA_MISSING_LIMIT = 100;
const MEDIA_PRUNE_LIMIT = 50;

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function handleContentApi(
  request: Request,
  env: AdminEnv,
  pathname: string,
  email: string,
): Promise<Response> {
  const rest = pathname.slice(`${API_PREFIX}/content`.length);
  const method = request.method;

  if (rest === "/media") {
    if (method === "GET") return getMedia(request, env);
    if (method !== "POST" && method !== "DELETE") {
      return json({ error: "Chỉ hỗ trợ GET, POST hoặc DELETE." }, 405);
    }
    if (!allowContentWrite(email)) return json({ error: "rate_limited" }, 429);
    return method === "POST" ? uploadMedia(request, env, email) : deleteMedia(request, env, email);
  }

  if (rest === "/media/prune") {
    if (method !== "POST") return json({ error: "Chỉ hỗ trợ POST." }, 405);
    if (!allowContentWrite(email)) return json({ error: "rate_limited" }, 429);
    return pruneMedia(request, env, email);
  }

  if (rest === "/items") {
    if (method === "GET") return getContentItems(request, env);
    if (method !== "POST" && method !== "PATCH" && method !== "DELETE") {
      return json({ error: "Chỉ hỗ trợ GET, POST, PATCH hoặc DELETE." }, 405);
    }
    if (!allowContentWrite(email)) return json({ error: "rate_limited" }, 429);
    if (method === "DELETE") return deleteContentItem(request, env, email);
    return saveContentItem(request, env, email, method === "POST" ? "create" : "update");
  }

  if (rest === "/versions") {
    if (method !== "GET") return json({ error: "Chỉ hỗ trợ GET." }, 405);
    const listed = await readVersions(env);
    if (!listed.ok) return json({ error: listed.error }, contentStatus(listed.error));
    return json({ ok: true, versions: listed.versions });
  }

  const versionMatch = /^\/versions\/(\d{1,9})$/.exec(rest);
  if (versionMatch) {
    if (method !== "GET") return json({ error: "Chỉ hỗ trợ GET." }, 405);
    const version = Number(versionMatch[1]);
    if (!Number.isInteger(version) || version <= 0) return json({ error: "invalid_body" }, 400);
    const snapshot = await readVersion(env, version);
    if (!snapshot.ok) return json({ error: snapshot.error }, contentStatus(snapshot.error));
    return json({
      ok: true,
      version: snapshot.version,
      createdAt: snapshot.createdAt,
      createdBy: snapshot.createdBy,
      counts: countsOf(snapshot.catalog),
      catalog: snapshot.catalog,
    });
  }

  if (rest === "/rollback") {
    if (method !== "POST") return json({ error: "Chỉ hỗ trợ POST." }, 405);
    if (!allowContentWrite(email)) return json({ error: "rate_limited" }, 429);
    const body = await readJsonBody(request);
    const version = body?.version;
    if (typeof version !== "number" || !Number.isInteger(version) || version <= 0) {
      return json({ error: "invalid_body" }, 400);
    }
    const snapshot = await readVersion(env, version);
    if (!snapshot.ok) return json({ error: snapshot.error }, contentStatus(snapshot.error));
    const current = await readPublished(env);
    if (!current.ok) return json({ error: current.error }, contentStatus(current.error));

    const counts = countsOf(snapshot.catalog);
    if (
      !(await logAudit(env, {
        actorEmail: email,
        action: "content.rollback",
        target: `version:${version}`,
        detail: { from: version, to: current.version + 1, counts },
      }))
    ) {
      return json({ error: "audit_failed" }, 500);
    }
    const written = await writeVersion(env, snapshot.catalog, email, current.version);
    if (!written.ok) return json({ error: written.error }, contentStatus(written.error));
    return json({ ok: true, version: written.version, counts });
  }

  if (rest === "/init") {
    if (method !== "POST") return json({ error: "Chỉ hỗ trợ POST." }, 405);
    if (!allowContentWrite(email)) return json({ error: "rate_limited" }, 429);
    const body = await readJsonBody(request);
    if (!body) return json({ error: "invalid_body" }, 400);
    const current = await readPublished(env);
    if (!current.ok) return json({ error: current.error }, contentStatus(current.error));
    if (current.version > 0) return json({ error: "already_initialized" }, 409);
    const checked = validateCatalog(body);
    if (!checked.ok) return json({ error: "invalid_catalog", errors: checked.errors }, 400);

    if (
      !(await logAudit(env, {
        actorEmail: email,
        action: "content.init",
        target: "version:1",
        detail: { counts: checked.counts },
      }))
    ) {
      return json({ error: "audit_failed" }, 500);
    }
    const written = await writeVersion(env, checked.catalog, email, 0);
    if (!written.ok) return json({ error: written.error }, contentStatus(written.error));
    return json({ ok: true, version: written.version, counts: checked.counts });
  }

  return json({ error: "Không có endpoint này." }, 404);
}

async function getContentItems(request: Request, env: AdminEnv): Promise<Response> {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") || "";
  if (!isContentKind(kind)) return json({ error: "invalid_kind" }, 400);

  const published = await readPublished(env);
  if (!published.ok) return json({ error: published.error }, contentStatus(published.error));

  const items = getItems(published.catalog, kind);
  const index = await readFileIndex(env);
  const files = new Set<string>();
  for (const item of items) {
    for (const path of filesOf(kind, item)) files.add(path);
  }

  return json({
    ok: true,
    kind,
    version: published.version,
    createdAt: published.createdAt,
    createdBy: published.createdBy,
    counts: countsOf(published.catalog),
    items,
    media: mediaState(files, index),
    filesOk: index.ok,
    filesPartial: index.ok ? index.partial : false,
  });
}

async function saveContentItem(
  request: Request,
  env: AdminEnv,
  email: string,
  mode: "create" | "update",
): Promise<Response> {
  const body = await readJsonBody(request);
  const kind = body?.kind;
  if (!body || !isContentKind(kind)) return json({ error: "invalid_kind" }, 400);

  const published = await readPublished(env);
  if (!published.ok) return json({ error: published.error }, contentStatus(published.error));

  if (mode === "create") {
    const raw = body.item;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return json({ error: "invalid_body" }, 400);
    }
    const item = { ...(raw as Record<string, unknown>) };
    if (typeof item.id !== "string" || !item.id.trim()) item.id = makeItemId(kind);
    const inserted = insertItem(published.catalog, kind, item);
    if (!inserted.ok) return json({ error: "invalid_body", message: inserted.message }, 400);
    const checked = validateCatalog(inserted.catalog);
    if (!checked.ok) return json({ error: "invalid_catalog", errors: checked.errors }, 400);

    if (
      !(await logAudit(env, {
        actorEmail: email,
        action: "content.item.create",
        target: `${kind}:${item.id}`,
        detail: {
          version: published.version + 1,
          kind,
          id: item.id,
          fields: Object.keys(item),
        },
      }))
    ) {
      return json({ error: "audit_failed" }, 500);
    }
    const written = await writeVersion(env, checked.catalog, email, published.version);
    if (!written.ok) return json({ error: written.error }, contentStatus(written.error));

    const saved = getItems(checked.catalog, kind).find(
      (entry) => (entry as { id?: string }).id === item.id,
    );
    return json({ ok: true, version: written.version, item: saved ?? null });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return json({ error: "invalid_body" }, 400);
  const patch = pickItemPatch(kind, body.patch);
  if (!patch) return json({ error: "invalid_body" }, 400);

  const updated = updateItem(published.catalog, kind, id, patch);
  if (!updated.ok) return json({ error: updated.message }, contentStatus(updated.message));
  const checked = validateCatalog(updated.catalog);
  if (!checked.ok) return json({ error: "invalid_catalog", errors: checked.errors }, 400);

  if (
    !(await logAudit(env, {
      actorEmail: email,
      action: "content.item.update",
      target: `${kind}:${id}`,
      detail: {
        version: published.version + 1,
        kind,
        id,
        fields: diffFields(updated.before, { ...(updated.before as object), ...patch }),
      },
    }))
  ) {
    return json({ error: "audit_failed" }, 500);
  }
  const written = await writeVersion(env, checked.catalog, email, published.version);
  if (!written.ok) return json({ error: written.error }, contentStatus(written.error));

  const saved = getItems(checked.catalog, kind).find(
    (entry) => (entry as { id?: string }).id === id,
  );
  return json({ ok: true, version: written.version, item: saved ?? null });
}

async function deleteContentItem(
  request: Request,
  env: AdminEnv,
  email: string,
): Promise<Response> {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") || "";
  const id = (url.searchParams.get("id") || "").trim();
  if (!isContentKind(kind) || !id) return json({ error: "invalid_body" }, 400);

  const published = await readPublished(env);
  if (!published.ok) return json({ error: published.error }, contentStatus(published.error));

  const removed = deleteItem(published.catalog, kind, id);
  if (!removed.ok) return json({ error: removed.message }, contentStatus(removed.message));
  const checked = validateCatalog(removed.catalog);
  if (!checked.ok) return json({ error: "invalid_catalog", errors: checked.errors }, 400);

  const row = (removed.removed || {}) as Record<string, unknown>;
  const label = typeof row.name === "string" ? row.name : typeof row.title === "string" ? row.title : "";
  if (
    !(await logAudit(env, {
      actorEmail: email,
      action: "content.item.delete",
      target: `${kind}:${id}`,
      detail: { version: published.version + 1, kind, id, name: label },
    }))
  ) {
    return json({ error: "audit_failed" }, 500);
  }
  const written = await writeVersion(env, checked.catalog, email, published.version);
  if (!written.ok) return json({ error: written.error }, contentStatus(written.error));
  // Chỉ bỏ mục khỏi catalog; file trong R2 giữ nguyên vì có thể dùng chung.
  return json({ ok: true, version: written.version, files: filesOf(kind, removed.removed) });
}

async function getMedia(request: Request, env: AdminEnv): Promise<Response> {
  const url = new URL(request.url);
  const prefix = url.searchParams.get("prefix") || "";
  if (prefix && !isMediaFolder(prefix)) return json({ error: "invalid_folder" }, 400);
  const query = (url.searchParams.get("q") || "").trim().toLowerCase().slice(0, 80);
  const onlyOrphans = url.searchParams.get("orphans") === "1";

  const published = await readPublished(env);
  if (!published.ok) return json({ error: published.error }, contentStatus(published.error));
  const usage = fileUsage(published.catalog);

  const index = await readFileIndex(env, url.searchParams.get("fresh") === "1");
  if (!index.ok) return json({ error: index.error }, contentStatus(index.error));

  type FolderSummary = {
    prefix: string;
    files: number;
    bytes: number;
    orphans: number;
    orphanBytes: number;
  };
  const folders = new Map<string, FolderSummary>();
  const entries: Array<{
    key: string;
    size: number;
    uploaded: number;
    usedBy: FileUsage[];
    orphan: boolean;
  }> = [];
  const orphanKeys: string[] = [];
  let totalBytes = 0;
  let orphanFiles = 0;
  let orphanBytesAll = 0;

  for (const [key, entry] of index.objects) {
    const folder = key.split("/")[0] || "";
    const summary =
      folders.get(folder) ||
      { prefix: folder, files: 0, bytes: 0, orphans: 0, orphanBytes: 0 };
    summary.files += 1;
    summary.bytes += entry.size;
    totalBytes += entry.size;

    const usedBy = usage.get(key) || [];
    const orphan = usedBy.length === 0;
    if (orphan) {
      summary.orphans += 1;
      summary.orphanBytes += entry.size;
      orphanFiles += 1;
      orphanBytesAll += entry.size;
      if (orphanKeys.length < MEDIA_ORPHAN_LIMIT) orphanKeys.push(key);
    }
    folders.set(folder, summary);

    if (prefix && folder !== prefix) continue;
    if (query && !key.toLowerCase().includes(query)) continue;
    if (onlyOrphans && !orphan) continue;
    entries.push({ key, size: entry.size, uploaded: entry.uploaded, usedBy, orphan });
  }

  entries.sort((a, b) => a.key.localeCompare(b.key));
  const total = entries.length;
  const shown = entries.slice(0, MEDIA_ENTRY_LIMIT);

  const missing: Array<{ kind: ContentKind; id: string; name: string; path: string }> = [];
  let missingTotal = 0;
  const checkFile = (kind: ContentKind, id: string, name: string, path: string) => {
    if (!path || index.objects.has(path)) return;
    missingTotal += 1;
    if (missing.length < MEDIA_MISSING_LIMIT) missing.push({ kind, id, name, path });
  };
  for (const scene of published.catalog.scenes) {
    for (const path of filesOf("scenes", scene)) checkFile("scenes", scene.id, scene.name, path);
  }
  for (const sound of published.catalog.sounds) {
    for (const path of filesOf("sounds", sound)) checkFile("sounds", sound.id, sound.name, path);
  }
  for (const mood of ["lofi", "jazz", "relax"] as const) {
    for (const track of published.catalog.tracks[mood]) {
      for (const path of filesOf("tracks", track)) {
        checkFile("tracks", track.id, track.title, path);
      }
    }
  }

  return json({
    ok: true,
    version: published.version,
    summary: {
      files: index.objects.size,
      bytes: totalBytes,
      orphans: orphanFiles,
      orphanBytes: orphanBytesAll,
      missing: missingTotal,
      partial: index.partial,
    },
    folders: [...folders.values()].sort((a, b) => a.prefix.localeCompare(b.prefix)),
    entries: shown,
    total,
    truncated: total > shown.length,
    orphanKeys,
    missing,
  });
}

async function uploadMedia(
  request: Request,
  env: AdminEnv,
  email: string,
): Promise<Response> {
  const url = new URL(request.url);
  const folder = url.searchParams.get("folder") || "";
  if (!isMediaFolder(folder)) return json({ error: "invalid_folder" }, 400);
  const name = url.searchParams.get("name") || "";
  const cleaned = sanitizeFileName(name);
  if (!cleaned.ext || !folderAccepts(folder, cleaned.ext)) {
    return json({ error: "unsupported_type" }, 415);
  }
  if (!env.R2 || typeof env.R2.put !== "function") {
    return json({ error: "missing_binding" }, 500);
  }

  const declaredRaw = request.headers.get("content-length");
  const declared = declaredRaw === null ? NaN : Number(declaredRaw);
  if (Number.isFinite(declared) && declared > FILE_MAX_BYTES) {
    return json({ error: "too_large" }, 413);
  }

  // Danh sách tươi trước khi đặt tên: không bao giờ ghi đè file vừa được thêm.
  const index = await readFileIndex(env, true);
  if (!index.ok) return json({ error: index.error }, contentStatus(index.error));
  const key = pickFreeKey(`${folder}/${cleaned.base}${cleaned.ext}`, new Set(index.objects.keys()));

  let payload: ArrayBuffer | ReadableStream<Uint8Array>;
  let size: number;
  if (request.body && Number.isFinite(declared) && declared > 0) {
    payload = request.body;
    size = declared;
  } else {
    const buffer = await request.arrayBuffer();
    if (buffer.byteLength === 0) return json({ error: "invalid_body" }, 400);
    if (buffer.byteLength > FILE_MAX_BYTES) return json({ error: "too_large" }, 413);
    payload = buffer;
    size = buffer.byteLength;
  }

  const contentType = contentTypeFor(cleaned.ext);
  if (
    !(await logAudit(env, {
      actorEmail: email,
      action: "content.media.upload",
      target: key,
      detail: { key, size, contentType },
    }))
  ) {
    return json({ error: "audit_failed" }, 500);
  }

  try {
    await env.R2.put(key, payload, {
      httpMetadata: {
        contentType,
        cacheControl: "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return json({ error: "r2_write_failed" }, 500);
  }
  fileIndexCache = null;
  return json({ ok: true, key, size, contentType });
}

async function deleteMedia(
  request: Request,
  env: AdminEnv,
  email: string,
): Promise<Response> {
  const url = new URL(request.url);
  const key = (url.searchParams.get("key") || "").trim();
  if (!isSafeRelPath(key) || !isMediaFolder(key.split("/")[0])) {
    return json({ error: "invalid_key" }, 400);
  }
  if (!env.R2 || typeof env.R2.delete !== "function") {
    return json({ error: "missing_binding" }, 500);
  }

  const published = await readPublished(env);
  if (!published.ok) return json({ error: published.error }, contentStatus(published.error));
  const usedBy = fileUsage(published.catalog).get(key) || [];
  if (usedBy.length > 0) {
    return json({ error: "media_in_use", usedBy }, 409);
  }

  const index = await readFileIndex(env);
  if (index.ok && !index.objects.has(key)) return json({ error: "not_found" }, 404);

  if (
    !(await logAudit(env, {
      actorEmail: email,
      action: "content.media.delete",
      target: key,
      detail: { key, size: index.ok ? index.objects.get(key)?.size || 0 : 0 },
    }))
  ) {
    return json({ error: "audit_failed" }, 500);
  }

  try {
    await env.R2.delete(key);
  } catch {
    return json({ error: "r2_error" }, 500);
  }
  fileIndexCache = null;
  return json({ ok: true, key });
}

async function pruneMedia(
  request: Request,
  env: AdminEnv,
  email: string,
): Promise<Response> {
  const body = await readJsonBody(request);
  const raw = body?.keys;
  if (!Array.isArray(raw) || raw.length === 0) return json({ error: "invalid_body" }, 400);
  if (raw.length > MEDIA_PRUNE_LIMIT) return json({ error: "too_many_keys" }, 400);
  if (!env.R2 || typeof env.R2.delete !== "function") {
    return json({ error: "missing_binding" }, 500);
  }

  const published = await readPublished(env);
  if (!published.ok) return json({ error: published.error }, contentStatus(published.error));
  const usage = fileUsage(published.catalog);
  const index = await readFileIndex(env);

  const keys: string[] = [];
  let skipped = 0;
  let bytes = 0;
  for (const value of new Set(raw)) {
    if (
      typeof value !== "string" ||
      !isSafeRelPath(value) ||
      !isMediaFolder(value.split("/")[0]) ||
      (usage.get(value) || []).length > 0 ||
      (index.ok && !index.objects.has(value))
    ) {
      skipped += 1;
      continue;
    }
    keys.push(value);
    bytes += index.ok ? index.objects.get(value)?.size || 0 : 0;
  }

  if (keys.length === 0) return json({ ok: true, deleted: 0, skipped, freed: 0 });

  if (
    !(await logAudit(env, {
      actorEmail: email,
      action: "content.media.prune",
      target: "media",
      detail: { count: keys.length, bytes, keys: keys.slice(0, 20) },
    }))
  ) {
    return json({ error: "audit_failed" }, 500);
  }

  try {
    await env.R2.delete(keys);
  } catch {
    return json({ error: "r2_error" }, 500);
  }
  fileIndexCache = null;
  return json({ ok: true, deleted: keys.length, skipped, freed: bytes });
}
