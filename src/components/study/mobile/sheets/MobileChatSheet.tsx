"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  BrainIcon,
  PlusIcon,
  ClockCounterClockwiseIcon,
  GoogleLogoIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import { MobileSheetShell } from "./MobileSheetShell";
import { useAuth, GoogleSignInButton } from "@/components/study/auth";
import { firebaseConfigured } from "@/lib/firebase-config";
import { useChatSessions } from "../../chat/hooks/useChatSessions";
import { useChatMessages } from "../../chat/hooks/useChatMessages";
import { useImageAttachments } from "../../chat/hooks/useImageAttachments";
import { SessionDrawer } from "../../chat/components/SessionDrawer";
import { MessageList } from "../../chat/components/MessageList";
import { ChatInput } from "../../chat/components/ChatInput";

interface MobileChatSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  backLabel?: string;
}

export function MobileChatSheet({
  isOpen,
  onClose,
  onBack,
  backLabel,
}: MobileChatSheetProps) {
  const { user, loading, redirectError, signIn, getToken } = useAuth();
  const [input, setInput] = useState("");
  const [notice, setNotice] = useState("");
  const attachmentsApi = useImageAttachments(setNotice);

  // Nhớ hội thoại
  const [remember, setRemember] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!user) return;
    try {
      setRemember(localStorage.getItem(`chat-remember:${user.uid}`) === "1");
    } catch {}
  }, [user]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const toggleRemember = () => {
    setRemember((v) => {
      const next = !v;
      try {
        if (user) localStorage.setItem(`chat-remember:${user.uid}`, next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  const sessionsApi = useChatSessions({ user, open: isOpen, setNotice });
  const {
    sessions,
    activeSid,
    drawerOpen,
    drawerLoading,
    confirmDelSid,
    createSession,
    switchSession,
    deleteSession,
    renameSession,
  } = sessionsApi;

  const messagesApi = useChatMessages({
    user,
    open: isOpen,
    activeSid,
    resolved: sessionsApi.resolved,
    remember,
    ensureSession: sessionsApi.ensureSession,
    noteFirstMessage: sessionsApi.noteFirstMessage,
    inputRef,
    setNotice,
    getToken,
  });
  const { sending, regenerating } = messagesApi;
  const busy = sending || regenerating;

  const closeDrawer = useCallback(
    () => sessionsApi.setDrawerOpen(false),
    [sessionsApi.setDrawerOpen]
  );

  const send = () => {
    const text = input;
    const files = attachmentsApi.items;
    setInput("");
    attachmentsApi.clear();
    messagesApi.sendWithText(text, files);
  };

  const fillInput = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
    messagesApi.scrollToBottom();
  };

  // Lắng nghe yêu cầu gửi ghi chú từ Takenote sang Chatbot
  useEffect(() => {
    const handleSendToChat = (e: Event) => {
      const customEvent = e as CustomEvent<{ text: string; autoSend?: boolean }>;
      const text = customEvent.detail?.text;
      if (!text) return;

      if (!user) {
        setInput(text);
        setNotice("Vui lòng đăng nhập Google để hỏi Trợ lý học tập nhé!");
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
  }, [user, messagesApi]);

  if (!firebaseConfigured) return null;

  return (
    <MobileSheetShell
      isOpen={isOpen}
      onClose={onClose}
      onBack={onBack}
      backLabel={backLabel}
      sheetId="chat"
      title="Trợ lý học tập"
      heightClassName="h-[68dvh] max-h-[72dvh]"
      contentScroll={false}
      headerRight={
        user ? (
          <div className="flex items-center gap-1.5">
            {/* Nút nhớ ngữ cảnh */}
            <button
              type="button"
              onClick={toggleRemember}
              title={
                remember
                  ? "Nhớ hội thoại: Đang BẬT"
                  : "Nhớ hội thoại: Đang TẮT"
              }
              aria-label={remember ? "Tắt nhớ hội thoại" : "Bật nhớ hội thoại"}
              className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                remember
                  ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.3)]"
                  : "bg-white/10 hover:bg-white/20 border-white/15 text-white/70 hover:text-white"
              }`}
            >
              <BrainIcon
                className="w-4 h-4"
                weight={remember ? "fill" : "bold"}
              />
            </button>

            {/* Nút tạo đoạn chat mới */}
            <button
              type="button"
              onClick={() => {
                createSession(
                  messagesApi.msgs.length > 0,
                  busy,
                  () => messagesApi.resetView()
                );
                setTimeout(() => inputRef.current?.focus(), 120);
              }}
              title="Đoạn chat mới"
              aria-label="Tạo đoạn chat mới"
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 border border-white/15 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer"
            >
              <PlusIcon className="w-4 h-4" weight="bold" />
            </button>

            {/* Nút mở lịch sử đoạn chat */}
            <button
              type="button"
              onClick={() => {
                if (drawerOpen) {
                  closeDrawer();
                } else {
                  void sessionsApi.openDrawer();
                }
              }}
              title="Lịch sử đoạn chat"
              aria-label="Mở danh sách đoạn chat"
              className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                drawerOpen
                  ? "bg-white/25 border-white/30 text-white shadow-sm"
                  : "bg-white/10 hover:bg-white/20 border-white/15 text-white/80 hover:text-white"
              }`}
            >
              <ClockCounterClockwiseIcon className="w-4 h-4" weight="bold" />
            </button>
          </div>
        ) : undefined
      }
      footer={
        !drawerOpen && user ? (
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
            placeholder="Hỏi trợ lý bất cứ điều gì..."
          />
        ) : null
      }
    >
      <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden text-white select-none">
        {/* Thông báo dạng pill nổi phía trên */}
        {notice && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-full bg-neutral-900/95 border border-white/20 text-xs text-white shadow-xl pointer-events-none animate-in fade-in zoom-in-95 duration-150">
            {notice}
          </div>
        )}

        {/* Khung lịch sử phiên chat chiếm toàn bộ view khi mở */}
        {drawerOpen && user && (
          <SessionDrawer
            sessions={sessions}
            activeSid={activeSid}
            loading={drawerLoading}
            confirmDelSid={confirmDelSid}
            isMobile={true}
            onCreate={() => {
              createSession(
                messagesApi.msgs.length > 0,
                busy,
                () => messagesApi.resetView()
              );
              closeDrawer();
              setTimeout(() => inputRef.current?.focus(), 120);
            }}
            onSwitch={(sid) => {
              void switchSession(sid, busy, () => messagesApi.resetView());
              closeDrawer();
            }}
            onDelete={(sid) =>
              void deleteSession(sid, busy, () => messagesApi.resetView())
            }
            onRename={(sid, title) => void renameSession(sid, title)}
            onClose={closeDrawer}
          />
        )}

        {!loading && !user ? (
          /* Màn hình yêu cầu đăng nhập tài khoản Google */
          <div className="flex-1 flex flex-col items-center justify-center gap-3.5 p-6 text-center">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shadow-[0_0_30px_rgba(52,211,153,0.3)] mb-1">
              <SparkleIcon className="w-8 h-8" weight="duotone" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Trợ lý học tập AI</h3>
              <p className="text-xs text-white/50 mt-1 max-w-[260px] leading-relaxed">
                Đăng nhập tài khoản Google để hỏi bài, tóm tắt kiến thức và lưu trữ lịch sử đoạn chat.
              </p>
            </div>
            <div className="pt-2">
              <GoogleSignInButton />
              {!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
                <button
                  type="button"
                  onClick={signIn}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-xs font-bold hover:scale-[1.02] active:scale-95 transition-all cursor-pointer shadow-md"
                >
                  <GoogleLogoIcon className="w-4 h-4" weight="bold" />
                  <span>Đăng nhập với Google</span>
                </button>
              )}
            </div>
            {redirectError && (
              <p className="text-xs text-rose-300 leading-relaxed max-w-[260px]">
                {redirectError}
              </p>
            )}
          </div>
        ) : (
          /* Danh sách tin nhắn cuộc trò chuyện */
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
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
          </div>
        )}
      </div>
    </MobileSheetShell>
  );
}
