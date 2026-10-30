// Gửi báo cáo câu trả lời AI lên data-api (P0.5, bắt buộc cho chính sách AI content của Play).
// Dùng chung cho chat desktop và mobile; giới hạn 10 báo cáo/ngày/UID kiểm ở Worker.

export type AiReportReason =
  | "inaccurate"
  | "inappropriate"
  | "dangerous"
  | "harassment"
  | "other";

// Mã lý do phải khớp REPORT_REASONS.ai trong workers/data-api/worker.js.
export const AI_REPORT_REASONS: ReadonlyArray<{ value: AiReportReason; label: string }> = [
  { value: "inaccurate", label: "Thông tin sai lệch" },
  { value: "inappropriate", label: "Nội dung không phù hợp" },
  { value: "dangerous", label: "Nội dung nguy hiểm" },
  { value: "harassment", label: "Xúc phạm hoặc quấy rối" },
  { value: "other", label: "Lý do khác" },
];

const REPORT_API_URL = (
  process.env.NEXT_PUBLIC_DATA_API_URL || "https://data-api.leutiendung-hht.workers.dev"
).replace(/\/+$/, "");

const CONTENT_MAX = 8000;
const DETAIL_MAX = 500;

export interface AiReportInput {
  getToken: () => Promise<string | null>;
  answer: string;
  reason: AiReportReason;
  detail?: string;
  sessionId?: string | null;
  messageId?: string | null;
}

export type AiReportResult = { ok: true } | { ok: false; notice: string };

export async function submitAiReport(input: AiReportInput): Promise<AiReportResult> {
  const token = await input.getToken();
  if (!token) return { ok: false, notice: "Phiên đăng nhập đã hết hạn, bạn đăng nhập lại nhé." };

  try {
    const res = await fetch(`${REPORT_API_URL}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        source: "ai",
        reason: input.reason,
        content: input.answer.slice(0, CONTENT_MAX),
        detail: input.detail?.trim().slice(0, DETAIL_MAX) || "",
        sessionId: input.sessionId || "",
        messageId: input.messageId || "",
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: unknown };
    if (!res.ok) {
      const notice =
        res.status === 401
          ? "Phiên đăng nhập đã hết hạn, bạn đăng nhập lại nhé."
          : res.status === 429
            ? "Bạn đã gửi quá nhiều báo cáo hôm nay, mai bạn thử lại nhé."
            : String(data?.error || "Không gửi được báo cáo, bạn thử lại nhé.");
      return { ok: false, notice };
    }
    return { ok: true };
  } catch {
    return { ok: false, notice: "Mạng chập chờn, bạn thử lại nhé." };
  }
}
