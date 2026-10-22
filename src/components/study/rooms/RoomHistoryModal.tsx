"use client";

import { useEffect, useState, useCallback } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import {
  ClockCounterClockwiseIcon,
  XIcon,
  TimerIcon,
  CalendarBlankIcon,
  CircleNotchIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { getMeetEndpoints } from "@/lib/meet-invite";

interface SessionItem {
  id: string;
  date: string;
  startTime: number;
  durationMinutes: number;
}

interface RoomHistoryData {
  room: string;
  month: string;
  totalMinutes: number;
  totalSessions: number;
  uniqueParticipants: number;
  sessions: SessionItem[];
}

interface RoomHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomName: string;
  getIdToken: () => Promise<string | null>;
}

export function RoomHistoryModal({
  isOpen,
  onClose,
  roomName,
  getIdToken,
}: RoomHistoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RoomHistoryData | null>(null);

  const fetchHistory = useCallback(async () => {
    const { historyUrl } = getMeetEndpoints();
    if (!historyUrl || !roomName) return;

    setLoading(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Chưa đăng nhập.");
      const now = new Date();
      const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

      const res = await fetch(
        `${historyUrl}?room=${encodeURIComponent(roomName)}&month=${encodeURIComponent(currentMonth)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        throw new Error("Không thể tải lịch sử học tập.");
      }
      const resData = await res.json();
      setData(resData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tải lịch sử thất bại");
    } finally {
      setLoading(false);
    }
  }, [roomName, getIdToken]);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, fetchHistory]);

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Lịch sử phiên học của phòng"
      backdropClassName="z-[190] bg-black/50 backdrop-blur-md"
      panelClassName="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-lg rounded-3xl bg-neutral-950/96 backdrop-blur-2xl border border-white/20 p-0 text-white shadow-[0_24px_60px_rgba(0,0,0,0.85)] z-[200] overflow-hidden max-h-[85vh] flex flex-col"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent pointer-events-none z-10" />

      <div className="relative px-5 pt-5 pb-4 border-b border-white/10 bg-white/[0.02] shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
              <ClockCounterClockwiseIcon className="w-5 h-5" weight="fill" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-white flex items-center gap-1.5 truncate">
                <span>Lịch sử học tập</span>
                <span className="text-emerald-400 font-mono truncate">{roomName}</span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Tổng hợp giờ học theo tháng (thông tin ẩn danh)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/10 text-slate-300 hover:text-white transition-colors"
            aria-label="Đóng"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
          <CircleNotchIcon className="w-6 h-6 animate-spin text-emerald-400" />
          <span className="text-xs">Đang tải lịch sử phòng học...</span>
        </div>
      ) : data ? (
        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center space-y-1">
              <span className="block text-[10px] text-slate-400 font-medium">Tổng thời lượng</span>
              <span className="text-base font-bold text-emerald-300 font-mono block">
                {data.totalMinutes} <span className="text-[11px] font-normal">phút</span>
              </span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center space-y-1">
              <span className="block text-[10px] text-slate-400 font-medium">Số lượt học</span>
              <span className="text-base font-bold text-sky-300 font-mono block">
                {data.totalSessions} <span className="text-[11px] font-normal">lượt</span>
              </span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center space-y-1">
              <span className="block text-[10px] text-slate-400 font-medium">Thành viên khác</span>
              <span className="text-base font-bold text-amber-300 font-mono block">
                {data.uniqueParticipants} <span className="text-[11px] font-normal">người</span>
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <CalendarBlankIcon className="w-4 h-4 text-emerald-400" />
              <span>Các phiên học gần nhất ({data.sessions.length})</span>
            </div>

            {data.sessions.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-center text-xs text-slate-400">
                Chưa có dữ liệu phiên học nào được ghi nhận trong tháng này.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {data.sessions.map((sess, idx) => (
                  <div
                    key={sess.id || idx}
                    className="px-3 py-2.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between text-xs hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300 font-mono text-[11px] font-bold border border-emerald-500/20">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-semibold text-slate-200">{sess.date}</div>
                        <div className="text-[10px] text-slate-500">
                          {sess.startTime > 0
                            ? new Date(sess.startTime * 1000).toLocaleTimeString("vi-VN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-emerald-300 font-bold">
                      <TimerIcon className="w-3.5 h-3.5" />
                      <span>{sess.durationMinutes} phút</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-xs text-slate-400">Không có dữ liệu.</div>
      )}
    </ModalShell>
  );
}
