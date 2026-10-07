"use client";

import { Radio, X } from "lucide-react";

interface StudioHeaderProps {
  onClose: () => void;
}

export function StudioHeader({ onClose }: StudioHeaderProps) {
  return (
    <div className="relative z-10 flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-white/10 bg-white/[0.02]">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-accent-stream/15 border border-accent-stream/30 flex items-center justify-center text-accent-stream-bright">
          <Radio className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold tracking-wide text-white flex items-center gap-2">
            <span>Đài Phát & Âm Nhạc Trực Tuyến</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold bg-white/10 text-slate-300 border border-white/10">
              STUDIO
            </span>
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Đóng (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
