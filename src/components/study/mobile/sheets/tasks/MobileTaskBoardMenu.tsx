"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CaretDownIcon, PlusIcon, TrashIcon, CheckIcon } from "@phosphor-icons/react";
import { KanbanBoard } from "../../../tasks/types";
import { STORAGE_KEYS } from "@/lib/storage-keys";

export interface MobileTaskBoardMenuProps {
  boards: KanbanBoard[];
  activeBoardId: string;
  currentBoard?: KanbanBoard;
  cardCount: number;
  onSelectBoard: (boardId: string) => void;
  onCreateBoard: (title: string) => void;
  onPromptDeleteBoard: (board: KanbanBoard) => void;
  isSheetOpen: boolean;
}

/**
 * Menu chuyển đổi bảng, tạo bảng mới và xóa bảng học tập trên điện thoại.
 * Render popup dạng Portal phủ toàn màn hình khi mở menu.
 */
export const MobileTaskBoardMenu = React.memo(function MobileTaskBoardMenu({
  boards,
  activeBoardId,
  currentBoard,
  cardCount,
  onSelectBoard,
  onCreateBoard,
  onPromptDeleteBoard,
  isSheetOpen,
}: MobileTaskBoardMenuProps) {
  const [showBoardMenu, setShowBoardMenu] = useState(false);
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [boardMenuCoords, setBoardMenuCoords] = useState<{ top: number; left: number } | null>(null);

  const boardMenuRef = useRef<HTMLDivElement>(null);
  const boardMenuPopoverRef = useRef<HTMLDivElement>(null);

  const submitNewBoard = () => {
    const title = newBoardTitle.trim();
    if (!title) return;
    onCreateBoard(title);
    setNewBoardTitle("");
    setIsCreatingBoard(false);
  };

  // Cập nhật vị trí neo và đóng popover khi chạm ra ngoài hoặc nhấn phím Escape
  useEffect(() => {
    if (!showBoardMenu) {
      setBoardMenuCoords(null);
      return;
    }

    const updateCoords = () => {
      const el = boardMenuRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setBoardMenuCoords({
        top: rect.bottom + 8,
        left: Math.max(12, rect.left),
      });
    };

    updateCoords();
    window.addEventListener("resize", updateCoords);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowBoardMenu(false);
        setIsCreatingBoard(false);
        setNewBoardTitle("");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", updateCoords);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showBoardMenu]);

  // Tự động đóng popover chuyển bảng khi sheet bị đóng
  useEffect(() => {
    if (!isSheetOpen) {
      setShowBoardMenu(false);
      setIsCreatingBoard(false);
      setNewBoardTitle("");
    }
  }, [isSheetOpen]);

  return (
    <div ref={boardMenuRef} className="relative flex items-center min-w-0 flex-1 max-w-full">
      <button
        type="button"
        onClick={() => {
          if (!showBoardMenu && boardMenuRef.current) {
            const rect = boardMenuRef.current.getBoundingClientRect();
            setBoardMenuCoords({
              top: rect.bottom + 8,
              left: Math.max(12, rect.left),
            });
          }
          setShowBoardMenu((prev) => !prev);
          setIsCreatingBoard(false);
          setNewBoardTitle("");
        }}
        aria-haspopup="true"
        aria-expanded={showBoardMenu}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition-all max-w-full text-left cursor-pointer min-w-0 shadow-sm border ${
          showBoardMenu
            ? "bg-white/20 border-white/30 text-white"
            : "bg-white/10 hover:bg-white/15 active:scale-95 border-white/15 text-white"
        }`}
        title="Chuyển bảng học tập"
      >
        <span className="text-sm font-semibold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] truncate min-w-0">
          {currentBoard?.title || "Nhiệm vụ học tập"}
        </span>
        <span className="text-[10px] font-semibold text-white/70 bg-white/15 px-1.5 py-0.5 rounded-full shrink-0">
          {cardCount}
        </span>
        <CaretDownIcon
          className={`w-3.5 h-3.5 text-white/60 shrink-0 transition-transform duration-200 ${
            showBoardMenu ? "rotate-180 text-white" : ""
          }`}
          weight="bold"
        />
      </button>

      {/* Popover Menu chuyển bảng dạng Liquid Glass (Portal ra body để lớp nền phủ toàn màn hình) */}
      {typeof document !== "undefined" &&
        document.body &&
        createPortal(
          <AnimatePresence>
            {showBoardMenu && boardMenuCoords && (
              <div className="select-none">
                {/* Lớp nền mờ tối phủ toàn bộ màn hình */}
                <motion.div
                  key="board-menu-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  className="fixed inset-0 z-[70] bg-black/45 cursor-pointer touch-none"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowBoardMenu(false);
                    setIsCreatingBoard(false);
                    setNewBoardTitle("");
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowBoardMenu(false);
                    setIsCreatingBoard(false);
                    setNewBoardTitle("");
                  }}
                  role="button"
                  tabIndex={-1}
                  aria-label="Đóng menu danh sách bảng"
                />

                {/* Khung menu danh sách bảng */}
                <motion.div
                  key="board-menu-popover"
                  ref={boardMenuPopoverRef}
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  style={{ top: boardMenuCoords.top, left: boardMenuCoords.left }}
                  className="fixed z-[71] w-64 max-w-[calc(100vw-24px)] rounded-2xl surface-frost border p-2 shadow-[0_20px_48px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.2)] text-white select-none"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
                    Danh sách bảng học tập
                  </div>

                  <div className="max-h-52 overflow-y-auto space-y-0.5 no-scrollbar py-0.5">
                    {boards.map((b) => {
                      const isActive = b.id === activeBoardId;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            onSelectBoard(b.id);
                            try {
                              localStorage.setItem(STORAGE_KEYS.activeBoard, b.id);
                            } catch {}
                            setShowBoardMenu(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all text-left cursor-pointer ${
                            isActive
                              ? "bg-white/15 text-white font-semibold shadow-sm"
                              : "text-white/80 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <span className="truncate pr-2">{b.title}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-white/50 px-1.5 py-0.5 rounded-md bg-white/5">
                              {b.cards.length}
                            </span>
                            {isActive && <CheckIcon className="w-3.5 h-3.5 text-emerald-400" weight="bold" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="h-px bg-white/10 my-1.5" />

                  {/* Chức năng tạo bảng mới */}
                  {isCreatingBoard ? (
                    <div className="p-1.5 bg-white/5 rounded-xl border border-white/10 space-y-2">
                      <input
                        type="text"
                        value={newBoardTitle}
                        onChange={(e) => setNewBoardTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            submitNewBoard();
                            setShowBoardMenu(false);
                          } else if (e.key === "Escape") {
                            setIsCreatingBoard(false);
                            setNewBoardTitle("");
                          }
                        }}
                        placeholder="Tên bảng mới..."
                        autoFocus
                        className="lg-input h-8 w-full px-2.5 text-xs text-white rounded-lg placeholder:text-white/40"
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingBoard(false);
                            setNewBoardTitle("");
                          }}
                          className="h-7 px-2.5 rounded-lg text-[11px] text-white/70 hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            submitNewBoard();
                            setShowBoardMenu(false);
                          }}
                          disabled={!newBoardTitle.trim()}
                          className="h-7 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-bold disabled:opacity-40 transition-colors cursor-pointer"
                        >
                          Tạo bảng
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setNewBoardTitle("");
                        setIsCreatingBoard(true);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-emerald-300 hover:bg-emerald-500/15 transition-all cursor-pointer"
                    >
                      <PlusIcon className="w-4 h-4 text-emerald-400" weight="bold" />
                      <span>Tạo bảng mới</span>
                    </button>
                  )}

                  {/* Xóa bảng hiện tại (khi có nhiều hơn 1 bảng) */}
                  {boards.length > 1 && !isCreatingBoard && currentBoard && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowBoardMenu(false);
                        onPromptDeleteBoard(currentBoard);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium text-rose-300 hover:bg-rose-500/15 transition-all cursor-pointer"
                    >
                      <TrashIcon className="w-4 h-4 text-rose-400" />
                      <span className="truncate">Xóa bảng &quot;{currentBoard?.title}&quot;</span>
                    </button>
                  )}
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
});
