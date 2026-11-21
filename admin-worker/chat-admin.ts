/**
 * Bước 3 — Quản lý trợ lý chat v2 (chỉ metadata).
 *
 * Danh mục model đọc từ Worker `chat-v2` (`GET /models`, công khai, không tốn
 * chi phí); số lượt đọc từ D1 `chat_usage`; hạn mức đọc từ KV `cfg:flags`.
 * Không đọc nội dung hội thoại: phiên chat v2 chỉ nằm trên máy người học.
 */

import { readFlags } from "./flags";
import { json, trimUrl, type AdminEnv } from "./shared";
import { pacificDay, DEFAULT_CHAT_DAILY } from "./usage";
import { lookupIdentity } from "./users-api";

const CATALOG_TIMEOUT_MS = 8000;
const USAGE_DAYS_DEFAULT = 30;
const USAGE_DAYS_MIN = 7;
const USAGE_DAYS_MAX = 90;
const TOP_LIMIT = 10;

type CatalogModel = {
  id: string;
  displayName: string;
  provider: string;
  free: boolean;
  available: boolean | null;
  contextTokens: number | null;
  maxOutputTokens: number | null;
  priceIn: number | null;
  priceOut: number | null;
  priceSource: string;
  specSource: string;
  checkedAt: string;
};

type CatalogResult =
  | { ok: true; generatedAt: string; models: CatalogModel[] }
  | { ok: false; error: string };

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function boolOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function mapCatalogModel(raw: Record<string, unknown>): CatalogModel | null {
  const id = text(raw.id, 120);
  if (!id) return null;
  return {
    id,
    displayName: text(raw.displayName, 120) || id,
    provider: text(raw.ownedBy, 60),
    free: raw.free === true,
    available: boolOrNull(raw.available),
    contextTokens: numberOrNull(raw.contextTokens),
    maxOutputTokens: numberOrNull(raw.maxOutputTokens),
    priceIn: numberOrNull(raw.priceIn),
    priceOut: numberOrNull(raw.priceOut),
    priceSource: text(raw.priceSource, 120),
    specSource: text(raw.specSource, 160),
    checkedAt: text(raw.checkedAt, 40),
  };
}

async function fetchCatalog(env: AdminEnv): Promise<CatalogResult> {
  const base = trimUrl(env.CHAT_V2_URL);
  if (!base) return { ok: false, error: "missing_chat_v2_url" };
  let body: unknown = null;
  try {
    const res = await fetch(`${base}/models`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(CATALOG_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, error: `chat_v2_${res.status}` };
    body = await res.json().catch(() => null);
  } catch {
    return { ok: false, error: "chat_v2_unreachable" };
  }
  if (!body || typeof body !== "object") return { ok: false, error: "chat_v2_bad_payload" };
  const source = body as Record<string, unknown>;
  const rows = Array.isArray(source.data) ? source.data : [];
  const models: CatalogModel[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const mapped = mapCatalogModel(row as Record<string, unknown>);
    if (mapped) models.push(mapped);
  }
  return { ok: true, generatedAt: text(source.generatedAt, 40), models };
}

function countCatalog(models: CatalogModel[]) {
  let free = 0;
  let unverified = 0;
  let unavailable = 0;
  for (const model of models) {
    if (model.free) free += 1;
    if (model.available === null) unverified += 1;
    if (model.available === false) unavailable += 1;
  }
  return { total: models.length, free, unverified, unavailable };
}

async function catalogRoute(request: Request, env: AdminEnv): Promise<Response> {
  if (request.method !== "GET") return json({ error: "Chỉ hỗ trợ GET." }, 405);
  const result = await fetchCatalog(env);
  if (!result.ok) return json({ ok: false, error: result.error }, 502);
  return json({
    ok: true,
    generatedAt: result.generatedAt,
    counts: countCatalog(result.models),
    models: result.models,
  });
}

function pacificDayAgo(daysAgo: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() - daysAgo * 86_400_000));
}

async function resolveTopUsers(
  env: AdminEnv,
  rows: Array<{ uid: string; count: number }>,
): Promise<Array<{ uid: string; count: number; name: string; email: string; aiDisabled: boolean }>> {
  if (rows.length === 0) return [];
  const uids = rows.map((row) => row.uid);
  const marks = uids.map(() => "?").join(",");

  const disabled = new Map<string, boolean>();
  let identities = new Map<string, { name: string; email: string }>();
  const tasks: Array<Promise<unknown>> = [
    env.DB!
      .prepare(`SELECT uid, ai_disabled FROM user_restrictions WHERE uid IN (${marks})`)
      .bind(...uids)
      .all<{ uid: string; ai_disabled: number }>()
      .then((result) => {
        for (const row of result.results || []) disabled.set(String(row.uid), !!row.ai_disabled);
      })
      .catch(() => {}),
    Promise.all(
      uids.map((uid) =>
        lookupIdentity(env, { uid })
          .then((found) => (found.ok && found.user ? found.user : null))
          .catch(() => null),
      ),
    ).then((users) => {
      const map = new Map<string, { name: string; email: string }>();
      users.forEach((user) => {
        if (user) map.set(user.uid, { name: user.displayName, email: user.email });
      });
      identities = map;
    }).catch(() => {}),
  ];
  await Promise.all(tasks);

  return rows.map((row) => {
    const identity = identities.get(row.uid);
    return {
      uid: row.uid,
      count: row.count,
      name: identity?.name || "",
      email: identity?.email || "",
      aiDisabled: disabled.get(row.uid) === true,
    };
  });
}

async function usageRoute(request: Request, env: AdminEnv): Promise<Response> {
  if (request.method !== "GET") return json({ error: "Chỉ hỗ trợ GET." }, 405);
  if (!env.DB) return json({ ok: false, error: "d1_unavailable" }, 503);

  const rawDays = Number(new URL(request.url).searchParams.get("days"));
  const days =
    Number.isFinite(rawDays) && rawDays >= USAGE_DAYS_MIN && rawDays <= USAGE_DAYS_MAX
      ? Math.floor(rawDays)
      : USAGE_DAYS_DEFAULT;
  const day = pacificDay();
  const since = pacificDayAgo(days - 1);

  try {
    const [today, series, top] = await Promise.all([
      env.DB.prepare(
        "SELECT COALESCE(SUM(count), 0) AS total, COUNT(*) AS users FROM chat_usage WHERE day = ?",
      )
        .bind(day)
        .first<{ total: number; users: number }>(),
      env.DB.prepare(
        "SELECT day, COALESCE(SUM(count), 0) AS total, COUNT(*) AS users FROM chat_usage WHERE day >= ? GROUP BY day ORDER BY day",
      )
        .bind(since)
        .all<{ day: string; total: number; users: number }>(),
      env.DB.prepare("SELECT uid, count FROM chat_usage WHERE day = ? ORDER BY count DESC LIMIT ?")
        .bind(day, TOP_LIMIT)
        .all<{ uid: string; count: number }>(),
    ]);

    const topRows = (top.results || []).map((row) => ({
      uid: String(row.uid || "").slice(0, 128),
      count: Number(row.count) || 0,
    }));
    const topUsers = await resolveTopUsers(
      env,
      topRows.filter((row) => row.uid),
    );

    const flags = await readFlags(env);
    const limit =
      flags.ok && flags.flags.chatDailyLimit !== null
        ? flags.flags.chatDailyLimit
        : DEFAULT_CHAT_DAILY;

    return json({
      ok: true,
      day,
      days,
      today: {
        total: Number(today?.total) || 0,
        users: Number(today?.users) || 0,
      },
      limit,
      limitFromFlags: flags.ok && flags.flags.chatDailyLimit !== null,
      series: (series.results || []).map((row) => ({
        day: String(row.day || ""),
        total: Number(row.total) || 0,
        users: Number(row.users) || 0,
      })),
      top: topUsers,
    });
  } catch {
    return json({ ok: false, error: "d1_error" }, 500);
  }
}

export async function handleChatAdmin(
  request: Request,
  env: AdminEnv,
  pathname: string,
): Promise<Response | null> {
  if (pathname === "/api/admin/chat/catalog") return catalogRoute(request, env);
  if (pathname === "/api/admin/chat/usage") return usageRoute(request, env);
  return null;
}
