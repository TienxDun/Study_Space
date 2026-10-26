"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleLogoIcon } from "@phosphor-icons/react";
import { useAuth, GoogleSignInButton } from "@/components/study/auth";
import { firebaseConfigured } from "@/lib/firebase-config";
import { useChatSessions } from "./hooks/useChatSessions";
import { useChatMessages } from "./hooks/useChatMessages";
import { useImageAttachments } from "./hooks/useImageAttachments";
import { notifyChat } from "./utils/chatNotice";
import { ChatFab } from "./components/ChatFab";
import { ChatHeader } from "./components/ChatHeader";
import { SessionDrawer } from "./components/SessionDrawer";
import { MessageList } from "./components/MessageList";
import { ChatInput } from "./components/ChatInput";

export interface StudyChatWidgetProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  isZenMode?: boolean;
  chatEnabled?: boolean;
}

/** Bong bóng chat góc phải: đăng nhập Google mới chat được, lịch sử lưu Firestore. */
export function StudyChatWidget({
  isOpen: controlledOpen,
  onOpenChange,
  onClose: controlledClose,
  isZenMode = false,
  chatEnabled = true,
}: StudyChatWidgetProps = {}) {
  const { user, loading, redirectError, signIn, signOut, getToken } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = useCallback(
    (valOrFn: boolean | ((prev: boolean) => boolean)) => {
      const nextVal = typeof valOrFn === "function" ? valOrFn(open) : valOrFn;
      if (!isControlled) {
        setInternalOpen(nextVal);
      }
      onOpenChange?.(nextVal);
      if (!nextVal) {
        controlledClose?.();
      }
    },
    [isControlled, open, onOpenChange, controlledClose]
  );

  const [input, setInput] = useState("");
  const attachmentsApi = useImageAttachments(notifyChat);
  // Nhớ hội thoại: tắt mặc định cho rẻ token, bật thì gửi kèm 10 tin gần nhất.
  const [remember, setRemember] = useState(false);
  // Mở rộng kích thước khung chat để đọc câu trả lời dài thuận tiện hơn.
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Nhớ lựa chọn theo từng acc.
  useEffect(() => {
    if (!user) return;
    try {
      setRemember(localStorage.getItem(`chat-remember:${user.uid}`) === "1");
    } catch {
      /* bỏ qua */
    }
  }, [user]);

  const toggleRemember = () => {
    setRemember((v) => {
      const next = !v;
      try {
        if (user) localStorage.setItem(`chat-remember:${user.uid}`, next ? "1" : "0");
      } catch {
        /* bỏ qua */
      }
      return next;
    });
  };

  const sessionsApi = useChatSessions({ user, open, notify: notifyChat });
  const {
    sessions,
    activeSid,
    hasNew,
    drawerOpen,
    drawerLoading,
    pendingAction,
    createSession,
    switchSession,
    deleteSession,
    renameSession,
  } = sessionsApi;

  const messagesApi = useChatMessages({
    user,
    open,
    activeSid,
    resolved: sessionsApi.resolved,
    remember,
    ensureSession: sessionsApi.ensureSession,
    noteFirstMessage: sessionsApi.noteFirstMessage,
    inputRef,
    getToken,
  });
  const { sending, regenerating } = messagesApi;

  // Bấm ra ngoài khung hoặc phím Esc thì tự đóng.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = panelRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open ]);

  const send = async () => {
    const text = input;
    const files = attachmentsApi.items;
    setInput("");
    attachmentsApi.clear();
    const ok = await messagesApi.sendWithText(text, files);
    // Gửi hỏng thì trả lại chữ đã gõ để người dùng không phải viết lại.
    if (!ok && text) setInput((cur) => cur || text);
  };

  const fillInput = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
    messagesApi.scrollToBottom();
  };

  // Lắng nghe yêu cầu gửi ghi chú từ Takenote sang Chatbot
  useEffect(() => {
    const handleSendToChat = (e: Event) => {
      if (!chatEnabled) return;
      const customEvent = e as CustomEvent<{ text: string; autoSend?: boolean }>;
      const text = customEvent.detail?.text;
      if (!text) return;

      setOpen(true);

      if (!user) {
        setInput(text);
        notifyChat("Vui lòng đăng nhập Google để hỏi Trợ lý học tập nhé!");
        return;
      }

      if (customEvent.detail.autoSend) {
        setTimeout(() => {
          messagesApi.sendWithText(text);
        }, 120);
      } else {
        setInput(text);
        setTimeout(() => {
          inputRef.current?.focus();
        }, 150);
      }
    };

    window.addEventListener("study-space:send-to-chat", handleSendToChat);
    return () => {
      window.removeEventListener("study-space:send-to-chat", handleSendToChat);
    };
  }, [user, messagesApi, chatEnabled]);

  const busy = sending || regenerating;
  const closeDrawer = useCallback(() => sessionsApi.setDrawerOpen(false), [sessionsApi.setDrawerOpen]);

  if (!firebaseConfigured) return null;

  return (
    <>
      {!open && !isZenMode && (
        <ChatFab hasNew={hasNew} onOpen={() => setOpen(true)} disabled={!chatEnabled} />
      )}

      <AnimatePresence>
        {open && !isZenMode && (
          <motion.div
            id="study-chat-panel"
            ref={panelRef}
            role="dialog"
            aria-label="Trợ lý học tập"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              background: "linear-gradient(180deg, rgba(13, 17, 28, 0.92) 0%, rgba(9, 12, 20, 0.96) 100%)",
              backdropFilter: "blur(32px)",
              WebkitBackdropFilter: "blur(32px)",
            }}
            className={`fixed z-40 right-[max(1rem,var(--app-safe-right))] left-[max(1rem,var(--app-safe-left))] sm:left-auto flex flex-col glass-panel overflow-hidden text-white transition-[width,height,bottom,border-radius,box-shadow] duration-[340ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[width,height,bottom] ${
              expanded
                ? "bottom-[calc(var(--mobile-nav-height,0px)+var(--app-safe-bottom,0px)+5.5rem)] sm:bottom-[4.5rem] w-[min(92vw,440px)] xl:w-[465px] 2xl:w-[480px] h-[calc(100dvh-8.75rem)] shadow-[0_24px_70px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.08)_inset] border border-white/15 rounded-3xl"
                : "bottom-[calc(var(--mobile-nav-height,0px)+var(--app-safe-bottom,0px)+5.5rem)] sm:bottom-20 w-[min(92vw,380px)] h-[min(70dvh,520px)] shadow-[0_16px_40px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.06)_inset] border border-white/12 rounded-2xl"
            }`}
          >
            {/* Ambient subtle glow for Study Space atmosphere */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-16 -left-16 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl z-0"
            />
          <ChatHeader
            user={user}
            loading={loading}
            drawerOpen={drawerOpen}
            remember={remember}
            onToggleRemember={toggleRemember}
            expanded={expanded}
            onToggleExpand={() => setExpanded((v) => !v)}
            onNewChat={() => {
              createSession(messagesApi.msgs.length > 0, busy, () => messagesApi.resetView());
              setTimeout(() => inputRef.current?.focus(), 120);
            }}
            onToggleDrawer={() => void sessionsApi.openDrawer()}
            onClose={() => setOpen(false)}
            onSignOut={signOut}
          />

          {drawerOpen && user && (
            <SessionDrawer
              sessions={sessions}
              activeSid={activeSid}
              loading={drawerLoading}
              pendingAction={pendingAction}
              onCreate={() => {
                createSession(messagesApi.msgs.length > 0, busy, () => messagesApi.resetView());
                setTimeout(() => inputRef.current?.focus(), 120);
              }}
              onSwitch={(sid) => void switchSession(sid, busy, () => messagesApi.resetView())}
              onDelete={(sid) => void deleteSession(sid, busy, () => messagesApi.resetView())}
              onRename={(sid, title) => renameSession(sid, title)}
              onClose={closeDrawer}
            />
          )}

          {!loading && !user ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-slate-300 leading-relaxed">
                Đăng nhập để trò chuyện với trợ lý.
              </p>
              <GoogleSignInButton />
              {!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
                <button
                  onClick={signIn}
                  className="flex items-center gap-2 px-4 py-2.5 min-h-11 rounded-xl bg-white text-black text-sm font-semibold hover:scale-[1.03] active:scale-95 transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-music-glow focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  <GoogleLogoIcon size={18} weight="bold" aria-hidden="true" />
                  Đăng nhập bằng Google
                </button>
              )}
              {redirectError && <p className="text-xs text-amber-300 leading-relaxed" role="alert">{redirectError}</p>}
            </div>
          ) : (
            <>
              <MessageList
                msgs={messagesApi.msgs}
                loading={messagesApi.loading}
                sending={messagesApi.sending}
                regenerating={messagesApi.regenerating}
                copiedId={messagesApi.copiedId}
                isAtBottom={messagesApi.isAtBottom}
                canScrollUp={messagesApi.canScrollUp}
                panelNewCount={messagesApi.panelNewCount}
                scrollRef={messagesApi.scrollRef}
                bottomRef={messagesApi.bottomRef}
                onScroll={messagesApi.handleScroll}
                onScrollBottom={() => messagesApi.scrollToBottom()}
                onCopy={(id, text) => void messagesApi.copyMsg(id, text)}
                onRegenerate={() => void messagesApi.regenerate()}
                onReuse={fillInput}
                onSuggest={fillInput}
              />

              <ChatInput
                input={input}
                onInput={setInput}
                inputRef={inputRef}
                sending={sending}
                regenerating={regenerating}
                onSend={send}
                attachments={attachmentsApi.items}
                onAddFiles={attachmentsApi.addFiles}
                onRemoveAttachment={attachmentsApi.remove}
              />
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
