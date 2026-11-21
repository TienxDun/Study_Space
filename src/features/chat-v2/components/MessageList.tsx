"use client";

import { useMemo } from "react";
import type { ChatV2Message } from "../types";
import { EmptyState } from "./EmptyState";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: ChatV2Message[];
  sending: boolean;
  streamingId: string | null;
  onSuggestion: (text: string) => void;
  onRegenerate: () => void;
  onEdit?: (text: string) => void;
}

export function MessageList({
  messages,
  sending,
  streamingId,
  onSuggestion,
  onRegenerate,
  onEdit,
}: MessageListProps) {
  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "assistant") return messages[i].id;
    }
    return null;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[1120px] flex-1 px-4 sm:px-6">
        <EmptyState onSuggestion={onSuggestion} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-3.5 px-4 py-5 sm:gap-4 sm:px-6 sm:py-6">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          streaming={streamingId === message.id}
          canRegenerate={!sending && message.id === lastAssistantId}
          onRegenerate={onRegenerate}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
