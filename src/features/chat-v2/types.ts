export type ChatV2Role = "system" | "user" | "assistant";

// Chế độ chọn API key ở Worker: auto = free model dùng key free, còn lại key trả phí.
export type ChatV2KeyTier = "auto" | "free" | "paid";

export interface ChatV2AttachmentMeta {
  id: string;
  name: string;
  kind: "image" | "text";
  thumb?: string;
}

/** Tệp chữ kèm nội dung để mở lại ở thanh chi tiết phiên. */
export interface ChatV2SessionFileMeta extends ChatV2AttachmentMeta {
  text?: string;
}

export interface ChatV2ImagePayload {
  name: string;
  data: string;
}

export interface ChatV2FilePayload {
  name: string;
  text: string;
}

export interface ChatV2Message {
  id: string;
  role: ChatV2Role;
  text: string;
  /** Thời gian chờ + nhận câu trả lời (ms) — chỉ gắn cho tin assistant đã xong. */
  durationMs?: number;
  attachments?: ChatV2AttachmentMeta[];
  payload?: {
    images: ChatV2ImagePayload[];
    files: ChatV2FilePayload[];
  };
}

export interface ChatV2SessionSummary {
  text: string;
  upToMessageId: string;
  messageCount: number;
  updatedAt: number;
}

export interface ChatV2Session {
  id: string;
  title: string;
  modelId: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  messages: ChatV2Message[];
  summary?: ChatV2SessionSummary;
  lastContext?: ChatV2ContextMeta;
}

export interface ChatV2SessionStore {
  schemaVersion: 1;
  activeSessionId: string | null;
  sessions: ChatV2Session[];
}

export interface ChatV2SessionMeta {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: number;
  summaryMessageCount: number;
}

export interface ChatV2RequestMessage {
  role: ChatV2Role;
  content: string;
}

export interface ChatV2Usage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ChatV2ContextMeta {
  estimatedInputTokens: number;
  maxInputTokens: number;
  trimmedMessages: number;
  contextTokens: number;
  maxOutputTokens: number;
}

export interface ChatV2Reply {
  text: string;
  model: string;
  finishReason: string;
  usage: ChatV2Usage | null;
  latencyMs: number;
  id?: string;
  context?: ChatV2ContextMeta;
}

export interface ChatV2Model {
  id: string;
  ownedBy: string;
  /** Số token ngữ cảnh; null khi chưa xác minh. */
  contextTokens: number | null;
  /** Số token đầu ra tối đa; null khi chưa xác minh. */
  maxOutputTokens: number | null;
  /** Đọc ảnh; null khi chưa xác minh. */
  vision: boolean | null;
  /** Thuộc gói key free. */
  free: boolean;
  /** true = đã kiểm và dùng được, false = đang hỏng, null = chưa xác minh. */
  available: boolean | null;
  visionSource?: string | null;
  specSource?: string | null;
  checkedAt?: string | null;
  /** Giá USD / 1M token đầu vào (null nếu chưa có dữ liệu). */
  priceIn?: number | null;
  /** Giá USD / 1M token đầu ra (null nếu chưa có dữ liệu). */
  priceOut?: number | null;
}
