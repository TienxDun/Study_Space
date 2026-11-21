"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChatCircleDotsIcon,
  DotsThreeIcon,
  PencilSimpleIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { relativeTime } from "../lib/sessions";
import type { ChatV2SessionMeta } from "../types";

interface SessionListProps {
  sessions: ChatV2SessionMeta[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function SessionList({ sessions, activeId, onSelect, onRename, onDelete }: SessionListProps) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const skipCommitRef = useRef(false);

  useEffect(() => {
    if (!menuId && !confirmId) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-session-actions]")) setMenuId(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuId(null);
      setConfirmId(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuId, confirmId]);

  const startRename = (session: ChatV2SessionMeta) => {
    skipCommitRef.current = false;
    setMenuId(null);
    setConfirmId(null);
    setRenamingId(session.id);
    setDraft(session.title);
  };

  const commitRename = (id: string) => {
    if (skipCommitRef.current) {
      skipCommitRef.current = false;
      return;
    }
    onRename(id, draft);
    setRenamingId(null);
  };

  const cancelRename = () => {
    skipCommitRef.current = true;
    setRenamingId(null);
  };

  return (
    <div className="mt-5 flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-chat-faint">
          Hội thoại
        </p>
        <span className="text-[9px] text-chat-faint">{sessions.length}</span>
      </div>

      <ul className="custom-study-scroll -mr-1 mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {sessions.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-chat-border px-3 py-4 text-center text-[10px] text-chat-muted">
            Chưa có phiên nào.
          </li>
        ) : null}

        {sessions.map((session) => {
          const active = session.id === activeId;
          const renaming = session.id === renamingId;

          return (
            <li key={session.id}>
              <div
                className={`group flex items-center gap-1 rounded-2xl border transition ${
                  active
                    ? "border-chat-accent-border bg-chat-accent-soft"
                    : "border-transparent hover:border-chat-border hover:bg-chat-hover"
                }`}
              >
                {renaming ? (
                  <input
                    autoFocus
                    value={draft}
                    maxLength={80}
                    aria-label="Đổi tên phiên"
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") commitRename(session.id);
                      if (event.key === "Escape") cancelRename();
                    }}
                    onBlur={() => commitRename(session.id)}
                    className="m-1.5 min-w-0 flex-1 rounded-xl border border-chat-accent-border bg-chat-elevated px-2.5 py-1.5 text-[12px] font-medium text-chat-ink outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelect(session.id)}
                    aria-current={active ? "true" : undefined}
                    className="flex min-w-0 flex-1 items-start gap-2 rounded-2xl px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/50"
                  >
                    <span
                      className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-xl ${
                        active
                          ? "bg-chat-accent-soft text-chat-accent"
                          : "bg-chat-surface text-chat-muted"
                      }`}
                    >
                      <ChatCircleDotsIcon size={14} weight="duotone" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-semibold text-chat-ink">
                        {session.title}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-chat-muted">
                        <span>{session.messageCount > 0 ? `${session.messageCount} tin` : "Trống"}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{relativeTime(session.updatedAt)}</span>
                      </span>
                    </span>
                  </button>
                )}

                {renaming ? null : (
                  <div data-session-actions className="relative shrink-0 pr-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuId((current) => (current === session.id ? null : session.id));
                        setConfirmId(null);
                      }}
                      aria-label={`Tuỳ chọn cho ${session.title}`}
                      aria-haspopup="menu"
                      aria-expanded={menuId === session.id}
                      className="grid h-7 w-7 place-items-center rounded-lg text-chat-faint transition hover:bg-chat-surface hover:text-chat-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/50"
                    >
                      <DotsThreeIcon size={16} weight="bold" aria-hidden="true" />
                    </button>

                    {menuId === session.id ? (
                      <div
                        role="menu"
                        className="chat-v2-anim-pop absolute right-0 top-full z-30 mt-1 w-36 overflow-hidden rounded-xl border border-chat-border-strong bg-chat-elevated shadow-[var(--chat-shadow-popover)]"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => startRename(session)}
                          className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-[11px] text-chat-sub transition hover:bg-chat-hover hover:text-chat-ink"
                        >
                          <PencilSimpleIcon size={13} aria-hidden="true" />
                          Đổi tên
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMenuId(null);
                            setConfirmId(session.id);
                          }}
                          className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-[11px] text-chat-rose transition hover:bg-chat-rose-soft"
                        >
                          <TrashIcon size={13} aria-hidden="true" />
                          Xoá phiên
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {confirmId === session.id ? (
                <div className="chat-v2-anim-fade mt-1 flex items-center gap-2 rounded-xl border border-chat-rose-border bg-chat-rose-soft px-2.5 py-1.5">
                  <span className="min-w-0 flex-1 text-[10px] text-chat-rose">Xoá phiên này?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmId(null);
                      onDelete(session.id);
                    }}
                    className="rounded-lg bg-chat-rose px-2 py-1 text-[10px] font-semibold text-white transition hover:opacity-90"
                  >
                    Xoá
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    className="rounded-lg border border-chat-border px-2 py-1 text-[10px] text-chat-sub transition hover:bg-chat-hover"
                  >
                    Huỷ
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
