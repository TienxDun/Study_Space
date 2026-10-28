/**
 * ZenStudy Admin Worker — router chính.
 *
 * - `/api/admin/*`: xác thực Cloudflare Access JWT rồi mới định tuyến xuống
 *   module theo concern: content (P2c), overview/ping (P1), flags (P2a),
 *   chat config (P2b). Xem từng module trong cùng thư mục `admin-worker/`.
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
 *   DATA_API_URL        Text   https://data-api...workers.dev
 *   LIVEKIT_URL         Text   https://livekit...workers.dev
 *
 * Chỉ riêng `.dev.vars` (local, gitignored):
 *   ENVIRONMENT         Text   "development" — bỏ qua Access khi chạy localhost.
 *                              Không bao giờ đặt biến này trong Production.
 */

import { verifyAccessJwt } from "./access";
import { allowChatWrite, allowFlagWrite, logAudit } from "./audit";
import {
  CHAT_CFG_TARGETS,
  CHAT_PROVIDER_ID_RE,
  chatProxyCall,
  mapChatConfig,
  parseChatCfgBody,
} from "./chat-config";
import { handleContentApi } from "./content-api";
import { FLAGS_KEY, parseFlagsBody, readFlags, type SystemFlags } from "./flags";
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
  __resetChatWriteLog,
  __resetContentWriteLog,
} from "./audit";
export { mapChatConfig, parseChatCfgBody } from "./chat-config";
export { __resetContentCaches } from "./content-api";
export { __resetR2Cache } from "./usage";
export type { AdminEnv } from "./shared";

const CHAT_TEST_TIMEOUT_MS = 30 * 1000;

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

  if (pathname === `${API_PREFIX}/chat/config`) {
    if (request.method === "GET") {
      const current = await chatProxyCall(env, "/models");
      if (!current.ok) return json({ error: current.error }, 502);
      return json({ ok: true, config: mapChatConfig(current.data) });
    }
    if (request.method !== "POST") {
      return json({ error: "Chỉ hỗ trợ GET hoặc POST." }, 405);
    }
    if (!allowChatWrite(identity.email)) {
      return json({ error: "rate_limited" }, 429);
    }
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_body" }, 400);
    }
    // Đọc trạng thái hiện tại để validate và ghi before/after vào audit.
    const current = await chatProxyCall(env, "/models");
    if (!current.ok) return json({ error: current.error }, 502);
    const change = parseChatCfgBody(body, mapChatConfig(current.data));
    if (!change) return json({ error: "invalid_body" }, 400);

    const audited = await logAudit(env, {
      actorEmail: identity.email,
      action: "chat.config.update",
      target: CHAT_CFG_TARGETS[change.kind],
      detail: change.auditDetail,
    });
    if (!audited) return json({ error: "audit_failed" }, 500);

    const written = await chatProxyCall(env, "/models", {
      method: "POST",
      body: change.payload,
    });
    if (!written.ok) return json({ error: written.error }, 502);
    return json({ ok: true });
  }

  if (pathname === `${API_PREFIX}/chat/check-key`) {
    if (request.method !== "POST") {
      return json({ error: "Chỉ hỗ trợ POST." }, 405);
    }
    if (!allowChatWrite(identity.email)) {
      return json({ error: "rate_limited" }, 429);
    }
    let body: Record<string, unknown> = {};
    try {
      const parsed = await request.json();
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      return json({ error: "invalid_body" }, 400);
    }
    const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    if (!/^https:\/\/.+/.test(baseUrl) || !apiKey || apiKey.length > 500) {
      return json({ error: "invalid_body" }, 400);
    }
    const checked = await chatProxyCall(env, "/providers/check", {
      method: "POST",
      body: { type: body.type, baseUrl, apiKey },
    });
    if (!checked.ok) {
      const status = checked.status === 401 || checked.status === 403 ? 502 : checked.status;
      return json({ error: checked.error }, status);
    }
    const models = Array.isArray(checked.data.models) ? checked.data.models : [];
    return json({
      ok: true,
      count: typeof checked.data.count === "number" ? checked.data.count : models.length,
      models,
    });
  }

  if (pathname === `${API_PREFIX}/chat/provider-models`) {
    if (request.method !== "GET") {
      return json({ error: "Chỉ hỗ trợ GET." }, 405);
    }
    const id = new URL(request.url).searchParams.get("id") || "";
    if (!CHAT_PROVIDER_ID_RE.test(id)) return json({ error: "invalid_body" }, 400);
    const listed = await chatProxyCall(env, `/providers/models?id=${encodeURIComponent(id)}`);
    if (!listed.ok) {
      const status = listed.status === 401 || listed.status === 403 ? 502 : listed.status;
      return json({ error: listed.error }, status);
    }
    const models = Array.isArray(listed.data.models) ? listed.data.models : [];
    return json({ ok: true, models });
  }

  if (pathname === `${API_PREFIX}/chat/test`) {
    if (request.method !== "POST") {
      return json({ error: "Chỉ hỗ trợ POST." }, 405);
    }
    if (!allowChatWrite(identity.email)) {
      return json({ error: "rate_limited" }, 429);
    }
    let body: Record<string, unknown> = {};
    try {
      const parsed = await request.json();
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      return json({ error: "invalid_body" }, 400);
    }
    const provider = typeof body.provider === "string" ? body.provider : "";
    const modelId = typeof body.modelId === "string" ? body.modelId : "";
    if (!provider || provider.length > 40 || !modelId || modelId.length > 200) {
      return json({ error: "invalid_body" }, 400);
    }
    const started = Date.now();
    // /chat với Bearer ADMIN_TOKEN + strict: chạy đúng model đã chọn,
    // không trừ lượt của người dùng và không lưu lịch sử.
    const tested = await chatProxyCall(env, "/chat", {
      method: "POST",
      bearer: true,
      timeoutMs: CHAT_TEST_TIMEOUT_MS,
      body: {
        text: "Xin chào! Hãy trả lời đúng một câu ngắn để kiểm tra kết nối.",
        strict: true,
        provider,
        modelId,
      },
    });
    if (!tested.ok) {
      const status = tested.status === 401 || tested.status === 403 ? 502 : tested.status;
      return json({ error: tested.error }, status);
    }
    return json({
      ok: true,
      text: typeof tested.data.text === "string" ? tested.data.text : "",
      provider: typeof tested.data.provider === "string" ? tested.data.provider : provider,
      model: typeof tested.data.model === "string" ? tested.data.model : modelId,
      ms: Date.now() - started,
    });
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
