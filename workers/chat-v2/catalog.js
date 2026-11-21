/**
 * Danh mục model chat v2, sinh bởi scripts/refresh-chat-v2-models.mjs.
 * Không sửa tay — chạy `npm run refresh:models` để cập nhật.
 * Mỗi model ghi kèm nguồn (giá, ngữ cảnh) và ngày kiểm; model chưa kiểm có
 * available = null, giao diện phải khoá chọn.
 */
import catalog from "./model-catalog.json";

// Phần đầu ra app giữ lại khi chia ngân sách token.
const RESERVED_OUTPUT_CAP = 16384;

const MODELS = new Map((catalog.models || []).map((model) => [model.id, model]));

export const CATALOG_GENERATED_AT = catalog.generatedAt || null;
export const CATALOG_IDS = [...MODELS.keys()];

export function catalogEntry(modelId) {
  return MODELS.get(String(modelId || "")) || null;
}

export function isFreeModel(modelId) {
  const entry = catalogEntry(modelId);
  return !!(entry && entry.free);
}

export function isModelUnavailable(modelId) {
  return catalogEntry(modelId)?.available === false;
}

export function catalogFreeCount() {
  let total = 0;
  for (const model of MODELS.values()) if (model.free) total += 1;
  return total;
}

function listedModel(entry) {
  return {
    id: entry.id,
    displayName: entry.displayName || entry.id,
    ownedBy: entry.provider || "",
    free: entry.free === true,
    available: entry.available,
    contextTokens: entry.contextTokens,
    maxOutputTokens: entry.maxOutputTokens,
    priceIn: entry.priceIn,
    priceOut: entry.priceOut,
    priceSource: entry.priceSource || null,
    specSource: entry.specSource || null,
    upstreamModel: entry.upstreamModel || null,
    checkedAt: entry.checkedAt || null,
  };
}

export function listCatalog() {
  return [...MODELS.values()].map(listedModel);
}

// Không có mức mặc định: model lạ trả null để worker từ chối thay vì đoán.
export function getCapability(modelId) {
  const entry = catalogEntry(modelId);
  if (!entry) return null;
  const contextTokens = Number.isFinite(entry.contextTokens) ? entry.contextTokens : null;
  const output = Number.isFinite(entry.maxOutputTokens) ? entry.maxOutputTokens : RESERVED_OUTPUT_CAP;
  return {
    contextTokens,
    maxOutputTokens: Math.min(output, RESERVED_OUTPUT_CAP),
    baselinePromptTokens: Number.isFinite(entry.baselinePromptTokens) ? entry.baselinePromptTokens : 0,
    priceIn: entry.priceIn ?? null,
    priceOut: entry.priceOut ?? null,
  };
}

export function publicCapability(modelId) {
  const cap = getCapability(modelId);
  if (!cap) return null;
  return {
    contextTokens: cap.contextTokens,
    maxOutputTokens: cap.maxOutputTokens,
    priceIn: cap.priceIn,
    priceOut: cap.priceOut,
  };
}
