// Quy ước log console của app:
// - devWarn: chẩn đoán nội bộ (nạp tài nguyên, thiết bị, đồng bộ ngầm). Chỉ hiện ở
//   dev hoặc khi bật localStorage "zs:debug" = "1" để hỗ trợ gỡ lỗi trên máy người dùng.
// - logError: lỗi thật, luôn hiện. Ở production chỉ in tên/mã/thông điệp ngắn vì object
//   lỗi của Firebase/LiveKit chứa UID, đường dẫn tài liệu và nhãn thiết bị.

const isProd = process.env.NODE_ENV === "production";
const DEBUG_KEY = "zs:debug";

function isDebugEnabled(): boolean {
  if (!isProd) return true;
  try {
    return window.localStorage.getItem(DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

export function devWarn(...args: unknown[]): void {
  if (isDebugEnabled()) console.warn(...args);
}

function summarizeError(err: unknown): string {
  if (typeof err === "string") return err.slice(0, 300);
  if (err instanceof Error) {
    const code = (err as { code?: unknown }).code;
    const summary = [err.name, typeof code === "string" ? code : "", err.message]
      .filter(Boolean)
      .join(" · ");
    return summary.slice(0, 300);
  }
  return String(err).slice(0, 300);
}

export function logError(scope: string, err: unknown): void {
  if (isDebugEnabled()) {
    console.error(`[${scope}]`, err);
    return;
  }
  console.error(`[${scope}]`, summarizeError(err));
}
