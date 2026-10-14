"use client";

import { useEffect, useRef, useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  setDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { firebaseConfigured, getFirebaseDb } from "@/lib/firebase";
import { SESSION_LIST_MAX, PAGE_SIZE, type Session } from "../types";

interface SessionsArgs {
  user: { uid: string } | null;
  open: boolean;
  setNotice: (msg: string) => void;
}

function extractTimestamp(val: unknown): number | undefined {
  if (!val) return undefined;
  if (typeof val === "number") return val;
  if (
    typeof val === "object" &&
    val !== null &&
    "toMillis" in val &&
    typeof (val as { toMillis: unknown }).toMillis === "function"
  ) {
    return (val as { toMillis: () => number }).toMillis();
  }
  return undefined;
}

// Quản lý phiên trò chuyện: nghe document cha, dò phiên, tạo/chuyển/xóa đoạn.
// activeSid null = chưa có phiên nào, câu gửi đầu sẽ tạo.
export function useChatSessions({ user, open, setNotice }: SessionsArgs) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSid, setActiveSid] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [confirmDelSid, setConfirmDelSid] = useState<string | null>(null);
  const [parentMs, setParentMs] = useState(0);
  const [lastSeenParent, setLastSeenParent] = useState(0);
  const [parentLoaded, setParentLoaded] = useState(false);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const freshTitleRef = useRef(false);
  const switchingSidRef = useRef<{ sid: string; until: number } | null>(null);

  // Document cha: 1 lượt đọc khi đăng nhập + khi có đổi (rẻ hơn nghe 50 tin).
  // Vừa lấy activeSid, vừa báo chấm đỏ khi có tin mới lúc đóng khung.
  useEffect(() => {
    if (!user || !firebaseConfigured) return;
    const ref = doc(getFirebaseDb(), "conversations", user.uid);
    return onSnapshot(
      ref,
      (snap) => {
        const data = snap.data() as { activeSid?: string | null; updatedAt?: { toMillis?: () => number } } | undefined;
        const pending = switchingSidRef.current;
        // Nếu người dùng vừa chủ động đổi phiên trong 3s qua, không để snapshot cũ ghi đè
        if (pending && Date.now() < pending.until) {
          if (data?.activeSid === pending.sid) {
            switchingSidRef.current = null;
          }
        } else {
          setActiveSid(data?.activeSid ?? null);
        }
        setParentMs(typeof data?.updatedAt?.toMillis === "function" ? data.updatedAt.toMillis() : 0);
        setParentLoaded(true);
      },
      (err) => {
        // Rules chưa publish kịp hoặc document chưa có: coi như chưa có gì để khỏi nổ console.
        if ((err as { code?: string })?.code === "permission-denied") setParentLoaded(true);
      }
    );
  }, [user]);

  // Chấm đỏ lúc đóng khung: document cha mới hơn lần xem cuối.
  const hasNew = !open && parentMs > lastSeenParent;

  // Chọn phiên khi mở: đang chọn thì thôi, chưa có thì lấy phiên mới nhất,
  // trắng tinh thì để trống (câu gửi đầu sẽ tạo). Tốn tối đa 1 lượt đọc.
  useEffect(() => {
    if (!open || !user || !parentLoaded || activeSid !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const db = getFirebaseDb();
        const s = await getDocs(
          query(collection(db, "conversations", user.uid, "sessions"), orderBy("createdAt", "desc"), limit(1))
        );
        if (cancelled) return;
        if (!s.empty) {
          const first = s.docs[0];
          const data = first.data() as Record<string, unknown>;
          const created = extractTimestamp(data.createdAt);
          setActiveSid(first.id);
          setSessions([
            {
              id: first.id,
              title: String(data.title || "Đoạn chat"),
              createdAt: created,
            },
          ]);
          await setDoc(
            doc(db, "conversations", user.uid),
            { ownerUid: user.uid, activeSid: first.id, updatedAt: serverTimestamp() },
            { merge: true }
          );
        }
        setResolved(true);
      } catch {
        if (!cancelled) setResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user, parentLoaded, activeSid]);

  // Mở khung thì đánh dấu đã xem.
  useEffect(() => {
    if (open) setLastSeenParent(parentMs);
  }, [open, parentMs]);

  // Đăng xuất thì dọn state phiên để khỏi lộ sang acc khác (cache máy do widget dọn).
  useEffect(() => {
    if (!user) {
      setSessions([]);
      setSessionsLoaded(false);
      setActiveSid(null);
      setResolved(false);
      setParentMs(0);
      setLastSeenParent(0);
      setParentLoaded(false);
      setDrawerOpen(false);
    }
  }, [user]);

  // Có phiên để ghi: đang xem phiên nào ghi vào đó, mới tinh thì tạo 1 phiên.
  const ensureSession = async (): Promise<string | null> => {
    if (!user) return null;
    if (activeSid) return activeSid;
    const db = getFirebaseDb();
    const sref = await addDoc(collection(db, "conversations", user.uid, "sessions"), {
      ownerUid: user.uid,
      title: "Đoạn chat mới",
      createdAt: serverTimestamp(),
    });
    void setDoc(
      doc(db, "conversations", user.uid),
      { ownerUid: user.uid, activeSid: sref.id, updatedAt: serverTimestamp() },
      { merge: true }
    ).catch(() => {});
    freshTitleRef.current = true;
    const now = Date.now();
    setSessions((prev) => [{ id: sref.id, title: "Đoạn chat mới", createdAt: now, updatedAt: now }, ...prev]);
    setActiveSid(sref.id);
    return sref.id;
  };

  // Phiên mới tạo thì đặt tên theo câu hỏi đầu (1 lần ghi duy nhất).
  const noteFirstMessage = async (sid: string, text: string) => {
    if (!freshTitleRef.current || !user) return;
    freshTitleRef.current = false;
    const title = text.slice(0, 32);
    try {
      await updateDoc(doc(getFirebaseDb(), "conversations", user.uid, "sessions", sid), { title });
      setSessions((prev) => prev.map((s) => (s.id === sid ? { ...s, title, updatedAt: Date.now() } : s)));
    } catch {
      /* tên mặc định vẫn dùng được */
    }
  };

  // Đổi tên phiên: cập nhật Firestore và state cục bộ
  const renameSession = async (sid: string, newTitle: string): Promise<boolean> => {
    const trimmed = newTitle.trim().slice(0, 48);
    if (!trimmed || !user) return false;
    // Optimistic update
    setSessions((prev) => prev.map((s) => (s.id === sid ? { ...s, title: trimmed, updatedAt: Date.now() } : s)));
    try {
      await updateDoc(doc(getFirebaseDb(), "conversations", user.uid, "sessions", sid), {
        title: trimmed,
        updatedAt: serverTimestamp(),
      });
      return true;
    } catch (e) {
      console.warn("Lỗi đổi tên phiên:", e);
      setNotice("Không thể đổi tên đoạn chat, bạn thử lại nhé.");
      return false;
    }
  };

  // Mở ngăn phiên: tải list 1 lần (tối đa 20 lượt đọc), lần sau dùng lại.
  const openDrawer = async () => {
    setDrawerOpen((v) => !v);
    setConfirmDelSid(null);
    if (sessionsLoaded || !user) return;
    setDrawerLoading(true);
    try {
      const db = getFirebaseDb();
      let s;
      try {
        s = await getDocs(
          query(
            collection(db, "conversations", user.uid, "sessions"),
            orderBy("createdAt", "desc"),
            limit(SESSION_LIST_MAX)
          )
        );
      } catch {
        // Fallback không orderBy nếu index chưa sẵn sàng
        s = await getDocs(
          query(
            collection(db, "conversations", user.uid, "sessions"),
            limit(SESSION_LIST_MAX)
          )
        );
      }
      setSessions(
        s.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            title: String(data.title || "Đoạn chat"),
            createdAt: extractTimestamp(data.createdAt),
            updatedAt: extractTimestamp(data.updatedAt),
          };
        })
      );
      setSessionsLoaded(true);
    } catch {
      setNotice("Mạng chập chờn, bạn thử lại nhé.");
    } finally {
      setDrawerLoading(false);
    }
  };

  // Tạo phiên mới: chỉ khi phiên hiện tại đã có tin nhắn.
  // Đưa về trạng thái phiên mới (activeSid = null), câu hỏi đầu mới ghi DB để không sinh rác.
  const createSession = (hasMessages: boolean, busy: boolean, onSwitched: () => void) => {
    if (!user || busy) return;
    if (!hasMessages || activeSid === null) {
      setNotice("Đoạn chat hiện tại chưa có tin nhắn, bạn hãy gửi câu hỏi nhé!");
      setDrawerOpen(false);
      return;
    }
    setActiveSid(null);
    onSwitched();
    setDrawerOpen(false);
    setConfirmDelSid(null);
  };

  // Chuyển phiên: Optimistic update ngay lập tức, lưu ngầm không chặn UI.
  const switchSession = async (sid: string, busy: boolean, onSwitched: () => void) => {
    if (!user || sid === activeSid) {
      setDrawerOpen(false);
      return;
    }
    if (busy) {
      setNotice("Trợ lý đang trả lời câu hỏi, bạn đợi một lát nhé.");
      setDrawerOpen(false);
      return;
    }

    // 1. Cập nhật state cục bộ ngay lập tức để UI mở phiên mượt mà
    setActiveSid(sid);
    switchingSidRef.current = { sid, until: Date.now() + 3500 };
    onSwitched();
    setDrawerOpen(false);
    setConfirmDelSid(null);

    // 2. Ghi activeSid ngầm lên Firestore để lưu lại vị trí phiên
    try {
      await setDoc(
        doc(getFirebaseDb(), "conversations", user.uid),
        { ownerUid: user.uid, activeSid: sid, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (e) {
      console.warn("Lỗi đồng bộ activeSid ngầm:", e);
    }
  };

  // Xóa phiên: bấm 2 lần để chắc. Xóa cả tin trong phiên nên tốn lượt xóa theo số tin.
  const deleteSession = async (sid: string, busy: boolean, onDeletedActive: () => void) => {
    if (!user || busy) return;
    if (confirmDelSid !== sid) {
      setConfirmDelSid(sid);
      return;
    }
    setConfirmDelSid(null);
    try {
      const db = getFirebaseDb();
      const all = await getDocs(
        query(collection(db, "conversations", user.uid, "sessions", sid, "messages"), orderBy("createdAt", "desc"), limit(PAGE_SIZE))
      );
      await Promise.all([
        ...all.docs.map((d) => deleteDoc(doc(db, "conversations", user.uid, "sessions", sid, "messages", d.id))),
        deleteDoc(doc(db, "conversations", user.uid, "sessions", sid)),
      ]);
      setSessions((prev) => prev.filter((s) => s.id !== sid));
      if (sid === activeSid) {
        await setDoc(
          doc(db, "conversations", user.uid),
          { ownerUid: user.uid, activeSid: null, updatedAt: serverTimestamp() },
          { merge: true }
        );
        setActiveSid(null);
        onDeletedActive();
      }
    } catch (e) {
      const code = (e as { code?: string } | null)?.code;
      setNotice(
        code === "permission-denied"
          ? "Chưa mở quyền xóa, báo admin cập nhật Rules nhé."
          : "Mạng chập chờn, bạn thử lại nhé."
      );
    }
  };

  return {
    sessions,
    activeSid,
    resolved,
    parentLoaded,
    hasNew,
    drawerOpen,
    setDrawerOpen,
    drawerLoading,
    confirmDelSid,
    ensureSession,
    noteFirstMessage,
    openDrawer,
    createSession,
    switchSession,
    deleteSession,
    renameSession,
  };
}
