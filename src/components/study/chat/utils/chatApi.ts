const CHAT_URL = process.env.NEXT_PUBLIC_CHAT_API_URL || "";

// Gọi API chat chung cho gửi mới + làm lại, đo thời gian máy nghĩ.
// history: 10 tin gần nhất khi bật Nhớ hội thoại.
// Để ngoài component vì Date.now là hàm impure (quy tắc react-hooks/purity).
export interface ChatHistoryItem {
  role: string;
  text: string;
}

// Ảnh gửi kèm: chữ dài dataURL để worker đưa tiếp cho model đọc.
export interface ChatImageItem {
  name: string;
  data: string;
}

// File chữ gửi kèm: nội dung chữ đọc sẵn ở web.
export interface ChatFileItem {
  name: string;
  text: string;
}

export interface ChatExtras {
  images?: ChatImageItem[];
  files?: ChatFileItem[];
}

export async function callChatApi(
  getToken: () => Promise<string | null>,
  text: string,
  history: ChatHistoryItem[] = [],
  extras: ChatExtras = {}
): Promise<{ ok: true; text: string; secs: number } | { ok: false; notice: string }> {
  const token = await getToken();
  if (!token) return { ok: false, notice: "Phiên đăng nhập hết hạn, bạn đăng nhập lại nhé." };
  const t0 = Date.now();
  try {
    const body: Record<string, unknown> = { text };
    if (history.length > 0) body.history = history;
    if (extras.images && extras.images.length > 0) body.images = extras.images;
    if (extras.files && extras.files.length > 0) body.files = extras.files;
    const r = await fetch(`${CHAT_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = (await r.json().catch(() => ({}))) as { error?: unknown; text?: unknown };
    if (!r.ok) {
      const notice =
        r.status === 401
          ? "Bạn đăng nhập lại để chat nhé."
          : r.status === 429
            ? "Bản free hôm nay đã hết lượt, mai bạn quay lại nhé."
            : String(data?.error || "Máy đang bận, thử lại sau 1 phút.");
      return { ok: false, notice };
    }
    const secs = Math.max(1, Math.round((Date.now() - t0) / 1000));
    return { ok: true, text: String(data.text || ""), secs };
  } catch {
    return { ok: false, notice: "Mạng chập chờn, bạn thử lại nhé." };
  }
}
