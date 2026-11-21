"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { InfoIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { useChatV2 } from "./hooks/useChatV2";
import { useChatV2Theme } from "./hooks/useChatV2Theme";
import { ChatSidebar } from "./components/ChatSidebar";
import { SessionDrawer } from "./components/SessionDrawer";
import { ChatTopbar } from "./components/ChatTopbar";
import { MessageList } from "./components/MessageList";
import { Composer } from "./components/Composer";
import { SessionRail } from "./components/SessionRail";

interface ChatV2Props {
  onClose?: () => void;
}

export function ChatV2({ onClose }: ChatV2Props) {
  const chat = useChatV2();
  const { toggleTheme } = useChatV2Theme();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickRef = useRef(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [railOpen, setRailOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const hasRailContent = useMemo(
    () => !!chat.summary || chat.sessionFiles.length > 0,
    [chat.summary, chat.sessionFiles]
  );

  // Đọc trạng thái panel đã lưu trước khi vẽ lại sau hydrate; script trong <head>
  // đã gắn attribute để frame đầu tiên không nháy trạng thái mặc định.
  useLayoutEffect(() => {
    let sidebar = true;
    let rail = true;
    try {
      sidebar = localStorage.getItem(STORAGE_KEYS.chatV2SidebarOpen) !== "0";
      rail = localStorage.getItem(STORAGE_KEYS.chatV2RailOpen) !== "0";
    } catch {
      /* bỏ qua */
    }
    applyPanelPrefs(sidebar, rail);
    setSidebarOpen(sidebar);
    setRailOpen(rail);
  }, []);

  const toggleSidebar = () => {
    const next = !sidebarOpen;
    setSidebarOpen(next);
    document.documentElement.dataset.chatSidebar = next ? "1" : "0";
    try {
      localStorage.setItem(STORAGE_KEYS.chatV2SidebarOpen, next ? "1" : "0");
    } catch {
      /* bỏ qua */
    }
  };

  const toggleRail = () => {
    const next = !railOpen;
    setRailOpen(next);
    document.documentElement.dataset.chatRail = next ? "1" : "0";
    try {
      localStorage.setItem(STORAGE_KEYS.chatV2RailOpen, next ? "1" : "0");
    } catch {
      /* bỏ qua */
    }
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el || chat.messages.length === 0 || !stickRef.current) return;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: chat.sending || reduceMotion ? "auto" : "smooth",
    });
  }, [chat.messages, chat.sending]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
  };

  const handleSuggestion = (text: string) => {
    chat.setInput(text);
    stickRef.current = true;
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleNewChat = () => {
    chat.newChat();
    setDrawerOpen(false);
    stickRef.current = true;
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleSelectSession = (id: string) => {
    chat.selectSession(id);
    setDrawerOpen(false);
    stickRef.current = true;
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleSend = () => {
    stickRef.current = true;
    chat.submit();
  };

  const handleRegenerate = () => {
    stickRef.current = true;
    chat.regenerate();
  };

  const handleEditUserMessage = (text: string) => {
    chat.setInput(text);
    stickRef.current = true;
    window.requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    });
  };

  return (
    <div className="relative flex h-dvh overflow-hidden bg-chat-bg text-chat-ink">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 right-[-12%] h-[520px] w-[520px] rounded-full bg-[var(--chat-glow-1)] blur-[140px]" />
        <div className="absolute bottom-[-25%] left-[-12%] h-[460px] w-[460px] rounded-full bg-[var(--chat-glow-2)] blur-[140px]" />
        <div className="absolute inset-0 opacity-[0.7] [background-image:linear-gradient(var(--chat-grid)_1px,transparent_1px),linear-gradient(90deg,var(--chat-grid)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_74%)]" />
      </div>

      <ChatSidebar
        open={sidebarOpen}
        sessions={chat.sessions}
        activeId={chat.activeSessionId}
        onSelect={handleSelectSession}
        onRename={chat.renameSession}
        onDelete={chat.deleteSession}
        onNewChat={handleNewChat}
        newChatDisabled={!chat.canStartNewChat}
        onToggleTheme={toggleTheme}
        onClose={onClose}
      />

      <SessionDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sessions={chat.sessions}
        activeId={chat.activeSessionId}
        onSelect={handleSelectSession}
        onRename={chat.renameSession}
        onDelete={chat.deleteSession}
        onNewChat={handleNewChat}
        newChatDisabled={!chat.canStartNewChat}
        onToggleTheme={toggleTheme}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        <ChatTopbar
          title={chat.title}
          models={chat.models}
          model={chat.model}
          modelInfo={chat.modelInfo}
          onModelChange={chat.setModel}
          keyTier={chat.keyTier}
          onKeyTierChange={chat.setKeyTier}
          context={chat.context}
          summaryCount={chat.summaryMessageCount}
          summarizing={chat.summarizing}
          onCompact={chat.compactContext}
          canCompact={chat.canCompact}
          sending={chat.sending}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
          onOpenSessions={() => setDrawerOpen(true)}
          onNewChat={handleNewChat}
          newChatDisabled={!chat.canStartNewChat}
          railAvailable={hasRailContent}
          railOpen={railOpen}
          onToggleRail={toggleRail}
          onClose={onClose}
        />

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            <div
              ref={listRef}
              onScroll={handleScroll}
              aria-live="polite"
              className="custom-study-scroll flex flex-1 flex-col overflow-y-auto"
            >
              <MessageList
                key={chat.activeSessionId || "new"}
                messages={chat.messages}
                sending={chat.sending}
                streamingId={chat.streamingId}
                onSuggestion={handleSuggestion}
                onRegenerate={handleRegenerate}
                onEdit={handleEditUserMessage}
              />

              {chat.modelNotice || chat.error || chat.info || chat.storageError ? (
                <div className="mx-auto flex w-full max-w-[820px] flex-col gap-2 px-4 pb-5 sm:px-6">
                  {chat.modelNotice ? (
                    <Callout tone="amber" icon={<WarningCircleIcon size={15} weight="duotone" />}>
                      {chat.modelNotice}
                    </Callout>
                  ) : null}
                  {chat.storageError ? (
                    <Callout tone="amber" icon={<WarningCircleIcon size={15} weight="duotone" />}>
                      {chat.storageError}
                    </Callout>
                  ) : null}
                  {chat.error ? (
                    <Callout tone="rose" icon={<WarningCircleIcon size={15} weight="duotone" />}>
                      {chat.error}
                    </Callout>
                  ) : null}
                  {chat.info ? (
                    <Callout tone="emerald" icon={<InfoIcon size={15} weight="duotone" />}>
                      {chat.info}
                    </Callout>
                  ) : null}
                </div>
              ) : null}
            </div>

            <Composer
              input={chat.input}
              onInput={chat.setInput}
              inputRef={inputRef}
              sending={chat.sending}
              canSend={chat.canSend}
              visionBlocked={chat.visionBlocked}
              attachments={chat.attachments}
              onAddFiles={chat.addFiles}
              onRemoveAttachment={chat.removeAttachment}
              onSend={handleSend}
              onStop={chat.stop}
            />
          </div>

          {railOpen && hasRailContent ? (
            <SessionRail
              summary={chat.summary}
              summarizing={chat.summarizing}
              files={chat.sessionFiles}
              onClose={toggleRail}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}

function applyPanelPrefs(sidebarOpen: boolean, railOpen: boolean) {
  const root = document.documentElement;
  root.dataset.chatSidebar = sidebarOpen ? "1" : "0";
  root.dataset.chatRail = railOpen ? "1" : "0";
}

function Callout({
  tone,
  icon,
  children,
}: {
  tone: "amber" | "rose" | "emerald";
  icon: ReactNode;
  children: ReactNode;
}) {
  const styles =
    tone === "rose"
      ? "border-chat-rose-border bg-chat-rose-soft text-chat-rose"
      : tone === "amber"
        ? "border-chat-amber-border bg-chat-amber-soft text-chat-amber"
        : "border-chat-accent-border bg-chat-accent-soft text-chat-accent";

  return (
    <div className={`chat-v2-anim-rise flex items-start gap-2 rounded-2xl border px-3 py-2.5 text-[11px] leading-5 ${styles}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}
