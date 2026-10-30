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
      backdropClassName="z-[190] bg-black/60 backdrop-blur-md"
      panelClassName="fixed inset-x-0 bottom-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:w-[92vw] sm:max-w-lg max-h-[90dvh] sm:max-h-[85vh] rounded-t-[28px] sm:rounded-2xl glass-panel p-0 text-white z-[200] flex flex-col overflow-hidden pb-safe"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent pointer-events-none z-10" />

      {/* Thanh kéo nhỏ chuẩn mobile bottom sheet */}
      <div className="pt-2.5 pb-1 flex justify-center sm:hidden shrink-0">
        <div className="h-1.5 w-12 rounded-full bg-white/20" />
      </div>

      <div className="relative px-5 pt-3 sm:pt-5 pb-4 border-b border-white/10 bg-white/[0.02] shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
              <ClockCounterClockwiseIcon className="w-5 h-5" weight="fill" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm sm:text-base font-semibold text-white flex items-center gap-1.5 min-w-0">
                <span className="shrink-0">Lịch sử học tập</span>
                <span className="text-emerald-400 font-mono truncate">{roomName}</span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Tổng hợp giờ học theo tháng
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.14] active:scale-95 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
            aria-label="Đóng"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 flex-1">
          <CircleNotchIcon className="w-6 h-6 animate-spin text-emerald-400" />
          <span className="text-xs">Đang tải lịch sử phòng học...</span>
        </div>
      ) : data ? (
        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1 custom-study-scroll">
          <div className="grid grid-cols-3 gap-2">
            <div
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 py-3 text-center flex flex-col justify-between min-h-[76px] shadow-sm"
              title="Tổng thời lượng học"
            >
              <span className="text-[11px] text-slate-400 font-medium truncate block leading-tight">
                Thời lượng
              </span>
              <div className="text-base font-bold text-emerald-300 font-mono tabular-nums leading-tight">
                {data.totalMinutes} <span className="text-[10px] font-normal text-emerald-300/80">phút</span>
              </div>
            </div>

            <div
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 py-3 text-center flex flex-col justify-between min-h-[76px] shadow-sm"
              title="Tổng số lượt học"
            >
              <span className="text-[11px] text-slate-400 font-medium truncate block leading-tight">
                Lượt học
              </span>
              <div className="text-base font-bold text-slate-200 font-mono tabular-nums leading-tight">
                {data.totalSessions} <span className="text-[10px] font-normal text-slate-400">lượt</span>
              </div>
            </div>

            <div
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 py-3 text-center flex flex-col justify-between min-h-[76px] shadow-sm"
              title="Số thành viên khác cùng học"
            >
              <span className="text-[11px] text-slate-400 font-medium truncate block leading-tight">
                Thành viên
              </span>
              <div className="text-base font-bold text-slate-200 font-mono tabular-nums leading-tight">
                {data.uniqueParticipants} <span className="text-[10px] font-normal text-slate-400">người</span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
              <CalendarBlankIcon className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Các phiên học gần nhất ({data.sessions.length})</span>
            </div>

            {data.sessions.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-center text-xs text-slate-400">
                Chưa có dữ liệu phiên học nào được ghi nhận trong tháng này.
              </div>
            ) : (
              <div className="space-y-2">
                {data.sessions.map((sess, idx) => (
                  <div
                    key={sess.id || idx}
                    className="px-3.5 py-2.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between text-xs hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300 font-mono text-[11px] font-bold border border-emerald-500/20 shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-200 truncate">{sess.date}</div>
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
                    <div className="flex items-center gap-1.5 font-mono text-emerald-300 font-bold shrink-0 ml-3">
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
        <div className="py-8 text-center text-xs text-slate-400 flex-1">Không có dữ liệu.</div>
      )}
    </ModalShell>
  );
}
