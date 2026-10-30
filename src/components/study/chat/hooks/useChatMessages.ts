"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  setDoc,
  doc,
} from "firebase/firestore";
import { firebaseConfigured, getFirebaseDb } from "@/lib/firebase";
import { logError } from "@/lib/logger";
import { PAGE_SIZE, type Msg } from "../types";
import { callChatApi, type ChatHistoryItem } from "../utils/chatApi";
import { clearChatNotice, notifyChat } from "../utils/chatNotice";
import type { ImageAttachment } from "./useImageAttachments";
import type { MsgAttachment } from "../types";
import { loadCache, saveCache, clearCache } from "../utils/chatCache";
import { saveLocalImage } from "../utils/imageStorage";
import { trackEvent } from "@/lib/analytics";

interface MessagesArgs {
  user: { uid: string } | null;
  open: boolean;
  activeSid: string | null;
  resolved: boolean;
  remember: boolean;
  ensureSession: () => Promise<string | null>;
  noteFirstMessage: (sid: string, text: string) => Promise<void>;
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  getToken: () => Promise<string | null>;
}

// Quản lý tin nhắn phiên đang xem: nghe realtime, gửi, làm lại, chép, cuộn.
export function useChatMessages({
  user,
  open,
  activeSid,
  resolved,
  remember,
  ensureSession,
  noteFirstMessage,
  inputRef,
  getToken,
}: MessagesArgs) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [panelNewCount, setPanelNewCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const prevLenRef = useRef(0);
  const pendingSeqRef = useRef(0);
  const lastUidRef = useRef<string | null>(null);

  // Chuyển phiên: Nạp cache ngay lập tức (0 lượt đọc), nếu chưa có cache thì nạp từ listener
  useEffect(() => {
    if (!open || !user || !activeSid) {
      if (activeSid === null && resolved) {
        setMsgs((prev) => prev.filter((m) => m.id.startsWith("pending-")));
      }
      setLoading(false);
      return;
    }
    const cached = loadCache(user.uid, activeSid);
    if (cached && cached.length > 0) {
      setMsgs((prev) => {
        const pendings = prev.filter((m) => m.id.startsWith("pending-"));
        if (pendings.length === 0) return cached;
        const kept = pendings.filter((p) => !cached.some((m) => m.role === "user" && m.text === p.text));
        return [...cached, ...kept];
      });
      prevLenRef.current = cached.length;
      setLoading(false);
    } else {
      // Giữ lại các tin pending đang gửi, không xóa trắng màn hình
      setMsgs((prev) => prev.filter((m) => m.id.startsWith("pending-")));
      setLoading(false);
    }
  }, [open, user, activeSid, resolved]);

  // Nghe tin nhắn CHỈ khi mở khung (đóng khung thì hook phiên nghe document cha thôi).
  useEffect(() => {
    if (!open || !user || !firebaseConfigured || !activeSid) return;
    const db = getFirebaseDb();
    const col = collection(db, "conversations", user.uid, "sessions", activeSid, "messages");
    const q = query(col, orderBy("createdAt", "desc"), limit(PAGE_SIZE));

    const parseDocToMsg = (d: { id: string; data: () => Record<string, unknown> }): Msg => {
      const data = d.data();
      const rawTs = data.createdAt ?? data.timestamp ?? data.created_at ?? data.time;
      let ts: number | undefined;
      if (rawTs && typeof (rawTs as { toMillis?: () => number }).toMillis === "function") {
        ts = (rawTs as { toMillis: () => number }).toMillis();
      } else if (typeof rawTs === "number") {
        ts = rawTs;
      } else if (typeof rawTs === "string") {
        const parsed = Date.parse(rawTs);
        if (!isNaN(parsed)) ts = parsed;
      }
      return {
        id: d.id,
        role: data.role as "user" | "assistant",
        text: String(data.text ?? ""),
        thoughtSecs: typeof data.thoughtSecs === "number" ? data.thoughtSecs : undefined,
        rating: data.rating as Msg["rating"],
        ...(Array.isArray(data.attachments) ? { attachments: data.attachments as MsgAttachment[] } : {}),
        ts,
      };
    };

    const applySnapList = (docs: Array<{ id: string; data: () => Record<string, unknown> }>) => {
      const list = docs.map(parseDocToMsg).reverse();
      setMsgs((prev) => {
        const enrichedList = list.map((m) => {
          const old = prev.find((p) => p.id === m.id || (p.role === m.role && p.text === m.text));
          if (!old?.attachments || !m.attachments) return m;
          return {
            ...m,
            attachments: m.attachments.map((att) => {
              const oldAtt = old.attachments?.find((o) => o.id === att.id || o.name === att.name);
              return oldAtt?.originalUrl ? { ...att, originalUrl: oldAtt.originalUrl } : att;
            }),
          };
        });
        const pendings = prev.filter((m) => m.id.startsWith("pending-"));
        if (pendings.length === 0) return enrichedList;
        const kept = pendings.filter(
          (p) => !enrichedList.some((m) => m.role === "user" && m.text === p.text)
        );
        return [...enrichedList, ...kept];
      });
      saveCache(user.uid, activeSid, list);
      setLoading(false);
    };

    return onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          // Fallback: nếu tin nhắn cũ trong Firestore không có trường createdAt
          void getDocs(query(col, limit(PAGE_SIZE)))
            .then((fallbackSnap) => {
              if (!fallbackSnap.empty) {
                const sortedDocs = [...fallbackSnap.docs].sort((a, b) => {
                  const tsA = parseDocToMsg(a).ts ?? 0;
                  const tsB = parseDocToMsg(b).ts ?? 0;
                  return tsB - tsA;
                });
                applySnapList(sortedDocs);
              } else {
                setMsgs((prev) => prev.filter((m) => m.id.startsWith("pending-")));
                setLoading(false);
              }
            })
            .catch(() => {
              setMsgs((prev) => prev.filter((m) => m.id.startsWith("pending-")));
              setLoading(false);
            });
          return;
        }
        applySnapList(snap.docs);
      },
      (err) => {
        logError("Chat:onSnapshot", err);
        setLoading(false);
        if ((err as { code?: string })?.code === "permission-denied") {
          notifyChat("Chưa mở quyền đọc tin nhắn, báo admin cập nhật Rules nhé.");
        } else {
          // Fallback nếu orderBy thất bại (ví dụ missing single index)
          void getDocs(query(col, limit(PAGE_SIZE)))
            .then((fallbackSnap) => {
              if (!fallbackSnap.empty) {
                const sortedDocs = [...fallbackSnap.docs].sort((a, b) => {
                  const tsA = parseDocToMsg(a).ts ?? 0;
                  const tsB = parseDocToMsg(b).ts ?? 0;
                  return tsB - tsA;
                });
                applySnapList(sortedDocs);
              }
            })
            .catch(() => {});
        }
      }
    );
  }, [open, user, activeSid]);

  // Mở khung thì dính đáy lại.
  useEffect(() => {
    if (open) {
      stickRef.current = true;
      setIsAtBottom(true);
      setPanelNewCount(0);
      prevLenRef.current = msgs.length;
      // Focus ô nhập trên máy tính, không tự bật bàn phím trên điện thoại.
      if (window.matchMedia("(pointer: fine)").matches) {
        setTimeout(() => inputRef.current?.focus(), 150);
      }
    }
  }, [open]);
  useEffect(() => {
    if (user) {
      lastUidRef.current = user.uid;
      return;
    }
    if (lastUidRef.current) clearCache(lastUidRef.current);
    lastUidRef.current = null;
    setMsgs([]);
  }, [user]);

  const scrollToBottom = (smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = true;
    setIsAtBottom(true);
    setPanelNewCount(0);
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const at = dist < 80;
    stickRef.current = at;
    setIsAtBottom(at);
    setCanScrollUp(el.scrollTop > 8);
    if (at) setPanelNewCount(0);
  };

  // Chỉ tự cuộn khi đang dính đáy; đang đọc tin cũ thì hiện nút ↓ thay vì giật hình.
  useEffect(() => {
    if (!open) return;
    const grown = msgs.length - prevLenRef.current;
    prevLenRef.current = msgs.length;
    if (stickRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } else if (grown > 0) {
      setPanelNewCount((c) => c + grown);
    }
  }, [msgs, open, sending]);

  // Lịch sử gửi kèm khi bật Nhớ hội thoại: 10 tin thật gần nhất (bỏ tin tạm).
  const recentHistory = (): ChatHistoryItem[] => {
    if (!remember) return [];
    return msgs
      .filter((m) => !m.id.startsWith("pending-"))
      .slice(-10)
      .map((m) => ({ role: m.role, text: m.text }));
  };

  const copyMsg = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
    } catch {
      notifyChat("Không sao chép được, bạn thử lại nhé.");
    }
  };

  const sendWithText = async (raw: string, files: ImageAttachment[] = []) => {
    const text = raw.trim().slice(0, 8000);
    // Ảnh gốc gửi cho model, hình nhỏ + tên file lưu lịch sử.
    const extras = {
      images: files
        .filter((a) => a.kind === "image" && a.dataUrl)
        .map((a) => ({ name: a.name, data: a.dataUrl as string })),
      files: files
        .filter((a) => a.kind === "text" && a.text)
        .map((a) => ({ name: a.name, text: a.text as string })),
    };
    // Lưu các ảnh Full HD / Gốc vào IndexedDB cục bộ (R3.1: không tốn dung lượng Firestore).
    for (const f of files) {
      if (f.kind === "image" && f.dataUrl) {
        void saveLocalImage(f.id, f.dataUrl);
      }
    }
    const meta: MsgAttachment[] = files.map((a) => ({
      id: a.id,
      kind: a.kind,
      name: a.name,
      ...(a.kind === "image" && a.thumb ? { thumb: a.thumb } : {}),
    }));
    const localMeta: MsgAttachment[] = files.map((a) => ({
      id: a.id,
      kind: a.kind,
      name: a.name,
      ...(a.kind === "image" && a.thumb ? { thumb: a.thumb } : {}),
      ...(a.kind === "image" && a.dataUrl ? { originalUrl: a.dataUrl } : {}),
    }));
    if ((!text && meta.length === 0) || sending || regenerating || !user) return false;

    // 1. Hiện câu hỏi ngay lập tức trên UI (Optimistic UI - không đợi bất kỳ lệnh await nào)
    pendingSeqRef.current += 1;
    const pendingId = `pending-${pendingSeqRef.current}`;
    const newPendingMsg: Msg = {
      id: pendingId,
      role: "user" as const,
      text,
      ...(localMeta.length > 0 ? { attachments: localMeta } : {}),
    };
    setMsgs((prev) => [...prev, newPendingMsg]);
    setSending(true);
    clearChatNotice();
    stickRef.current = true;
    setIsAtBottom(true);
    setPanelNewCount(0);

    const dropPending = () =>
      setMsgs((prev) => prev.filter((m) => m.id !== pendingId));

    // 2. Chưa có phiên nào thì tạo 1 phiên mới ngầm để ghi vào.
    const sid = await ensureSession().catch(() => null);
    if (!sid) {
      dropPending();
      notifyChat("Mạng chập chờn, bạn thử lại nhé.");
      setSending(false);
      return false;
    }

    // 3. Gọi API AI
    const res = await callChatApi(getToken, text, recentHistory(), extras);
    if (!res.ok) {
      dropPending();
      notifyChat(res.notice);
      setSending(false);
      return false;
    }
    try {
      // Lưu 2 tin + preview: 3 lần ghi/câu (R2.2).
      // Tin user lưu kèm hình nhỏ + tên file (nhẹ, F5 còn hình), ảnh gốc không lưu.
      const db = getFirebaseDb();
      const ref = collection(db, "conversations", user.uid, "sessions", sid, "messages");
      await addDoc(ref, {
        role: "user",
        text,
        ...(meta.length > 0 ? { attachments: meta } : {}),
        createdAt: serverTimestamp(),
      });
      await addDoc(ref, { role: "assistant", text: res.text, thoughtSecs: res.secs, createdAt: serverTimestamp() });
      await setDoc(
        doc(db, "conversations", user.uid),
        { ownerUid: user.uid, activeSid: sid, lastText: res.text.slice(0, 200), updatedAt: serverTimestamp() },
        { merge: true }
      );
      await noteFirstMessage(sid, text || "Câu hỏi kèm ảnh/file");
      trackEvent("chat-message");
      return true;
    } catch {
      dropPending();
      notifyChat("Mạng chập chờn, bạn thử lại nhé.");
      return false;
    } finally {
      setSending(false);
    }
  };

  // Làm lại câu trả lời cuối: gọi lại câu hỏi cuối, ghi đè tin máy cuối.
  const regenerate = async () => {
    const rev = [...msgs].reverse();
    const lastUser = rev.find((m) => m.role === "user");
    const lastAsst = rev.find((m) => m.role === "assistant");
    if (!activeSid || !lastUser || !lastAsst || sending || regenerating || !user) return;
    setRegenerating(true);
    clearChatNotice();
    stickRef.current = true;
    setIsAtBottom(true);
    setPanelNewCount(0);
    const res = await callChatApi(getToken, lastUser.text, recentHistory());
    if (!res.ok) {
      notifyChat(res.notice);
      setRegenerating(false);
      return;
    }
    try {
      const db = getFirebaseDb();
      const base = collection(db, "conversations", user.uid, "sessions", activeSid, "messages");
      await updateDoc(doc(base, lastAsst.id), {
        text: res.text,
        thoughtSecs: res.secs,
      });
      await setDoc(
        doc(db, "conversations", user.uid),
        { ownerUid: user.uid, lastText: res.text.slice(0, 200), updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (e) {
      const code = (e as { code?: string } | null)?.code;
      notifyChat(
        code === "permission-denied"
          ? "Chưa mở quyền sửa tin nhắn, báo admin cập nhật Rules nhé."
          : "Mạng chập chờn, bạn thử lại nhé."
      );
    } finally {
      setRegenerating(false);
    }
  };

  return {
    msgs,
    loading,
    sending,
    regenerating,
    copiedId,
    scrollRef,
    bottomRef,
    isAtBottom,
    canScrollUp,
    panelNewCount,
    handleScroll,
    scrollToBottom,
    sendWithText,
    regenerate,
    copyMsg,
    // Dọn view khi chuyển/xóa/tạo phiên mới (listener phiên mới sẽ nạp lại nếu có activeSid).
    resetView: () => {
      setMsgs([]);
      setLoading(false);
      prevLenRef.current = 0;
      stickRef.current = true;
      setIsAtBottom(true);
      setPanelNewCount(0);
    },
  };
}
