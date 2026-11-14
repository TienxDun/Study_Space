// Gửi góp ý/báo lỗi chung lên data-api (P3.16), khác báo cáo vi phạm ở content-reports.ts.
// Giới hạn 5 lượt/ngày/UID kiểm ở Worker; không có cơ chế tự xoá, quản trị viên xoá tay.

import { APP_VERSION_LABEL } from "@/lib/version";

export type FeedbackKind = "bug" | "idea" | "other";

// Mã loại phải khớp FEEDBACK_KINDS trong workers/data-api/worker.js.
export const FEEDBACK_KINDS: ReadonlyArray<{ value: FeedbackKind; label: string }> = [
  { value: "bug", label: "Báo lỗi" },
  { value: "idea", label: "Đề xuất" },
  { value: "other", label: "Khác" },
];

export const FEEDBACK_MESSAGE_MIN = 10;
export const FEEDBACK_MESSAGE_MAX = 2000;
export const FEEDBACK_CONTACT_MAX = 120;

const FEEDBACK_API_URL = (
  process.env.NEXT_PUBLIC_DATA_API_URL || "https://data-api.leutiendung-hht.workers.dev"
).replace(/\/+$/, "");

export interface FeedbackInput {
  getToken: () => Promise<string | null>;
  kind: FeedbackKind;
  message: string;
  /** Email/liên hệ người dùng tự nguyện nhập, để admin hỏi lại khi cần. */
  contact?: string;
  /** Tên hiển thị của người gửi, để admin đọc thay vì UID. */
  name?: string;
  /** Ảnh đã nén sẵn ở client (xem feedback-image.ts), tối đa 1 ảnh. */
  image?: Blob;
}

export type FeedbackResult = { ok: true } | { ok: false; notice: string };

/** Ngữ cảnh nhỏ, không định danh người dùng; giúp đoán lỗi giao diện. */
function collectContext() {
  if (typeof window === "undefined") return {};
  return {
    appVersion: APP_VERSION_LABEL,
    platform: process.env.NEXT_PUBLIC_MOBILE_SHELL === "1" ? "android" : "web",
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    locale: String(navigator.language || "").slice(0, 12),
  };
}

export async function submitFeedback(input: FeedbackInput): Promise<FeedbackResult> {
  const token = await input.getToken();
  if (!token) return { ok: false, notice: "Phiên đăng nhập đã hết hạn, bạn đăng nhập lại nhé." };

  const payload: Record<string, string | undefined> = {
    kind: input.kind,
    message: input.message.slice(0, FEEDBACK_MESSAGE_MAX),
    contact: input.contact?.trim().slice(0, FEEDBACK_CONTACT_MAX) || "",
    name: input.name?.slice(0, 30) || "",
    ...collectContext(),
  };
  const url = `${FEEDBACK_API_URL}/feedback`;

  try {
    let res: Response;
    if (input.image) {
      // Có ảnh thì gửi multipart; Worker đọc form và kiểm lại ảnh.
      const form = new FormData();
      for (const [key, value] of Object.entries(payload)) {
        form.append(key, String(value ?? ""));
      }
      form.append("image", input.image, "feedback.jpg");
      res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
    } else {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
    }

    const data = (await res.json().catch(() => ({}))) as { error?: unknown; code?: unknown };
    if (!res.ok) {
      const serverMessage = typeof data?.error === "string" ? data.error : "";
      const notice =
        res.status === 401
          ? "Phiên đăng nhập đã hết hạn, bạn đăng nhập lại nhé."
          : res.status === 429 && data?.code !== "IMAGE_RATE_LIMITED"
            ? "Bạn đã gửi nhiều góp ý hôm nay, mai bạn thử lại nhé."
            : serverMessage || "Không gửi được góp ý, bạn thử lại nhé.";
      return { ok: false, notice };
    }
    return { ok: true };
  } catch {
    return { ok: false, notice: "Mạng chập chờn, bạn thử lại nhé." };
  }
}
