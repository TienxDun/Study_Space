"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { fetchChatV2Models, streamChatV2, summarizeChatV2 } from "../lib/api";
import {
  CHAT_V2_DEFAULT_MODEL,
  NON_CHAT_MODEL_RE,
} from "../lib/config";
import {
  MAX_ATTACHMENTS,
  prepareAttachments,
  toAttachmentMeta,
  toAttachmentPayloads,
  type ChatV2Attachment,
} from "../lib/attachments";
import { finishNotice } from "../lib/contract";
import { deleteChatImages, pruneChatImages, saveChatImage } from "../lib/image-store";
import {
  createSession,
  createSessionStore,
  liveSessions,
  loadSessionStore,
  saveSessionStore,
  sessionMeta,
  sessionTitle,
  requestMessagesFor,
  newChatV2Id,
  MAX_TITLE_LENGTH,
  unsummarizedMessages,
} from "../lib/sessions";
import { shouldSummarize, summaryChunk, SUMMARY_KEEP_RECENT } from "../lib/tokens";
import type {
  ChatV2AttachmentMeta,
  ChatV2FilePayload,
  ChatV2ImagePayload,
  ChatV2KeyTier,
  ChatV2Message,
  ChatV2Model,
  ChatV2Reply,
  ChatV2RequestMessage,
  ChatV2Session,
  ChatV2SessionStore,
} from "../types";

export interface ChatV2Extras {
  images: ChatV2ImagePayload[];
  files: ChatV2FilePayload[];
}

const EMPTY_EXTRAS: ChatV2Extras = { images: [], files: [] };

function isUsable(model: ChatV2Model): boolean {
  return model.available === true && Number(model.contextTokens) > 0;
}

// Model đã xác minh lên trước, model đang xác minh kế tiếp, model hỏng xuống cuối.
function sortModels(rows: ChatV2Model[]): ChatV2Model[] {
  const rank = (model: ChatV2Model) =>
    model.available === true ? 0 : model.available === null ? 1 : 2;
  return [...rows].sort((a, b) => {
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    if (a.free !== b.free) return a.free ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

function preferredUsable(rows: ChatV2Model[]): ChatV2Model | undefined {
  const usable = rows.filter(isUsable);
  return usable.find((row) => row.id === CHAT_V2_DEFAULT_MODEL) || usable[0];
}

function loadKeyTier(): ChatV2KeyTier {
  if (typeof window === "undefined") return "auto";
  const raw = window.localStorage.getItem(STORAGE_KEYS.chatV2KeyTier);
  return raw === "free" || raw === "paid" ? raw : "auto";
}

function isAbortError(cause: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" && cause instanceof DOMException && cause.name === "AbortError") ||
    (!!cause && typeof cause === "object" && (cause as { name?: string }).name === "AbortError")
  );
}

function nextMessageId(prefix: string): string {
  return newChatV2Id(prefix);
}

export function useChatV2() {
  const [store, setStore] = useState<ChatV2SessionStore>(() =>
    createSessionStore(CHAT_V2_DEFAULT_MODEL)
  );
  const [hydrated, setHydrated] = useState(false);
  const [models, setModels] = useState<ChatV2Model[]>([]);
  const [model, setModelState] = useState(CHAT_V2_DEFAULT_MODEL);
  const [modelNotice, setModelNotice] = useState<string | null>(null);
  const [keyTier, setKeyTierState] = useState<ChatV2KeyTier>(loadKeyTier);
  const [attachments, setAttachments] = useState<ChatV2Attachment[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [lastReply, setLastReply] = useState<ChatV2Reply | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const storeRef = useRef(store);
  const activeIdRef = useRef(store.activeSessionId);
  const summarizingRef = useRef(false);

  const activeSession = useMemo(
    () => store.sessions.find((session) => session.id === store.activeSessionId && !session.deletedAt) || null,
    [store]
  );
  const messages = useMemo(() => activeSession?.messages || [], [activeSession]);
  const context = activeSession?.lastContext || lastReply?.context;
  const sessions = useMemo(() => liveSessions(store).map(sessionMeta), [store]);
  const title = activeSession ? sessionTitle(activeSession) : "Trợ lý học tập";
  const summary = activeSession?.summary || null;
  const summaryMessageCount = summary?.messageCount || 0;
  const sessionFiles = useMemo(() => {
    const files: ChatV2AttachmentMeta[] = [];
    const seen = new Set<string>();
    for (const message of messages) {
      for (const file of message.attachments || []) {
        if (seen.has(file.id)) continue;
        seen.add(file.id);
        files.push(file);
      }
    }
    return files;
  }, [messages]);

  const modelInfo = models.find((item) => item.id === model);
  const modelLocked = !!modelInfo && !isUsable(modelInfo);
  const hasImages = attachments.some((item) => item.kind === "image");
  const visionBlocked = hasImages && !!modelInfo && modelInfo.vision !== true;
  const canSend = !sending && !modelLocked && (!!input.trim() || attachments.length > 0) && !visionBlocked;
  const canRegenerate = !sending && messages.some((message) => message.role === "user");
  // Phiên rỗng đã là "cuộc trò chuyện mới" — tạo thêm chỉ lặp lại vô nghĩa.
  const canStartNewChat = messages.length > 0;

  useEffect(() => {
    storeRef.current = store;
    activeIdRef.current = store.activeSessionId;
  }, [store]);

  useEffect(() => {
    const loaded = loadSessionStore();
    const initial = loaded || createSessionStore(CHAT_V2_DEFAULT_MODEL);
    const active = initial.sessions.find(
      (session) => session.id === initial.activeSessionId && !session.deletedAt
    );
    if (active?.modelId) setModelState(active.modelId);
    if (loaded && active && !active.modelId) {
      initial.sessions = initial.sessions.map((session) =>
        session.id === active.id ? { ...session, modelId: CHAT_V2_DEFAULT_MODEL } : session
      );
      setModelState(CHAT_V2_DEFAULT_MODEL);
    }
    setStore(initial);
    setHydrated(true);

    const keep = new Set<string>();
    for (const session of initial.sessions) {
      for (const message of session.messages) {
        for (const attachment of message.attachments || []) {
          if (attachment.kind === "image") keep.add(attachment.id);
        }
      }
    }
    void pruneChatImages(keep);
  }, []);

  useEffect(() => {
    if (!hydrated || sending) return;
    const timer = window.setTimeout(() => {
      const ok = saveSessionStore(store);
      setStorageError(
        ok
          ? null
          : "Không lưu được phiên vào trình duyệt (bộ nhớ đầy hoặc bị chặn). Phiên vẫn còn trong tab này."
      );
    }, 400);
    return () => window.clearTimeout(timer);
  }, [store, sending, hydrated]);

  useEffect(() => {
    let alive = true;
    fetchChatV2Models(keyTier)
      .then((rows) => {
        if (!alive) return;
        // Bỏ qua các model tạo ảnh, video, audio
        const chatRows = rows.filter((row) => !NON_CHAT_MODEL_RE.test(row.id));
        setModels(sortModels(chatRows));
        const usable = chatRows.filter(isUsable);
        setModelNotice(
          usable.length > 0
            ? null
            : "Chưa có model nào được xác minh đủ để dùng; chờ lần kiểm tra kế tiếp."
        );
      })
      .catch((cause: unknown) => {
        if (!alive) return;
        setModels([]);
        setModelNotice(cause instanceof Error ? cause.message : "Không tải được danh sách model.");
      });
    return () => {
      alive = false;
    };
  }, [keyTier]);

  useEffect(() => {
    if (!hydrated || models.length === 0) return;
    const current = models.find((row) => row.id === model);
    if (current && isUsable(current)) return;
    const next = preferredUsable(models);
    if (!next || next.id === model) return;
    setModelState(next.id);
    setModelNotice(
      `Đã chuyển sang ${next.id} vì ${model} chưa xác minh hoặc không còn trong danh mục.`
    );
    const sessionId = store.activeSessionId;
    if (sessionId) {
      setStore((storeState) => ({
        ...storeState,
        sessions: storeState.sessions.map((session) =>
          session.id === sessionId ? { ...session, modelId: next.id } : session
        ),
      }));
    }
  }, [hydrated, models, model, store.activeSessionId]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    []
  );

  const updateSession = (id: string, updater: (session: ChatV2Session) => ChatV2Session) => {
    setStore((current) => ({
      ...current,
      sessions: current.sessions.map((session) => (session.id === id ? updater(session) : session)),
    }));
  };

  const patchMessages = (sessionId: string, updater: (list: ChatV2Message[]) => ChatV2Message[]) => {
    updateSession(sessionId, (session) => ({
      ...session,
      messages: updater(session.messages),
      updatedAt: Date.now(),
    }));
  };

  const resetTransient = () => {
    setAttachments([]);
    setInput("");
    setError(null);
    setInfo(null);
    setLastReply(null);
  };

  const setModel = (id: string) => {
    const target = models.find((item) => item.id === id);
    if (target && !isUsable(target)) return;
    setModelState(id);
    const sessionId = store.activeSessionId;
    if (!sessionId) return;
    updateSession(sessionId, (session) => ({ ...session, modelId: id }));
  };

  const setKeyTier = (next: ChatV2KeyTier) => {
    if (sending || next === keyTier) return;
    setKeyTierState(next);
    try {
      window.localStorage.setItem(STORAGE_KEYS.chatV2KeyTier, next);
    } catch {
      // localStorage bị chặn thì chỉ giữ lựa chọn trong tab hiện tại.
    }
    setInfo(
      next === "free"
        ? "Đang dùng key free — danh sách chỉ còn model thuộc gói free."
        : next === "paid"
          ? "Đang dùng key trả phí — model chưa xác minh vẫn bị khoá."
          : "Tự động: model free đi key free, model khác đi key trả phí."
    );
  };

  const performSummarize = async (
    sessionId: string,
    chunk: ChatV2Message[],
    existingSummary?: string
  ): Promise<boolean> => {
    if (chunk.length === 0) return false;
    summarizingRef.current = true;
    setSummarizing(true);
    try {
      const result = await summarizeChatV2({
        messages: chunk.map((message) => ({ role: message.role, content: message.text })),
        summary: existingSummary,
        keyTier,
      });
      updateSession(sessionId, (current) => {
        if (current.deletedAt) return current;
        return {
          ...current,
          summary: {
            text: result.text,
            upToMessageId: chunk[chunk.length - 1].id,
            messageCount: (current.summary?.messageCount || 0) + chunk.length,
            updatedAt: Date.now(),
          },
        };
      });
      return true;
    } catch {
      return false;
    } finally {
      summarizingRef.current = false;
      setSummarizing(false);
    }
  };

  const maybeSummarize = async (sessionId: string, modelId: string) => {
    if (summarizingRef.current) return;
    const session = storeRef.current.sessions.find((item) => item.id === sessionId);
    if (!session || session.deletedAt) return;

    const modelForSession = models.find((item) => item.id === modelId);
    if (!shouldSummarize(session, modelForSession)) return;
    const chunk = summaryChunk(session);
    if (chunk.length === 0) return;

    const ok = await performSummarize(sessionId, chunk, session.summary?.text);
    if (ok && activeIdRef.current === sessionId) {
      setInfo(`Đã tóm tắt ${chunk.length} tin cũ — áp dụng từ lượt gửi tiếp theo.`);
    }
  };

  const compactContext = async () => {
    if (summarizingRef.current || sending) return;
    const sessionId = activeIdRef.current;
    if (!sessionId) return;
    const session = storeRef.current.sessions.find((item) => item.id === sessionId);
    if (!session || session.deletedAt) return;

    const chunk = summaryChunk(session);
    if (chunk.length === 0) {
      setInfo("Chưa đủ tin nhắn cũ để nén (cần ít nhất 7 tin nhắn).");
      return;
    }

    const ok = await performSummarize(sessionId, chunk, session.summary?.text);
    if (ok && activeIdRef.current === sessionId) {
      setInfo(`Đã nén ${chunk.length} tin cũ vào bộ nhớ phiên.`);
    }
  };

  const runAssistant = async (
    sessionId: string,
    modelId: string,
    request: { messages: ChatV2RequestMessage[]; summary?: string },
    assistantId: string,
    extras: ChatV2Extras = EMPTY_EXTRAS
  ) => {
    const controller = new AbortController();
    const startedAt = Date.now();
    abortRef.current = controller;
    setSending(true);
    setStreamingId(assistantId);
    setError(null);
    setInfo(null);
    setLastReply(null);

    try {
      const reply = await streamChatV2({
        model: modelId,
        messages: request.messages,
        summary: request.summary,
        images: extras.images,
        files: extras.files,
        keyTier,
        signal: controller.signal,
        onDelta: (delta) => {
          patchMessages(sessionId, (list) =>
            list.map((message) =>
              message.id === assistantId ? { ...message, text: message.text + delta } : message
            )
          );
        },
      });
      const notice = finishNotice(reply.finishReason);
      if (!reply.text) {
        patchMessages(sessionId, (list) => list.filter((message) => message.id !== assistantId));
        if (activeIdRef.current === sessionId) {
          setError(notice || "Model trả về rỗng. Kiểm tra model hoặc thử model khác.");
        }
      } else {
        updateSession(sessionId, (session) => ({
          ...session,
          messages: session.messages.map((message) =>
            message.id === assistantId
              ? { ...message, text: reply.text || message.text, durationMs: reply.latencyMs }
              : message
          ),
          ...(reply.context ? { lastContext: reply.context } : {}),
          updatedAt: Date.now(),
        }));
        if (activeIdRef.current === sessionId) {
          setLastReply(reply);
          if (notice) setError(notice);
          if (reply.context && reply.context.trimmedMessages > 0) {
            setInfo(`Đã lược bớt ${reply.context.trimmedMessages} tin cũ để vừa ngữ cảnh của model.`);
          }
        }
        void maybeSummarize(sessionId, modelId);
      }
    } catch (cause) {
      const aborted = isAbortError(cause);
      if (aborted) {
        if (activeIdRef.current === sessionId) setInfo("Đã dừng câu trả lời.");
      } else if (activeIdRef.current === sessionId) {
        setError(cause instanceof Error ? cause.message : "Gọi API thất bại.");
      }
      // Câu trả lời dừng giữa chừng vẫn còn phần chữ đã nhận — ghi lại thời gian đã chờ.
      const elapsed = Date.now() - startedAt;
      patchMessages(sessionId, (list) =>
        list.flatMap((message) => {
          if (message.id !== assistantId) return [message];
          if (!message.text.trim()) return [];
          return [aborted ? { ...message, durationMs: elapsed } : message];
        })
      );
    } finally {
      abortRef.current = null;
      setSending(false);
      setStreamingId(null);
    }
  };

  const addFiles = async (files: FileList | File[]) => {
    const room = MAX_ATTACHMENTS - attachments.length;
    const result = await prepareAttachments(files, room);
    if (result.errors.length > 0) setError(result.errors.join(" "));
    if (result.items.length > 0) {
      setAttachments((current) => [...current, ...result.items].slice(0, MAX_ATTACHMENTS));
      const addingImage = result.items.some((item) => item.kind === "image");
      if (addingImage && modelInfo && modelInfo.vision !== true) {
        const preferred = ["qwen3.8-max", "gemini-3.8-flash", "gpt-5.6", "claude-sonnet-5-5", "glm-5.3-flash"];
        const usableVision = models.filter((item) => isUsable(item) && item.vision === true);
        const visionModel =
          preferred
            .map((id) => usableVision.find((item) => item.id === id))
            .find(Boolean) || usableVision[0];
        if (visionModel) {
          setModel(visionModel.id);
          setInfo(`Đã chuyển sang ${visionModel.id} vì model trước không đọc được ảnh.`);
        }
      }
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((current) => current.filter((item) => item.id !== id));
  };

  const submit = () => {
    if (!canSend || !activeSession) return;
    const typed = input.trim();
    const text = typed || (attachments.length > 0 ? "Hãy xem nội dung đính kèm." : "");
    if (!text) return;

    const payload = toAttachmentPayloads(attachments);
    const meta = attachments.map(toAttachmentMeta);
    for (const item of attachments) {
      if (item.kind === "image" && item.dataUrl) void saveChatImage(item.id, item.dataUrl);
    }
    const userMessage: ChatV2Message = {
      id: nextMessageId("u"),
      role: "user",
      text,
      ...(meta.length > 0 ? { attachments: meta } : {}),
      ...(payload.images.length > 0 || payload.files.length > 0 ? { payload } : {}),
    };
    const assistantMessage: ChatV2Message = { id: nextMessageId("a"), role: "assistant", text: "" };
    const history = [...activeSession.messages, userMessage];
    const request = requestMessagesFor({ ...activeSession, messages: history });

    patchMessages(activeSession.id, () => [...history, assistantMessage]);
    setInput("");
    setAttachments([]);
    void runAssistant(
      activeSession.id,
      activeSession.modelId || model,
      request,
      assistantMessage.id,
      payload
    );
  };

  const regenerate = () => {
    if (sending || !activeSession) return;
    let lastUser = -1;
    for (let i = activeSession.messages.length - 1; i >= 0; i -= 1) {
      if (activeSession.messages[i].role === "user") {
        lastUser = i;
        break;
      }
    }
    if (lastUser < 0) return;

    const lastUserMessage = activeSession.messages[lastUser];
    const extras = lastUserMessage.payload || EMPTY_EXTRAS;
    const hasImageMeta = lastUserMessage.attachments?.some((item) => item.kind === "image");
    if (hasImageMeta && extras.images.length === 0) {
      setInfo("Ảnh cũ không còn trong bản lưu; lần làm lại này chỉ dùng phần chữ.");
    }

    const history = activeSession.messages.slice(0, lastUser + 1);
    const request = requestMessagesFor({ ...activeSession, messages: history });
    const assistantMessage: ChatV2Message = { id: nextMessageId("a"), role: "assistant", text: "" };
    patchMessages(activeSession.id, () => [...history, assistantMessage]);
    void runAssistant(
      activeSession.id,
      activeSession.modelId || model,
      request,
      assistantMessage.id,
      extras
    );
  };

  const stop = () => {
    if (!sending) return;
    setInfo("Đang dừng…");
    abortRef.current?.abort();
  };

  const newChat = () => {
    abortRef.current?.abort();
    if (activeSession && activeSession.messages.length === 0) {
      resetTransient();
      return;
    }
    const session = createSession(model || CHAT_V2_DEFAULT_MODEL);
    setStore((current) => ({
      ...current,
      activeSessionId: session.id,
      sessions: [...current.sessions, session],
    }));
    resetTransient();
  };

  const selectSession = (id: string) => {
    if (id === store.activeSessionId) return;
    const session = store.sessions.find((item) => item.id === id && !item.deletedAt);
    if (!session) return;
    abortRef.current?.abort();
    setStore((current) => ({ ...current, activeSessionId: id }));
    setModelState(session.modelId || model || CHAT_V2_DEFAULT_MODEL);
    resetTransient();
  };

  const renameSession = (id: string, value: string) => {
    updateSession(id, (session) => ({
      ...session,
      title: value.trim().slice(0, MAX_TITLE_LENGTH),
    }));
  };

  const deleteSession = (id: string) => {
    const current = storeRef.current;
    const target = current.sessions.find((session) => session.id === id);
    if (target) {
      void deleteChatImages(
        target.messages.flatMap((message) =>
          (message.attachments || [])
            .filter((attachment) => attachment.kind === "image")
            .map((attachment) => attachment.id)
        )
      );
    }
    const activeId = current.activeSessionId;
    const remaining = current.sessions
      .filter((session) => session.id !== id && !session.deletedAt)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const nextActive = activeId === id ? remaining[0] : null;
    const now = Date.now();
    const fresh = activeId === id && !nextActive ? createSession(model || CHAT_V2_DEFAULT_MODEL, now) : null;

    if (activeId === id) {
      abortRef.current?.abort();
      setModelState(nextActive?.modelId || model || CHAT_V2_DEFAULT_MODEL);
      resetTransient();
    }

    setStore((latest) => {
      const sessions = latest.sessions.map((session) =>
        session.id === id ? { ...session, deletedAt: now } : session
      );
      if (latest.activeSessionId !== id) {
        return { ...latest, sessions };
      }
      if (nextActive) {
        return { ...latest, sessions, activeSessionId: nextActive.id };
      }
      if (fresh) {
        return { ...latest, sessions: [...sessions, fresh], activeSessionId: fresh.id };
      }
      return { ...latest, sessions, activeSessionId: null };
    });
  };

  const canCompact = useMemo(() => {
    if (summarizing || sending || !activeSession) return false;
    return unsummarizedMessages(activeSession).length > SUMMARY_KEEP_RECENT;
  }, [summarizing, sending, activeSession]);

  return {
    models,
    model,
    modelInfo,
    modelNotice,
    setModel,
    keyTier,
    setKeyTier,
    sessions,
    activeSessionId: store.activeSessionId,
    title,
    messages,
    summary,
    summaryMessageCount,
    sessionFiles,
    summarizing,
    canCompact,
    compactContext,
    storageError,
    attachments,
    input,
    setInput,
    sending,
    streamingId,
    error,
    info,
    context,
    lastReply,
    visionBlocked,
    canSend,
    canRegenerate,
    canStartNewChat,
    submit,
    regenerate,
    stop,
    newChat,
    selectSession,
    renameSession,
    deleteSession,
    addFiles,
    removeAttachment,
  };
}
