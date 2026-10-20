"use client";

import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  SparkleIcon,
  LightbulbIcon,
  QuestionIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ChatTeardropTextIcon,
} from "@phosphor-icons/react";
import { StudyNote } from "../types";
import { noteHtmlToPlainText } from "../utils/note-markdown";

interface NoteChatPromptMenuProps {
  activeNote: StudyNote | null;
  isLight: boolean;
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

interface PromptAction {
  id: string;
  icon: React.ComponentType<{ className?: string; size?: number; weight?: "bold" | "regular" | "fill" }>;
  iconColor: string;
  title: string;
  description: string;
  badge?: string;
  buildPrompt: (title: string, content: string) => { text: string; autoSend: boolean };
}

const PROMPT_ACTIONS: PromptAction[] = [
  {
    id: "summarize",
    icon: SparkleIcon,
    iconColor: "text-emerald-400 bg-emerald-500/15 border-emerald-500/25",
    title: "Tóm tắt & Rút gọn ý cốt lõi",
    description: "Trích xuất 3-5 ý then chốt, công thức và định nghĩa quan trọng nhất",
    badge: "Phổ biến nhất",
    buildPrompt: (title, content) => ({
      autoSend: true,
      text: `Dựa vào ghi chú sau đây, hãy tóm tắt ngắn gọn các ý cốt lõi, công thức hoặc định nghĩa quan trọng nhất để mình dễ dàng ôn tập:\n\n---\n📌 TIÊU ĐỀ: ${title || "Ghi chú học tập"}\n\n📝 NỘI DUNG:\n${content}\n---`,
    }),
  },
  {
    id: "explain",
    icon: LightbulbIcon,
    iconColor: "text-amber-400 bg-amber-500/15 border-amber-500/25",
    title: "Giải thích đơn giản & Ví dụ thực tế",
    description: "Đóng vai gia sư giải thích dễ hiểu (phương pháp Feynman) kèm ví dụ sinh động",
    buildPrompt: (title, content) => ({
      autoSend: true,
      text: `Hãy đóng vai một gia sư nhiệt tình, giải thích lại toàn bộ nội dung trong ghi chú sau một cách thật dễ hiểu, trực quan kèm ví dụ minh họa thực tế sinh động:\n\n---\n📌 TIÊU ĐỀ: ${title || "Ghi chú học tập"}\n\n📝 NỘI DUNG:\n${content}\n---`,
    }),
  },
  {
    id: "quiz",
    icon: QuestionIcon,
    iconColor: "text-sky-400 bg-sky-500/15 border-sky-500/25",
    title: "Tạo câu hỏi ôn tập & Trắc nghiệm",
    description: "Tạo 3-5 câu hỏi trắc nghiệm & tự luận kèm đáp án để tự kiểm tra kiến thức",
    badge: "Ôn thi",
    buildPrompt: (title, content) => ({
      autoSend: true,
      text: `Dựa vào nội dung ghi chú sau, hãy tạo giúp mình 3-5 câu hỏi ôn tập (gồm cả trắc nghiệm và câu hỏi tự luận ngắn) kèm đáp án & giải thích ngắn gọn ở cuối để mình tự kiểm tra kiến thức theo phương pháp Active Recall:\n\n---\n📌 TIÊU ĐỀ: ${title || "Ghi chú học tập"}\n\n📝 NỘI DUNG:\n${content}\n---`,
    }),
  },
  {
    id: "gaps",
    icon: MagnifyingGlassIcon,
    iconColor: "text-indigo-400 bg-indigo-500/15 border-indigo-500/25",
    title: "Tìm lỗ hổng & Gợi ý mở rộng",
    description: "Phân tích xem ghi chú còn thiếu sót gì không và gợi ý hướng đào sâu",
    buildPrompt: (title, content) => ({
      autoSend: true,
      text: `Hãy phân tích nội dung ghi chú sau: xem còn lỗ hổng kiến thức, thiếu sót khía cạnh hoặc liên kết logic nào cần bổ sung không, đồng thời gợi ý cho mình 2-3 câu hỏi đào sâu để mở rộng hiểu biết:\n\n---\n📌 TIÊU ĐỀ: ${title || "Ghi chú học tập"}\n\n📝 NỘI DUNG:\n${content}\n---`,
    }),
  },
  {
    id: "action_plan",
    icon: CheckCircleIcon,
    iconColor: "text-teal-400 bg-teal-500/15 border-teal-500/25",
    title: "Biến thành kế hoạch hành động (To-do)",
    description: "Chuyển ý tưởng và kiến thức thành checklist từng bước thực hành cụ thể",
    buildPrompt: (title, content) => ({
      autoSend: true,
      text: `Dựa vào nội dung ghi chú sau, hãy chuyển đổi các ý tưởng và kiến thức thành một kế hoạch hành động (Action Plan / Checklist) từng bước cụ thể để mình có thể áp dụng ngay vào thực tế:\n\n---\n📌 TIÊU ĐỀ: ${title || "Ghi chú học tập"}\n\n📝 NỘI DUNG:\n${content}\n---`,
    }),
  },
  {
    id: "custom",
    icon: ChatTeardropTextIcon,
    iconColor: "text-slate-300 bg-white/10 border-white/15",
    title: "Tự đặt câu hỏi (Đưa vào khung chat)",
    description: "Chèn nội dung ghi chú vào khung chat để bạn tự do gõ câu hỏi riêng",
    buildPrompt: (title, content) => ({
      autoSend: false,
      text: `Dựa vào ghi chú sau: "${title || "Ghi chú"}"\n\nNội dung:\n${content}\n\n👉 Câu hỏi của tôi: `,
    }),
  },
];

export function NoteChatPromptMenu({
  activeNote,
  isLight,
  isOpen,
  onClose,
  triggerRef,
}: NoteChatPromptMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef?.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen, onClose, triggerRef]);

  const handleTriggerAction = (action: PromptAction) => {
    if (!activeNote) return;
    onClose();

    const plainText = noteHtmlToPlainText(activeNote.content);
    const title = activeNote.title.trim();
    const finalContent = plainText || "(Chưa có nội dung ghi chú chi tiết)";

    const { text, autoSend } = action.buildPrompt(title, finalContent);

    // Gửi event liên lạc mở chat và truyền nội dung
    window.dispatchEvent(
      new CustomEvent("study-space:send-to-chat", {
        detail: {
          text,
          autoSend,
        },
      })
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 6 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className={`absolute right-0 top-full mt-1.5 w-[min(320px,calc(100vw-36px))] sm:w-[340px] p-1.5 rounded-2xl border z-50 select-none ${
            isLight
              ? "bg-white border-slate-200 text-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.18)]"
              : "bg-slate-900 border-slate-700/80 text-white shadow-[0_20px_60px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.08)]"
          }`}
        >
          {/* Header menu */}
          <div
            className={`px-2.5 pt-1.5 pb-2 border-b flex items-center justify-between ${
              isLight ? "border-slate-200/80" : "border-white/10 sm:border-slate-800"
            }`}
          >
            <div>
              <div
                className={`text-xs font-bold flex items-center gap-1.5 ${
                  isLight ? "text-slate-900" : "text-white"
                }`}
              >
                <span>Hỏi Trợ lý AI về ghi chú này</span>
              </div>
              <div
                className={`text-[11px] mt-0.5 ${
                  isLight ? "text-slate-500" : "text-slate-400"
                }`}
              >
                Chọn nhu cầu phù hợp để AI phản hồi tối ưu nhất
              </div>
            </div>
          </div>

          {/* Prompt list */}
          <div className="space-y-0.5 mt-1 max-h-[min(400px,calc(100vh-200px))] overflow-y-auto custom-study-scroll p-0.5">
            {PROMPT_ACTIONS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTriggerAction(item)}
                  className={`w-full flex items-start gap-2.5 p-1.5 rounded-xl text-left transition-all cursor-pointer group ${
                    isLight
                      ? "hover:bg-slate-100/80 active:bg-slate-200/70"
                      : "hover:bg-white/10 active:bg-white/15"
                  }`}
                >
                  <div
                    className={`shrink-0 w-7 h-7 rounded-lg border flex items-center justify-center transition-transform group-hover:scale-105 ${item.iconColor}`}
                  >
                    <Icon size={15} weight="bold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs font-semibold transition-colors ${
                          isLight
                            ? "text-slate-800 group-hover:text-emerald-600"
                            : "text-slate-100 group-hover:text-emerald-400"
                        }`}
                      >
                        {item.title}
                      </span>
                      {item.badge && (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-[11px] leading-snug mt-0.5 line-clamp-2 ${
                        isLight ? "text-slate-500" : "text-slate-400"
                      }`}
                    >
                      {item.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
