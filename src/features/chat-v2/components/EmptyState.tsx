"use client";

import { FileTextIcon, LightbulbIcon, ListChecksIcon } from "@phosphor-icons/react";
import { StudySproutMascot } from "@/components/study/chat/components/StudySproutMascot";

const SUGGESTIONS = [
  {
    icon: LightbulbIcon,
    title: "Giải thích từng bước",
    prompt: "Giải thích định luật Newton thứ 2 theo cách dễ hiểu, có ví dụ.",
  },
  {
    icon: FileTextIcon,
    title: "Tóm tắt tài liệu",
    prompt: "Tóm tắt đoạn văn tôi gửi thành 5 ý chính và 3 câu hỏi ôn tập.",
  },
  {
    icon: ListChecksIcon,
    title: "Luyện tập nhanh",
    prompt: "Tạo 5 câu hỏi trắc nghiệm môn Sinh học lớp 11 kèm đáp án.",
  },
];

interface EmptyStateProps {
  onSuggestion: (text: string) => void;
}

export function EmptyState({ onSuggestion }: EmptyStateProps) {
  return (
    <div className="chat-v2-anim-rise flex min-h-full flex-col items-center justify-start px-4 pb-5 pt-4 text-center sm:justify-center sm:px-6 sm:py-12">
      <div className="w-full max-w-[1120px]">
        <div className="chat-v2-anim-pop mx-auto flex max-w-[720px] flex-col items-center">
          <StudySproutMascot size={64} className="mb-3 sm:mb-4" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-chat-accent">
            Trợ lý học tập
          </p>
          <h2 className="mt-1.5 text-balance text-xl font-semibold tracking-tight text-chat-ink sm:mt-2 sm:text-[26px]">
            Hôm nay bạn muốn học gì?
          </h2>
          <p className="mt-1.5 max-w-[560px] text-[12px] leading-5 text-chat-muted sm:mt-2 sm:text-[13px]">
            Hỏi bài, dán đoạn văn hoặc gửi ảnh đề. Mình sẽ giải thích từng bước, không làm bài hộ.
          </p>
        </div>

        <div className="mx-auto mt-5 hidden max-w-[900px] items-center justify-center gap-3 sm:mt-9 sm:flex">
          <span aria-hidden="true" className="h-px w-10 bg-chat-border" />
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-chat-faint">
            Gợi ý bắt đầu
          </span>
          <span aria-hidden="true" className="h-px w-10 bg-chat-border" />
        </div>

        <div className="mx-auto mt-4 grid w-full max-w-[900px] gap-2 sm:gap-2.5 sm:grid-cols-3">
          {SUGGESTIONS.map(({ icon: Icon, title, prompt }) => (
            <button
              key={title}
              type="button"
              onClick={() => onSuggestion(prompt)}
              className="group flex items-center gap-3 rounded-2xl border border-chat-border bg-chat-surface px-3 py-2.5 text-left transition hover:border-chat-accent-border hover:bg-chat-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/50 active:scale-[0.99] sm:block sm:p-4 sm:hover:-translate-y-0.5 motion-reduce:active:scale-100 motion-reduce:sm:hover:translate-y-0"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-chat-accent-soft text-chat-accent">
                <Icon size={16} weight="duotone" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 sm:block">
                <span className="block text-[12px] font-semibold text-chat-ink sm:mt-3 sm:text-[13px]">
                  {title}
                </span>
                <span className="mt-0.5 line-clamp-1 text-[10px] leading-4 text-chat-muted sm:mt-1 sm:line-clamp-2 sm:text-[11px] sm:leading-5">
                  {prompt}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
