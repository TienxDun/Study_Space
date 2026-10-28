/**
 * Phần dùng chung của admin worker: kiểu binding, hằng số hạ tầng và
 * helper response/request nhỏ dùng qua nhiều module.
 */

export const API_PREFIX = "/api/admin";
export const PROBE_TIMEOUT_MS = 10_000;
export const R2_LIST_PAGE = 1000;
export const R2_LIST_MAX_PAGES = 30;
export const R2_CACHE_TTL_MS = 60 * 1000;

export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<unknown>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1Statement;
}

export interface R2ObjectLike {
  key?: string;
  size?: number;
}

export interface R2ListPage {
  objects?: R2ObjectLike[];
  truncated?: boolean;
  cursor?: string;
}

export interface R2BucketLike {
  list(options?: { limit?: number; cursor?: string }): Promise<R2ListPage>;
}

export interface KvNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface AdminEnv {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ADMIN_TOKEN?: string;
  CHAT_PROXY_URL?: string;
  DATA_API_URL?: string;
  LIVEKIT_URL?: string;
  ENVIRONMENT?: string;
  ASSETS?: { fetch(request: Request): Promise<Response> };
  DB?: D1DatabaseLike;
  R2?: R2BucketLike;
  FLAGS?: KvNamespaceLike;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function trimUrl(raw: string | undefined): string {
  return String(raw || "").trim().replace(/\/+$/, "");
}
