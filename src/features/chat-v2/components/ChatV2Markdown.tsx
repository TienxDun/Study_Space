"use client";

import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const REMARK_PLUGINS = [remarkGfm];

const COMPONENTS: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-chat-accent underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
};

export const ChatV2Markdown = memo(function ChatV2Markdown({ text }: { text: string }) {
  return (
    <div className="text-sm leading-relaxed [&>p]:my-1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&>ul]:my-1 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:my-1 [&>ol]:list-decimal [&>ol]:pl-5 [&>li]:my-0.5 [&_strong]:font-semibold [&_strong]:text-chat-ink [&>pre]:my-2 [&>pre]:overflow-x-auto [&>pre]:rounded-lg [&>pre]:bg-chat-code-bg [&>pre]:p-2.5 [&>pre]:text-[13px] [&_code]:rounded [&_code]:bg-chat-code-bg [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px] [&_code]:text-chat-ink [&>pre_code]:bg-transparent [&>pre_code]:p-0 [&>blockquote]:my-1 [&>blockquote]:border-l-2 [&>blockquote]:border-chat-border-strong [&>blockquote]:pl-2.5 [&>blockquote]:text-chat-sub [&>table]:my-2 [&>table]:w-full [&>table]:text-xs [&_th]:border [&_th]:border-chat-border [&_th]:bg-chat-table-head [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-chat-border [&_td]:px-2 [&_td]:py-1">
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  );
});
