import { STORAGE_KEYS } from "@/lib/storage-keys";
import type {
  ChatV2AttachmentMeta,
  ChatV2Message,
  ChatV2RequestMessage,
  ChatV2Session,
  ChatV2SessionMeta,
  ChatV2SessionStore,
} from "../types";

export const SESSION_STORE_VERSION = 1 as const;
export const MAX_LIVE_SESSIONS = 30;
export const MAX_SESSION_MESSAGES = 200;
export const TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const DEFAULT_SESSION_TITLE = "Cuộc trò chuyện mới";
export const MAX_TITLE_LENGTH = 80;

let idSeq = 0;

export function newChatV2Id(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  idSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${idSeq}`;
}

export function createSession(modelId: string, now = Date.now()): ChatV2Session {
  return {
    id: newChatV2Id("s"),
    title: "",
    modelId,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export function createSessionStore(modelId: string, now = Date.now()): ChatV2SessionStore {
  const session = createSession(modelId, now);
  return {
    schemaVersion: SESSION_STORE_VERSION,
    activeSessionId: session.id,
    sessions: [session],
  };
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function truncateTitle(text: string, limit = 48): string {
  const clean = collapseWhitespace(text);
  return clean.length > limit ? `${clean.slice(0, limit)}…` : clean;
}

export function sessionTitle(session: ChatV2Session): string {
  const manual = collapseWhitespace(session.title);
  if (manual) return truncateTitle(manual, MAX_TITLE_LENGTH);
  const first = session.messages.find((message) => message.role === "user" && message.text.trim());
  return first ? truncateTitle(first.text) : DEFAULT_SESSION_TITLE;
}

export function sessionMeta(session: ChatV2Session): ChatV2SessionMeta {
  return {
    id: session.id,
    title: sessionTitle(session),
    messageCount: session.messages.length,
    updatedAt: session.updatedAt,
    summaryMessageCount: session.summary?.messageCount || 0,
  };
}

export function liveSessions(store: ChatV2SessionStore): ChatV2Session[] {
  return store.sessions
    .filter((session) => !session.deletedAt)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Tin nhắn chưa nằm trong bản tóm tắt — phần thực sự gửi cho model. */
export function unsummarizedMessages(session: ChatV2Session): ChatV2Message[] {
  const summary = session.summary;
  if (!summary) return session.messages;
  const index = session.messages.findIndex((message) => message.id === summary.upToMessageId);
  return index >= 0 ? session.messages.slice(index + 1) : session.messages;
}

export function requestMessagesFor(session: ChatV2Session): {
  messages: ChatV2RequestMessage[];
  summary?: string;
  omittedMessages: number;
} {
  const pending = unsummarizedMessages(session);
  return {
    messages: pending
      .filter((message) => message.text.trim().length > 0)
      .map((message) => ({ role: message.role, content: message.text })),
    ...(session.summary?.text ? { summary: session.summary.text } : {}),
    omittedMessages: session.messages.length - pending.length,
  };
}

function stripLocalImages(message: ChatV2Message): ChatV2Message {
  const images = message.payload?.images;
  if (!images || images.length === 0) return message;
  const files = message.payload?.files || [];
  const next: ChatV2Message = { ...message };
  delete next.payload;
  if (files.length > 0) next.payload = { images: [], files };
  return next;
}

function normalizeMessage(raw: unknown): ChatV2Message | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.id !== "string" || !item.id) return null;
  if (item.role !== "user" && item.role !== "assistant") return null;
  if (typeof item.text !== "string") return null;

  const message: ChatV2Message = {
    id: item.id,
    role: item.role,
    text: item.text,
  };

  if (Number.isFinite(item.durationMs) && Number(item.durationMs) > 0) {
    message.durationMs = Number(item.durationMs);
  }

  if (Array.isArray(item.attachments)) {
    const attachments = item.attachments
      .map((entry): ChatV2AttachmentMeta | null => {
        if (!entry || typeof entry !== "object") return null;
        const meta = entry as Record<string, unknown>;
        if (typeof meta.id !== "string" || typeof meta.name !== "string") return null;
        if (meta.kind !== "image" && meta.kind !== "text") return null;
        return {
          id: meta.id,
          name: meta.name,
          kind: meta.kind,
          ...(typeof meta.thumb === "string" ? { thumb: meta.thumb } : {}),
        };
      })
      .filter((entry): entry is ChatV2AttachmentMeta => entry !== null);
    if (attachments.length > 0) message.attachments = attachments;
  }

  if (item.payload && typeof item.payload === "object") {
    const payload = item.payload as Record<string, unknown>;
    const images = Array.isArray(payload.images)
      ? payload.images
          .map((entry) => {
            if (!entry || typeof entry !== "object") return null;
            const image = entry as Record<string, unknown>;
            if (typeof image.name !== "string" || typeof image.data !== "string") return null;
            if (!image.data) return null;
            return { name: image.name, data: image.data };
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      : [];
    const files = Array.isArray(payload.files)
      ? payload.files
          .map((entry) => {
            if (!entry || typeof entry !== "object") return null;
            const file = entry as Record<string, unknown>;
            if (typeof file.name !== "string" || typeof file.text !== "string") return null;
            return { name: file.name, text: file.text };
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      : [];
    if (images.length > 0 || files.length > 0) message.payload = { images, files };
  }

  return message;
}

function normalizeSession(raw: unknown, now: number): ChatV2Session | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.id !== "string" || !item.id) return null;

  const messages = Array.isArray(item.messages)
    ? item.messages
        .map((message) => normalizeMessage(message))
        .filter((message): message is ChatV2Message => message !== null)
        .slice(-MAX_SESSION_MESSAGES)
    : [];

  const createdAt = Number.isFinite(item.createdAt) ? Number(item.createdAt) : now;
  const updatedAt = Number.isFinite(item.updatedAt) ? Number(item.updatedAt) : createdAt;

  const session: ChatV2Session = {
    id: item.id,
    title: typeof item.title === "string" ? item.title.slice(0, MAX_TITLE_LENGTH) : "",
    modelId: typeof item.modelId === "string" && item.modelId ? item.modelId : "",
    createdAt,
    updatedAt,
    messages,
  };

  if (Number.isFinite(item.deletedAt)) session.deletedAt = Number(item.deletedAt);

  if (item.summary && typeof item.summary === "object") {
    const summary = item.summary as Record<string, unknown>;
    if (
      typeof summary.text === "string" &&
      summary.text.trim() &&
      typeof summary.upToMessageId === "string" &&
      summary.upToMessageId
    ) {
      session.summary = {
        text: summary.text,
        upToMessageId: summary.upToMessageId,
        messageCount: Number.isFinite(summary.messageCount) ? Number(summary.messageCount) : 0,
        updatedAt: Number.isFinite(summary.updatedAt) ? Number(summary.updatedAt) : updatedAt,
      };
    }
  }

  if (item.lastContext && typeof item.lastContext === "object") {
    const ctx = item.lastContext as Record<string, unknown>;
    if (
      Number.isFinite(ctx.estimatedInputTokens) &&
      Number.isFinite(ctx.maxInputTokens) &&
      Number.isFinite(ctx.contextTokens) &&
      Number.isFinite(ctx.maxOutputTokens)
    ) {
      session.lastContext = {
        estimatedInputTokens: Number(ctx.estimatedInputTokens),
        maxInputTokens: Number(ctx.maxInputTokens),
        trimmedMessages: Number.isFinite(ctx.trimmedMessages) ? Number(ctx.trimmedMessages) : 0,
        contextTokens: Number(ctx.contextTokens),
        maxOutputTokens: Number(ctx.maxOutputTokens),
      };
    }
  }

  return session;
}

export function pruneSessionStore(
  store: ChatV2SessionStore,
  now = Date.now()
): ChatV2SessionStore {
  const seen = new Set<string>();
  const sessions = store.sessions
    .filter((session) => {
      if (seen.has(session.id)) return false;
      seen.add(session.id);
      return !session.deletedAt || now - session.deletedAt < TOMBSTONE_RETENTION_MS;
    })
    .map((session) => ({
      ...session,
      messages: session.messages.slice(-MAX_SESSION_MESSAGES),
    }));

  const live = sessions
    .filter((session) => !session.deletedAt)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const overflow = new Set(live.slice(MAX_LIVE_SESSIONS).map((session) => session.id));

  const next = sessions.map((session) =>
    overflow.has(session.id) ? { ...session, deletedAt: now } : session
  );
  const activeExists = next.some(
    (session) => session.id === store.activeSessionId && !session.deletedAt
  );
  const fallback = next
    .filter((session) => !session.deletedAt)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];

  return {
    schemaVersion: SESSION_STORE_VERSION,
    activeSessionId: activeExists ? store.activeSessionId : fallback?.id || null,
    sessions: next,
  };
}

export function serializeSessionStore(store: ChatV2SessionStore): string {
  const pruned = pruneSessionStore(store);
  return JSON.stringify({
    ...pruned,
    sessions: pruned.sessions.map((session) => ({
      ...session,
      messages: session.messages.map(stripLocalImages),
    })),
  });
}

export function normalizeSessionStore(raw: unknown, now = Date.now()): ChatV2SessionStore | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  if (item.schemaVersion !== SESSION_STORE_VERSION) return null;
  if (!Array.isArray(item.sessions)) return null;

  const sessions = item.sessions
    .map((session) => normalizeSession(session, now))
    .filter((session): session is ChatV2Session => session !== null);
  if (sessions.length === 0) return null;

  return pruneSessionStore(
    {
      schemaVersion: SESSION_STORE_VERSION,
      activeSessionId:
        typeof item.activeSessionId === "string" ? item.activeSessionId : null,
      sessions,
    },
    now
  );
}

export function loadSessionStore(storage?: Storage): ChatV2SessionStore | null {
  const target = storage || (typeof window !== "undefined" ? window.localStorage : null);
  if (!target) return null;
  try {
    const raw = target.getItem(STORAGE_KEYS.chatV2Sessions);
    if (!raw) return null;
    return normalizeSessionStore(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveSessionStore(store: ChatV2SessionStore, storage?: Storage): boolean {
  const target = storage || (typeof window !== "undefined" ? window.localStorage : null);
  if (!target) return false;
  try {
    target.setItem(STORAGE_KEYS.chatV2Sessions, serializeSessionStore(store));
    return true;
  } catch {
    return false;
  }
}

export function relativeTime(timestamp: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestamp);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "Vừa xong";
  if (diff < hour) return `${Math.floor(diff / minute)} phút trước`;
  if (diff < day) return `${Math.floor(diff / hour)} giờ trước`;
  if (diff < 2 * day) return "Hôm qua";
  if (diff < 7 * day) return `${Math.floor(diff / day)} ngày trước`;

  const date = new Date(timestamp);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
}
