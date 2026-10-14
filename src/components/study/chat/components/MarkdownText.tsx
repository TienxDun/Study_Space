"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Chữ máy trả về (có markdown **đậm**, list, bảng) hiện đúng định dạng.
// Không render HTML thô nên tin lạ không chèn được mã độc.
export function MarkdownText({ text }: { text: string }) {
  return (
    <div className="markdown-body text-sm leading-relaxed [&>p]:my-1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&>ul]:my-1 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:my-1 [&>ol]:list-decimal [&>ol]:pl-5 [&>li]:my-0.5 [& strong]:text-white [&>pre]:my-2 [&>pre]:overflow-x-auto [&>pre]:rounded-lg [&>pre]:bg-black/60 [&>pre]:p-2.5 [&>pre]:text-[13px] [& code]:rounded [& code]:bg-white/10 [& code]:px-1 [& code]:py-0.5 [& code]:text-[13px] [& code]:text-zinc-100 [&>pre_code]:bg-transparent [&>pre_code]:p-0 [&>blockquote]:border-l-2 [&>blockquote]:border-white/20 [&>blockquote]:pl-2.5 [&>blockquote]:my-1 [&>blockquote]:text-zinc-300 [&>table]:my-2 [&>table]:w-full [&>table]:text-xs sm:[&>table]:text-[13px] [& th]:border [& th]:border-white/10 [& th]:px-2 [& th]:py-1 [& th]:bg-white/5 [& td]:border [& td]:border-white/10 [& td]:px-2 [& td]:py-1">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
