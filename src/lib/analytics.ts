/**
 * GoatCounter: đếm lượt xem trang và vài thao tác chính, không cookie,
 * không thu nội dung người dùng gõ.
 *
 * Bật bằng NEXT_PUBLIC_GOATCOUNTER_URL, nhận 2 dạng:
 * - mã site của bản hosted goatcounter.com: "zenstudy"
 *   → https://zenstudy.goatcounter.com (script dùng chung gc.zgo.at)
 * - URL đầy đủ của bản tự host: "https://stats.zenstudy.space"
 *
 * Không cấu hình thì mọi hàm ở đây thành no-op.
 */

export interface GoatCounterConfig {
  /** URL nhận dữ liệu, gắn vào data-goatcounter. */
  endpoint: string;
  /** URL file count.js. */
  scriptSrc: string;
}

const HOSTED_SCRIPT_SRC = "https://gc.zgo.at/count.js";
const SITE_CODE_RE = /^[a-z0-9][a-z0-9-]*$/i;

/** Khu vực không đếm: bảng admin và studio nội bộ. */
const IGNORED_PREFIXES = ["/admin", "/dev", "/dev-preview"];

export function resolveGoatCounterConfig(
  raw: string | undefined
): GoatCounterConfig | null {
  const value = (raw ?? "").trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    const base = value.replace(/\/+$/, "");
    return { endpoint: `${base}/count`, scriptSrc: `${base}/count.js` };
  }

  if (!SITE_CODE_RE.test(value)) return null;
  return {
    endpoint: `https://${value}.goatcounter.com/count`,
    scriptSrc: HOSTED_SCRIPT_SRC,
  };
}

export function getGoatCounterConfig(): GoatCounterConfig | null {
  return resolveGoatCounterConfig(process.env.NEXT_PUBLIC_GOATCOUNTER_URL);
}

export function shouldTrackPath(pathname: string): boolean {
  const path = pathname || "/";
  return !IGNORED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

export function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  );
}

interface GoatCounterVars {
  path: string;
  title?: string;
  event?: boolean;
}

declare global {
  interface Window {
    goatcounter?: {
      count: (vars: GoatCounterVars) => void;
    };
  }
}

function canTrackNow(): boolean {
  if (typeof window === "undefined") return false;
  if (isLocalHostname(window.location.hostname)) return false;
  return shouldTrackPath(window.location.pathname);
}

/** Gửi sự kiện tùy chỉnh; chỉ khi script đã sẵn sàng và không ở máy local. */
export function trackEvent(name: string): void {
  if (!canTrackNow()) return;
  const counter = window.goatcounter;
  if (!counter || typeof counter.count !== "function") return;
  counter.count({ path: `event/${name}`, title: name, event: true });
}
