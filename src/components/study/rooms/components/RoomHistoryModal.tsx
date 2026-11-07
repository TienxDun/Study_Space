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
      ariaLabel="Lịch sử phòng học"
      backdropClassName="z-[190] bg-black/60 backdrop-blur-md"
      panelClassName="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-sm sm:max-w-lg max-h-[88dvh] rounded-2xl border border-white/15 bg-neutral-950/88 text-white z-[200] flex flex-col overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.75),inset_0_1px_1.5px_rgba(255,255,255,0.18)]"
    >
      <div className="absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none z-10" />

      <div className="relative px-5 pt-4.5 pb-3.5 border-b border-white/[0.08] shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
              <ClockCounterClockwiseIcon className="w-4.5 h-4.5" weight="fill" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-white flex items-center gap-1.5 min-w-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                <span className="shrink-0">Lịch sử phòng học</span>
                <span className="text-emerald-400 font-mono truncate">{roomName}</span>
              </h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Tổng hợp giờ học theo tháng
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <XIcon className="w-3.5 h-3.5" weight="bold" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-400 flex-1">
          <CircleNotchIcon className="w-6 h-6 animate-spin text-emerald-400" />
          <span className="text-xs">Đang tải lịch sử phòng học...</span>
        </div>
      ) : data ? (
        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1 custom-study-scroll">
          <div className="grid grid-cols-3 gap-2">
            <div
              className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 py-3 text-center flex flex-col justify-between min-h-[72px]"
              title="Tổng thời lượng học"
            >
              <span className="text-[11px] text-zinc-400 font-medium truncate block leading-tight">
                Thời lượng
              </span>
              <div className="text-base font-bold text-emerald-300 font-mono tabular-nums leading-tight">
                {data.totalMinutes} <span className="text-[10px] font-normal text-emerald-300/80">phút</span>
              </div>
            </div>

            <div
              className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 py-3 text-center flex flex-col justify-between min-h-[72px]"
              title="Tổng số lượt học"
            >
              <span className="text-[11px] text-zinc-400 font-medium truncate block leading-tight">
                Lượt học
              </span>
              <div className="text-base font-bold text-zinc-200 font-mono tabular-nums leading-tight">
                {data.totalSessions} <span className="text-[10px] font-normal text-zinc-400">lượt</span>
              </div>
            </div>

            <div
              className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 py-3 text-center flex flex-col justify-between min-h-[72px]"
              title="Số thành viên khác cùng học"
            >
              <span className="text-[11px] text-zinc-400 font-medium truncate block leading-tight">
                Thành viên
              </span>
              <div className="text-base font-bold text-zinc-200 font-mono tabular-nums leading-tight">
                {data.uniqueParticipants} <span className="text-[10px] font-normal text-zinc-400">người</span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              <CalendarBlankIcon className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Các phiên học gần nhất ({data.sessions.length})</span>
            </div>

            {data.sessions.length === 0 ? (
              <div className="p-6 rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-center text-xs text-zinc-400">
                Chưa có dữ liệu phiên học nào được ghi nhận trong tháng này.
              </div>
            ) : (
              <div className="space-y-2">
                {data.sessions.map((sess, idx) => (
                  <div
                    key={sess.id || idx}
                    className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between text-xs hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300 font-mono text-[11px] font-bold border border-emerald-500/20 shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-zinc-200 truncate">{sess.date}</div>
                        <div className="text-[10px] text-zinc-500">
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
        <div className="py-8 text-center text-xs text-zinc-400 flex-1">Không có dữ liệu.</div>
      )}
    </ModalShell>
  );
}
