/**
 * ZenStudy Admin Worker — router chính.
 *
 * - `/api/admin/*`: xác thực Cloudflare Access JWT rồi mới định tuyến xuống
 *   module theo concern: content (P2c), overview/ping (P1), flags (P2a),
 *   chat catalog/usage (bước 3). Xem từng module trong cùng thư mục `admin-worker/`.
 * - Mọi path khác: trả static asset trong `dist-admin/` qua binding `ASSETS`.
 *
 * Binding: `DB` → D1, `R2` → bucket study-space, `FLAGS` → KV CHAT_QUOTA
 * (khai trong `wrangler.admin.jsonc`).
 *
 * Biến môi trường (chỉ Production, không đặt ở Preview):
 *   ACCESS_TEAM_DOMAIN  Text   https://<team>.cloudflareaccess.com
 *   ACCESS_AUD          Text   Application Audience Tag
 *   ADMIN_TOKEN         Secret trùng token của worker livekit
 *   CHAT_PROXY_URL      Text   https://chat-proxy...workers.dev
 *   CHAT_V2_URL         Text   https://zenstudy-chat-v2...workers.dev
 *   DATA_API_URL        Text   https://data-api...workers.dev
 *   LIVEKIT_URL         Text   https://livekit...workers.dev
 *
 * Chỉ riêng `.dev.vars` (local, gitignored):
 *   ENVIRONMENT         Text   "development" — bỏ qua Access khi chạy localhost.
 *                              Không bao giờ đặt biến này trong Production.
 */

import { verifyAccessJwt } from "./access";
import { allowFlagWrite, logAudit } from "./audit";
import { handleChatAdmin } from "./chat-admin";
import { handleContentApi } from "./content-api";
import { FLAGS_KEY, parseFlagsBody, readFlags, type SystemFlags } from "./flags";
import { handleFeedbackApi } from "./feedback-api";
import { handleMaintenanceApi } from "./maintenance-api";
import { handleReportsApi, handleRestrictionsApi } from "./reports-api";
import { handleUsersApi } from "./users-api";
import { API_PREFIX, json, type AdminEnv } from "./shared";
import { buildOverview, pingProbes, probeCheck } from "./usage";

// Re-export để test (và ai import trực tiếp từ `_worker`) không phải đổi đường dẫn.
export {
  __resetAccessCertsCache,
  normalizeTeamDomain,
  verifyAccessJwt,
} from "./access";
export { __resetErrorLogThrottle, logAdminError } from "./errors";
export {
  __resetFlagWriteLog,
  __resetContentWriteLog,
  __resetReportWriteLog,
  __resetFeedbackWriteLog,
  __resetAuditWriteLog,
} from "./audit";
export { __resetContentCaches } from "./content-api";
export { __resetR2Cache } from "./usage";
export type { AdminEnv } from "./shared";

async function handleApi(
  request: Request,
  env: AdminEnv,
  pathname: string,
): Promise<Response> {
  const identity = await verifyAccessJwt(request, env);
  if (!identity.ok) {
    console.warn("admin api: từ chối", { reason: identity.reason, path: pathname });
    return json({ error: "Cần đăng nhập Cloudflare Access." }, 401);
  }

  if (pathname === `${API_PREFIX}/content` || pathname.startsWith(`${API_PREFIX}/content/`)) {
    return handleContentApi(request, env, pathname, identity.email);
  }

  if (pathname === `${API_PREFIX}/reports` || pathname.startsWith(`${API_PREFIX}/reports/`)) {
    return handleReportsApi(request, env, pathname, identity.email);
  }

  if (pathname === `${API_PREFIX}/feedback` || pathname.startsWith(`${API_PREFIX}/feedback/`)) {
    return handleFeedbackApi(request, env, pathname, identity.email);
  }

  if (pathname === `${API_PREFIX}/errors` || pathname === `${API_PREFIX}/audit`) {
    return handleMaintenanceApi(request, env, pathname, identity.email);
  }

  const restrictionsMatch = new RegExp(`^${API_PREFIX}/users/([^/]+)/restrictions$`).exec(pathname);
  if (restrictionsMatch) {
    return handleRestrictionsApi(request, env, restrictionsMatch[1], identity.email);
  }

  if (pathname === `${API_PREFIX}/users` || pathname.startsWith(`${API_PREFIX}/users/`)) {
    const handled = await handleUsersApi(request, env, pathname, identity.email);
    if (handled) return handled;
  }

  if (pathname === `${API_PREFIX}/overview`) {
    if (request.method !== "GET") {
      return json({ error: "Chỉ hỗ trợ GET." }, 405);
    }
    return json(await buildOverview(env, identity.email));
  }

  if (pathname === `${API_PREFIX}/flags`) {
    if (request.method !== "POST") {
      return json({ error: "Chỉ hỗ trợ POST." }, 405);
    }
    if (!env.FLAGS) {
      return json({ error: "kv_error" }, 500);
    }
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_body" }, 400);
    }
    const next = parseFlagsBody(body);
    if (!next) {
      return json({ error: "invalid_body" }, 400);
    }
    if (!allowFlagWrite(identity.email)) {
      return json({ error: "rate_limited" }, 429);
    }

    const before = await readFlags(env);
    const record: SystemFlags = {
      ...next,
      updatedAt: Date.now(),
      updatedBy: identity.email,
    };
    const audited = await logAudit(env, {
      actorEmail: identity.email,
      action: "flags.update",
      target: FLAGS_KEY,
      detail: { before: before.ok ? before.flags : null, after: record },
    });
    if (!audited) {
      return json({ error: "audit_failed" }, 500);
    }
    try {
      await env.FLAGS.put(FLAGS_KEY, JSON.stringify(record));
    } catch {
      return json({ error: "kv_error" }, 500);
    }
    return json({ ok: true, flags: record });
  }

  const chatAdmin = await handleChatAdmin(request, env, pathname);
  if (chatAdmin) return chatAdmin;
  if (pathname.startsWith(`${API_PREFIX}/chat/`)) {
    return json({ error: "not_found" }, 404);
  }

  if (pathname === `${API_PREFIX}/ping`) {
    if (request.method !== "GET") {
      return json({ error: "Chỉ hỗ trợ GET." }, 405);
    }
    const checks = await Promise.all(pingProbes(env).map(probeCheck));
    return json({
      ok: checks.every((check) => check.ok),
      email: identity.email,
      checks,
      time: new Date().toISOString(),
    });
  }

  return json({ error: "Không có endpoint này." }, 404);
}

const worker = {
  async fetch(request: Request, env: AdminEnv): Promise<Response> {
    const url = new URL(request.url);

    if (
      url.pathname === API_PREFIX ||
      url.pathname.startsWith(`${API_PREFIX}/`)
    ) {
      return handleApi(request, env, url.pathname);
    }

    if (!env.ASSETS) return new Response("Not found", { status: 404 });
    return env.ASSETS.fetch(request);
  },
};

export default worker;
