/**
 * P2c — Lớp API nội dung runtime: đọc/ghi bảng `content_manifest` (D1), lập
 * chỉ mục file R2 và định tuyến `/api/admin/content/*`. Luật thuần nằm ở
 * `content.ts`; file này chỉ lo hạ tầng và HTTP.
 *
 * Mỗi lần lưu = một version mới đủ 3 dòng; lịch sử chỉ thêm, không sửa.
 */

import { allowContentWrite, logAudit } from "./audit";
import {
  VERSIONS_PAGE,
  countsOf,
  deleteItem,
  diffFields,
  getItems,
  insertItem,
  isContentKind,
  makeItemId,
  pickItemPatch,
  updateItem,
  validateCatalog,
  type Catalog,
  type CatalogCounts,
  type ContentKind,
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

type FileIndex =
  | { ok: true; sizes: Map<string, number>; partial: boolean }
  | { ok: false; error: string };

let fileIndexCache: { at: number; value: FileIndex } | null = null;

/** Test dùng để xóa cache danh sách file R2 giữa các ca. */
export function __resetContentCaches(): void {
  fileIndexCache = null;
}

/**
 * Danh sách key + dung lượng trong bucket, cache 60 giây như `readR2Usage`.
 * Một lần list dùng cho cả tab nội dung và tab kho tệp để không đốt Class A.
 */
async function readFileIndex(env: AdminEnv): Promise<FileIndex> {
  const now = Date.now();
  if (fileIndexCache && now - fileIndexCache.at < R2_CACHE_TTL_MS) return fileIndexCache.value;

  let result: FileIndex;
  if (!env.R2) {
    result = { ok: false, error: "missing_binding" };
  } else {
    const sizes = new Map<string, number>();
    let cursor: string | undefined;
    let partial = false;
    try {
      for (let page = 1; ; page += 1) {
        const res = await env.R2.list({ limit: R2_LIST_PAGE, cursor });
        for (const object of res?.objects || []) {
          const key = typeof object?.key === "string" ? object.key : "";
          if (key) sizes.set(key, Number(object?.size) || 0);
        }
        if (!res?.truncated) break;
        if (!res.cursor || page >= R2_LIST_MAX_PAGES) {
          partial = true;
          break;
        }
        cursor = res.cursor;
      }
      result = { ok: true, sizes, partial };
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
    const size = index.ok ? index.sizes.get(path) : undefined;
    out[path] = typeof size === "number" ? size : null;
  }
  return out;
}

function contentStatus(error: string): number {
  if (error === "not_found") return 404;
  if (error === "version_conflict") return 409;
  if (error === "missing_binding" || error === "d1_error" || error === "r2_error") return 500;
  if (error === "invalid_json") return 500;
  return 400;
}

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
    for (const path of itemFiles(kind, item)) files.add(path);
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

function itemFiles(kind: ContentKind, item: unknown): string[] {
  const row = (item || {}) as Record<string, unknown>;
  const out: string[] = [];
  const push = (value: unknown) => {
    if (typeof value === "string" && value) out.push(value);
  };
  if (kind === "scenes") {
    push(row.mediaPath);
    push(row.thumbnailPath);
  } else if (kind === "sounds") {
    push(row.audioPath);
  } else {
    push(row.audioPath);
    if (typeof row.coverPath === "string" && !/^https?:\/\//i.test(row.coverPath)) {
      push(row.coverPath);
    }
  }
  return out;
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
  return json({ ok: true, version: written.version, files: itemFiles(kind, removed.removed) });
}
