// Quy ước log console của app:
// - devWarn: chẩn đoán nội bộ (nạp tài nguyên, thiết bị, đồng bộ ngầm). Chỉ hiện ở
//   dev hoặc khi bật sessionStorage "zs:debug" = "1" để gỡ lỗi trên máy người dùng.
//   Cờ nằm ở sessionStorage nên đóng tab là mất, không sót lại quyền in log thô.
// - logError: lỗi thật, luôn hiện. Ở production chỉ in tên/mã/thông điệp ngắn, đã lọc
//   token/email/UID và đường dẫn tài liệu vì object lỗi của Firebase/LiveKit chứa
//   định danh người dùng.

const isProd = process.env.NODE_ENV === "production";
const DEBUG_KEY = "zs:debug";

function isDebugEnabled(): boolean {
  if (!isProd) return true;
  try {
    return window.sessionStorage.getItem(DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

export function devWarn(...args: unknown[]): void {
  if (isDebugEnabled()) console.warn(...args);
}

// Định danh có thể lọt vào message lỗi của SDK: token trong query, Bearer/JWT,
// email, UID Firebase và đường dẫn document Firestore.
const SENSITIVE_PARAM_RE =
  /([?&](?:access_token|id_token|refresh_token|token|api_key|apikey|key|secret|password|sig|signature|auth|code)=)[^&\s#]+/gi;
const BEARER_TOKEN_RE = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const FIRESTORE_DOC_PATH_RE =
  /(projects\/[^/\s]+\/databases\/\(default\)\/documents\/[^/\s()]+)((?:\/[^/\s()]+)+)/g;
const FIREBASE_UID_RE = /(?<![A-Za-z0-9])[A-Za-z0-9]{28}(?![A-Za-z0-9])/g;

function redactIdentifiers(text: string): string {
  return text
    .replace(SENSITIVE_PARAM_RE, "$1<redacted>")
    .replace(BEARER_TOKEN_RE, "Bearer <redacted>")
    .replace(JWT_RE, "<redacted>")
    .replace(EMAIL_RE, "<email>")
    .replace(FIRESTORE_DOC_PATH_RE, "$1/<id>")
    .replace(FIREBASE_UID_RE, "<uid>");
}

function summarizeError(err: unknown): string {
  if (typeof err === "string") return redactIdentifiers(err).slice(0, 300);
  if (err instanceof Error) {
    const code = (err as { code?: unknown }).code;
    const summary = [err.name, typeof code === "string" ? code : "", err.message]
      .filter(Boolean)
      .join(" · ");
    return redactIdentifiers(summary).slice(0, 300);
  }
  return redactIdentifiers(String(err)).slice(0, 300);
}

export function logError(scope: string, err: unknown): void {
  if (isDebugEnabled()) {
    console.error(`[${scope}]`, err);
    return;
  }
  console.error(`[${scope}]`, summarizeError(err));
}
