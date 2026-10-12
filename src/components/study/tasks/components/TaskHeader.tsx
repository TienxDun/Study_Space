"use client";

import React, { useState } from "react";
import {
  CheckSquareIcon,
  CaretDownIcon,
  PencilLineIcon,
  TrashIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  XIcon,
  SquaresFourIcon,
  ListIcon,
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { KanbanBoard, ViewMode } from "../types";
import { STORAGE_KEYS } from "@/lib/storage-keys";

interface TaskHeaderProps {
  boards: KanbanBoard[];
  currentBoard: KanbanBoard;
  isBoardDropdownOpen: boolean;
  setIsBoardDropdownOpen: (open: boolean) => void;
  isEditingBoardTitle: boolean;
  setIsEditingBoardTitle: (editing: boolean) => void;
  editingBoardTitleText: string;
  setEditingBoardTitleText: (text: string) => void;
  setActiveBoardId: (id: string) => void;
  updateCurrentBoard: (mutator: (b: KanbanBoard) => KanbanBoard) => void;
  handleCreateBoard: (title: string) => void;
  promptDeleteBoard: (b: KanbanBoard) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  onClose: () => void;
}

export const TaskHeader = React.memo(function TaskHeader({
  boards,
  currentBoard,
  isBoardDropdownOpen,
  setIsBoardDropdownOpen,
  isEditingBoardTitle,
  setIsEditingBoardTitle,
  editingBoardTitleText,
  setEditingBoardTitleText,
  setActiveBoardId,
  updateCurrentBoard,
  handleCreateBoard,
  promptDeleteBoard,
  searchQuery,
  setSearchQuery,
  viewMode,
  setViewMode,
  onClose,
}: TaskHeaderProps) {
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");

  const submitNewBoard = () => {
    if (!newBoardTitle.trim()) return;
    handleCreateBoard(newBoardTitle);
    setNewBoardTitle("");
    setIsCreatingBoard(false);
  };

  return (
    <div className="flex items-center justify-between px-6 py-3.5 border-b border-white/10 z-20 bg-white/[0.02]">
      {/* Left: Board Selector Pill & Management */}
      <div className="flex items-center gap-2.5">
        {isEditingBoardTitle ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editingBoardTitleText}
              onChange={(e) => setEditingBoardTitleText(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/30 text-base font-bold text-white focus:outline-none focus:border-emerald-400"
              autoFocus
            />
            <button
              onClick={() => {
                if (editingBoardTitleText.trim()) {
                  updateCurrentBoard((b) => ({ ...b, title: editingBoardTitleText.trim() }));
                }
                setIsEditingBoardTitle(false);
              }}
              className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 cursor-pointer"
            >
              Lưu
            </button>
          </div>
        ) : (
          <div className="relative">
            <button
              onClick={() => setIsBoardDropdownOpen(!isBoardDropdownOpen)}
              className="px-3.5 py-1.5 rounded-2xl bg-white/10 hover:bg-white/20 text-sm sm:text-base font-black text-white flex items-center gap-2 transition-all cursor-pointer border border-white/10 shadow-sm max-w-[200px] sm:max-w-xs"
            >
              <CheckSquareIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="truncate max-w-[110px] sm:max-w-[180px]" title={currentBoard.title}>
                {currentBoard.title}
              </span>
              <CaretDownIcon className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />
            </button>

            <AnimatePresence>
              {isBoardDropdownOpen && (
                <React.Fragment key="board-dropdown-fragment">
                  <div
                    key="board-dropdown-backdrop"
                    className="fixed inset-0 z-40"
                    onClick={() => setIsBoardDropdownOpen(false)}
                  />
                  <motion.div
                    key="board-dropdown-panel"
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full mt-2 left-0 w-64 p-2 rounded-2xl bg-black/40 backdrop-blur-2xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-xs space-y-1 z-50"
                  >
                    <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase">
                      Danh sách bảng học tập:
                    </div>
                    {boards.map((b, bIdx) => (
                      <button
                        key={b.id || `board-${bIdx}`}
                        onClick={() => {
                          setActiveBoardId(b.id);
                          setIsBoardDropdownOpen(false);
                          try {
                            localStorage.setItem(STORAGE_KEYS.activeBoard, b.id);
                          } catch {}
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-left font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                          b.id === currentBoard.id
                            ? "bg-emerald-500/20 text-emerald-300 font-bold"
                            : "text-white/80 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <span className="truncate flex-1 mr-2" title={b.title}>
                          {b.title}
                        </span>
                        <span className="text-[10px] text-slate-400 flex-shrink-0">
                          {b.cards.length} thẻ
                        </span>
                      </button>
                    ))}
                  </motion.div>
                </React.Fragment>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Edit Board Name */}
        <button
          onClick={() => {
            setEditingBoardTitleText(currentBoard.title);
            setIsEditingBoardTitle(true);
          }}
          className="p-1.5 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
          title="Sửa tên bảng"
        >
          <PencilLineIcon className="w-3.5 h-3.5" />
        </button>

        {/* Delete Board */}
        {boards.length > 1 && (
          <button
            onClick={() => promptDeleteBoard(currentBoard)}
            className="p-1.5 rounded-xl hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
            title="Xóa bảng này"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Create Board Button in Header */}
        {isCreatingBoard ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={newBoardTitle}
              onChange={(e) => setNewBoardTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitNewBoard();
                } else if (e.key === "Escape") {
                  setIsCreatingBoard(false);
                  setNewBoardTitle("");
                }
              }}
              placeholder="Tên bảng mới..."
              maxLength={60}
              autoFocus
              className="w-36 sm:w-44 px-2.5 py-1.5 rounded-xl bg-black/40 border border-emerald-400/50 text-xs font-bold text-white placeholder-white/40 focus:outline-none"
            />
            <button
              type="button"
              onClick={submitNewBoard}
              disabled={!newBoardTitle.trim()}
              className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 disabled:opacity-40 cursor-pointer"
            >
              Tạo
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreatingBoard(false);
                setNewBoardTitle("");
              }}
              className="p-1.5 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Hủy"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setNewBoardTitle("");
              setIsCreatingBoard(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center gap-1.5 border border-emerald-400/30 transition-all cursor-pointer"
            title="Tạo bảng mới"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tạo bảng</span>
          </button>
        )}
      </div>

      {/* Right: Search, Views, Close */}
      <div className="flex items-center gap-3">
        {/* Search Bar */}
        <div className="relative w-44 sm:w-56">
          <MagnifyingGlassIcon className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm kiếm thẻ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-full bg-black/40 border border-white/15 text-xs text-white placeholder-white/40 focus:outline-none focus:border-sky-400/50 backdrop-blur-md"
          />
          {Boolean(searchQuery) && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              <XIcon className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-full bg-black/40 border border-white/15 backdrop-blur-md">
          <button
            onClick={() => setViewMode("board")}
            className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === "board"
                ? "bg-white/20 text-white shadow-sm font-bold"
                : "text-white/60 hover:text-white"
            }`}
            title="Chế độ bảng Kanban"
          >
            <SquaresFourIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Bảng</span>
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === "list"
                ? "bg-white/20 text-white shadow-sm font-bold"
                : "text-white/60 hover:text-white"
            }`}
            title="Chế độ danh sách"
          >
            <ListIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Danh sách</span>
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all cursor-pointer"
          title="Đóng (Esc)"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});
