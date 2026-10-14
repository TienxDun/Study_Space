"use client";

import { useState, type RefObject } from "react";
import {
  ArrowDownIcon,
  CopyIcon,
  CheckIcon,
  ArrowCounterClockwiseIcon,
  PencilSimpleLineIcon,
  BookmarkSimpleIcon,
  MagnifyingGlassPlusIcon,
  FileTextIcon,
  DownloadSimpleIcon,
  LightbulbFilamentIcon,
  CalendarCheckIcon,
  TimerIcon,
  SparkleIcon,
  BrainIcon,
} from "@phosphor-icons/react";
import { StudySproutMascot } from "./StudySproutMascot";
import { ImageLightboxModal } from "./ImageLightboxModal";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { markdownToHtml } from "@/components/study/notes/utils/note-markdown";
import type { StudyNote } from "@/components/study/notes/types";
import { MarkdownText } from "./MarkdownText";
import type { Msg } from "../types";
import { getLocalImage } from "../utils/imageStorage";

function extractNoteTitle(markdownText: string): string {
  const lines = markdownText.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length > 0) {
    const firstLine = lines[0]
      .replace(/^[#*>\-\s\d.]+/, "")
      .replace(/[*_~`]/g, "")
      .trim();
    if (firstLine.length > 0) {
      return firstLine.length > 40 ? firstLine.slice(0, 40) + "…" : firstLine;
    }
  }
  return `Ghi chú AI (${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })})`;
}

const SUGGESTIONS = [
  {
    icon: LightbulbFilamentIcon,
    iconColor: "text-amber-300",
    iconBg: "bg-amber-400/10 border-amber-400/20",
    text: "Cách nhớ bài lâu mà không học vẹt",
  },
  {
    icon: CalendarCheckIcon,
    iconColor: "text-sky-300",
    iconBg: "bg-sky-400/10 border-sky-400/20",
    text: "Lập kế hoạch học tập 7 ngày",
  },
  {
    icon: TimerIcon,
    iconColor: "text-emerald-300",
    iconBg: "bg-emerald-400/10 border-emerald-400/20",
    text: "Mẹo tập trung khi học cùng Pomodoro",
  },
  {
    icon: SparkleIcon,
    iconColor: "text-indigo-300",
    iconBg: "bg-indigo-400/10 border-indigo-400/20",
    text: "Tóm tắt nhanh và giải thích bài tập",
  },
];

interface MessageListProps {
  msgs: Msg[];
  loading?: boolean;
  sending: boolean;
  regenerating: boolean;
  copiedId: string | null;
  isAtBottom: boolean;
  canScrollUp: boolean;
  panelNewCount: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  bottomRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  onScrollBottom: () => void;
  onCopy: (id: string, text: string) => void;
  onRegenerate: () => void;
  onReuse: (text: string) => void;
  onSuggest: (text: string) => void;
}

// Danh sách tin nhắn: gom nhóm, avatar mèo, dòng suy nghĩ tinh gọn, nút tác vụ, nút xuống dưới.
export function MessageList({
  msgs,
  loading = false,
  sending,
  regenerating,
  copiedId,
  isAtBottom,
  canScrollUp,
  panelNewCount,
  scrollRef,
  bottomRef,
  onScroll,
  onScrollBottom,
  onCopy,
  onRegenerate,
  onReuse,
  onSuggest,
}: MessageListProps) {
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const [downloadedId, setDownloadedId] = useState<string | null>(null);
  const [lightboxImg, setLightboxImg] = useState<{ src: string; alt?: string } | null>(null);
  const lastAssistantId = [...msgs].reverse().find((m) => m.role === "assistant")?.id;

  // Mở ảnh Full HD / gốc từ bộ nhớ tạm hoặc IndexedDB (fallback sang thumb nếu không có)
  const handleOpenLightbox = async (att: { thumb?: string; name: string; id?: string; originalUrl?: string }) => {
    if (att.originalUrl) {
      setLightboxImg({ src: att.originalUrl, alt: att.name });
      return;
    }
    if (att.id) {
      try {
        const cached = await getLocalImage(att.id);
        if (cached) {
          setLightboxImg({ src: cached, alt: att.name });
          return;
        }
      } catch {
        /* bỏ qua nếu IndexedDB không mở được */
      }
    }
    if (att.thumb) {
      setLightboxImg({ src: att.thumb, alt: att.name });
    }
  };

  // Tải câu trả lời về máy dạng text, làm ở web nên không tốn lượt.
  const handleDownload = (id: string, text: string) => {
    try {
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `tra-loi-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      setDownloadedId(id);
      setTimeout(() => {
        setDownloadedId((cur) => (cur === id ? null : cur));
      }, 2500);
    } catch {
      /* bỏ qua */
    }
  };

  const handleSaveToNote = (id: string, text: string) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.multiNotes);
      let existingNotes: StudyNote[] = [];
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) existingNotes = parsed;
        } catch {
          /* bỏ qua */
        }
      }

      const newNote: StudyNote = {
        id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: extractNoteTitle(text),
        content: markdownToHtml(text),
        updatedAt: Date.now(),
        isPinned: false,
      };

      const updatedNotes = [newNote, ...existingNotes];
      localStorage.setItem(STORAGE_KEYS.multiNotes, JSON.stringify(updatedNotes));

      // Kích hoạt event để StudyNotesWidget cập nhật ngay lập tức và chọn note mới
      window.dispatchEvent(
        new CustomEvent("study-space:notes-updated", {
          detail: { noteId: newNote.id },
        })
      );
      // Mở hiển thị widget Takenote lên giao diện người dùng ngay lập tức
      window.dispatchEvent(
        new CustomEvent("study-space:open-notes", {
          detail: { noteId: newNote.id },
        })
      );
      window.dispatchEvent(new Event("storage"));

      setSavedNoteId(id);
      setTimeout(() => {
        setSavedNoteId((cur) => (cur === id ? null : cur));
      }, 2500);
    } catch (err) {
      console.error("Không thể tạo ghi chú:", err);
    }
  };

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        role="log"
        aria-live="polite"
        aria-label="Lịch sử trò chuyện"
        className="h-full overflow-y-auto overscroll-contain custom-study-scroll px-3.5 pt-3 pb-8 text-sm"
      >
        {loading && msgs.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center animate-in fade-in duration-200">
            <div className="h-7 w-7 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-spin" />
            <p className="text-xs text-slate-400 font-medium">Đang nạp tin nhắn...</p>
          </div>
        )}
        {!loading && msgs.length === 0 && (
          <div className="flex flex-col items-center gap-2.5 py-6 text-center">
            <StudySproutMascot size={64} />
            <p className="text-sm font-semibold text-white">Bắt đầu trò chuyện</p>
            <p className="text-slate-300 text-xs leading-relaxed max-w-[28ch]">
              Hỏi mình về bài vở, phương pháp học, hay nhờ giải thích khái niệm nhé.
            </p>

            {/* Thẻ hướng dẫn giải thích cơ chế nhớ hội thoại */}
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-sky-500/10 border border-sky-400/20 text-left max-w-[390px] w-full my-1.5 shadow-sm">
              <span className="p-1 rounded-lg bg-sky-500/20 text-sky-300 shrink-0 mt-0.5">
                <BrainIcon size={16} weight="fill" />
              </span>
              <p className="text-[11px] leading-relaxed text-zinc-300">
                <strong className="text-sky-300 font-semibold">Lưu ý ngữ cảnh:</strong> Khác với ChatGPT/Gemini tự nhớ đoạn chat dài, trợ lý ZenStudy trả lời độc lập từng câu để phản hồi siêu nhanh. Nếu muốn AI xâu chuỗi câu trước để giải tiếp, bạn hãy bật nút <strong className="text-sky-300 font-semibold">[🧠 Nhớ hội thoại]</strong> ở góc trên nhé!
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 w-full max-w-[390px]">
              {SUGGESTIONS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.text}
                    onClick={() => onSuggest(item.text)}
                    className="group flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-xs text-zinc-300 hover:text-white transition-all cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 active:scale-[0.98] touch-manipulation"
                  >
                    <span className={`h-7 w-7 rounded-lg border flex items-center justify-center ${item.iconBg} ${item.iconColor} shrink-0 transition-transform group-hover:scale-105`}>
                      <Icon size={14} weight="duotone" aria-hidden="true" />
                    </span>
                    <span className="flex-1 font-medium leading-snug line-clamp-2">{item.text}</span>
                  </button>
                );
              })}
            </div>

            {/* Lời nhắc nhở về độ chính xác của AI được đặt trong luồng tin nhắn để tối ưu diện tích */}
            <p className="pt-2 text-[10.5px] text-zinc-500 text-center select-none leading-relaxed max-w-[340px]">
              ZenStudy AI có thể nhầm lẫn. Hãy luôn đối chiếu lại kiến thức với sách giáo khoa và tài liệu học tập chính thống.
            </p>
          </div>
        )}
        {msgs.map((m, i) => {
          const grouped = i > 0 && msgs[i - 1].role === m.role;
          if (m.role === "user") {
            const imgAtts = m.attachments?.filter((a) => a.kind === "image" && a.thumb) ?? [];
            const textAtts = m.attachments?.filter((a) => a.kind === "text" || !a.thumb) ?? [];
            const hasImgs = imgAtts.length > 0;
            const hasTexts = textAtts.length > 0;
            const hasBody = Boolean(m.text && m.text.trim());

            return (
              <div
                key={m.id}
                className={`ml-auto w-fit max-w-[88%] sm:max-w-[80%] group/msg ${grouped ? "mt-1.5" : "mt-3.5"}`}
              >
                <div className="p-2 sm:p-2.5 rounded-2xl rounded-br-xs leading-relaxed whitespace-pre-wrap break-words border bg-gradient-to-br from-sky-500/25 via-blue-600/20 to-indigo-600/25 border-sky-400/30 text-sky-50 shadow-[0_4px_20px_rgba(14,165,233,0.12)] animate-in fade-in slide-in-from-bottom-2 duration-200 motion-reduce:animate-none">
                  {/* Danh sách ảnh đính kèm: tỉ lệ đẹp, click phóng to */}
                  {hasImgs && (
                    <div className="pb-1">
                      {imgAtts.length === 1 ? (
                        <div
                          onClick={() => handleOpenLightbox(imgAtts[0])}
                          className="group/img relative block overflow-hidden rounded-xl border border-white/20 bg-black/40 shadow-sm cursor-pointer transition-transform active:scale-[0.99] max-w-full sm:max-w-[340px]"
                        >
                          <img
                            src={imgAtts[0].thumb}
                            alt={imgAtts[0].name}
                            className="w-full max-h-64 object-contain rounded-xl bg-black/25"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/35 transition-colors flex items-center justify-center opacity-0 group-hover/img:opacity-100">
                            <span className="px-3 py-1.5 rounded-full bg-black/75 backdrop-blur-md text-white text-xs font-medium flex items-center gap-1.5 border border-white/20 shadow-xl">
                              <MagnifyingGlassPlusIcon size={14} weight="bold" />
                              <span>Phóng to</span>
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-1.5 max-w-full sm:max-w-[340px]">
                          {imgAtts.map((a, j) => (
                            <div
                              key={`${m.id}-img-${j}`}
                              onClick={() => handleOpenLightbox(a)}
                              className="group/img relative overflow-hidden rounded-xl border border-white/20 bg-black/40 aspect-square flex items-center justify-center cursor-pointer transition-transform active:scale-95 shadow-sm"
                            >
                              <img
                                src={a.thumb}
                                alt={a.name}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover/img:opacity-100">
                                <span className="p-2 rounded-full bg-black/70 backdrop-blur-md text-white border border-white/20 shadow-lg">
                                  <MagnifyingGlassPlusIcon size={14} weight="bold" />
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* File text đính kèm */}
                  {hasTexts && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {textAtts.map((a, j) => (
                        <span
                          key={`${m.id}-txt-${j}`}
                          title={a.name}
                          className="inline-flex items-center gap-1.5 max-w-56 px-2.5 py-1 rounded-lg bg-black/35 border border-white/20 text-xs text-sky-100 truncate shadow-2xs"
                        >
                          <FileTextIcon size={13} className="text-sky-300 shrink-0" />
                          <span className="truncate">{a.name}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Nội dung câu hỏi */}
                  {hasBody && (
                    <div className={hasImgs || hasTexts ? "pt-1.5 px-1 text-sm text-sky-50 leading-relaxed font-normal" : "px-1 text-sm text-sky-50 leading-relaxed font-normal"}>
                      {m.text}
                    </div>
                  )}
                </div>
                <div className="mt-1 flex justify-end gap-1 sm:opacity-0 sm:group-hover/msg:opacity-100 sm:focus-within:opacity-100 transition-opacity">
                  <button
                    onClick={() => onCopy(m.id, m.text)}
                    aria-label={copiedId === m.id ? "Đã sao chép" : "Sao chép tin nhắn"}
                    title="Sao chép"
                    className="h-6 w-6 grid place-items-center rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    {copiedId === m.id ? (
                      <CheckIcon size={13} aria-hidden="true" className="text-emerald-300" />
                    ) : (
                      <CopyIcon size={13} aria-hidden="true" />
                    )}
                  </button>
                  <button
                    onClick={() => onReuse(m.text)}
                    aria-label="Lấy lại câu hỏi này để sửa và gửi mới"
                    title="Sửa & hỏi lại"
                    className="h-6 w-6 grid place-items-center rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    <PencilSimpleLineIcon size={13} weight="bold" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          }
          const isLast = m.id === lastAssistantId;
          return (
            <div
              key={m.id}
              className={`mr-auto w-fit max-w-[94%] ${grouped ? "mt-1.5" : "mt-3.5"}`}
            >
              <div className="px-3.5 py-3 rounded-2xl rounded-tl-xs leading-relaxed break-words border bg-white/[0.035] hover:bg-white/[0.045] text-slate-100 border-white/[0.08] hover:border-white/12 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.45)] transition-colors animate-in fade-in slide-in-from-bottom-2 duration-200 motion-reduce:animate-none">
                <MarkdownText text={m.text} />
              </div>

              {/* Action Bar tối giản, chuẩn phong cách AI hiện đại */}
              <div className="mt-1.5 flex items-center justify-between gap-2 pl-0.5 pr-1">
                <div className="flex items-center gap-1">
                  {/* Sao chép */}
                  <button
                    onClick={() => onCopy(m.id, m.text)}
                    aria-label={copiedId === m.id ? "Đã sao chép" : "Sao chép câu trả lời"}
                    title={copiedId === m.id ? "Đã sao chép" : "Sao chép"}
                    className={`h-6 w-6 grid place-items-center rounded-md transition-all cursor-pointer active:scale-90 ${
                      copiedId === m.id
                        ? "text-emerald-400 bg-emerald-500/15"
                        : "text-zinc-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {copiedId === m.id ? (
                      <CheckIcon size={13} weight="bold" aria-hidden="true" />
                    ) : (
                      <CopyIcon size={13} weight="bold" aria-hidden="true" />
                    )}
                  </button>

                  {/* Lưu vào Takenote */}
                  <button
                    onClick={() => handleSaveToNote(m.id, m.text)}
                    aria-label={savedNoteId === m.id ? "Đã lưu vào Takenote" : "Lưu vào Takenote"}
                    title={savedNoteId === m.id ? "Đã lưu vào Takenote" : "Lưu vào Takenote"}
                    className={`h-6 w-6 grid place-items-center rounded-md transition-all cursor-pointer active:scale-90 ${
                      savedNoteId === m.id
                        ? "text-emerald-400 bg-emerald-500/15"
                        : "text-zinc-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {savedNoteId === m.id ? (
                      <CheckIcon size={13} weight="bold" aria-hidden="true" />
                    ) : (
                      <BookmarkSimpleIcon size={13} weight="bold" aria-hidden="true" />
                    )}
                  </button>

                  {/* Làm lại câu trả lời (chỉ câu cuối) */}
                  {isLast && (
                    <button
                      onClick={onRegenerate}
                      disabled={regenerating || sending}
                      aria-label="Làm lại câu trả lời"
                      title="Tạo lại câu trả lời"
                      className="h-6 w-6 grid place-items-center rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer disabled:opacity-30 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    >
                      <ArrowCounterClockwiseIcon
                        size={13}
                        weight="bold"
                        aria-hidden="true"
                        className={regenerating ? "animate-spin text-sky-400" : undefined}
                      />
                    </button>
                  )}

                  {/* Tải về */}
                  <button
                    onClick={() => handleDownload(m.id, m.text)}
                    aria-label={downloadedId === m.id ? "Đã tải về máy" : "Tải về máy (.txt)"}
                    title={downloadedId === m.id ? "Đã tải về máy" : "Tải về (.txt)"}
                    className={`h-6 w-6 grid place-items-center rounded-md transition-all cursor-pointer active:scale-90 ${
                      downloadedId === m.id
                        ? "text-emerald-400 bg-emerald-500/15"
                        : "text-zinc-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {downloadedId?.startsWith(m.id) ? (
                      <CheckIcon size={13} weight="bold" aria-hidden="true" />
                    ) : (
                      <DownloadSimpleIcon size={13} weight="bold" aria-hidden="true" />
                    )}
                  </button>
                </div>

                {typeof m.thoughtSecs === "number" && m.thoughtSecs > 0 && (
                  <span
                    title={`Mô hình đã suy luận trong ${m.thoughtSecs} giây`}
                    className="text-[10px] font-mono text-zinc-500/80 select-none ml-auto shrink-0"
                  >
                    {m.thoughtSecs}s
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {!isAtBottom && <div aria-hidden="true" className="h-12" />}
        {sending && (
          <div className="mr-auto space-y-1.5 mt-3.5">
            <p
              aria-hidden="true"
              className="text-xs font-medium bg-gradient-to-r from-zinc-400 via-white to-zinc-400 bg-[length:200%_100%] bg-clip-text text-transparent animate-[shimmer-text_1.6s_linear_infinite] motion-reduce:animate-none"
            >
              Đang suy nghĩ câu trả lời…
            </p>
            <div
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-zinc-900/80 border border-white/10 w-fit"
              role="status"
              aria-label="Trợ lý đang trả lời"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-bounce motion-reduce:animate-none" />
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-bounce [animation-delay:150ms] motion-reduce:animate-none" />
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-bounce [animation-delay:300ms] motion-reduce:animate-none" />
            </div>
          </div>
        )}

        {/* Lời nhắc nhở về độ chính xác của AI được đặt trong luồng tin nhắn để tối ưu diện tích */}
        {msgs.length > 0 && (
          <p className="pt-4 pb-2 text-[10.5px] text-zinc-500 text-center select-none leading-relaxed max-w-[340px] mx-auto">
            ZenStudy AI có thể nhầm lẫn. Hãy luôn đối chiếu lại kiến thức với sách giáo khoa và tài liệu học tập chính thống.
          </p>
        )}
        <div ref={bottomRef} />
      </div>
      {canScrollUp && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-black/50 to-transparent"
        />
      )}
      {!isAtBottom && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/50 to-transparent"
        />
      )}
      {!isAtBottom && (
        <button
          onClick={onScrollBottom}
          aria-label={panelNewCount > 0 ? `Xuống dưới, ${panelNewCount} tin mới` : "Xuống tin mới nhất"}
          className="absolute bottom-3 right-3.5 flex items-center justify-center w-8 h-8 rounded-full bg-slate-900/90 backdrop-blur-xl border border-white/20 text-white shadow-[0_8px_24px_rgba(0,0,0,0.6)] hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 group"
          title="Cuộn xuống tin mới nhất"
        >
          <ArrowDownIcon size={14} weight="bold" aria-hidden="true" className="group-hover:translate-y-0.5 transition-transform" />
          {panelNewCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-[10px] font-bold text-slate-950 flex items-center justify-center shadow-sm animate-bounce">
              {panelNewCount > 99 ? "99+" : panelNewCount}
            </span>
          )}
        </button>
      )}

      {/* Lightbox Modal xem ảnh phóng to */}
      <ImageLightboxModal
        src={lightboxImg?.src ?? null}
        alt={lightboxImg?.alt}
        onClose={() => setLightboxImg(null)}
      />
    </div>
  );
}
