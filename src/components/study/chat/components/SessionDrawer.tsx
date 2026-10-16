"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
  PlusIcon,
  TrashIcon,
  PencilSimpleIcon,
  CheckIcon,
  XIcon,
  ChatTeardropDotsIcon,
  MagnifyingGlassIcon,
  ClockCounterClockwiseIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import { StudySproutMascot } from "./StudySproutMascot";
import type { Session } from "../types";

interface SessionDrawerProps {
  sessions: Session[];
  activeSid: string | null;
  loading: boolean;
  confirmDelSid: string | null;
  onCreate: () => void;
  onSwitch: (sid: string) => void;
  onDelete: (sid: string) => void;
  onRename?: (sid: string, newTitle: string) => void;
  onClose: () => void;
  isMobile?: boolean;
}

/** Định dạng thời gian tương đối thân thiện chuẩn tiếng Việt */
function formatRelativeTime(ts?: number): string {
  if (!ts) return "";
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
  if (diffSec < 60) return "Vừa xong";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) {
    const timeStr = new Date(ts).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    return `Hôm qua, ${timeStr}`;
  }
  if (diffDay < 7) return `${diffDay} ngày trước`;
  const date = new Date(ts);
  return `${date.getDate()} Thg ${date.getMonth() + 1}`;
}

interface SessionGroup {
  label: string;
  items: Session[];
}

/** Gom nhóm các đoạn chat theo mốc thời gian thông minh như Claude/ChatGPT */
function groupSessionsByTime(sessions: Session[]): SessionGroup[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOf7Days = startOfToday - 6 * 86400000;

  const today: Session[] = [];
  const yesterday: Session[] = [];
  const past7Days: Session[] = [];
  const older: Session[] = [];

  for (const s of sessions) {
    const time = s.updatedAt || s.createdAt || 0;
    if (time >= startOfToday) {
      today.push(s);
    } else if (time >= startOfYesterday) {
      yesterday.push(s);
    } else if (time >= startOf7Days) {
      past7Days.push(s);
    } else {
      older.push(s);
    }
  }

  const groups: SessionGroup[] = [];
  if (today.length > 0) groups.push({ label: "Hôm nay", items: today });
  if (yesterday.length > 0) groups.push({ label: "Hôm qua", items: yesterday });
  if (past7Days.length > 0) groups.push({ label: "7 ngày qua", items: past7Days });
  if (older.length > 0) groups.push({ label: "Cũ hơn", items: older });
  return groups;
}

/**
 * Ngăn danh sách đoạn chat (Session Drawer) phiên bản Spatial Glassmorphism hiện đại:
 * - Trượt toàn chiều cao khung chat (Full-height slide-over)
 * - Thanh tìm kiếm tức thì (Instant search)
 * - Tự động nhóm theo mốc thời gian: Hôm nay, Hôm qua, 7 ngày qua, Cũ hơn
 * - Đổi tên trực tiếp (Inline Rename) & xác nhận xóa an toàn không giật layout
 * - Thẻ trạng thái phát sáng tinh tế khi đang mở
 */
export function SessionDrawer({
  sessions,
  activeSid,
  loading,
  confirmDelSid,
  onCreate,
  onSwitch,
  onDelete,
  onRename,
  onClose,
  isMobile = false,
}: SessionDrawerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [editingSid, setEditingSid] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [localConfirmSid, setLocalConfirmSid] = useState<string | null>(null);

  // Đóng khi click ra ngoài (ngoại trừ nút toggle trên header)
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      if ((e.target as HTMLElement).closest?.("[data-drawer-toggle]")) return;
      onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [onClose]);

  // Điều hướng bằng phím Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (localConfirmSid) {
          setLocalConfirmSid(null);
        } else if (editingSid) {
          setEditingSid(null);
        } else if (searchQuery) {
          setSearchQuery("");
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [localConfirmSid, editingSid, searchQuery, onClose]);

  // Đồng bộ confirmDelSid từ props nếu có
  useEffect(() => {
    if (confirmDelSid) {
      setLocalConfirmSid(confirmDelSid);
    }
  }, [confirmDelSid]);

  // Lọc tìm kiếm
  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  // Nhóm theo thời gian (khi không tìm kiếm)
  const groupedSessions = useMemo(() => {
    if (searchQuery.trim()) return [];
    return groupSessionsByTime(filteredSessions);
  }, [filteredSessions, searchQuery]);

  const handleStartRename = (s: Session) => {
    setEditingSid(s.id);
    setEditTitle(s.title);
    setLocalConfirmSid(null);
    setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 50);
  };

  const handleSaveRename = (sid: string) => {
    if (onRename && editTitle.trim()) {
      onRename(sid, editTitle.trim());
    }
    setEditingSid(null);
  };

  const handleConfirmDelete = (sid: string) => {
    onDelete(sid);
    setLocalConfirmSid(null);
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Danh sách đoạn chat"
      className={`absolute inset-x-0 bottom-0 z-30 flex flex-col select-none ${
        isMobile
          ? "top-0 bg-neutral-950/95 backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-200"
          : "top-[53px] bg-slate-950/90 backdrop-blur-2xl border-t border-white/10 animate-in fade-in slide-in-from-top-3 duration-200"
      } motion-reduce:animate-none`}
    >
      {/* Top Header của Drawer */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.08] bg-black/25">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white/90">
            <ClockCounterClockwiseIcon size={14} weight="bold" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white tracking-tight">Lịch sử trò chuyện</h3>
            <p className="text-[10px] text-zinc-400">
              {sessions.length > 0 ? `${sessions.length} cuộc hội thoại` : "Chưa có cuộc trò chuyện"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCreate}
            className="flex items-center gap-1 px-2.5 h-7 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all cursor-pointer active:scale-95 shadow-sm"
            title="Bắt đầu đoạn chat mới"
          >
            <PlusIcon size={13} weight="bold" aria-hidden="true" />
            <span>Đoạn mới</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 grid place-items-center rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer active:scale-95"
            title="Đóng danh sách (Esc)"
            aria-label="Đóng danh sách đoạn chat"
          >
            <XIcon size={13} weight="bold" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Thanh tìm kiếm nhanh (Instant Search Filter) */}
      {sessions.length > 3 && (
        <div className="px-3 pt-2.5 pb-1 shrink-0">
          <div className="relative flex items-center">
            <MagnifyingGlassIcon
              size={13}
              weight="bold"
              className="absolute left-2.5 text-zinc-400 pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm đoạn chat..."
              className="w-full h-8 pl-8 pr-7 rounded-xl bg-white/5 hover:bg-white/8 focus:bg-black/50 border border-white/10 focus:border-emerald-400/40 text-xs text-white placeholder:text-zinc-500 transition-all outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 text-zinc-400 hover:text-white transition-colors"
                title="Xóa tìm kiếm"
              >
                <XIcon size={12} weight="bold" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Danh sách các đoạn chat cuộn mượt mà */}
      <div className="flex-1 overflow-y-auto custom-study-scroll p-3 space-y-3.5">
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2 pt-1">
            {[1, 2, 3].map((k) => (
              <div
                key={k}
                className="h-13 rounded-2xl bg-white/[0.04] border border-white/[0.06] p-2.5 flex items-center gap-3 animate-pulse"
              >
                <div className="w-8 h-8 rounded-xl bg-white/10 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-white/15 rounded-md w-3/4" />
                  <div className="h-2 bg-white/10 rounded-md w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Chưa có phiên trò chuyện nào */}
        {!loading && sessions.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 text-center my-auto">
            <div className="w-14 h-14 rounded-3xl bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center mb-3 shadow-[0_0_24px_rgba(52,211,153,0.15)]">
              <StudySproutMascot size={32} />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Chưa có cuộc trò chuyện nào</h4>
            <p className="text-xs text-zinc-400 max-w-[240px] leading-relaxed mb-4">
              Đặt câu hỏi cùng ZenStudy AI để bắt đầu buổi học tập trung và hiệu quả!
            </p>
            <button
              type="button"
              onClick={onCreate}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-bold transition-all shadow-[0_0_16px_rgba(52,211,153,0.3)] active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <SparkleIcon size={14} weight="fill" />
              <span>Bắt đầu đoạn chat mới</span>
            </button>
          </div>
        )}

        {/* Không tìm thấy kết quả tìm kiếm */}
        {!loading && sessions.length > 0 && filteredSessions.length === 0 && (
          <div className="text-center py-8 px-4 text-zinc-400">
            <p className="text-xs mb-2">Không tìm thấy đoạn chat nào khớp với &quot;{searchQuery}&quot;</p>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-xs text-emerald-400 hover:text-emerald-300 underline font-medium"
            >
              Xóa bộ lọc tìm kiếm
            </button>
          </div>
        )}

        {/* Khi đang tìm kiếm: hiển thị danh sách phẳng */}
        {!loading && searchQuery.trim() && filteredSessions.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1 mb-1">
              Kết quả tìm kiếm ({filteredSessions.length})
            </div>
            {filteredSessions.map((s, idx) => renderSessionCard(s, idx))}
          </div>
        )}

        {/* Khi không tìm kiếm: hiển thị theo nhóm thời gian */}
        {!loading && !searchQuery.trim() && groupedSessions.length > 0 && (
          <div className="space-y-4">
            {groupedSessions.map((group) => (
              <div key={group.label} className="space-y-1.5">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1 flex items-center justify-between">
                  <span>{group.label}</span>
                  <span className="text-[9px] text-zinc-500 font-normal">
                    {group.items.length} đoạn
                  </span>
                </div>
                <div className="space-y-1.5">
                  {group.items.map((s, idx) => renderSessionCard(s, idx))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer gợi ý nhỏ - ẩn trên mobile để thoáng không gian */}
      {!isMobile && (
        <div className="px-3.5 py-2 border-t border-white/[0.06] bg-black/20 flex items-center justify-between text-[10px] text-zinc-400">
          <span>💡 Bấm đúp vào tên để đổi tên</span>
          <button
            type="button"
            onClick={onCreate}
            className="text-white/80 hover:text-white font-medium transition-colors"
          >
            + Tạo đoạn mới
          </button>
        </div>
      )}
    </div>
  );

  /** Render từng thẻ bài học (Session Card) */
  function renderSessionCard(s: Session, idx: number = 0) {
    const isActive = s.id === activeSid;
    const isEditing = editingSid === s.id;
    const isConfirming = localConfirmSid === s.id;
    const relativeTime = formatRelativeTime(s.updatedAt || s.createdAt);

    return (
      <div
        key={s.id}
        onClick={() => {
          if (!isEditing && !isConfirming) {
            onSwitch(s.id);
          }
        }}
        onDoubleClick={() => !isEditing && handleStartRename(s)}
        style={{ "--stagger-idx": Math.min(idx, 10) } as React.CSSProperties}
        className={`group relative flex items-center gap-2.5 p-2.5 rounded-2xl border transition-all cursor-pointer sheet-stagger-item ${
          isActive
            ? "bg-white/[0.12] border-white/25 shadow-lg text-white"
            : "bg-white/[0.03] hover:bg-white/[0.07] active:bg-white/[0.08] border-white/8 hover:border-white/15 text-zinc-300 hover:text-white"
        }`}
      >
        {/* Leading icon */}
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
            isActive
              ? "bg-white/15 text-white border border-white/25"
              : "bg-white/5 text-zinc-400 group-hover:text-zinc-200 border border-white/10"
          }`}
        >
          <ChatTeardropDotsIcon size={16} weight={isActive ? "fill" : "duotone"} />
        </div>

        {/* Nội dung tiêu đề hoặc ô chỉnh sửa tên inline */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <input
                ref={renameInputRef}
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveRename(s.id);
                  if (e.key === "Escape") setEditingSid(null);
                }}
                className="flex-1 h-7 px-2 rounded-lg bg-black/60 border border-white/30 focus:border-white/60 text-xs text-white focus:outline-none"
                maxLength={48}
              />
              <button
                type="button"
                onClick={() => handleSaveRename(s.id)}
                className="w-7 h-7 grid place-items-center rounded-lg bg-white/15 hover:bg-white/25 text-white border border-white/20 active:scale-95"
                title="Lưu tên (Enter)"
              >
                <CheckIcon size={12} weight="bold" />
              </button>
              <button
                type="button"
                onClick={() => setEditingSid(null)}
                className="w-7 h-7 grid place-items-center rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10 active:scale-95"
                title="Hủy (Esc)"
              >
                <XIcon size={12} weight="bold" />
              </button>
            </div>
          ) : (
            <div>
              <p
                className={`text-xs font-semibold truncate ${
                  isActive ? "text-white" : "text-zinc-200 group-hover:text-white"
                }`}
                title={s.title}
              >
                {s.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {isActive && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-[10px] font-semibold text-emerald-300 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Đang mở
                  </span>
                )}
                {relativeTime && (
                  <span className="text-[10px] text-zinc-400 truncate">
                    {relativeTime}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Cụm hành động bên phải: Xóa & Đổi tên */}
        {!isEditing && (
          <div
            className={`flex items-center gap-1 shrink-0 ${
              isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            } transition-opacity`}
            onClick={(e) => e.stopPropagation()}
          >
            {isConfirming ? (
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-rose-500/15 border border-rose-400/30 animate-in fade-in zoom-in-95 duration-150">
                <span className="text-[10px] text-rose-300 font-medium pl-1.5 pr-0.5">Xóa?</span>
                <button
                  type="button"
                  onClick={() => handleConfirmDelete(s.id)}
                  className="px-1.5 py-0.5 rounded bg-rose-500 text-white text-[10px] font-bold hover:bg-rose-600 transition-colors cursor-pointer active:scale-95"
                  title="Xác nhận xóa đoạn chat này"
                >
                  Có
                </button>
                <button
                  type="button"
                  onClick={() => setLocalConfirmSid(null)}
                  className="px-1.5 py-0.5 rounded bg-white/10 text-zinc-300 text-[10px] hover:text-white hover:bg-white/20 transition-colors cursor-pointer active:scale-95"
                  title="Hủy xóa"
                >
                  Không
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-0.5">
                {onRename && (
                  <button
                    type="button"
                    onClick={() => handleStartRename(s)}
                    className="w-7 h-7 grid place-items-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors cursor-pointer"
                    title="Đổi tên đoạn chat"
                    aria-label={`Đổi tên đoạn chat ${s.title}`}
                  >
                    <PencilSimpleIcon size={13} weight="bold" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLocalConfirmSid(s.id)}
                  className="w-7 h-7 grid place-items-center rounded-lg text-zinc-400 hover:text-rose-300 hover:bg-rose-500/15 active:bg-rose-500/25 transition-colors cursor-pointer"
                  title="Xóa đoạn chat này"
                  aria-label={`Xóa đoạn chat ${s.title}`}
                >
                  <TrashIcon size={13} weight="bold" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
}
